import { create } from 'zustand';

export interface RunMeta {
  name: string;
  description: string;
  savedAt: number;
}

interface RunMetaState {
  meta: Record<string, RunMeta>;
  save: (runId: string, name: string, description: string) => void;
  get: (runId: string) => RunMeta | null;
}

export const useRunMetaStore = create<RunMetaState>((set, get) => ({
  meta: {},

  save: (runId, name, description) =>
    set((state) => ({
      meta: {
        ...state.meta,
        [runId]: { name: name.trim(), description: description.trim(), savedAt: Date.now() },
      },
    })),

  get: (runId) => get().meta[runId] ?? null,
}));
