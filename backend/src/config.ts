/**
 * Game / server configuration.
 *
 * Territory cells use Uber H3 at resolution 10 (~50–70 m edge length depending
 * on latitude).
 */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',

  h3Resolution: 11,

  /** Reject tile queries over huge areas to avoid polygonToCells blow-ups. */
  maxTileQueryLatSpanDeg: 0.35,
  maxTileQueryLngSpanDeg: 0.35,

  baseStrength: 3,
  walkBaseStrength: 1,
  runBaseStrength: 2,
  maxStrength: 10,

  /** Minimum accumulated effort in a tile during this run before any mutation fires. */
  minTileEffortToApply: 8,
  /** Effort ÷ this value → strength delta (rounded), clamped by maxStrengthDeltaPerApply. */
  effortPerStrengthPoint: 18,
  /** Cap how much strength can change from one mutation (attack, reinforce, or capture chain). */
  maxStrengthDeltaPerApply: 5,

  effortWeights: {
    time: 0.05,
    distance: 1.0,
  },

  antiCheat: {
    maxSpeedKmh: 20,
    maxJumpMeters: 200,
    minTimestampDeltaMs: 250,
  },

  decay: {
    intervalMs: 1000 * 60 * 60 * 6,
    amount: 1,
  },
} as const;

export type AppConfig = typeof config;
