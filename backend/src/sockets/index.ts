import { Server as HttpServer } from 'http';
import { Server as IOServer } from 'socket.io';

import { WireTile } from '../models/types';

let io: IOServer | null = null;

export function initSocket(server: HttpServer, corsOrigin: string): IOServer {
  io = new IOServer(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log(`[socket] connected ${socket.id}`);

    socket.on('subscribe_region', (region: { regionId?: string }) => {
      if (region?.regionId) socket.join(region.regionId);
    });

    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.log(`[socket] disconnected ${socket.id}`);
    });
  });

  return io;
}

export function emitTileUpdates(tiles: WireTile[]): void {
  if (!io || tiles.length === 0) return;
  io.emit('tile_updated', tiles);
}

export function emitTerritoryChanged(userId: string, territoryCount: number): void {
  if (!io) return;
  io.emit('territory_changed', { userId, territoryCount });
}
