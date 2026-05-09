import * as Location from 'expo-location';
import { useCallback, useEffect, useRef } from 'react';

import { GAME } from '../constants/game';
import { api, GpsPointPayload } from '../services/api';
import { useRunStore } from '../store/runStore';
import { useUserStore } from '../store/userStore';
import { haversineMeters } from '../utils/geo';

interface UseRunTrackerResult {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
}

const SUDDEN_JUMP_M = 200;

function smoothGpsPoint(
  newPt: GpsPointPayload,
  prev: GpsPointPayload | null,
): GpsPointPayload {
  if (!prev) return newPt;
  const α = GAME.gpsEmaAlpha;
  return {
    lat: α * newPt.lat + (1 - α) * prev.lat,
    lng: α * newPt.lng + (1 - α) * prev.lng,
    timestamp: newPt.timestamp,
  };
}

export function useRunTracker(): UseRunTrackerResult {
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endingRef = useRef(false);
  const smoothedRef = useRef<GpsPointPayload | null>(null);

  const refreshUser = useUserStore((s) => s.refreshUser);

  const flush = useCallback(async () => {
    const { runId, consumeBuffer, setError } = useRunStore.getState();
    if (!runId) return;
    const batch = consumeBuffer();
    if (batch.length === 0) return;
    try {
      const res = await api.updateRun(runId, batch);
      if (res.rejected) setError(res.rejected.reason);
      else setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    }
  }, []);

  const stopWatching = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    smoothedRef.current = null;
  }, []);

  const beginWatching = useCallback(async () => {
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: GAME.gpsIntervalMs,
        distanceInterval: 3,
      },
      (location) => {
        const { phase, path, pushPoint } = useRunStore.getState();
        if (phase !== 'active') return;

        // Reject poor accuracy readings
        if (
          location.coords.accuracy != null &&
          location.coords.accuracy > GAME.gpsAccuracyFilterM
        ) {
          return;
        }

        const raw: GpsPointPayload = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          timestamp: location.timestamp ?? Date.now(),
        };

        const last = path[path.length - 1];

        // Reject teleportation jumps
        if (last) {
          const jump = haversineMeters(
            { latitude: last.lat, longitude: last.lng },
            { latitude: raw.lat, longitude: raw.lng },
          );
          if (jump > SUDDEN_JUMP_M) return;
        }

        // EMA smoothing to reduce GPS jitter
        const smoothed = smoothGpsPoint(raw, smoothedRef.current);
        smoothedRef.current = smoothed;

        const delta = last
          ? haversineMeters(
              { latitude: last.lat, longitude: last.lng },
              { latitude: smoothed.lat, longitude: smoothed.lng },
            )
          : 0;

        if (delta > 0 || !last) {
          pushPoint(smoothed, delta);
        }
      },
    );
    subRef.current = sub;
    flushTimerRef.current = setInterval(flush, GAME.gpsIntervalMs * 2);
  }, [flush]);

  const start = useCallback(async () => {
    if (useRunStore.getState().phase !== 'idle') return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      useRunStore.getState().setError('location_permission_denied');
      return;
    }

    const user = useUserStore.getState().user;
    if (!user) {
      useRunStore.getState().setError('not_authenticated');
      return;
    }
    const mode = useRunStore.getState().mode;
    const { run } = await api.startRun(user.id, mode);
    useRunStore.getState().beginRun(run.id);
    await beginWatching();
  }, [beginWatching]);

  const pause = useCallback(() => {
    useRunStore.getState().pause();
  }, []);

  const resume = useCallback(() => {
    useRunStore.getState().resume();
  }, []);

  const stop = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      const { runId, setSummary, setPhase, reset } = useRunStore.getState();
      if (!runId) {
        reset();
        return;
      }
      setPhase('ending');
      await flush();
      const { summary } = await api.endRun(runId);
      setSummary(summary);
      reset();
      setSummary(summary);
      await refreshUser();
    } catch (err) {
      useRunStore
        .getState()
        .setError(err instanceof Error ? err.message : 'end_run_failed');
    } finally {
      stopWatching();
      endingRef.current = false;
    }
  }, [flush, refreshUser, stopWatching]);

  useEffect(() => {
    return () => stopWatching();
  }, [stopWatching]);

  return { start, pause, resume, stop };
}
