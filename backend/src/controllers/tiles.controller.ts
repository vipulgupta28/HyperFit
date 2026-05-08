import { Request, Response } from 'express';

import { config } from '../config';
import { getTilesInBoundingBox } from '../services/tiles.service';
import { wireTilesFromCells } from '../utils/h3Geo';

/**
 * GET /tiles?bbox=minLng,minLat,maxLng,maxLat
 * Order matches the Mapbox/MVT convention.
 */
export async function getTiles(req: Request, res: Response): Promise<void> {
  const bboxParam = (req.query.bbox as string | undefined) ?? '';
  const parts = bboxParam.split(',').map(Number);

  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    res.status(400).json({ error: 'invalid_bbox' });
    return;
  }

  const [minLng, minLat, maxLng, maxLat] = parts;

  const latSpan = Math.abs(maxLat - minLat);
  const lngSpan = Math.abs(maxLng - minLng);
  if (latSpan > config.maxTileQueryLatSpanDeg || lngSpan > config.maxTileQueryLngSpanDeg) {
    res.status(400).json({ error: 'bbox_too_large' });
    return;
  }

  const tiles = await getTilesInBoundingBox({ minLat, minLng, maxLat, maxLng });
  res.json({ tiles: wireTilesFromCells(tiles) });
}
