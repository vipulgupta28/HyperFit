"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGpsBatch = validateGpsBatch;
const config_1 = require("../config");
const geo_1 = require("../utils/geo");
/**
 * Validate a batch of GPS points against the previous tail of the run path.
 *
 * Rejection criteria (per backend guide):
 *  - Speed exceeds {@link config.antiCheat.maxSpeedKmh}.
 *  - Two consecutive points jump more than {@link config.antiCheat.maxJumpMeters}.
 *  - Timestamps are non-monotonic or arrive faster than expected.
 */
function validateGpsBatch(previous, batch) {
    if (batch.length === 0) {
        return { ok: false, reason: 'empty_batch' };
    }
    const sequence = previous ? [previous, ...batch] : batch;
    const maxSpeedMs = config_1.config.antiCheat.maxSpeedKmh * 1000 / 3600;
    for (let i = 1; i < sequence.length; i++) {
        const prev = sequence[i - 1];
        const curr = sequence[i];
        const dtMs = curr.timestamp - prev.timestamp;
        if (dtMs <= 0) {
            return { ok: false, reason: 'non_monotonic_timestamp' };
        }
        if (dtMs < config_1.config.antiCheat.minTimestampDeltaMs && i > 1) {
            return { ok: false, reason: 'timestamps_too_close' };
        }
        const meters = (0, geo_1.haversineMeters)(prev, curr);
        if (meters > config_1.config.antiCheat.maxJumpMeters) {
            return { ok: false, reason: 'gps_jump' };
        }
        const speed = meters / (dtMs / 1000);
        if (speed > maxSpeedMs) {
            return { ok: false, reason: 'speed_too_high' };
        }
    }
    return { ok: true };
}
