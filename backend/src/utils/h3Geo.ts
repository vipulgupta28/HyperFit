import {
  cellToBoundary,
  gridDisk,
  isValidCell,
  latLngToCell,
  polygonToCells,
} from 'h3-js';

import { config } from '../config';
import { BoundingBox, Tile, WireTile } from '../models/types';

export const H3_RES = config.h3Resolution;

const LEGACY_TILE_SIZE_DEG = 0.0005;

const bboxCellCache = new Map<string, string[]>();
const MAX_BBOX_CACHE_ENTRIES = 48;

function quantizeBboxKey(b: BoundingBox): string {
  const q = (n: number) => n.toFixed(5);
  return `${q(b.minLat)},${q(b.minLng)},${q(b.maxLat)},${q(b.maxLng)}`;
}

/** Neighbor cells within `radius` steps (H3 k-ring / gridDisk). */
export function h3KRing(h3Index: string, radius: number): string[] {
  return gridDisk(h3Index, radius);
}

export function latLngToH3Index(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RES);
}

export function legacyTileKeyToH3(tileKey: string): string | null {
  const m = /^(-?\d+):(-?\d+)$/.exec(tileKey.trim());
  if (!m) return null;
  const tileX = Number(m[1]);
  const tileY = Number(m[2]);
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;
  const minLat = tileX * LEGACY_TILE_SIZE_DEG;
  const minLng = tileY * LEGACY_TILE_SIZE_DEG;
  const lat = minLat + LEGACY_TILE_SIZE_DEG / 2;
  const lng = minLng + LEGACY_TILE_SIZE_DEG / 2;
  return latLngToCell(lat, lng, H3_RES);
}

export function normalizeLegacyPendingEffort(
  pending: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(pending)) {
    let key = k;
    if (!isValidCell(k)) {
      const migrated = legacyTileKeyToH3(k);
      if (!migrated) continue;
      key = migrated;
    }
    out[key] = (out[key] ?? 0) + v;
  }
  return out;
}

/**
 * H3 cells whose centers fall inside the bbox rectangle.
 * Cached on quantized bbox for pan/zoom bursts.
 */
export function h3IndexesForBoundingBox(bbox: BoundingBox): string[] {
  const key = quantizeBboxKey(bbox);
  const hit = bboxCellCache.get(key);
  if (hit) return hit;

  const { minLat, minLng, maxLat, maxLng } = bbox;
  const ring: [number, number][] = [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, maxLng],
    [maxLat, minLng],
    [minLat, minLng],
  ];

  const cells = polygonToCells(ring, H3_RES, false);

  if (bboxCellCache.size >= MAX_BBOX_CACHE_ENTRIES) {
    const firstKey = bboxCellCache.keys().next().value as string | undefined;
    if (firstKey) bboxCellCache.delete(firstKey);
  }
  bboxCellCache.set(key, cells);
  return cells;
}

export function wireTileFromCell(tile: Tile): WireTile {
  const ring = cellToBoundary(tile.h3Index, false);
  return {
    ...tile,
    boundary: ring.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
  };
}

export function wireTilesFromCells(tiles: Tile[]): WireTile[] {
  return tiles.map(wireTileFromCell);
}
