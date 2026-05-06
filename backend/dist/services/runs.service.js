"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRun = startRun;
exports.appendRunPoints = appendRunPoints;
exports.endRun = endRun;
const uuid_1 = require("uuid");
const store_1 = require("../models/store");
const geo_1 = require("../utils/geo");
const h3Geo_1 = require("../utils/h3Geo");
const antiCheat_service_1 = require("./antiCheat.service");
const tiles_service_1 = require("./tiles.service");
const users_service_1 = require("./users.service");
function startRun(userId) {
    const user = (0, users_service_1.getOrCreateUser)(userId);
    const run = {
        id: (0, uuid_1.v4)(),
        userId: user.id,
        status: 'active',
        path: [],
        distance: 0,
        duration: 0,
        startedAt: Date.now(),
        endedAt: null,
        capturedTileIds: [],
        liveTilesSnap: {},
        tileEffortPending: {},
        netTerritoryDeltaAccum: 0,
    };
    return store_1.store.saveRun(run);
}
function appendRunPoints(runId, batch) {
    const run = store_1.store.getRun(runId);
    if (!run)
        throw new Error('run_not_found');
    if (run.status !== 'active')
        throw new Error('run_not_active');
    const previousTail = run.path[run.path.length - 1] ?? null;
    const validation = (0, antiCheat_service_1.validateGpsBatch)(previousTail, batch);
    if (!validation.ok) {
        return { run, acceptedPoints: 0, rejected: { reason: validation.reason } };
    }
    let added = 0;
    let lastPoint = previousTail;
    for (const point of batch) {
        if (lastPoint) {
            run.distance += (0, geo_1.haversineMeters)(lastPoint, point);
        }
        run.path.push(point);
        lastPoint = point;
        added++;
    }
    if (run.path.length >= 2) {
        run.duration = run.path[run.path.length - 1].timestamp - run.path[0].timestamp;
    }
    let mutations;
    if (added > 0) {
        const visits = (0, tiles_service_1.segmentsToTileVisits)(previousTail, batch);
        const user = (0, users_service_1.getOrCreateUser)(run.userId);
        const pending = { ...(run.tileEffortPending ?? {}) };
        for (const v of visits) {
            pending[v.h3Index] = (pending[v.h3Index] ?? 0) + v.effort;
        }
        const { mutations: batchMutations, nextPending } = (0, tiles_service_1.consumePendingEffortIntoMutations)(pending, user);
        run.tileEffortPending = nextPending;
        let acc = run.netTerritoryDeltaAccum ?? 0;
        let snap = { ...(run.liveTilesSnap ?? {}) };
        for (const m of batchMutations) {
            snap[m.tile.h3Index] = m.tile;
            if (m.ownerChanged && m.tile.ownerId === user.id)
                acc++;
            if (m.ownerChanged && m.previousOwnerId === user.id)
                acc--;
        }
        run.liveTilesSnap = snap;
        run.netTerritoryDeltaAccum = acc;
        if (batchMutations.length > 0)
            mutations = batchMutations;
    }
    store_1.store.saveRun(run);
    return { run, acceptedPoints: added, mutations };
}
function endRun(runId) {
    const run = store_1.store.getRun(runId);
    if (!run)
        throw new Error('run_not_found');
    if (run.status !== 'active')
        throw new Error('run_not_active');
    const user = (0, users_service_1.getOrCreateUser)(run.userId);
    const pending = { ...(run.tileEffortPending ?? {}) };
    const { mutations: flushMutations, nextPending } = (0, tiles_service_1.consumePendingEffortIntoMutations)(pending, user);
    run.tileEffortPending = nextPending;
    let acc = run.netTerritoryDeltaAccum ?? 0;
    let snap = { ...(run.liveTilesSnap ?? {}) };
    for (const m of flushMutations) {
        snap[m.tile.h3Index] = m.tile;
        if (m.ownerChanged && m.tile.ownerId === user.id)
            acc++;
        if (m.ownerChanged && m.previousOwnerId === user.id)
            acc--;
    }
    run.liveTilesSnap = snap;
    run.netTerritoryDeltaAccum = acc;
    const capturedCells = Object.values(run.liveTilesSnap ?? {});
    run.capturedTileIds = capturedCells.map((t) => t.h3Index);
    run.status = 'ended';
    run.endedAt = Date.now();
    store_1.store.saveRun(run);
    user.totalDistance += run.distance;
    user.territoryCount = (0, tiles_service_1.getOwnedTileCount)(user.id);
    store_1.store.saveUser(user);
    (0, users_service_1.recomputeRanks)();
    const durationSec = Math.max(1, run.duration / 1000);
    const distanceKm = run.distance / 1000;
    const summary = {
        runId: run.id,
        userId: user.id,
        distance: run.distance,
        duration: run.duration,
        pace: distanceKm > 0 ? durationSec / 60 / distanceKm : 0,
        caloriesEstimate: Math.round(distanceKm * 65),
        capturedTiles: (0, h3Geo_1.wireTilesFromCells)(capturedCells),
        netTerritoryDelta: run.netTerritoryDeltaAccum ?? 0,
    };
    return { run, summary, mutations: flushMutations };
}
