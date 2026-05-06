import { create } from 'zustand';

import { ActivityMode } from '../constants/game';
import { ApiRunSummary, GpsPointPayload } from '../services/api';

export type RunPhase = 'idle' | 'active' | 'paused' | 'ending';

interface RunState {
  phase: RunPhase;
  mode: ActivityMode;
  runId: string | null;
  startedAt: number | null;
  pausedAt: number | null;
  pausedTotalMs: number;

  path: GpsPointPayload[];
  buffered: GpsPointPayload[];
  distance: number;
  pendingError: string | null;

  lastSummary: ApiRunSummary | null;

  setPhase: (phase: RunPhase) => void;
  setMode: (mode: ActivityMode) => void;
  beginRun: (runId: string) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  pushPoint: (point: GpsPointPayload, distanceDeltaM: number) => void;
  consumeBuffer: () => GpsPointPayload[];
  setError: (msg: string | null) => void;
  setSummary: (summary: ApiRunSummary | null) => void;
}

const initial = {
  phase: 'idle' as RunPhase,
  mode: 'run' as ActivityMode,
  runId: null,
  startedAt: null,
  pausedAt: null,
  pausedTotalMs: 0,
  path: [] as GpsPointPayload[],
  buffered: [] as GpsPointPayload[],
  distance: 0,
  pendingError: null,
  lastSummary: null as ApiRunSummary | null,
};

export const useRunStore = create<RunState>((set, get) => ({
  ...initial,

  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),

  beginRun: (runId) =>
    set({
      ...initial,
      mode: get().mode,
      runId,
      phase: 'active',
      startedAt: Date.now(),
    }),

  pause: () => {
    if (get().phase !== 'active') return;
    set({ phase: 'paused', pausedAt: Date.now() });
  },

  resume: () => {
    const { phase, pausedAt, pausedTotalMs } = get();
    if (phase !== 'paused' || pausedAt === null) return;
    set({
      phase: 'active',
      pausedAt: null,
      pausedTotalMs: pausedTotalMs + (Date.now() - pausedAt),
    });
  },

  reset: () => set({ ...initial, mode: get().mode }),

  pushPoint: (point, distanceDeltaM) =>
    set((state) => ({
      path: [...state.path, point],
      buffered: [...state.buffered, point],
      distance: state.distance + distanceDeltaM,
    })),

  consumeBuffer: () => {
    const buf = get().buffered;
    if (buf.length === 0) return [];
    set({ buffered: [] });
    return buf;
  },

  setError: (pendingError) => set({ pendingError }),
  setSummary: (lastSummary) => set({ lastSummary }),
}));
