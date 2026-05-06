export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  color: string;
  totalDistance: number;
  territoryCount: number;
  rank: number;
  createdAt: number;
}

export interface Tile {
  h3Index: string;
  ownerId: string | null;
  ownerColor: string | null;
  strength: number;
  lastUpdated: number;
}

/** Tile + hex boundary for API/WebSocket clients. */
export interface WireTile extends Tile {
  boundary: { latitude: number; longitude: number }[];
}

export type RunStatus = 'active' | 'ended' | 'cancelled';
export type ActivityMode = 'walk' | 'run';

export interface Run {
  id: string;
  userId: string;
  status: RunStatus;
  path: GpsPoint[];
  distance: number;
  duration: number;
  startedAt: number;
  endedAt: number | null;
  /** H3 cell indexes touched or updated during this run (incremental snapshots). */
  capturedTileIds: string[];
  mode: ActivityMode;
  /**
   * Latest tile document per {@link Tile.h3Index} after any live mutation during this run.
   */
  liveTilesSnap?: Record<string, Tile>;
  /** Accumulated effort units per {@link Tile.h3Index} toward the next mutation. */
  tileEffortPending?: Record<string, number>;
  /** Running net territory delta from incremental owner flips during this run. */
  netTerritoryDeltaAccum?: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface RunSummary {
  runId: string;
  userId: string;
  distance: number;
  duration: number;
  pace: number;
  caloriesEstimate: number;
  capturedTiles: WireTile[];
  netTerritoryDelta: number;
}
