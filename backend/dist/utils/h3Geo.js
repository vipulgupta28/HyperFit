"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.H3_RES = void 0;
exports.h3KRing = h3KRing;
exports.latLngToH3Index = latLngToH3Index;
exports.legacyTileKeyToH3 = legacyTileKeyToH3;
exports.normalizeLegacyPendingEffort = normalizeLegacyPendingEffort;
exports.h3IndexesForBoundingBox = h3IndexesForBoundingBox;
exports.wireTileFromCell = wireTileFromCell;
exports.wireTilesFromCells = wireTilesFromCells;
const h3_js_1 = require("h3-js");
const config_1 = require("../config");
exports.H3_RES = config_1.config.h3Resolution;
const LEGACY_TILE_SIZE_DEG = 0.0005;
const bboxCellCache = new Map();
const MAX_BBOX_CACHE_ENTRIES = 48;
function quantizeBboxKey(b) {
    const q = (n) => n.toFixed(5);
    return `${q(b.minLat)},${q(b.minLng)},${q(b.maxLat)},${q(b.maxLng)}`;
}
/** Neighbor cells within `radius` steps (H3 k-ring / gridDisk). */
function h3KRing(h3Index, radius) {
    return (0, h3_js_1.gridDisk)(h3Index, radius);
}
function latLngToH3Index(lat, lng) {
    return (0, h3_js_1.latLngToCell)(lat, lng, exports.H3_RES);
}
function legacyTileKeyToH3(tileKey) {
    const m = /^(-?\d+):(-?\d+)$/.exec(tileKey.trim());
    if (!m)
        return null;
    const tileX = Number(m[1]);
    const tileY = Number(m[2]);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY))
        return null;
    const minLat = tileX * LEGACY_TILE_SIZE_DEG;
    const minLng = tileY * LEGACY_TILE_SIZE_DEG;
    const lat = minLat + LEGACY_TILE_SIZE_DEG / 2;
    const lng = minLng + LEGACY_TILE_SIZE_DEG / 2;
    return (0, h3_js_1.latLngToCell)(lat, lng, exports.H3_RES);
}
function normalizeLegacyPendingEffort(pending) {
    const out = {};
    for (const [k, v] of Object.entries(pending)) {
        let key = k;
        if (!(0, h3_js_1.isValidCell)(k)) {
            const migrated = legacyTileKeyToH3(k);
            if (!migrated)
                continue;
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
function h3IndexesForBoundingBox(bbox) {
    const key = quantizeBboxKey(bbox);
    const hit = bboxCellCache.get(key);
    if (hit)
        return hit;
    const { minLat, minLng, maxLat, maxLng } = bbox;
    const ring = [
        [minLat, minLng],
        [minLat, maxLng],
        [maxLat, maxLng],
        [maxLat, minLng],
        [minLat, minLng],
    ];
    const cells = (0, h3_js_1.polygonToCells)(ring, exports.H3_RES, false);
    if (bboxCellCache.size >= MAX_BBOX_CACHE_ENTRIES) {
        const firstKey = bboxCellCache.keys().next().value;
        if (firstKey)
            bboxCellCache.delete(firstKey);
    }
    bboxCellCache.set(key, cells);
    return cells;
}
function wireTileFromCell(tile) {
    const ring = (0, h3_js_1.cellToBoundary)(tile.h3Index, false);
    return {
        ...tile,
        boundary: ring.map(([lat, lng]) => ({ latitude: lat, longitude: lng })),
    };
}
function wireTilesFromCells(tiles) {
    return tiles.map(wireTileFromCell);
}
