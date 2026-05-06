import axios, { AxiosInstance } from 'axios';

import { ActivityMode, getApiBaseUrl } from '../constants/game';

export interface GpsPointPayload {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface ApiTile {
  h3Index: string;
  boundary: { latitude: number; longitude: number }[];
  ownerId: string | null;
  ownerColor: string | null;
  strength: number;
  lastUpdated: number;
}

export interface ApiUser {
  id: string;
  username: string;
  color: string;
  totalDistance: number;
  territoryCount: number;
  rank: number;
  createdAt: number;
}

export interface ApiRun {
  id: string;
  userId: string;
  status: 'active' | 'ended' | 'cancelled';
  mode?: ActivityMode;
  path: GpsPointPayload[];
  distance: number;
  duration: number;
  startedAt: number;
  endedAt: number | null;
  capturedTileIds: string[];
}

export interface ApiRunSummary {
  runId: string;
  userId: string;
  distance: number;
  duration: number;
  pace: number;
  caloriesEstimate: number;
  capturedTiles: ApiTile[];
  netTerritoryDelta: number;
}

let cached: AxiosInstance | null = null;

function client(): AxiosInstance {
  if (cached) return cached;
  cached = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 15000,
  });
  return cached;
}

export const api = {
  baseUrl: () => getApiBaseUrl(),

  startRun: async (userId: string, mode: ActivityMode = 'run'): Promise<{ run: ApiRun; user: ApiUser }> => {
    const { data } = await client().post('/run/start', { userId, mode });
    return data;
  },

  updateRun: async (
    runId: string,
    points: GpsPointPayload[],
  ): Promise<{ run: ApiRun; acceptedPoints: number; rejected?: { reason: string } }> => {
    const { data } = await client().post('/run/update', { runId, points });
    return data;
  },

  endRun: async (runId: string): Promise<{ run: ApiRun; summary: ApiRunSummary }> => {
    const { data } = await client().post('/run/end', { runId });
    return data;
  },

  getTiles: async (bbox: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  }): Promise<{ tiles: ApiTile[] }> => {
    const param = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
    const { data } = await client().get('/tiles', { params: { bbox: param } });
    return data;
  },

  getUser: async (userId: string): Promise<{ user: ApiUser; recentRuns: ApiRun[] }> => {
    const { data } = await client().get(`/users/${encodeURIComponent(userId)}`);
    return data;
  },

  getLeaderboard: async (): Promise<{ users: ApiUser[] }> => {
    const { data } = await client().get('/leaderboard');
    return data;
  },
};
