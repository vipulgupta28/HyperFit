import { Request, Response } from 'express';

import { store } from '../models/store';
import { getOrCreateUser } from '../services/users.service';
import { signToken, verifyToken } from '../utils/jwt';

export async function authLogin(req: Request, res: Response): Promise<void> {
  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ error: 'invalid_payload' }); return; }

  const existing = await store.getUser(userId);
  if (!existing) {
    res.json({ isNew: true });
    return;
  }

  res.json({ isNew: false, token: signToken(existing.id), user: existing });
}

export async function authRegister(req: Request, res: Response): Promise<void> {
  const { userId, username } = req.body as { userId?: string; username?: string };
  if (!userId || !username?.trim()) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }

  const existing = await store.getUser(userId);
  if (existing) {
    res.json({ token: signToken(existing.id), user: existing });
    return;
  }

  const user = await getOrCreateUser(userId, username.trim());
  res.status(201).json({ token: signToken(user.id), user });
}

export async function authVerify(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'no_token' });
    return;
  }

  try {
    const userId = verifyToken(authHeader.slice(7));
    const user = await store.getUser(userId);
    if (!user) { res.status(401).json({ error: 'user_not_found' }); return; }
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
