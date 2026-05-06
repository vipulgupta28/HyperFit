import { v4 as uuid } from 'uuid';

import { store } from '../models/store';
import { ActivityMode, GpsPoint, Run, RunSummary, Tile } from '../models/types';
import { haversineMeters } from '../utils/geo';
import { wireTilesFromCells } from '../utils/h3Geo';
import { validateGpsBatch } from './antiCheat.service';
import {
  consumePendingEffortIntoMutations,
  getOwnedTileCount,
  segmentsToTileVisits,
  TileMutation,
} from './tiles.service';
import { getOrCreateUser, recomputeRanks } from './users.service';

export function startRun(userId: string, mode: ActivityMode = 'run'): Run {
  const user = getOrCreateUser(userId);
  const run: Run = {
    id: uuid(),
    userId: user.id,
    status: 'active',
    path: [],
    distance: 0,
    duration: 0,
    startedAt: Date.now(),
    endedAt: null,
    capturedTileIds: [],
    mode,
    liveTilesSnap: {},
    tileEffortPending: {},
    netTerritoryDeltaAccum: 0,
  };
  return store.saveRun(run);
}

export interface UpdateRunResult {
  run: Run;
  acceptedPoints: number;
  mutations?: TileMutation[];
  rejected?: { reason: string };
}

export function appendRunPoints(
  runId: string,
  batch: GpsPoint[],
): UpdateRunResult {
  const run = store.getRun(runId);
  if (!run) throw new Error('run_not_found');
  if (run.status !== 'active') throw new Error('run_not_active');

  const previousTail = run.path[run.path.length - 1] ?? null;
  const validation = validateGpsBatch(previousTail, batch);
  if (!validation.ok) {
    return { run, acceptedPoints: 0, rejected: { reason: validation.reason! } };
  }

  let added = 0;
  let lastPoint = previousTail;
  for (const point of batch) {
    if (lastPoint) {
      run.distance += haversineMeters(lastPoint, point);
    }
    run.path.push(point);
    lastPoint = point;
    added++;
  }
  if (run.path.length >= 2) {
    run.duration = run.path[run.path.length - 1].timestamp - run.path[0].timestamp;
  }

  let mutations: TileMutation[] | undefined;

  if (added > 0) {
    const visits = segmentsToTileVisits(previousTail, batch);
    const user = getOrCreateUser(run.userId);

    const pending = { ...(run.tileEffortPending ?? {}) };
    for (const v of visits) {
      pending[v.h3Index] = (pending[v.h3Index] ?? 0) + v.effort;
    }

    const { mutations: batchMutations, nextPending } =
      consumePendingEffortIntoMutations(pending, user, run.mode ?? 'run');
    run.tileEffortPending = nextPending;

    let acc = run.netTerritoryDeltaAccum ?? 0;
    let snap = { ...(run.liveTilesSnap ?? {}) };
    for (const m of batchMutations) {
      snap[m.tile.h3Index] = m.tile;
      if (m.ownerChanged && m.tile.ownerId === user.id) acc++;
      if (m.ownerChanged && m.previousOwnerId === user.id) acc--;
    }
    run.liveTilesSnap = snap;
    run.netTerritoryDeltaAccum = acc;

    if (batchMutations.length > 0) mutations = batchMutations;
  }

  store.saveRun(run);
  return { run, acceptedPoints: added, mutations };
}

export interface EndRunResult {
  run: Run;
  summary: RunSummary;
  mutations: TileMutation[];
}

export function endRun(runId: string): EndRunResult {
  const run = store.getRun(runId);
  if (!run) throw new Error('run_not_found');
  if (run.status !== 'active') throw new Error('run_not_active');

  const user = getOrCreateUser(run.userId);

  const pending = { ...(run.tileEffortPending ?? {}) };
  const { mutations: flushMutations, nextPending } =
    consumePendingEffortIntoMutations(pending, user, run.mode ?? 'run');
  run.tileEffortPending = nextPending;

  let acc = run.netTerritoryDeltaAccum ?? 0;
  let snap = { ...(run.liveTilesSnap ?? {}) };
  for (const m of flushMutations) {
    snap[m.tile.h3Index] = m.tile;
    if (m.ownerChanged && m.tile.ownerId === user.id) acc++;
    if (m.ownerChanged && m.previousOwnerId === user.id) acc--;
  }
  run.liveTilesSnap = snap;
  run.netTerritoryDeltaAccum = acc;

  const capturedCells: Tile[] = Object.values(run.liveTilesSnap ?? {});
  run.capturedTileIds = capturedCells.map((t) => t.h3Index);

  run.status = 'ended';
  run.endedAt = Date.now();
  store.saveRun(run);

  user.totalDistance += run.distance;
  user.territoryCount = getOwnedTileCount(user.id);
  store.saveUser(user);
  recomputeRanks();

  const durationSec = Math.max(1, run.duration / 1000);
  const distanceKm = run.distance / 1000;

  const summary: RunSummary = {
    runId: run.id,
    userId: user.id,
    distance: run.distance,
    duration: run.duration,
    pace: distanceKm > 0 ? durationSec / 60 / distanceKm : 0,
    caloriesEstimate: Math.round(distanceKm * 65),
    capturedTiles: wireTilesFromCells(capturedCells),
    netTerritoryDelta: run.netTerritoryDeltaAccum ?? 0,
  };

  return { run, summary, mutations: flushMutations };
}
