import { v4 as uuid } from 'uuid';

import { store } from '../models/store';
import { User } from '../models/types';
import { pickUserColor } from '../utils/colors';

export function getOrCreateUser(idOrUsername?: string): User {
  if (idOrUsername) {
    const existing = store.getUser(idOrUsername);
    if (existing) return existing;

    const byName = store.listUsers().find((u) => u.username === idOrUsername);
    if (byName) return byName;
  }

  const id = idOrUsername ?? uuid();
  const user: User = {
    id,
    username: idOrUsername ?? `Runner-${id.slice(0, 4)}`,
    color: pickUserColor(id),
    totalDistance: 0,
    territoryCount: 0,
    rank: 0,
    createdAt: Date.now(),
  };
  return store.saveUser(user);
}

export function recomputeRanks(): void {
  const users = store.listUsers().sort((a, b) => b.territoryCount - a.territoryCount);
  users.forEach((u, i) => store.saveUser({ ...u, rank: i + 1 }));
}

export function getLeaderboard(limit = 20): User[] {
  recomputeRanks();
  return store
    .listUsers()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}
