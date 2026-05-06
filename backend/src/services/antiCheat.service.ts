import { config } from '../config';
import { GpsPoint } from '../models/types';
import { haversineMeters } from '../utils/geo';

export interface AntiCheatResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate a batch of GPS points against the previous tail of the run path.
 *
 * Rejection criteria (per backend guide):
 *  - Speed exceeds {@link config.antiCheat.maxSpeedKmh}.
 *  - Two consecutive points jump more than {@link config.antiCheat.maxJumpMeters}.
 *  - Timestamps are non-monotonic or arrive faster than expected.
 */
export function validateGpsBatch(
  previous: GpsPoint | null,
  batch: GpsPoint[],
): AntiCheatResult {
  if (batch.length === 0) {
    return { ok: false, reason: 'empty_batch' };
  }

  const sequence: GpsPoint[] = previous ? [previous, ...batch] : batch;
  const maxSpeedMs = config.antiCheat.maxSpeedKmh * 1000 / 3600;

  for (let i = 1; i < sequence.length; i++) {
    const prev = sequence[i - 1];
    const curr = sequence[i];

    const dtMs = curr.timestamp - prev.timestamp;
    if (dtMs <= 0) {
      return { ok: false, reason: 'non_monotonic_timestamp' };
    }
    if (dtMs < config.antiCheat.minTimestampDeltaMs && i > 1) {
      return { ok: false, reason: 'timestamps_too_close' };
    }

    const meters = haversineMeters(prev, curr);
    if (meters > config.antiCheat.maxJumpMeters) {
      return { ok: false, reason: 'gps_jump' };
    }

    const speed = meters / (dtMs / 1000);
    if (speed > maxSpeedMs) {
      return { ok: false, reason: 'speed_too_high' };
    }
  }

  return { ok: true };
}
