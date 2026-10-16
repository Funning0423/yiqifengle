// WindAudio.ts — 风声（Voice bot）：两条风声循环（soft / strong）+ 围裙布料声。
// 风力来自 运镜bot 的 WorldFlowComponent.getWindStrength()（0..1，每帧轮询），一阶平滑后按 sim2.py 的曲线混音：
//   soft_gain(s)   = min(1, s/0.08) * (0.35 + 0.40*s)
//   strong_gain(s) = smoothstep(0.3, 1.0, s)
// 和海浪不同，风声不看室内外权重（出门那一刻就起风），只在 isWorldVisible() 为 false 时静音。
// 静音 / 切后台 / 来电 / 还没有用户手势：跟随 GameAudio.canPlayAmbience()，和 AmbienceAudio 一样。
// 音乐滑条乘在 soft/strong 曲线外面（0 无声，1 为现在的满音量）。BGM 让风仍走 setWindDuck，不改这条曲线。
// 风力为 0 时什么都不播：两个循环的 AudioSource 直到第一次真正需要出声才创建，安静超过 1 秒就暂停。
//
// 围裙布料声（角色动画bot 接）：onApronLift(strength:'full'|'soft', durationSec:number)
//   'full'：出门时围裙被风整个掀起 —— 布料声音量 0.7；风声本身由 getWindStrength() 驱动；
//           同时通知 AmbienceAudio 0.4 s 后放一声近处海鸥（出门海浪/海鸥逻辑都在 AmbienceAudio）。
//   'soft'：海岛待机时的一阵小风（此时风力为 0）—— 布料声音量 0.28（再低 8 dB），
//           同时内部包络在 durationSec（默认 4 s）内把风声 s 从 0 推到 0.5 再回 0（平滑，约 45% 处到顶）。
//   事件时刻 = 围裙开始掀起的那一刻，布料声当场播放。
//   两种接法任选：
//     1) 直接调用：WindAudio.notifyApronLift('soft', 4)（或 globalThis.__voiceWind.notifyApronLift('soft', 4)，免 import）
//     2) 在 WorldFlowComponent / WorldIntegrationBoot / 角色 adapter 上提供
//        onApronLift(listener:(strength:'full'|'soft', durationSec:number)=>void): ()=>void（返回取消订阅），
//        这里会用 typeof 找到并订阅，销毁时取消。
import { _decorator, Component, AudioSource, AudioClip, resources, director, Director, isValid } from 'cc';
import { GameAudio } from './GameAudio';
import { AmbienceAudio } from './AmbienceAudio';
const { ccclass } = _decorator;

/** Settings music slider. A stub with no getMusicVolume stays at the design full level (1). */
function musicBed(): number {
  const audio: any = GameAudio.instance;
  if (!audio || typeof audio.getMusicVolume !== 'function') return 1;
  const value = Number(audio.getMusicVolume());
  const trans = typeof audio.transitionGain === 'function' ? Number(audio.transitionGain()) : 1;   // 「主页」 fade
  return (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1) * (Number.isFinite(trans) ? Math.max(0, Math.min(1, trans)) : 1);
}

export type ApronLiftStrength = 'full' | 'soft';

const SOFT_PATH = 'audio_amb/amb_wind_soft_loop';
const STRONG_PATH = 'audio_amb/amb_wind_strong_loop';
const FLAP_PATH = 'audio_sfx/sfx_apron_flap';
const WIND_MAX_VOL = 1;            // 素材已按 sim2.py 母带处理，曲线值直接当音量
const FLAP_FULL_VOL = 0.7;         // ≈ -3 dB，满风叠加后峰值仍低于 -8 dBFS
const FLAP_SOFT_VOL = 0.7 * 0.4;   // 再低约 8 dB
const SOFT_PEAK_S = 0.5;           // 'soft' 包络峰值风力
const SOFT_PEAK_AT = 0.45;         // 包络在 durationSec 的 45% 处到顶
const SOFT_DEFAULT_S = 4;
const SMOOTH_TAU_S = 0.25;         // 一阶平滑时间常数
const ON_GAIN = 0.003;             // 低于这个当作无声
const IDLE_PAUSE_S = 1;            // 两条都无声超过这么久就暂停
const REFIND_S = 1;
const HOOK_RETRY_S = 2;

export function smoothstep(a: number, b: number, x: number): number {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u);
}
export function softGain(s: number): number { return Math.min(1, s / 0.08) * (0.35 + 0.40 * s); }
export function strongGain(s: number): number { return smoothstep(0.3, 1.0, s); }

@ccclass('WindAudio')
export class WindAudio extends Component {
  static instance: WindAudio | null = null;

  private softSrc: AudioSource | null = null;
  private strongSrc: AudioSource | null = null;
  private flapSrc: AudioSource | null = null;
  private clips: { [path: string]: AudioClip | null } = {};
  private flow: any = null;
  private boot: any = null;                   // WorldIntegrationBoot（缓存，找到后不再遍历场景）
  private refindIn = 0;
  private hookRetryIn = 0;
  private hooked: any[] = [];                 // 已经订阅过 onApronLift 的对象
  private unsubs: Array<() => void> = [];
  private s = 0;                              // 平滑后的风力（含 'soft' 包络）
  private sWind = 0;                          // 只看 getWindStrength() 的平滑值，报给 AmbienceAudio（出门海浪/海鸥）
  private quietFor = 0;
  private gust = -1;                          // 'soft' 包络已走的时间；<0 表示没有
  private gustDur = SOFT_DEFAULT_S;
  private alive = true;

  static ensure() {
    try {
      const a = GameAudio.ensure();
      if (!a.node.getComponent(WindAudio)) a.node.addComponent(WindAudio);
    } catch (e) { console.warn('[WindAudio] mount failed (silent, gameplay unaffected)', e); }
  }

  /** 角色动画bot 直接调用的入口。strength:'full'|'soft'；durationSec 只对 'soft' 有用（默认 4）。 */
  static notifyApronLift(strength: ApronLiftStrength, durationSec?: number) {
    const w = WindAudio.instance;
    if (w && w.alive) w.onApronLift(strength, durationSec);
  }

  onLoad() {
    if (WindAudio.instance && WindAudio.instance !== this && isValid(WindAudio.instance, true)) { this.alive = false; return; }
    WindAudio.instance = this;
    (globalThis as any).__voiceWind = {
      notifyApronLift: (strength: ApronLiftStrength, durationSec?: number) => WindAudio.notifyApronLift(strength, durationSec),
      snapshot: () => this.snapshot(),
    };
    for (const p of [SOFT_PATH, STRONG_PATH, FLAP_PATH]) {
      this.clips[p] = null;
      resources.load(p, AudioClip, (err, clip) => {
        if (!this.alive || !isValid(this.node, true)) return;
        if (err || !clip) { console.warn('[WindAudio] load failed', p, err); return; }
        clip.addRef(); this.clips[p] = clip;
      });
    }
  }

  onDestroy() {
    const owner = WindAudio.instance === this;
    this.alive = false;
    for (const off of this.unsubs) { try { off(); } catch { /* ignore */ } }
    this.unsubs = []; this.hooked = [];
    for (const src of [this.softSrc, this.strongSrc, this.flapSrc]) {
      if (!src) continue;
      try { src.stop(); } catch { /* ignore */ }
      try { src.clip = null; src.destroy(); } catch { /* ignore */ }
    }
    this.softSrc = this.strongSrc = this.flapSrc = null;
    for (const p in this.clips) { const c = this.clips[p]; if (c) c.decRef(); }
    this.clips = {}; this.flow = null; this.boot = null;
    if (owner) {
      WindAudio.instance = null; AmbienceAudio.setWindExit(0); WindAudio.duckBgm(0);
      const g = (globalThis as any).__voiceWind; if (g) delete (globalThis as any).__voiceWind;
    }
  }

  snapshot() {
    return { s: this.s, soft: this.softSrc ? this.softSrc.volume : 0, strong: this.strongSrc ? this.strongSrc.volume : 0,
      softPlaying: !!this.softSrc?.playing, strongPlaying: !!this.strongSrc?.playing, gust: this.gust, hooks: this.hooked.length };
  }

  /** GameAudio.setWindDuck if present (older GameAudio / test stubs: no-op) */
  private static duckBgm(s: number) {
    const a: any = GameAudio.instance; if (a && typeof a.setWindDuck === 'function') { try { a.setWindDuck(s); } catch { /* optional */ } }
  }

  onApronLift(strength: ApronLiftStrength, durationSec?: number) {
    if (!this.alive) return;
    if (strength !== 'full' && strength !== 'soft') return;
    if (strength === 'soft') {
      const d = Number(durationSec);
      this.gustDur = Number.isFinite(d) && d > 0 ? Math.max(0.5, Math.min(10, d)) : SOFT_DEFAULT_S;
      this.gust = 0;
    }
    if (!this.allowed()) return;
    if (strength === 'full') AmbienceAudio.notifyApronFull();
    this.playFlap(strength === 'full' ? FLAP_FULL_VOL : FLAP_SOFT_VOL);
  }

  private playFlap(vol: number) {
    const clip = this.clips[FLAP_PATH]; if (!clip) return;
    try {
      if (!this.flapSrc) { this.flapSrc = this.newSource(false); }
      const src = this.flapSrc;
      if (src.clip !== clip) src.clip = clip;
      src.volume = vol;
      if (src.playing) src.stop();
      src.play();
    } catch (e) { console.warn('[WindAudio] flap play failed', e); }
  }

  private newSource(loop: boolean): AudioSource {
    const src = this.node.addComponent(AudioSource);
    src.playOnAwake = false; src.loop = loop; src.volume = 0;
    return src;
  }

  private allowed(): boolean {
    const audio = GameAudio.instance;
    if (!audio || !audio.canPlayAmbience()) return false;
    const flow = this.flow;
    if (!flow || !isValid(flow, true)) return false;
    const vis = flow.isWorldVisible;
    if (typeof vis === 'function') { try { if (!vis.call(flow)) return false; } catch { return false; } }
    return true;
  }

  /** 找 WorldFlowComponent（没找到时每秒一次），并尝试订阅可选的 onApronLift 钩子 */
  private locate(dt: number) {
    if (!this.flow || !isValid(this.flow, true)) {
      this.flow = null; this.refindIn -= dt;
      if (this.refindIn > 0) return;
      this.refindIn = REFIND_S;
      try { this.flow = director.getScene()?.getComponentInChildren('WorldFlowComponent') ?? null; } catch { this.flow = null; }
      if (this.flow) this.hookRetryIn = 0;
    }
    if (!this.flow) return;
    this.hookRetryIn -= dt;
    if (this.hookRetryIn > 0) return;
    this.hookRetryIn = HOOK_RETRY_S;
    const cands: any[] = [this.flow];
    try {
      if (!this.boot || !isValid(this.boot, true)) this.boot = director.getScene()?.getComponentInChildren('WorldIntegrationBoot') ?? null;
      const boot = this.boot;
      if (boot) { cands.push(boot); if (boot._referenceAdapter) cands.push(boot._referenceAdapter); if (boot._characterAdapter) cands.push(boot._characterAdapter); }
    } catch { /* optional */ }
    for (const c of cands) {
      if (!c || this.hooked.indexOf(c) >= 0 || typeof c.onApronLift !== 'function') continue;
      try {
        const off = c.onApronLift((strength: ApronLiftStrength, durationSec: number) => this.onApronLift(strength, durationSec));
        this.hooked.push(c);
        if (typeof off === 'function') this.unsubs.push(off);
      } catch (e) { console.warn('[WindAudio] onApronLift subscribe failed', e); }
    }
  }

  private windStrength(): number {
    const get = this.flow ? this.flow.getWindStrength : null;
    if (typeof get !== 'function') return 0;
    let v = 0; try { v = Number(get.call(this.flow)); } catch { return 0; }
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }

  private gustValue(dt: number): number {
    if (this.gust < 0) return 0;
    this.gust += dt;
    const u = this.gust / this.gustDur;
    if (u >= 1) { this.gust = -1; return 0; }
    const e = u < SOFT_PEAK_AT ? smoothstep(0, SOFT_PEAK_AT, u) : 1 - smoothstep(SOFT_PEAK_AT, 1, u);
    return SOFT_PEAK_S * e;
  }

  private startLoop(which: 'soft' | 'strong', vol: number) {
    const path = which === 'soft' ? SOFT_PATH : STRONG_PATH;
    const clip = this.clips[path]; if (!clip) return;
    let src = which === 'soft' ? this.softSrc : this.strongSrc;
    try {
      if (!src) { src = this.newSource(true); if (which === 'soft') this.softSrc = src; else this.strongSrc = src; }
      if (src.clip !== clip) src.clip = clip;
      src.volume = vol;
      if (!src.playing) src.play();
    } catch (e) { console.warn('[WindAudio] wind play failed', which, e); }
  }

  private pauseLoops() {
    for (const src of [this.softSrc, this.strongSrc]) {
      if (src && src.playing) { try { src.pause(); } catch { /* ignore */ } }
    }
  }

  update(dt: number) {
    if (!this.alive) return;
    this.locate(dt);
    const g = this.gustValue(dt);
    const allowed = this.allowed();
    if (!allowed) {
      this.s = 0; this.sWind = 0; AmbienceAudio.setWindExit(0); WindAudio.duckBgm(0); this.quietFor = IDLE_PAUSE_S;
      this.pauseLoops();
      return;
    }
    const wind = this.windStrength();
    const target = Math.max(wind, g);
    const k = 1 - Math.exp(-Math.max(0, dt) / SMOOTH_TAU_S);
    this.s += (target - this.s) * k;
    if (this.s < 1e-4 && target === 0) this.s = 0;
    this.sWind += (wind - this.sWind) * k;
    if (this.sWind < 1e-4 && wind === 0) this.sWind = 0;
    AmbienceAudio.setWindExit(this.sWind);
    WindAudio.duckBgm(this.s);   // BGM 让风：GameAudio 里 -4 dB x smoothstep(0.2, 1, s)，0.5 s 平滑
    const music = musicBed();
    if (music <= 0) {
      for (const src of [this.softSrc, this.strongSrc]) if (src) src.volume = 0;
      this.pauseLoops();
      this.quietFor = IDLE_PAUSE_S;
      return;
    }
    const sv = softGain(this.s) * WIND_MAX_VOL * music, st = strongGain(this.s) * WIND_MAX_VOL * music;
    if (sv < ON_GAIN && st < ON_GAIN) {
      this.quietFor += dt;
      for (const src of [this.softSrc, this.strongSrc]) if (src) src.volume = 0;
      if (this.quietFor >= IDLE_PAUSE_S) this.pauseLoops();
      return;
    }
    this.quietFor = 0;
    if (sv >= ON_GAIN) this.startLoop('soft', sv); else if (this.softSrc) this.softSrc.volume = 0;
    if (st >= ON_GAIN) this.startLoop('strong', st); else if (this.strongSrc) this.strongSrc.volume = 0;
  }
}

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => WindAudio.ensure());
