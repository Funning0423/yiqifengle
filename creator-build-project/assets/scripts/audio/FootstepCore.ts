/** Voice Bot r4 (exit footsteps, Funning 2026-10-17: "no steps in the room, then sudden sharp loud steps outside").
 *  Engine-free footstep logic, unit-tested in node (tools/exit-footsteps/test_footsteps.cjs).
 *
 *  Steps are triggered from the character's real foot plants: FOOTSTEP_PLANTS lists, per clip, the clip time at which a
 *  shoe sole lands (derived offline from the shipped character GLB). The tracker only OBSERVES the motion clock
 *  (FlowReferenceStandin.clock.base: clip, abs; frozen code, never modified) once per frame after the flow advanced, and
 *  fires every plant whose clip time was crossed - plus a short lead (STEP_LEAD_S) so that frame quantisation and an
 *  mp3 decoder that does not trim the LAME priming (~25 ms at 44.1 kHz) both stay inside +-40 ms of the plant.
 *  The surface comes from FOOTSTEP_GROUND (0.1 m grid of the home/island ground) at the planted foot. */
import { FOOTSTEP_PLANTS, FOOTSTEP_GROUND } from './FootstepData';

export type StepSurface = 'wood' | 'rug' | 'stone' | 'path' | 'grass';
export type StepBone = 'foot.L' | 'foot.R';
/** Same names as the GameAudio SfxName step entries (GameAudio does not import this module). */
export type StepClipName = 'step_wood_1' | 'step_wood_2' | 'step_wood_3' | 'step_wood_4' | 'step_rug_1' | 'step_rug_2' | 'step_rug_3' | 'step_rug_4'
  | 'step_stone_1' | 'step_stone_2' | 'step_stone_3' | 'step_stone_4' | 'step_path_1' | 'step_path_2' | 'step_path_3' | 'step_path_4'
  | 'step_grass_1' | 'step_grass_2' | 'step_grass_3' | 'step_grass_4';
/** Subpackage folder of the step one-shots (region_island is already loaded for the character before she stands up). */
export const STEP_ASSETS = { bundle: 'region_island', dir: 'audio_steps' } as const;
export const STEP_VARIANTS = 4;
/** Fire this much before the plant (real seconds): the step sound lands within [-12, +dt-12] ms of the plant on a
 *  trimming decoder and [+13, +dt+13] ms on one that plays the 25 ms LAME priming. */
export const STEP_LEAD_S = 0.025;
/** Same foot cannot step twice inside this window (guards clip switches). */
export const STEP_DEDUPE_S = 0.25;
/** In-game volume per surface (files are peak -6 dBFS). Measured in the offline mix (README): the step's momentary
 *  loudness (400 ms) sits ~7-13 dB under the bed (BGM in the room; BGM + wind + waves outside),
 *  and its sample peak ~8 dB under the bed's. */
export const STEP_GAIN: Record<StepSurface, number> = { wood: 0.36, rug: 0.34, stone: 0.38, path: 0.34, grass: 0.32 };
/** +-1.5 dB random volume per step on top of the 4 pitch-baked variants (no machine-gun repetition). */
export const STEP_JITTER_DB = 1.5;
/** Flow states in which steps may sound: the exit (home -> island) and the return (island -> seat). Not region journeys. */
export const STEP_STATES = ['standing', 'turning-out', 'walking-out', 'opening-door', 'crossing-out', 'island',
  'walking-home', 'crossing-in', 'closing-door', 'walking-to-seat', 'sitting'];

type ClockTrack = { clip: string; abs: number; loop: boolean; duration: number; distance?: boolean; rate?: number };
export type StepClock = { base: ClockTrack | null };
/** x/z: where the planted sole touches, in the character's model frame (+z forward), from FOOTSTEP_PLANTS. */
export type StepHit = { clip: string; bone: StepBone; plantAbs: number; cycle: number; x: number; z: number };
type Plant = { t: number; bone: StepBone; x?: number; z?: number };

/** Plants of `clip` with from < abs <= to (loop: every cycle). */
export function crossedPlants(plants: ReadonlyArray<Plant>, from: number, to: number, duration: number, loop: boolean): StepHit[] {
  const out: StepHit[] = [];
  if (!(to > from) || !plants.length || !(duration > 0)) return out;
  const k0 = loop ? Math.floor(from / duration) : 0, k1 = loop ? Math.floor(to / duration) : 0;
  for (let k = k0; k <= k1; k++) for (let i = 0; i < plants.length; i++) {
    const abs = plants[i].t + k * duration;
    if (abs > from && abs <= to) out.push({ clip: '', bone: plants[i].bone, plantAbs: abs, cycle: k, x: plants[i].x || 0, z: plants[i].z || 0 });
  }
  out.sort((a, b) => a.plantAbs - b.plantAbs);
  return out;
}

export class FootstepTracker {
  private track: ClockTrack | null = null;
  private lastAbs = 0;
  private firedTo = 0;
  private speed = 1;          // clip seconds per real second, last frame
  private now = 0;            // tracker time (sum of dt)
  private lastBone: Record<string, number> = {};
  constructor(private plants: { [clip: string]: ReadonlyArray<Plant> } = FOOTSTEP_PLANTS.clips as any,
    public leadS = STEP_LEAD_S, public dedupeS = STEP_DEDUPE_S) { }
  reset() { this.track = null; this.lastAbs = 0; this.firedTo = 0; this.speed = 1; this.lastBone = {}; }
  /** Call once per frame AFTER the character advanced. dt = real seconds since the previous call. */
  observe(clock: StepClock | null, dt: number): StepHit[] {
    const hits: StepHit[] = [];
    this.now += dt > 0 ? dt : 0;
    const b = clock && clock.base;
    if (!b) { this.track = null; return hits; }
    const scan = (tr: ClockTrack, from: number, to: number) => {
      const list = this.plants[tr.clip];
      if (list && to > from) {
        const found = crossedPlants(list, from, to, tr.duration, tr.loop);
        for (let i = 0; i < found.length; i++) { found[i].clip = tr.clip; hits.push(found[i]); }
      }
    };
    if (b === this.track) {
      const adv = b.abs - this.lastAbs;
      if (dt > 0 && adv >= 0) this.speed = adv / dt;
      const ahead = b.abs + this.leadS * Math.max(0, this.speed);
      scan(b, this.firedTo, ahead);
      if (ahead > this.firedTo) this.firedTo = ahead;
    } else {
      // Clip switch. Finish the old track up to where it stopped (no lead: it is fading out).
      const old = this.track;
      if (old && old.abs > this.firedTo) scan(old, this.firedTo, old.abs);
      // The new track advanced at most one frame since it was created at (abs - adv).
      const rate = b.rate && b.rate > 0 ? b.rate : 1;
      const speed = b.distance ? (old && old.distance ? this.speed : rate) : rate;
      const adv = dt > 0 ? dt * speed : 0;
      const from = Math.max(-1e-9, b.abs - adv - 1e-9);
      const ahead = b.abs + this.leadS * speed;
      scan(b, old ? from : b.abs, ahead);      // first observation ever: nothing is "crossed" yet
      this.firedTo = ahead; this.speed = speed;
    }
    this.track = b; this.lastAbs = b.abs;
    const out: StepHit[] = [];
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i], last = this.lastBone[h.bone];
      if (last !== undefined && this.now - last < this.dedupeS) continue;
      this.lastBone[h.bone] = this.now; out.push(h);
    }
    return out;
  }
}

/** Decoded FOOTSTEP_GROUND: surface class at a world x/z (y up), nearest classified cell within 0.3 m, else a side default. */
export type GroundGrid = { x0: number; z0: number; cell: number; nx: number; nz: number; rows: ReadonlyArray<string> };
const CLASS: Record<string, StepSurface> = { W: 'wood', R: 'rug', S: 'stone', P: 'path', G: 'grass' };
export class StepGround {
  private cells: string[][] = [];
  constructor(private g: GroundGrid = FOOTSTEP_GROUND) {
    for (let r = 0; r < g.rows.length; r++) {
      const row: string[] = [], re = /(\d*)([^\d])/g; let m: RegExpExecArray | null;
      while ((m = re.exec(g.rows[r])) !== null) { const n = m[1] ? parseInt(m[1], 10) : 1; for (let i = 0; i < n; i++) row.push(m[2]); }
      this.cells.push(row);
    }
  }
  private at(ix: number, iz: number): string { const row = this.cells[iz]; return row && ix >= 0 && ix < row.length ? row[ix] : '.'; }
  surfaceAt(x: number, z: number): StepSurface {
    const g = this.g, ix = Math.floor((x - g.x0) / g.cell), iz = Math.floor((z - g.z0) / g.cell);
    const c = this.at(ix, iz); if (CLASS[c]) return CLASS[c];
    for (let r = 1; r <= 3; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const k = this.at(ix + dx, iz + dz); if (CLASS[k]) return CLASS[k];
    }
    return z < 0 ? 'wood' : 'path';   // room is z < 0 (door plane z ~ 0)
  }
}
/** World x/z of the planted sole: controller root (x, z) + the plant's model-frame offset rotated by yaw about +y
 *  (Cocos node euler y; forward = (sin yaw, cos yaw)). */
export function footPoint(x: number, z: number, yaw: number, hit: { x: number; z: number }): [number, number] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x + hit.x * c + hit.z * s, z - hit.x * s + hit.z * c];
}

/** Variant + volume: never the same file twice in a row on one surface, +-STEP_JITTER_DB volume. rnd() in [0,1). */
export class StepVariantPicker {
  private last: Record<string, number> = {};
  constructor(private rnd: () => number = Math.random) { }
  pick(surface: StepSurface): { name: StepClipName; volume: number } {
    const prev = this.last[surface];
    let i = Math.floor(this.rnd() * (prev === undefined ? STEP_VARIANTS : STEP_VARIANTS - 1));
    if (prev !== undefined && i >= prev) i++;
    this.last[surface] = i;
    const db = (this.rnd() * 2 - 1) * STEP_JITTER_DB;
    return { name: ('step_' + surface + '_' + (i + 1)) as StepClipName, volume: Math.min(1, STEP_GAIN[surface] * Math.pow(10, db / 20)) };
  }
}
