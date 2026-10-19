// BedLayerCore.ts — 鸟鸣 / 虫鸣 / 高空风三层循环（无 cc，tests/test_scene_bgm_switch.cjs 直接驱动）。
// 开关和音量来自 __sceneAudioBed + SCENE_AMBIENCE_DESIGN。层与层之间用 SCENE_AUDIO_CROSSFADE_S（2 s）等功率交叉：
// 从静音淡入是 sin，淡出到静音是 cos。同一条循环只改音量（热气球 0.5 → 天空城 0.75）用 smoothstep，避免等功率把同一条声音加高。
// 循环拼接：文件在 loopS 之后有 0.15 s 自己开头的副本，解码器不裁 LAME 头时开头还有 1105 个采样的延迟。
// 播到 loopS 时第二个声源从头起，过了编码延迟后做 0.15 s 等增益交叉（重叠的是同一段波形，音量和为 1，接缝没有咔哒）。
// 零散单发（草原远处鸟鸣）同时最多 MAX_SCATTER 个，多了就跳过这一次。
import { PENDING_LAYER_ASSETS, SCENE_AMBIENCE_DESIGN, SCENE_AUDIO_CROSSFADE_S } from './SceneAudioTable';

export const MAX_SCATTER = 6;
/** LAME 编码器延迟 + 解码器延迟。不裁 gapless 头的解码器把它放在文件最前面。 */
export const ENCODER_DELAY_SAMPLES = 1105;
/** 和文件里那截开头副本一样长。重叠是同一段声音，所以用等增益而不是等功率。 */
export const SEAM_XFADE_S = 0.15;
const PARTNER_TIMEOUT_S = 0.6;

export type BedLayerId = 'birds' | 'insects' | 'highWind';
export const BED_LAYER_IDS: BedLayerId[] = ['birds', 'insects', 'highWind'];

export type BedLoopSpec = { id: BedLayerId; path: string; bundle: string | null; loopS: number; sr: number };
export const BED_LOOPS: { [id: string]: BedLoopSpec } = {
  birds: { id: 'birds', path: PENDING_LAYER_ASSETS.birds.path, bundle: PENDING_LAYER_ASSETS.birds.bundle, loopS: PENDING_LAYER_ASSETS.birds.loopS || 30, sr: 32000 },
  insects: { id: 'insects', path: PENDING_LAYER_ASSETS.insects.path, bundle: PENDING_LAYER_ASSETS.insects.bundle, loopS: PENDING_LAYER_ASSETS.insects.loopS || 19.25, sr: 24000 },
  highWind: { id: 'highWind', path: PENDING_LAYER_ASSETS.highWind.path, bundle: PENDING_LAYER_ASSETS.highWind.bundle, loopS: PENDING_LAYER_ASSETS.highWind.loopS || 32, sr: 32000 },
};

export function encoderDelayS(sr: number): number { return ENCODER_DELAY_SAMPLES / sr; }

export interface BedSource { volume: number; readonly playing: boolean; readonly currentTime: number; play(): void; pause(): void; stop(): void; }

export type BedFlags = { place?: string | null; birds?: boolean; insects?: boolean; highWind?: boolean };

function clamp01(n: number): number { return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; }

function bedClipVol(place: string, id: string): number {
  const d = SCENE_AMBIENCE_DESIGN[place];
  if (!d) return 0;
  for (let i = 0; i < d.bed.length; i++) if (d.bed[i].id === id) return d.bed[i].vol;
  return 0;
}

/** 这一层在这个地方的设计音量。虫鸣夜里 +3 dB（night：0 白天 .. 1 夜里）。层关着时由 bedLayerTarget 归零。 */
export function bedLayerVol(id: string, place: string, night: number): number {
  if (id === 'birds') return place === 'meadow' ? bedClipVol('meadow', 'birds-bed') : 0;
  if (id === 'insects') {
    if (place !== 'meadow') return 0;
    return bedClipVol('meadow', 'insects') * Math.pow(10, 3 * clamp01(night) / 20);
  }
  if (id === 'highWind') {
    if (place === 'balloon') return bedClipVol('balloon', 'high-wind');
    if (place === 'skycity') return bedClipVol('skycity', 'high-wind');
    return 0;
  }
  return 0;
}

/** 床的开关优先。没开这一层就是 0，开了再用该地方的设计音量。 */
export function bedLayerTarget(id: string, bed: BedFlags | null | undefined, night: number): number {
  if (!bed || !(bed as any)[id]) return 0;
  return bedLayerVol(id, bed.place || '', night);
}

/**
 * 2 s 音量曲线。一端是静音：等功率（和 BGM 的交叉同一条 sin/cos）。
 * 两端都有声：同一条循环在变响，smoothstep，中点不会高过两端。
 */
export function layerLevelAt(from: number, to: number, u: number): number {
  const t = clamp01(u);
  if (from <= 1e-4 || to <= 1e-4) return from * Math.cos(t * Math.PI / 2) + to * Math.sin(t * Math.PI / 2);
  const s = t * t * (3 - 2 * t);
  return from + (to - from) * s;
}

export type ScatterClip = { path: string; bundle: string | null };
export type BirdScatter = { vol: number; interval: [number, number]; pan: [number, number]; clips: ScatterClip[]; nightRate: number };

export function birdScatter(): BirdScatter | null {
  const list = SCENE_AMBIENCE_DESIGN.meadow && SCENE_AMBIENCE_DESIGN.meadow.scatter;
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.id === 'bird-calls') return { vol: s.vol, interval: s.interval, pan: s.pan, clips: s.clips, nightRate: 0.25 };
  }
  return null;
}

/** 洗牌袋：一轮里每个素材一次，新一轮的第一个不等于刚播过的（不连续重复）。 */
export function takeFromBag<T>(bag: T[], all: T[], last: T | null, rnd: () => number): T | null {
  if (!all.length) return null;
  if (!bag.length) {
    const b = all.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const x = b[i]; b[i] = b[j]; b[j] = x;
    }
    if (b.length > 1 && b[b.length - 1] === last) { const x = b[0]; b[0] = b[b.length - 1]; b[b.length - 1] = x; }
    for (let i = 0; i < b.length; i++) bag.push(b[i]);
  }
  return bag.pop() as T;
}

/** 零散单发的时钟。playing 已经达到 MAX_SCATTER 就跳过，并记下 skipped。 */
export class ScatterClock {
  skipped = 0;
  nextIn: number;
  constructor(private minS: number, private maxS: number, private rnd: () => number) { this.nextIn = this.gap(); }
  private gap(): number {
    const u = this.rnd();
    const r = Number.isFinite(u) ? Math.max(0, Math.min(1, u)) : 0;
    const span = Math.max(0, this.maxS - this.minS);
    return this.minS + span * r;
  }
  /** true = 可以再起一个声。rate 是夜里的频率倍数（1 白天，0.25 夜里更稀）。 */
  step(dt: number, allowed: boolean, playing: number, rate = 1): boolean {
    const d = Number.isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0;
    if (!allowed) return false;
    const r = Number.isFinite(rate) && rate > 0 ? rate : 0;
    this.nextIn -= d * r;
    if (this.nextIn > 0) return false;
    this.nextIn = this.gap();
    if (playing >= MAX_SCATTER) { this.skipped++; return false; }
    return true;
  }
}

type Log = (event: string, data: Record<string, unknown>) => void;

/** 一层循环：两个声源，2 s 场景交叉 + 0.15 s 接缝交叉。 */
export class LoopBed {
  ready = false;
  level = 0;
  heard = 0;
  private from = 0;
  private to = 0;
  private fadeT = SCENE_AUDIO_CROSSFADE_S;
  private cur: BedSource;
  private next: BedSource;
  private xfading = false;
  private xWait = 0;
  private xFailed = false;
  constructor(private spec: BedLoopSpec, a: BedSource, b: BedSource, private log: Log = () => {}) { this.cur = a; this.next = b; }
  private delay(): number { return encoderDelayS(this.spec.sr); }
  diagnostics() {
    let out = 0;
    try { out = (this.cur.playing ? this.cur.volume : 0) + (this.next.playing ? this.next.volume : 0); } catch (e) { out = 0; }
    return {
      id: this.spec.id, target: +this.to.toFixed(4), level: +this.level.toFixed(4), heard: +this.heard.toFixed(4),
      out: +out.toFixed(4), playing: !!(this.cur.playing || this.next.playing), xfading: this.xfading, xFailed: this.xFailed, ready: this.ready,
      loopS: this.spec.loopS, seamS: SEAM_XFADE_S, delayS: +this.delay().toFixed(5),
    };
  }
  quiet(): void {
    this.level = 0; this.heard = 0; this.from = 0; this.to = 0; this.fadeT = SCENE_AUDIO_CROSSFADE_S;
    this.silence();
  }
  private silence(): void {
    const both = [this.cur, this.next];
    for (let i = 0; i < both.length; i++) { try { both[i].volume = 0; if (both[i].playing) both[i].pause(); } catch (e) { /* source already gone */ } }
  }
  step(dt: number, designTarget: number, canSound: boolean, bed: number): void {
    const d = Number.isFinite(dt) ? Math.max(0, Math.min(0.25, dt)) : 0;
    const target = Number.isFinite(designTarget) ? Math.max(0, designTarget) : 0;
    if (!canSound || !this.ready) {
      this.level = 0; this.heard = 0; this.from = 0; this.to = 0; this.fadeT = SCENE_AUDIO_CROSSFADE_S;
      this.silence();
      return;
    }
    if (Math.abs(target - this.to) > 1e-4) { this.from = this.level; this.to = target; this.fadeT = 0; }
    const fadeS = SCENE_AUDIO_CROSSFADE_S;
    this.fadeT = Math.min(fadeS, this.fadeT + d);
    this.level = layerLevelAt(this.from, this.to, fadeS > 0 ? this.fadeT / fadeS : 1);
    const b = Number.isFinite(bed) ? Math.max(0, Math.min(1, bed)) : 1;
    this.heard = this.level * b;
    if (this.heard < 0.002) { this.silence(); return; }
    if (!this.cur.playing) { try { this.cur.play(); } catch (e) { this.log('bed-play-failed', { id: this.spec.id, err: String(e) }); } }
    if (this.xfading && !this.next.playing) { try { this.next.play(); } catch (e) { /* partner retry below */ } }
    const delay = this.delay();
    if (!this.xfading && !this.xFailed && this.cur.currentTime >= this.spec.loopS) {
      try { this.next.stop(); this.next.volume = 0; this.next.play(); this.xfading = true; this.xWait = 0; }
      catch (e) { this.xFailed = true; this.log('bed-xloop-failed', { id: this.spec.id, err: String(e) }); }
    }
    if (this.xfading) {
      if (!this.next.playing) {
        this.xWait += d;
        if (this.xWait > PARTNER_TIMEOUT_S) { try { this.next.stop(); } catch (e) { /* ignore */ } this.xfading = false; this.xFailed = true; this.log('bed-xloop-failed', { id: this.spec.id }); }
        this.cur.volume = this.heard;
        return;
      }
      const u = Math.max(0, Math.min(1, (this.next.currentTime - delay) / SEAM_XFADE_S));
      this.cur.volume = this.heard * (1 - u);
      this.next.volume = this.heard * u;
      if (u >= 1) {
        try { this.cur.stop(); } catch (e) { /* ignore */ }
        const t = this.cur; this.cur = this.next; this.next = t;
        this.xfading = false;
        this.log('bed-xloop', { id: this.spec.id });
      }
      return;
    }
    this.cur.volume = this.heard;
  }
}

export class BedLayers {
  birds: LoopBed;
  insects: LoopBed;
  highWind: LoopBed;
  scatter: ScatterClock;
  constructor(pairs: { birds: [BedSource, BedSource]; insects: [BedSource, BedSource]; highWind: [BedSource, BedSource] }, rnd: () => number = Math.random, log: Log = () => {}) {
    this.birds = new LoopBed(BED_LOOPS.birds, pairs.birds[0], pairs.birds[1], log);
    this.insects = new LoopBed(BED_LOOPS.insects, pairs.insects[0], pairs.insects[1], log);
    this.highWind = new LoopBed(BED_LOOPS.highWind, pairs.highWind[0], pairs.highWind[1], log);
    const sc = birdScatter();
    this.scatter = new ScatterClock(sc ? sc.interval[0] : 6, sc ? sc.interval[1] : 16, rnd);
  }
  private row(id: BedLayerId): LoopBed {
    if (id === 'birds') return this.birds;
    if (id === 'insects') return this.insects;
    return this.highWind;
  }
  quiet(): void { this.birds.quiet(); this.insects.quiet(); this.highWind.quiet(); }
  /** 返回 true 时调用方再起一个零散鸟鸣（调用方自己数正在响的个数，不超过 MAX_SCATTER）。 */
  step(dt: number, bed: BedFlags | null, canSound: boolean, bedGain: number, night: number, scatterPlaying: number): boolean {
    const n = clamp01(night);
    for (let i = 0; i < BED_LAYER_IDS.length; i++) {
      const id = BED_LAYER_IDS[i];
      this.row(id).step(dt, bedLayerTarget(id, bed, n), canSound, bedGain);
    }
    const sc = birdScatter();
    const rate = sc ? 1 + (sc.nightRate - 1) * n : 1;
    const allow = canSound && bedLayerTarget('birds', bed, 0) > 0;
    return this.scatter.step(dt, allow, scatterPlaying, rate);
  }
  diagnostics() {
    const layers = [];
    for (let i = 0; i < BED_LAYER_IDS.length; i++) layers.push(this.row(BED_LAYER_IDS[i]).diagnostics());
    return { fadeS: SCENE_AUDIO_CROSSFADE_S, layers: layers, scatter: { cap: MAX_SCATTER, skipped: this.scatter.skipped } };
  }
}
