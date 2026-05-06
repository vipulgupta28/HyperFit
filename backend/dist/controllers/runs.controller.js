"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postRunStart = postRunStart;
exports.postRunUpdate = postRunUpdate;
exports.postRunEnd = postRunEnd;
const runs_service_1 = require("../services/runs.service");
const tiles_service_1 = require("../services/tiles.service");
const users_service_1 = require("../services/users.service");
const sockets_1 = require("../sockets");
const h3Geo_1 = require("../utils/h3Geo");
function postRunStart(req, res) {
    const userId = req.body?.userId ?? req.body?.username;
    const user = (0, users_service_1.getOrCreateUser)(userId);
    const run = (0, runs_service_1.startRun)(user.id);
    res.status(201).json({ run, user });
}
function postRunUpdate(req, res) {
    const { runId, points } = req.body;
    if (!runId || !Array.isArray(points)) {
        res.status(400).json({ error: 'invalid_payload' });
        return;
    }
    const result = (0, runs_service_1.appendRunPoints)(runId, points);
    if (result.mutations && result.mutations.length > 0) {
        (0, sockets_1.emitTileUpdates)((0, h3Geo_1.wireTilesFromCells)(result.mutations.map((m) => m.tile)));
        (0, sockets_1.emitTerritoryChanged)(result.run.userId, (0, tiles_service_1.getOwnedTileCount)(result.run.userId));
    }
    res.json(result);
}
function postRunEnd(req, res) {
    const { runId } = req.body;
    if (!runId) {
        res.status(400).json({ error: 'invalid_payload' });
        return;
    }
    const { run, summary, mutations } = (0, runs_service_1.endRun)(runId);
    if (mutations.length > 0) {
        (0, sockets_1.emitTileUpdates)((0, h3Geo_1.wireTilesFromCells)(mutations.map((m) => m.tile)));
    }
    (0, sockets_1.emitTerritoryChanged)(run.userId, (0, tiles_service_1.getOwnedTileCount)(run.userId));
    res.json({ run, summary });
}
