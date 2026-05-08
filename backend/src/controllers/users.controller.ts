import { Request, Response } from 'express';

import { store } from '../models/store';
import { getLeaderboard, getOrCreateUser } from '../services/users.service';
import { getOwnedTileCount } from '../services/tiles.service';

export async function getLeaderboardHandler(_req: Request, res: Response): Promise<void> {
  const users = await getLeaderboard(20);
  res.json({ users });
}

export async function getUserHandler(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id ?? '');
  const user = await getOrCreateUser(id);
  user.territoryCount = await getOwnedTileCount(user.id);
  await store.saveUser(user);

  const recentRuns = await store.listRunsByUser(user.id, 'ended');
  res.json({ user, recentRuns: recentRuns.slice(0, 10) });
}
