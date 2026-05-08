import { memo } from 'react';
import { Polygon } from 'react-native-maps';

import { PALETTE, TILE_COLORS } from '../constants/game';
import { ApiTile } from '../services/api';

interface TileOverlayProps {
  tile: ApiTile;
  meUserId?: string | null;
  satellite?: boolean;
  onPress?: (tile: ApiTile) => void;
}

function TileOverlayBase({ tile, meUserId, satellite, onPress }: TileOverlayProps) {
  const coords = tile.boundary;
  const ownerColor = tile.ownerColor ?? PALETTE.textDim;
  const isMine = meUserId != null && tile.ownerId === meUserId;
  const isUnclaimed = tile.ownerId == null;

  let fillColor: string;
  let strokeColor: string;
  let strokeWidth: number;

  if (isUnclaimed) {
    fillColor = TILE_COLORS.unclaimedFill;
    strokeColor = satellite ? 'rgba(255,255,255,0.25)' : TILE_COLORS.unclaimedStroke;
    strokeWidth = 1;
  } else if (isMine) {
    const fillOpacity = Math.min(0.6, TILE_COLORS.mineFillBase + tile.strength * 0.042);
    fillColor = hexToRgba(ownerColor, fillOpacity);
    strokeColor = satellite ? 'rgba(255,255,255,0.85)' : hexToRgba(ownerColor, TILE_COLORS.mineStrokeOpacity);
    strokeWidth = 2;
  } else {
    const fillOpacity = Math.min(0.45, TILE_COLORS.rivalFillBase + tile.strength * 0.033);
    fillColor = hexToRgba(ownerColor, fillOpacity);
    strokeColor = satellite ? 'rgba(255,255,255,0.65)' : hexToRgba(ownerColor, TILE_COLORS.rivalStrokeOpacity);
    strokeWidth = 1;
  }

  return (
    <Polygon
      coordinates={coords}
      strokeColor={strokeColor}
      strokeWidth={strokeWidth}
      fillColor={fillColor}
      tappable={!!onPress}
      onPress={onPress ? () => onPress(tile) : undefined}
    />
  );
}

export const TileOverlay = memo(TileOverlayBase, (prev, next) =>
  prev.tile.h3Index === next.tile.h3Index &&
  prev.tile.ownerId === next.tile.ownerId &&
  prev.tile.strength === next.tile.strength &&
  prev.meUserId === next.meUserId &&
  prev.satellite === next.satellite &&
  prev.onPress === next.onPress,
);

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}
