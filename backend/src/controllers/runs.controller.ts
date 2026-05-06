import { Request, Response } from 'express';

import { ActivityMode, GpsPoint } from '../models/types';
import {
  appendRunPoints,
  endRun,
  startRun,
} from '../services/runs.service';
import { getOwnedTileCount } from '../services/tiles.service';
import { getOrCreateUser } from '../services/users.service';
import { emitTerritoryChanged, emitTileUpdates } from '../sockets';
import { wireTilesFromCells } from '../utils/h3Geo';

export function postRunStart(req: Request, res: Response): void {
  const { userId, username, mode } = req.body as {
    userId?: string;
    username?: string;
    mode?: ActivityMode;
  };
  const user = getOrCreateUser(userId ?? username);
  const run = startRun(user.id, mode ?? 'run');
  res.status(201).json({ run, user });
}

export function postRunUpdate(req: Request, res: Response): void {
  const { runId, points } = req.body as {
    runId: string;
    points: GpsPoint[];
  };
  if (!runId || !Array.isArray(points)) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }

  const result = appendRunPoints(runId, points);
  if (result.mutations && result.mutations.length > 0) {
    emitTileUpdates(wireTilesFromCells(result.mutations.map((m) => m.tile)));
    emitTerritoryChanged(result.run.userId, getOwnedTileCount(result.run.userId));
  }
  res.json(result);
}

export function postRunEnd(req: Request, res: Response): void {
  const { runId } = req.body as { runId: string };
  if (!runId) {
    res.status(400).json({ error: 'invalid_payload' });
    return;
  }

  const { run, summary, mutations } = endRun(runId);
  if (mutations.length > 0) {
    emitTileUpdates(wireTilesFromCells(mutations.map((m) => m.tile)));
  }
  emitTerritoryChanged(run.userId, getOwnedTileCount(run.userId));
  res.json({ run, summary });
}
