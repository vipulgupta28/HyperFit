import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const GAME = {
  gpsIntervalMs: 3000,
  gpsBatchSize: 6,
  initialMapDelta: {
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  },
  walkBaseStrength: 1,
  runBaseStrength: 2,
  gpsAccuracyFilterM: 35,
  gpsEmaAlpha: 0.45,
} as const;

export type ActivityMode = 'walk' | 'run';

export const PALETTE = {
  background: '#000000',
  surface: '#0A0A0A',
  surfaceElevated: '#111111',
  surfaceCard: '#161616',

  border: '#262626',
  borderLight: '#3A3A3A',

  text: '#FFFFFF',
  textMuted: '#A3A3A3',
  textDim: '#717171',

  onDark: '#FFFFFF',
  onLight: '#000000',

  highlight: '#F5F5F5',
  primary: '#FFFFFF',

  danger: '#F87171',
  dangerMuted: '#FCA5A5',

  meColor: '#FFFFFF',

  // Walk mode accent
  walkPrimary: '#38BDF8',
  walkSecondary: '#0EA5E9',
  walkGlow: 'rgba(56,189,248,0.25)',

  // Run mode accent
  runPrimary: '#FB923C',
  runSecondary: '#F97316',
  runGlow: 'rgba(251,146,60,0.25)',
} as const;

export const TILE_COLORS = {
  unclaimedFill: 'rgba(255,255,255,0.04)',
  unclaimedStroke: 'rgba(255,255,255,0.18)',
  mineFillBase: 0.18,
  mineStrokeOpacity: 0.9,
  rivalFillBase: 0.12,
  rivalStrokeOpacity: 0.7,
} as const;

const DEFAULT_DEV_PORT = 4000;

function resolveDevApiHost(): string | null {
  const fromExtra = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;

  const hostUri =
    (Constants.expoGoConfig as { debuggerHost?: string } | null | undefined)?.debuggerHost ??
    Constants.expoConfig?.hostUri ??
    null;
  if (!hostUri) return null;

  const host = hostUri.split(':')[0];
  if (!host) return null;

  return `http://${host}:${DEFAULT_DEV_PORT}`;
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const dev = resolveDevApiHost();
  if (dev) return dev;

  return Platform.select({
    android: `http://10.0.2.2:${DEFAULT_DEV_PORT}`,
    default: `http://localhost:${DEFAULT_DEV_PORT}`,
  }) as string;
}
