"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickUserColor = pickUserColor;
const PALETTE = [
    '#FF3B6B',
    '#FFB000',
    '#3BD2A2',
    '#3B9DFF',
    '#A35BFF',
    '#FF7A3B',
    '#19E5C6',
    '#F73BFF',
];
function pickUserColor(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return PALETTE[hash % PALETTE.length];
}
