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
  /** Optional per-frame hook (the two-source loop voice runs its seam crossfade here, after volume is set). */
  tick?(dt: number): void;
}

// ---- Two-source landmark loop (b15). The loop file is loopS of circular audio followed by a copy of its own first
// LANDMARK_LOOP_DUP_S seconds. At loopS the partner source starts from 0 and the two cross over LANDMARK_SEAM_S of
// identical audio (equal gain), after the encoder delay that decoders without gapless trimming put at the file start.
// So mp3 encoder padding at either end of the file is never heard, unlike AudioSource.loop.
export const LANDMARK_LOOP_DUP_S = 0.3;
export const LANDMARK_SEAM_S = 0.15;
export const LANDMARK_ENCODER_DELAY_SAMPLES = 1105;
const LOOP_PARTNER_TIMEOUT_S = 0.6;
export interface LoopSource { volume: number; readonly playing: boolean; readonly currentTime: number; play(): void; pause(): void; stop(): void; }
export class LandmarkLoopPair {
  xfading = false;
  xFailed = false;
  seams = 0;
  private xWait = 0;
  constructor(private cur: LoopSource, private next: LoopSource, private loopS: number, private sr: number) {}
  get playing(): boolean { return !!(this.cur.playing || this.next.playing); }
  /** Start, or resume after an engine/visibility pause (AudioSource.play() continues from the paused position). */
  start(): void {
    try { if (!this.cur.playing) this.cur.play(); } catch (e) { /* source gone */ }
    if (this.xfading) { try { if (!this.next.playing) this.next.play(); } catch (e) { /* partner retry in tick */ } }
  }
  pause(): void {
    const both = [this.cur, this.next];
    for (let i = 0; i < both.length; i++) { try { if (both[i].playing) both[i].pause(); } catch (e) { /* source gone */ } }
  }
  stop(): void {
    const both = [this.cur, this.next];
    for (let i = 0; i < both.length; i++) { try { both[i].volume = 0; both[i].stop(); } catch (e) { /* source gone */ } }
    this.xfading = false; this.xWait = 0; this.xFailed = false;
  }
  tick(dt: number, vol: number): void {
    const d = isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0;
    const v = isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 0;
    if (!this.cur.playing && !this.xfading) {
      // The whole file ran out (no partner, or the partner failed): restart rather than fall silent.
      if (this.cur.currentTime <= 0 || this.cur.currentTime >= this.loopS) { try { this.cur.stop(); this.cur.play(); } catch (e) { /* ignore */ } }
      this.cur.volume = v; return;
    }
    // Start the partner half a frame early so the overlap lines up within +-dt/2.
    if (!this.xfading && !this.xFailed && this.cur.currentTime + d * 0.5 >= this.loopS) {
      try { this.next.stop(); this.next.volume = 0; this.next.play(); this.xfading = true; this.xWait = 0; }
      catch (e) { this.xFailed = true; }
    }
    if (this.xfading) {
      if (!this.next.playing) {
        this.xWait += d;
        // Partner never came up: give up on it once the overlap tail is used or the timeout passes, and run the
        // main source alone (restarted from 0 when it ends) so the ring never falls silent.
        if (!this.cur.playing || this.xWait > LOOP_PARTNER_TIMEOUT_S) {
          try { this.next.stop(); } catch (e) { /* ignore */ }
          this.xfading = false; this.xFailed = true;
          if (!this.cur.playing) { try { this.cur.stop(); this.cur.play(); } catch (e) { /* ignore */ } }
        }
        this.cur.volume = v; return;
      }
      const u = Math.max(0, Math.min(1, (this.next.currentTime - LANDMARK_ENCODER_DELAY_SAMPLES / this.sr) / LANDMARK_SEAM_S));
      this.cur.volume = v * (1 - u); this.next.volume = v * u;
      if (u >= 1) { try { this.cur.stop(); } catch (e) { /* ignore */ } const t = this.cur; this.cur = this.next; this.next = t; this.xfading = false; this.seams++; }
      return;
    }
    this.cur.volume = v;
  }
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
      // One-shots start directly at their distance level (no fade-in on the call itself); loops and leaving still glide over 2 s.
      if (s.loopS === null && r.reserved && r.port.ready && !r.port.playing && r.wait === 0 && target > 0) r.level = target;
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
    for (let i = 0; i < this.rows.length; i++) {
      const p = this.rows[i].port; p.volume = this.rows[i].level * this.rows[i].spec.vol * scale;
      if (p.tick) p.tick(delta);
    }
  }
}
