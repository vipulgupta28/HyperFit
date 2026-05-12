import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/src/components/Text';
import MapView, { Camera, Polyline, Region } from 'react-native-maps';

import { SaveRunModal } from '@/src/components/SaveRunModal';
import { TileOverlay } from '@/src/components/TileOverlay';
import { ActivityMode, GAME, PALETTE } from '@/src/constants/game';
import { SOOTHING_DARK_MAP_STYLE } from '@/src/constants/mapStyle';
import { useRunTracker } from '@/src/hooks/useRunTracker';
import { useTilesSocket } from '@/src/hooks/useTilesSocket';
import { ApiTile, api } from '@/src/services/api';
import { useRunStore } from '@/src/store/runStore';
import { useTilesStore } from '@/src/store/tilesStore';
import { useUserStore } from '@/src/store/userStore';
import {
  boundaryOverlapsViewport,
  formatDistance,
  formatDuration,
  formatPace,
} from '@/src/utils/geo';

const FALLBACK_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const MAP_3D_PITCH = 52;
const MAP_FOLLOW_ZOOM = 17.5;

// ── Mode Toggle ────────────────────────────────────────────────────────────────

interface ModeToggleProps {
  mode: ActivityMode;
  onChange: (m: ActivityMode) => void;
  disabled: boolean;
}

function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  const slideAnim = useRef(new Animated.Value(mode === 'walk' ? 0 : 1)).current;
  const [segWidth, setSegWidth] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    setSegWidth((e.nativeEvent.layout.width - 6) / 2);
  };

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === 'walk' ? 0 : 1,
      tension: 100,
      friction: 12,
      useNativeDriver: false,
    }).start();
  }, [mode, slideAnim]);

  const indicatorX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 3 + segWidth],
  });

  return (
    <View style={styles.segControl} onLayout={handleLayout}>
      {segWidth > 0 && (
        <Animated.View
          style={[
            styles.segIndicator,
            { width: segWidth, transform: [{ translateX: indicatorX }] },
          ]}
          pointerEvents="none"
        />
      )}
      {(['walk', 'run'] as ActivityMode[]).map((m) => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            style={styles.segOption}
            onPress={() => { if (!disabled && m !== mode) onChange(m); }}
            disabled={disabled}>
           
            <Text style={[styles.segLabel, active ? styles.segLabelActive : styles.segLabelInactive]}>
              {m === 'walk' ? 'Walk' : 'Run'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Control Button ─────────────────────────────────────────────────────────────

function CtrlBtn({
  label,
  icon,
  onPress,
  variant = 'secondary',
}: {
  label: string;
  icon: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const down = () =>
    Animated.spring(scale, { toValue: 0.95, tension: 140, friction: 8, useNativeDriver: true }).start();
  const up = () =>
    Animated.spring(scale, { toValue: 1, tension: 140, friction: 8, useNativeDriver: true }).start();

  const iconColor =
    variant === 'danger' ? PALETTE.dangerMuted : variant === 'primary' ? '#000' : PALETTE.text;

  return (
    <Animated.View style={[{ flex: 1 }, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={down}
        onPressOut={up}
        style={[
          styles.ctrlBtn,
          variant === 'primary' && styles.ctrlPrimary,
          variant === 'secondary' && styles.ctrlSecondary,
          variant === 'danger' && styles.ctrlDanger,
        ]}>
        <Ionicons name={icon as never} size={16} color={iconColor} style={{ marginRight: 6 }} />
        <Text
          style={[
            styles.ctrlLabel,
            variant === 'primary' && styles.ctrlPrimaryLabel,
            variant === 'danger' && styles.ctrlDangerLabel,
          ]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Stat Item ──────────────────────────────────────────────────────────────────

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function RunScreen() {
  const { start, pause, resume, stop } = useRunTracker();
  const phase = useRunStore((s) => s.phase);
  const mode = useRunStore((s) => s.mode);
  const setMode = useRunStore((s) => s.setMode);
  const distance = useRunStore((s) => s.distance);
  const startedAt = useRunStore((s) => s.startedAt);
  const pausedAt = useRunStore((s) => s.pausedAt);
  const pausedTotalMs = useRunStore((s) => s.pausedTotalMs);
  const pendingError = useRunStore((s) => s.pendingError);
  const path = useRunStore((s) => s.path);
  const tilesMap = useTilesStore((s) => s.tiles);
  const upsertMany = useTilesStore((s) => s.upsertMany);
  const user = useUserStore((s) => s.user);

  const [region, setRegion] = useState<Region | null>(null);
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [is3D, setIs3D] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [stoppedRunId, setStoppedRunId] = useState<string | null>(null);
  const lastSummary = useRunStore((s) => s.lastSummary);
  const [zoomKey, setZoomKey] = useState(0);
  const [isZooming, setIsZooming] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const followModeRef = useRef(true);
  const lastCameraUpdate = useRef(0);
  const isZoomingRef = useRef(false);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const splashOpacity = useRef(new Animated.Value(0)).current;
  useTilesSocket();

  // ── Timer ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase]);

  const elapsed = (() => {
    if (!startedAt) return 0;
    const ref = phase === 'paused' && pausedAt ? pausedAt : now;
    return Math.max(0, ref - startedAt - pausedTotalMs);
  })();

  const modeAccent = mode === 'walk' ? PALETTE.walkPrimary : PALETTE.runPrimary;
  const isRunning = phase === 'active' || phase === 'paused';
  // km/h: distance(m) / (elapsed(ms)/1000) * 3.6 / 1000 = distance * 3.6 / elapsed * 1000... simplify: distance * 3600 / elapsed
  const avgSpeedKmh = elapsed > 2000 ? (distance * 3600) / elapsed : 0;

  // ── Location ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setPermission('denied');
        setRegion(FALLBACK_REGION);
        return;
      }
      setPermission('granted');
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          ...GAME.initialMapDelta,
        });
      } catch {
        setRegion(FALLBACK_REGION);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Run phase side-effects ───────────────────────────────────────────────────

  useEffect(() => {
    if (phase === 'active') {
      setIs3D(true);
      setFollowMode(true);
      followModeRef.current = true;
    } else if (phase === 'idle') {
      setIs3D(false);
    }
  }, [phase]);

  // ── Camera follow ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!followModeRef.current || path.length === 0 || phase !== 'active') return;
    const last = path[path.length - 1];
    const nowMs = Date.now();
    if (nowMs - lastCameraUpdate.current < 1800) return;
    lastCameraUpdate.current = nowMs;
    const camera: Camera = {
      center: { latitude: last.lat, longitude: last.lng },
      pitch: is3D ? MAP_3D_PITCH : 0,
      heading: 0,
      zoom: MAP_FOLLOW_ZOOM,
      altitude: 300,
    };
    mapRef.current?.animateCamera(camera, { duration: 1200 });
  }, [path, phase, is3D]);

  // ── Earth zoom on tab focus ──────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (phase === 'idle') {
        setZoomKey((k) => k + 1);
      }
    }, [phase]),
  );

  useEffect(() => {
    if (zoomKey === 0 || !region || !mapRef.current) return;

    zoomTimersRef.current.forEach(clearTimeout);
    zoomTimersRef.current = [];

    setIsZooming(true);
    isZoomingRef.current = true;

    // Snap to full-Earth altitude instantly, hidden behind the splash
    splashOpacity.setValue(1);
    mapRef.current.animateCamera(
      {
        center: { latitude: region.latitude, longitude: region.longitude },
        altitude: 13_500_000,
        zoom: 1,
        pitch: 0,
        heading: 0,
      },
      { duration: 0 },
    );

    // Two-stage zoom: world → city (fast), city → street (slow settle).
    // This matches the logarithmic nature of zoom so the animation feels
    // smooth rather than spending most time at continental altitudes.
    const STAGE1 = 2000; // world → city
    const STAGE2 = 2200; // city → street
    const DELAY = 200;   // time for the instant snap to register on native side

    const t1 = setTimeout(() => {
      Animated.timing(splashOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();

      mapRef.current?.animateCamera(
        {
          center: { latitude: region.latitude, longitude: region.longitude },
          altitude: 50_000,
          zoom: 13,
          pitch: 0,
          heading: 0,
        },
        { duration: STAGE1 },
      );

      const t3 = setTimeout(() => {
        mapRef.current?.animateCamera(
          {
            center: { latitude: region.latitude, longitude: region.longitude },
            altitude: 300,
            zoom: MAP_FOLLOW_ZOOM,
            pitch: 0,
            heading: 0,
          },
          { duration: STAGE2 },
        );
      }, STAGE1);

      zoomTimersRef.current.push(t3);
    }, DELAY);

    const t2 = setTimeout(() => {
      setIsZooming(false);
      isZoomingRef.current = false;
    }, DELAY + STAGE1 + STAGE2 + 300);

    zoomTimersRef.current = [t1, t2];
    return () => zoomTimersRef.current.forEach(clearTimeout);
  }, [zoomKey, region, splashOpacity]);

  // ── Tile fetching ───────────────────────────────────────────────────────────

  const fetchVisibleTiles = useCallback(
    async (r: Region) => {
      try {
        const halfLat = r.latitudeDelta / 2;
        const halfLng = r.longitudeDelta / 2;
        const { tiles } = await api.getTiles({
          minLat: r.latitude - halfLat,
          maxLat: r.latitude + halfLat,
          minLng: r.longitude - halfLng,
          maxLng: r.longitude + halfLng,
        });
        upsertMany(tiles);
      } catch {
        // non-fatal
      }
    },
    [upsertMany],
  );

  const onRegionChangeComplete = useCallback(
    (next: Region) => {
      if (isZoomingRef.current) return;
      followModeRef.current = false;
      setFollowMode(false);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(() => fetchVisibleTiles(next), 350);
    },
    [fetchVisibleTiles],
  );

  useEffect(() => {
    if (region) fetchVisibleTiles(region);
  }, [region, fetchVisibleTiles]);

  const visibleTiles = useMemo(() => {
    if (!region) return [] as ApiTile[];
    const result: ApiTile[] = [];
    for (const t of Object.values(tilesMap)) {
      if (boundaryOverlapsViewport(t.boundary, region)) result.push(t);
    }
    result.sort((a, b) => (a.ownerId ? 1 : 0) - (b.ownerId ? 1 : 0));
    return result;
  }, [tilesMap, region]);

  const pathCoords = useMemo(
    () => path.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [path],
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleStop = async () => {
    const currentRunId = useRunStore.getState().runId;
    setStoppedRunId(currentRunId);
    await stop();
    setSaveModalVisible(true);
  };

  const toggle3D = () => {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.animateCamera({ pitch: next ? MAP_3D_PITCH : 0 }, { duration: 600 });
  };

  const handleRecenter = () => {
    followModeRef.current = true;
    setFollowMode(true);
    if (path.length > 0 && phase === 'active') {
      const last = path[path.length - 1];
      mapRef.current?.animateCamera(
        {
          center: { latitude: last.lat, longitude: last.lng },
          pitch: is3D ? MAP_3D_PITCH : 0,
          zoom: MAP_FOLLOW_ZOOM,
          altitude: 300,
          heading: 0,
        },
        { duration: 800 },
      );
    } else if (region) {
      mapRef.current?.animateToRegion(region, 600);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Map — full screen */}
      {region ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={region}
          userInterfaceStyle="dark"
          customMapStyle={Platform.OS === 'android' ? SOOTHING_DARK_MAP_STYLE : undefined}
          mapType={
            Platform.OS === 'ios'
              ? isZooming
                ? 'satellite'
                : is3D && isRunning
                  ? 'hybridFlyover'
                  : 'mutedStandard'
              : 'standard'
          }
          showsUserLocation={permission === 'granted'}
          showsMyLocationButton={false}
          showsCompass={false}
          showsBuildings={is3D}
          pitchEnabled
          rotateEnabled
          onRegionChangeComplete={onRegionChangeComplete}>
          {visibleTiles.map((tile) => (
            <TileOverlay key={tile.h3Index} tile={tile} meUserId={user?.id} />
          ))}
          {pathCoords.length > 1 && (
            <Polyline
              coordinates={pathCoords}
              strokeColor={modeAccent}
              strokeWidth={4}
              lineJoin="round"
              lineCap="round"
            />
          )}
        </MapView>
      ) : (
        <View style={styles.loadingOverlay}>
          <Ionicons name="location-outline" size={32} color={PALETTE.textDim} />
          <Text style={styles.loadingText}>Finding your location…</Text>
        </View>
      )}

      {/* Earth-zoom splash — covers map during the instant camera jump */}
      <Animated.View
        style={[styles.zoomSplash, { opacity: splashOpacity }]}
        pointerEvents="none">
        <Text style={styles.zoomSplashLabel}>HYPERFIT</Text>
      </Animated.View>

      {/* Map controls — top right */}
      <View style={styles.mapControls} pointerEvents="box-none">
        <Pressable
          style={[styles.mapBtn, is3D && { borderColor: modeAccent }]}
          onPress={toggle3D}>
          <Text style={[styles.mapBtnText, is3D && { color: modeAccent }]}>3D</Text>
        </Pressable>
        {!followMode && (
          <Pressable style={styles.mapBtn} onPress={handleRecenter}>
            <Ionicons name="locate-outline" size={18} color={PALETTE.text} />
          </Pressable>
        )}
      </View>

      {/* Bottom Sheet */}
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* Error banner */}
        {pendingError && (
          <View style={styles.errorBanner}>
            <Ionicons
              name="warning-outline"
              size={13}
              color={PALETTE.dangerMuted}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.errorText} numberOfLines={2}>
              {pendingError === 'location_permission_denied'
                ? 'Location permission required.'
                : pendingError === 'gps_jump'
                  ? 'GPS jump detected — point skipped.'
                  : pendingError === 'speed_too_high'
                    ? 'Moving too fast for a run.'
                    : pendingError}
            </Text>
          </View>
        )}

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <View style={styles.idleContent}>
            <View style={styles.idleHeader}>
              <Text style={styles.idleTitle}>HYPERFIT</Text>
              <View style={[styles.modePill, { borderColor: modeAccent + '60' }]}>
                <View style={[styles.modeDot, { backgroundColor: modeAccent }]} />
                <Text style={[styles.modeText, { color: modeAccent }]}>
                  {mode === 'walk' ? 'Walk' : 'Run'}
                </Text>
              </View>
            </View>
            <ModeToggle mode={mode} onChange={setMode} disabled={false} />
            <Pressable
              style={[styles.startBtn, { backgroundColor: modeAccent }]}
              onPress={start}>
            
              <Text style={styles.startBtnLabel}>
                Start {mode === 'walk' ? 'Walk' : 'Run'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── ACTIVE / PAUSED ── */}
        {(phase === 'active' || phase === 'paused') && (
          <View style={styles.activeContent}>
            {/* Status row */}
            <View style={styles.activeHeader}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        phase === 'paused' ? PALETTE.textDim : modeAccent,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        phase === 'paused' ? PALETTE.textDim : modeAccent,
                    },
                  ]}>
                  {phase === 'paused'
                    ? 'PAUSED'
                    : mode === 'walk'
                      ? 'WALKING'
                      : 'RUNNING'}
                </Text>
              </View>
              <Text style={styles.strengthBadge}>
                +{mode === 'walk' ? '1' : '2'} STR
              </Text>
            </View>

            {/* Big timer */}
            <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
            <Text style={styles.timerLabel}>ELAPSED</Text>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatItem label="DISTANCE" value={formatDistance(distance)} />
              <View style={styles.statDiv} />
              <StatItem label="PACE" value={formatPace(distance, elapsed)} />
              <View style={styles.statDiv} />
              <StatItem
                label="AVG SPEED"
                value={avgSpeedKmh > 0 ? `${avgSpeedKmh.toFixed(1)} km/h` : '—'}
              />
            </View>

            {/* Controls */}
            <View style={styles.ctrlRow}>
              {phase === 'active' ? (
                <CtrlBtn
                  label="Pause"
                  icon="pause"
                  onPress={pause}
                  variant="secondary"
                />
              ) : (
                <CtrlBtn
                  label="Resume"
                  icon="play"
                  onPress={resume}
                  variant="primary"
                />
              )}
              <CtrlBtn
                label="Stop"
                icon="stop"
                onPress={handleStop}
                variant="danger"
              />
            </View>
          </View>
        )}

        {/* ── ENDING ── */}
        {phase === 'ending' && (
          <View style={styles.endingContent}>
            <Ionicons
              name="checkmark-circle-outline"
              size={36}
              color={modeAccent}
            />
            <Text style={styles.endingTitle}>Capturing tiles…</Text>
            <Text style={styles.endingSub}>
              Calculating territory gains
            </Text>
          </View>
        )}
      </View>

      {/* Save run modal — rendered outside the sheet so it covers everything */}
      <SaveRunModal
        visible={saveModalVisible}
        summary={lastSummary}
        runId={stoppedRunId}
        mode={mode}
        onDone={() => setSaveModalVisible(false)}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.background },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: PALETTE.textMuted, fontSize: 15 },

  // Map controls
  mapControls: {
    position: 'absolute',
    top: 60,
    right: 16,
    gap: 8,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnText: { color: PALETTE.text, fontWeight: '700', fontSize: 12 },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8,8,8,0.97)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,113,113,0.25)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  errorText: {
    color: PALETTE.dangerMuted,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },

  // Idle content
  idleContent: { gap: 12, paddingBottom: 4 },
  idleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idleTitle: {
    color: PALETTE.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  // Start button
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 100,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  startBtnLabel: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Active / Paused content
  activeContent: { gap: 2, paddingBottom: 4 },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  strengthBadge: {
    color: PALETTE.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Timer
  timer: {
    color: PALETTE.text,
    fontSize: 72,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: -4,
    lineHeight: 78,
    textAlign: 'center',
  },
  timerLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 10,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: {
    color: PALETTE.text,
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statDiv: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: PALETTE.border,
    marginHorizontal: 4,
  },

  // Control row
  ctrlRow: { flexDirection: 'row', gap: 10, height: 54 },
  ctrlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  ctrlPrimary: { backgroundColor: PALETTE.text },
  ctrlPrimaryLabel: { color: '#000' },
  ctrlSecondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ctrlDanger: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,113,113,0.4)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  ctrlDangerLabel: { color: PALETTE.dangerMuted },
  ctrlLabel: {
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
    color: PALETTE.text,
  },

  // Ending
  endingContent: {
    alignItems: 'center',
    paddingVertical: 22,
    gap: 8,
  },
  endingTitle: {
    color: PALETTE.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  endingSub: { color: PALETTE.textDim, fontSize: 13 },

  // Segmented control
  segControl: {
    flexDirection: 'row',
    backgroundColor: PALETTE.surfaceElevated,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 3,
    height: 48,
    position: 'relative',
  },
  segIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 100,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.borderLight,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 1,
  },
  segLabel: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  segLabelActive: { color: '#000' },
  segLabelInactive: { color: PALETTE.textDim },

  // Earth-zoom splash
  zoomSplash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PALETTE.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  zoomSplashLabel: {
    color: PALETTE.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 7,
  },
});
