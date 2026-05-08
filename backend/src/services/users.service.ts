import { v4 as uuid } from 'uuid';

import { store } from '../models/store';
import { User } from '../models/types';
import { pickUserColor } from '../utils/colors';

export async function getOrCreateUser(id: string, preferredUsername?: string): Promise<User> {
  // Always look up by ID first
  const byId = await store.getUser(id);
  if (byId) return byId;

  // Fall back to username lookup only when no explicit username is given
  // (backward-compat: old guests had id === username)
  if (!preferredUsername) {
    const byName = await store.getUserByUsername(id);
    if (byName) return byName;
  }

  const username = preferredUsername ?? id;
  const user: User = {
    id,
    username,
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
