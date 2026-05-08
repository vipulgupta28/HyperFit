import { Router } from 'express';

import {
  authLogin,
  authRegister,
  authVerify,
} from '../controllers/auth.controller';
import {
  postRunCancel,
  postRunEnd,
  postRunStart,
  postRunUpdate,
} from '../controllers/runs.controller';
import {
  addComment,
  createPost,
  deleteComment,
  getFeed,
  getComments,
  getPostHandler,
  toggleLike,
} from '../controllers/feed.controller';
import { getTiles } from '../controllers/tiles.controller';
import {
  getLeaderboardHandler,
  getUserHandler,
} from '../controllers/users.controller';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

router.post('/auth/login', authLogin);
router.post('/auth/register', authRegister);
router.get('/auth/verify', authVerify);

router.post('/run/start', postRunStart);
router.post('/run/update', postRunUpdate);
router.post('/run/end', postRunEnd);
router.post('/run/cancel', postRunCancel);

router.get('/tiles', getTiles);

router.get('/leaderboard', getLeaderboardHandler);
router.get('/users/:id', getUserHandler);

// Feed & social
router.get('/feed', getFeed);
router.post('/posts', createPost);
router.get('/posts/:postId', getPostHandler);
router.post('/posts/:postId/like', toggleLike);
router.get('/posts/:postId/comments', getComments);
router.post('/posts/:postId/comments', addComment);
router.delete('/posts/:postId/comments/:commentId', deleteComment);
