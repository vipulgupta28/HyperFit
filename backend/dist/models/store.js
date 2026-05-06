"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
/**
 * Process-local in-memory store. Designed to be swapped for MongoDB later —
 * service layers only call these methods, never touch raw maps.
 */
class MemoryStore {
    constructor() {
        this.users = new Map();
        this.runs = new Map();
        this.tiles = new Map();
    }
    // Users
    saveUser(user) {
        this.users.set(user.id, user);
        return user;
    }
    getUser(id) {
        return this.users.get(id);
    }
    listUsers() {
        return [...this.users.values()];
    }
    // Runs
    saveRun(run) {
        this.runs.set(run.id, run);
        return run;
    }
    getRun(id) {
        return this.runs.get(id);
    }
    listRunsByUser(userId) {
        return [...this.runs.values()]
            .filter((r) => r.userId === userId)
            .sort((a, b) => b.startedAt - a.startedAt);
    }
    // Tiles (keyed by H3 cell index string)
    saveTile(tile) {
        this.tiles.set(tile.h3Index, tile);
        return tile;
    }
    getTile(h3Index) {
        return this.tiles.get(h3Index);
    }
    listTiles() {
        return [...this.tiles.values()];
    }
}
exports.store = new MemoryStore();
