import { io, Socket } from 'socket.io-client';

import { getApiBaseUrl } from '../constants/game';
import { ApiTile } from './api';

export interface ServerToClientEvents {
  tile_updated: (tiles: ApiTile[]) => void;
  territory_changed: (payload: { userId: string; territoryCount: number }) => void;
}

export interface ClientToServerEvents {
  subscribe_region: (region: { regionId: string }) => void;
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) return socket;
  socket = io(getApiBaseUrl(), {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
