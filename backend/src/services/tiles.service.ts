import { isValidCell } from 'h3-js';

import { config } from '../config';
import { store } from '../models/store';
import { ActivityMode, BoundingBox, GpsPoint, Tile, User } from '../models/types';
import { haversineMeters } from '../utils/geo';
import {
  h3IndexesForBoundingBox,
  latLngToH3Index,
  normalizeLegacyPendingEffort,
} from '../utils/h3Geo';

export interface TileVisit {
  h3Index: string;
  timeInTileMs: number;
  distanceInTileM: number;
  effort: number;
}

/**
 * Walk a GPS path and build a per-cell visit summary. Each visit captures
 * how long the runner stayed inside the H3 cell and how much distance they
 * covered there — feeding the effort calculation.
 */
export function pathToTileVisits(path: GpsPoint[]): TileVisit[] {
  if (path.length < 2) return [];

  const visits = new Map<string, TileVisit>();

  const ensure = (h3Index: string): TileVisit => {
    let v = visits.get(h3Index);
    if (!v) {
      v = { h3Index, timeInTileMs: 0, distanceInTileM: 0, effort: 0 };
      visits.set(h3Index, v);
    }
    return v;
  };

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];

    const segMeters = haversineMeters(prev, curr);
    const segMs = Math.max(0, curr.timestamp - prev.timestamp);

    const pCell = latLngToH3Index(prev.lat, prev.lng);
    const cCell = latLngToH3Index(curr.lat, curr.lng);

    if (pCell === cCell) {
      const v = ensure(pCell);
      v.distanceInTileM += segMeters;
      v.timeInTileMs += segMs;
    } else {
      // Split a segment crossing cell boundaries half-and-half — same MVP
      // tradeoff as the old grid system; full edge-aware splitting can use
      // h3 line algorithms if needed later.
      const a = ensure(pCell);
      const b = ensure(cCell);
      a.distanceInTileM += segMeters / 2;
      a.timeInTileMs += segMs / 2;
      b.distanceInTileM += segMeters / 2;
      b.timeInTileMs += segMs / 2;
    }
  }

  for (const v of visits.values()) {
    v.effort =
      v.timeInTileMs * config.effortWeights.time +
      v.distanceInTileM * config.effortWeights.distance;
  }

  return [...visits.values()];
}

/**
 * GPS segments introduced by the latest batch only (previous tail → new points).
 * Same rules as {@link pathToTileVisits} but avoids reprocessing the full path.
 */
export function segmentsToTileVisits(
  previousTail: GpsPoint | null,
  batch: GpsPoint[],
): TileVisit[] {
  if (batch.length === 0) return [];
  const points =
    previousTail !== null
      ? [previousTail, ...batch]
      : batch.length >= 2
        ? batch
        : [];
  if (points.length < 2) return [];
  return pathToTileVisits(points);
}

export function strengthDeltaFromEffort(effort: number): number {
  const raw = Math.round(effort / config.effortPerStrengthPoint);
  return Math.min(config.maxStrengthDeltaPerApply, Math.max(1, raw));
}

/**
 * Fold pending per-cell effort into mutations wherever threshold is met.
 * Clears consumed buckets; normalizes legacy `tileX:tileY` keys to H3 once.
 */
export function consumePendingEffortIntoMutations(
  pending: Record<string, number>,
  user: User,
  mode: ActivityMode = 'run',
): { mutations: TileMutation[]; nextPending: Record<string, number> } {
  const nextPending = normalizeLegacyPendingEffort(pending);
  const mutations: TileMutation[] = [];

  for (const h3Index of Object.keys(nextPending)) {
    if (!isValidCell(h3Index)) {
      delete nextPending[h3Index];
      continue;
    }
    while ((nextPending[h3Index] ?? 0) >= config.minTileEffortToApply) {
      const total = nextPending[h3Index]!;
      const delta = strengthDeltaFromEffort(total);

      mutations.push(applyStrengthDeltaToTile(h3Index, user, delta, mode));

      const spent = Math.min(
        total,
        Math.max(config.minTileEffortToApply, delta * config.effortPerStrengthPoint),
      );
      nextPending[h3Index] = total - spent;
    }
  }

  return { mutations, nextPending };
}

export interface TileMutation {
  tile: Tile;
  previousOwnerId: string | null;
  ownerChanged: boolean;
}

/**
 * Apply a territory mutation shaped by accumulated GPS effort (delta ∈ [1, max]).
 * Neutral cells become owned at {@link config.baseStrength}; same owner gains delta;
 * rival loses delta and may flip when strength hits zero or below.
 */
export function applyStrengthDeltaToTile(
  h3Index: string,
  user: User,
  strengthDelta: number,
  mode: ActivityMode = 'run',
): TileMutation {
  const existing = store.getTile(h3Index);
  const previousOwnerId = existing?.ownerId ?? null;
  const now = Date.now();

  const delta = Math.min(
    config.maxStrengthDeltaPerApply,
    Math.max(1, Math.round(strengthDelta)),
  );

  let nextTile: Tile;

  if (!existing || existing.ownerId === null) {
    const claimStrength = mode === 'walk' ? config.walkBaseStrength : config.runBaseStrength;
    nextTile = {
      h3Index,
      ownerId: user.id,
      ownerColor: user.color,
      strength: claimStrength,
      lastUpdated: now,
    };
  } else if (existing.ownerId === user.id) {
    nextTile = {
      ...existing,
      strength: Math.min(existing.strength + delta, config.maxStrength),
      lastUpdated: now,
    };
  } else {
    const newStrength = existing.strength - delta;
    if (newStrength <= 0) {
      nextTile = {
        ...existing,
        ownerId: user.id,
        ownerColor: user.color,
        strength: config.baseStrength,
        lastUpdated: now,
      };
    } else {
      nextTile = { ...existing, strength: newStrength, lastUpdated: now };
    }
  }

  store.saveTile(nextTile);
  return {
    tile: nextTile,
    previousOwnerId,
    ownerChanged: previousOwnerId !== nextTile.ownerId,
  };
}

/**
 * All H3 resolution-10 cells whose centers fall in `bbox`, each with persisted
 * territory data when present — otherwise an empty/neutral stub so clients can
 * draw the full hex grid (outline + fills for claimed cells).
 */
export function getTilesInBoundingBox(bbox: BoundingBox): Tile[] {
  const indexes = h3IndexesForBoundingBox(bbox);
  const out: Tile[] = [];
  for (const h3Index of indexes) {
    const existing = store.getTile(h3Index);
    out.push(
      existing ?? {
        h3Index,
        ownerId: null,
        ownerColor: null,
        strength: 0,
        lastUpdated: 0,
      },
    );
  }
  return out;
}

export function getOwnedTileCount(userId: string): number {
  return store.listTiles().filter((t) => t.ownerId === userId).length;
}

/**
 * Background decay: every cell loses a bit of strength over time. Hits zero?
 * The cell becomes neutral and is up for grabs again.
 */
export function decayAllTiles(amount = config.decay.amount): Tile[] {
  const changed: Tile[] = [];
  for (const tile of store.listTiles()) {
    if (tile.ownerId === null) continue;
    const nextStrength = tile.strength - amount;
    if (nextStrength <= 0) {
      changed.push(
        store.saveTile({
          ...tile,
          ownerId: null,
          ownerColor: null,
          strength: 0,
          lastUpdated: Date.now(),
        }),
      );
    } else {
      changed.push(
        store.saveTile({ ...tile, strength: nextStrength, lastUpdated: Date.now() }),
      );
    }
  }
  return changed;
}
