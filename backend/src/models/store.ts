import { Run, Tile, User } from './types';

/**
 * Process-local in-memory store. Designed to be swapped for MongoDB later —
 * service layers only call these methods, never touch raw maps.
 */
class MemoryStore {
  private users = new Map<string, User>();
  private runs = new Map<string, Run>();
  private tiles = new Map<string, Tile>();

  // Users
  saveUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }
  listUsers(): User[] {
    return [...this.users.values()];
  }

  // Runs
  saveRun(run: Run): Run {
    this.runs.set(run.id, run);
    return run;
  }
  getRun(id: string): Run | undefined {
    return this.runs.get(id);
  }
  listRunsByUser(userId: string): Run[] {
    return [...this.runs.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  // Tiles (keyed by H3 cell index string)
  saveTile(tile: Tile): Tile {
    this.tiles.set(tile.h3Index, tile);
    return tile;
  }
  getTile(h3Index: string): Tile | undefined {
    return this.tiles.get(h3Index);
  }
  listTiles(): Tile[] {
    return [...this.tiles.values()];
  }
}

export const store = new MemoryStore();
