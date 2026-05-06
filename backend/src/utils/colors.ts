const PALETTE = [
  '#FF9BB2', // light rose
  '#FFD580', // soft amber
  '#9FE8D3', // mint
  '#9FCCFF', // soft blue
  '#C7A6FF', // lavender
  '#FFB38A', // peach
  '#8FF0DF', // aqua
  '#F5A3FF'  // light magenta
]

export function pickUserColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
