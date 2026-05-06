import { useEffect } from 'react';

import { ApiTile } from '../services/api';
import { getSocket } from '../services/socket';
import { useTilesStore } from '../store/tilesStore';

/**
 * Subscribe to realtime tile updates and merge them into the tiles store.
 */
export function useTilesSocket(): void {
  const upsertMany = useTilesStore((s) => s.upsertMany);

  useEffect(() => {
    const socket = getSocket();

    const handler = (tiles: ApiTile[]) => upsertMany(tiles);
    socket.on('tile_updated', handler);

    return () => {
      socket.off('tile_updated', handler);
    };
  }, [upsertMany]);
}
