import { v4 as uuid } from 'uuid';

import { store } from '../models/store';
import { User } from '../models/types';
import { pickUserColor } from '../utils/colors';

export async function getOrCreateUser(idOrUsername?: string): Promise<User> {
  if (idOrUsername) {
    const byId = await store.getUser(idOrUsername);
    if (byId) return byId;

    const byName = await store.getUserByUsername(idOrUsername);
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

export async function recomputeRanks(): Promise<void> {
  await store.recomputeRanks();
}

export async function getLeaderboard(limit = 20): Promise<User[]> {
  await recomputeRanks();
  const users = await store.listUsers();
  return users.sort((a, b) => a.rank - b.rank).slice(0, limit);
}
