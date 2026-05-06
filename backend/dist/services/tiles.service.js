"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathToTileVisits = pathToTileVisits;
exports.segmentsToTileVisits = segmentsToTileVisits;
exports.strengthDeltaFromEffort = strengthDeltaFromEffort;
exports.consumePendingEffortIntoMutations = consumePendingEffortIntoMutations;
exports.applyStrengthDeltaToTile = applyStrengthDeltaToTile;
exports.getTilesInBoundingBox = getTilesInBoundingBox;
exports.getOwnedTileCount = getOwnedTileCount;
exports.decayAllTiles = decayAllTiles;
const h3_js_1 = require("h3-js");
const config_1 = require("../config");
const store_1 = require("../models/store");
const geo_1 = require("../utils/geo");
const h3Geo_1 = require("../utils/h3Geo");
/**
 * Walk a GPS path and build a per-cell visit summary. Each visit captures
 * how long the runner stayed inside the H3 cell and how much distance they
 * covered there — feeding the effort calculation.
 */
function pathToTileVisits(path) {
    if (path.length < 2)
        return [];
    const visits = new Map();
    const ensure = (h3Index) => {
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
        const segMeters = (0, geo_1.haversineMeters)(prev, curr);
        const segMs = Math.max(0, curr.timestamp - prev.timestamp);
        const pCell = (0, h3Geo_1.latLngToH3Index)(prev.lat, prev.lng);
        const cCell = (0, h3Geo_1.latLngToH3Index)(curr.lat, curr.lng);
        if (pCell === cCell) {
            const v = ensure(pCell);
            v.distanceInTileM += segMeters;
            v.timeInTileMs += segMs;
        }
        else {
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
            v.timeInTileMs * config_1.config.effortWeights.time +
                v.distanceInTileM * config_1.config.effortWeights.distance;
    }
    return [...visits.values()];
}
/**
 * GPS segments introduced by the latest batch only (previous tail → new points).
 * Same rules as {@link pathToTileVisits} but avoids reprocessing the full path.
 */
function segmentsToTileVisits(previousTail, batch) {
    if (batch.length === 0)
        return [];
    const points = previousTail !== null
        ? [previousTail, ...batch]
        : batch.length >= 2
            ? batch
            : [];
    if (points.length < 2)
        return [];
    return pathToTileVisits(points);
}
function strengthDeltaFromEffort(effort) {
    const raw = Math.round(effort / config_1.config.effortPerStrengthPoint);
    return Math.min(config_1.config.maxStrengthDeltaPerApply, Math.max(1, raw));
}
/**
 * Fold pending per-cell effort into mutations wherever threshold is met.
 * Clears consumed buckets; normalizes legacy `tileX:tileY` keys to H3 once.
 */
function consumePendingEffortIntoMutations(pending, user) {
    const nextPending = (0, h3Geo_1.normalizeLegacyPendingEffort)(pending);
    const mutations = [];
    for (const h3Index of Object.keys(nextPending)) {
        if (!(0, h3_js_1.isValidCell)(h3Index)) {
            delete nextPending[h3Index];
            continue;
        }
        while ((nextPending[h3Index] ?? 0) >= config_1.config.minTileEffortToApply) {
            const total = nextPending[h3Index];
            const delta = strengthDeltaFromEffort(total);
            mutations.push(applyStrengthDeltaToTile(h3Index, user, delta));
            const spent = Math.min(total, Math.max(config_1.config.minTileEffortToApply, delta * config_1.config.effortPerStrengthPoint));
            nextPending[h3Index] = total - spent;
        }
    }
    return { mutations, nextPending };
}
/**
 * Apply a territory mutation shaped by accumulated GPS effort (delta ∈ [1, max]).
 * Neutral cells become owned at {@link config.baseStrength}; same owner gains delta;
 * rival loses delta and may flip when strength hits zero or below.
 */
function applyStrengthDeltaToTile(h3Index, user, strengthDelta) {
    const existing = store_1.store.getTile(h3Index);
    const previousOwnerId = existing?.ownerId ?? null;
    const now = Date.now();
    const delta = Math.min(config_1.config.maxStrengthDeltaPerApply, Math.max(1, Math.round(strengthDelta)));
    let nextTile;
    if (!existing || existing.ownerId === null) {
        nextTile = {
            h3Index,
            ownerId: user.id,
            ownerColor: user.color,
            strength: config_1.config.baseStrength,
            lastUpdated: now,
        };
    }
    else if (existing.ownerId === user.id) {
        nextTile = {
            ...existing,
            strength: Math.min(existing.strength + delta, config_1.config.maxStrength),
            lastUpdated: now,
        };
    }
    else {
        const newStrength = existing.strength - delta;
        if (newStrength <= 0) {
            nextTile = {
                ...existing,
                ownerId: user.id,
                ownerColor: user.color,
                strength: config_1.config.baseStrength,
                lastUpdated: now,
            };
        }
        else {
            nextTile = { ...existing, strength: newStrength, lastUpdated: now };
        }
    }
    store_1.store.saveTile(nextTile);
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
function getTilesInBoundingBox(bbox) {
    const indexes = (0, h3Geo_1.h3IndexesForBoundingBox)(bbox);
    const out = [];
    for (const h3Index of indexes) {
        const existing = store_1.store.getTile(h3Index);
        out.push(existing ?? {
            h3Index,
            ownerId: null,
            ownerColor: null,
            strength: 0,
            lastUpdated: 0,
        });
    }
    return out;
}
function getOwnedTileCount(userId) {
    return store_1.store.listTiles().filter((t) => t.ownerId === userId).length;
}
/**
 * Background decay: every cell loses a bit of strength over time. Hits zero?
 * The cell becomes neutral and is up for grabs again.
 */
function decayAllTiles(amount = config_1.config.decay.amount) {
    const changed = [];
    for (const tile of store_1.store.listTiles()) {
        if (tile.ownerId === null)
            continue;
        const nextStrength = tile.strength - amount;
        if (nextStrength <= 0) {
            changed.push(store_1.store.saveTile({
                ...tile,
                ownerId: null,
                ownerColor: null,
                strength: 0,
                lastUpdated: Date.now(),
            }));
        }
        else {
            changed.push(store_1.store.saveTile({ ...tile, strength: nextStrength, lastUpdated: Date.now() }));
        }
    }
    return changed;
}
