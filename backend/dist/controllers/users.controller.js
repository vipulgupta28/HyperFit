"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaderboardHandler = getLeaderboardHandler;
exports.getUserHandler = getUserHandler;
const store_1 = require("../models/store");
const users_service_1 = require("../services/users.service");
const tiles_service_1 = require("../services/tiles.service");
function getLeaderboardHandler(_req, res) {
    const users = (0, users_service_1.getLeaderboard)(20);
    res.json({ users });
}
function getUserHandler(req, res) {
    const id = String(req.params.id ?? '');
    const user = (0, users_service_1.getOrCreateUser)(id);
    user.territoryCount = (0, tiles_service_1.getOwnedTileCount)(user.id);
    store_1.store.saveUser(user);
    const recentRuns = store_1.store.listRunsByUser(user.id).slice(0, 10);
    res.json({ user, recentRuns });
}
