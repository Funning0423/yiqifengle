/** Hull-shaped cockpit sole. y=0.12 stays above the waterline when the hull rolls. */
export const SOLE_Y = 0.12;
/** [z, halfWidth]. Inner wall at y=0.12, stern face through the foredeck bulkhead. No side walls. */
export const SOLE_STATIONS: readonly (readonly [number, number])[] = [
 [-2.088, 0.356], [-1.932, 0.400], [-1.680, 0.460], [-1.344, 0.530],
 [-0.966, 0.595], [-0.588, 0.638], [-0.210, 0.654], [0.168, 0.646],
 [0.504, 0.616], [0.840, 0.557], [1.134, 0.460], [1.260, 0.400],
];
export function soleHalfWidth(z: number): number {
 const s = SOLE_STATIONS;
 if (z <= s[0][0]) return s[0][1];
 if (z >= s[s.length - 1][0]) return s[s.length - 1][1];
 for (let i = 1; i < s.length; i++) {
  if (z <= s[i][0]) {
   const a = s[i - 1], b = s[i];
   const u = (z - a[0]) / (b[0] - a[0]);
   return a[1] + (b[1] - a[1]) * u;
  }
 }
 return s[s.length - 1][1];
}
/** Local positions of the sole strip. Every vertex is on a station. */
export function solePositions(): number[] {
 const pos: number[] = [];
 for (const [z, w] of SOLE_STATIONS) pos.push(-w, SOLE_Y, z, w, SOLE_Y, z);
 return pos;
}
export function soleIndices(): number[] {
 const idx: number[] = [];
 const n = SOLE_STATIONS.length;
 for (let i = 0; i < n - 1; i++) {
  const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
  idx.push(a, c, b, b, c, d);
 }
 return idx;
}
export function soleNormals(): number[] {
 const n: number[] = [];
 for (let i = 0; i < SOLE_STATIONS.length * 2; i++) n.push(0, 1, 0);
 return n;
}
/** True when (x,y,z) is inside the inner hull by 1 mm. */
export function soleVertexInside(x: number, y: number, z: number): boolean {
 if (z < -2.088 - 0.001 || z > 1.26 + 0.001) return false;
 if (Math.abs(y - SOLE_Y) > 0.001) return false;
 return Math.abs(x) <= soleHalfWidth(z) + 0.001;
}
