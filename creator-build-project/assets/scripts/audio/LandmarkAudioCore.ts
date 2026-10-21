// Pure proximity / fade / scheduling policy. Sources include both playing and fading voices.
import { CONFIRMED_LANDMARKS, type LandmarkSpec } from './SceneAudioTable';
export const LANDMARK_FADE_S = 2;
export const MAX_LANDMARK_SOURCES = 2;
// b15: 0.24 sat below every single landmark's own vol (0.4-0.5), so one voice alone was cut; 0.6 only trims two loud voices together.
export const LANDMARK_GAIN_BUDGET = 0.6;
export function landmarkGain(distance: number, near: number, far: number): number {
  if (!isFinite(distance) || distance < 0 || far <= near) return 0;
  const t = Math.max(0, Math.min(1, (distance - near) / (far - near)));
  return 1 - t * t * (3 - 2 * t);
}
export interface LandmarkPort {
  ready: boolean; playing: boolean; volume: number;
  prepare(index: number): void; play(loop: boolean): void; release(): void;
}
export type LandmarkRow = { spec: LandmarkSpec; port: LandmarkPort; level: number; wait: number; reserved: boolean };
export class LandmarkAudioCore {
  rows: LandmarkRow[] = [];
  private place = '';
  constructor(make: (spec: LandmarkSpec) => LandmarkPort, private random: () => number = Math.random, specs: LandmarkSpec[] = CONFIRMED_LANDMARKS) {
    for (let i = 0; i < specs.length; i++) this.rows.push({ spec: specs[i], port: make(specs[i]), level: 0, wait: 0, reserved: false });
  }
  quiet() {
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i]; r.port.volume = 0; r.port.release(); r.level = 0; r.wait = 0; r.reserved = false;
    }
  }
  step(dt: number, place: string, distances: { [id: string]: number }, allowed: boolean, gain: number, night = 0) {
    if (place !== this.place) { this.quiet(); this.place = place; }
    if (!allowed) { this.quiet(); return; }
    const delta = isFinite(dt) ? Math.max(0, dt) : 0;
    let count = 0;
    for (let i = 0; i < this.rows.length; i++) if (this.rows[i].reserved) count++;
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i], s = r.spec;
      const target = place === s.place ? landmarkGain(distances[s.id], s.nearM, s.farM) : 0;
      r.wait = Math.max(0, r.wait - delta * (s.id === 'lakeWaterbirds' ? 1 - 0.75 * Math.max(0, Math.min(1, night)) : 1));
      if (target > 0 && !r.reserved && count < MAX_LANDMARK_SOURCES && r.wait === 0) {
        r.reserved = true; count++; r.port.prepare(Math.min(s.clips.length - 1, Math.floor(this.random() * s.clips.length)));
      }
      // Fade starts only after decoding, so a delayed load cannot enter at full volume.
      const aim = r.reserved && r.port.ready ? target : 0;
      r.level += Math.max(-delta / LANDMARK_FADE_S, Math.min(delta / LANDMARK_FADE_S, aim - r.level));
      if (r.reserved && r.port.ready && r.level > 0 && !r.port.playing) {
        if (r.wait === 0) {
          r.port.play(s.loopS !== null);
          r.wait = s.interval ? s.interval[0] + this.random() * (s.interval[1] - s.interval[0]) : 0;
        } else if (s.loopS === null) { r.port.release(); r.reserved = false; count--; r.level = 0; }
      }
      if (r.reserved && target === 0 && r.level === 0) { r.port.release(); r.reserved = false; count--; r.wait = 0; }
    }
    let total = 0;
    for (let i = 0; i < this.rows.length; i++) total += this.rows[i].level * this.rows[i].spec.vol;
    const scale = Math.min(1, LANDMARK_GAIN_BUDGET / Math.max(total, 0.0001)) * (isFinite(gain) ? Math.max(0, Math.min(1, gain)) : 0);
    for (let i = 0; i < this.rows.length; i++) this.rows[i].port.volume = this.rows[i].level * this.rows[i].spec.vol * scale;
  }
}
