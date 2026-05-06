import { create } from 'zustand';

import { ApiRun } from '../services/api';

interface RunsState {
  runs: Record<string, ApiRun>;
  setRuns: (runs: ApiRun[]) => void;
  upsertRun: (run: ApiRun) => void;
}

export const useRunsStore = create<RunsState>((set) => ({
  runs: {},

  setRuns: (runs) =>
    set((state) => {
      const next = { ...state.runs };
      for (const r of runs) next[r.id] = r;
      return { runs: next };
    }),

  upsertRun: (run) =>
    set((state) => ({ runs: { ...state.runs, [run.id]: run } })),
}));
