/** Listeners that must track the rigid sea sheet after ShoreBreak.advance, in the same lateUpdate. */
type SeaListener = (seaSurfaceY?: number) => void;
const listeners: SeaListener[] = [];
export function bindSeaSurface(fn: SeaListener): void {
  if (listeners.indexOf(fn) < 0) listeners.push(fn);
}
export function unbindSeaSurface(fn: SeaListener): void {
  const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
}
export function applySeaSurface(seaSurfaceY?: number): void {
  for (let i = 0; i < listeners.length; i++) listeners[i](seaSurfaceY);
}
