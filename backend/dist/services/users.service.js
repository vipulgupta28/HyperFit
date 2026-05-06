"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateUser = getOrCreateUser;
exports.recomputeRanks = recomputeRanks;
exports.getLeaderboard = getLeaderboard;
const uuid_1 = require("uuid");
const store_1 = require("../models/store");
const colors_1 = require("../utils/colors");
function getOrCreateUser(idOrUsername) {
    if (idOrUsername) {
        const existing = store_1.store.getUser(idOrUsername);
        if (existing)
            return existing;
        const byName = store_1.store.listUsers().find((u) => u.username === idOrUsername);
        if (byName)
            return byName;
    }
    const id = idOrUsername ?? (0, uuid_1.v4)();
    const user = {
        id,
        username: idOrUsername ?? `Runner-${id.slice(0, 4)}`,
        color: (0, colors_1.pickUserColor)(id),
        totalDistance: 0,
        territoryCount: 0,
        rank: 0,
        createdAt: Date.now(),
    };
    return store_1.store.saveUser(user);
}
function recomputeRanks() {
    const users = store_1.store.listUsers().sort((a, b) => b.territoryCount - a.territoryCount);
    users.forEach((u, i) => store_1.store.saveUser({ ...u, rank: i + 1 }));
}
function getLeaderboard(limit = 20) {
    recomputeRanks();
    return store_1.store
        .listUsers()
        .sort((a, b) => a.rank - b.rank)
        .slice(0, limit);
}
