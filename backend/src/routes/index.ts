import { Router } from 'express';

import {
  postRunEnd,
  postRunStart,
  postRunUpdate,
} from '../controllers/runs.controller';
import { getTiles } from '../controllers/tiles.controller';
import {
  getLeaderboardHandler,
  getUserHandler,
} from '../controllers/users.controller';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

router.post('/run/start', postRunStart);
router.post('/run/update', postRunUpdate);
router.post('/run/end', postRunEnd);

router.get('/tiles', getTiles);

router.get('/leaderboard', getLeaderboardHandler);
router.get('/users/:id', getUserHandler);
