import { Request, Response } from 'express';

import { store } from '../models/store';
import { getLeaderboard, getOrCreateUser } from '../services/users.service';
import { getOwnedTileCount } from '../services/tiles.service';

export function getLeaderboardHandler(_req: Request, res: Response): void {
  const users = getLeaderboard(20);
  res.json({ users });
}

export function getUserHandler(req: Request, res: Response): void {
  const id = String(req.params.id ?? '');
  const user = getOrCreateUser(id);
  user.territoryCount = getOwnedTileCount(user.id);
  store.saveUser(user);

  const recentRuns = store.listRunsByUser(user.id).slice(0, 10);
  res.json({ user, recentRuns });
}
