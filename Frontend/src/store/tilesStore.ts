import { create } from 'zustand';

import { ApiTile } from '../services/api';

interface TilesState {
  tiles: Record<string, ApiTile>;
  upsertMany: (tiles: ApiTile[]) => void;
  replaceAll: (tiles: ApiTile[]) => void;
  asArray: () => ApiTile[];
}

export const useTilesStore = create<TilesState>((set, get) => ({
  tiles: {},

  upsertMany: (incoming) =>
    set((state) => {
      if (incoming.length === 0) return state;
      const next: Record<string, ApiTile> = { ...state.tiles };
      for (const tile of incoming) next[tile.h3Index] = tile;
      return { tiles: next };
    }),

  replaceAll: (incoming) => {
    const next: Record<string, ApiTile> = {};
    for (const tile of incoming) next[tile.h3Index] = tile;
    set({ tiles: next });
  },

  asArray: () => Object.values(get().tiles),
}));
