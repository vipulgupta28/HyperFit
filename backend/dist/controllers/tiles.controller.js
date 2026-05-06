"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTiles = getTiles;
const config_1 = require("../config");
const tiles_service_1 = require("../services/tiles.service");
const h3Geo_1 = require("../utils/h3Geo");
/**
 * GET /tiles?bbox=minLng,minLat,maxLng,maxLat
 * Order matches the Mapbox/MVT convention.
 */
function getTiles(req, res) {
    const bboxParam = req.query.bbox ?? '';
    const parts = bboxParam.split(',').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
        res.status(400).json({ error: 'invalid_bbox' });
        return;
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    const latSpan = Math.abs(maxLat - minLat);
    const lngSpan = Math.abs(maxLng - minLng);
    if (latSpan > config_1.config.maxTileQueryLatSpanDeg || lngSpan > config_1.config.maxTileQueryLngSpanDeg) {
        res.status(400).json({ error: 'bbox_too_large' });
        return;
    }
    const tiles = (0, tiles_service_1.getTilesInBoundingBox)({ minLat, minLng, maxLat, maxLng });
    res.json({ tiles: (0, h3Geo_1.wireTilesFromCells)(tiles) });
}
