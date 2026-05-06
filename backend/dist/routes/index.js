"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const runs_controller_1 = require("../controllers/runs.controller");
const tiles_controller_1 = require("../controllers/tiles.controller");
const users_controller_1 = require("../controllers/users.controller");
exports.router = (0, express_1.Router)();
exports.router.get('/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
});
exports.router.post('/run/start', runs_controller_1.postRunStart);
exports.router.post('/run/update', runs_controller_1.postRunUpdate);
exports.router.post('/run/end', runs_controller_1.postRunEnd);
exports.router.get('/tiles', tiles_controller_1.getTiles);
exports.router.get('/leaderboard', users_controller_1.getLeaderboardHandler);
exports.router.get('/users/:id', users_controller_1.getUserHandler);
