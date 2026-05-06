"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRadians = toRadians;
exports.haversineMeters = haversineMeters;
const EARTH_RADIUS_M = 6371000;
function toRadians(deg) {
    return (deg * Math.PI) / 180;
}
/** Great-circle distance in meters between two GPS points. */
function haversineMeters(a, b) {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
