// AmbienceAudio.ts — A4（Voice bot）：室外海浪循环 + 随机海鸥。
// 音量跟着 WorldFlowComponent.getRoomLightWeight() 走：w=0（海岛光）满音量，w=1（室内）静音，和光照用同一条曲线。
// 只读轮询，不改任何游戏状态；找不到 WorldFlowComponent 或接口时按"室内"处理，保持无声。
// 静音 / 切后台 / 来电 / 还没有用户手势时，一律跟随 GameAudio.canPlayAmbience() 暂停。
// 出门起风（WindAudio 每帧通过 AmbienceAudio.setWindExit(s) 报平滑后的 getWindStrength()）：
//   - 海浪：T5 的 w 在跨门那段一直是 1，要到 toIsland 才开始降，海浪会晚；所以出门时海浪音量至少
//     WAVE_WIND_FLOOR * smoothstep(0.1, 0.6, s)。风力只在出门时 >0（室内/岛上待机都是 0），
//     有 rig 但看不见世界 / 没有 rig 时仍然静音，T5 "室内无声" 不变。
//   - 远处海鸥：一次上升过程中 s 第一次越过 0.4、0.7 各一声（不同素材、更轻），s 回到 0.1 以下才重置。
//   - 近处海鸥：onApronLift('full') 后 0.4 s 一声（WindAudio 调 AmbienceAudio.notifyApronFull()），让开布料声。
//   - 起升镜头海鸥保留；任何两声海鸥间隔至少 GULL_MIN_GAP_S（太近就顺延）；出门过程中不放随机海鸥。
// 海鸥事件（给场景特效bot 的可见海鸥，docs/audio-events.md）：每声海鸥先 'scheduled' 再 'start'（同一 id），
//   方位 yawWorldDeg 由这里选定，声像每帧按当前镜头朝向重算（L/R 两个声源等功率声像）。夜里随机海鸥稀一些、轻一些。
import { _decorator, Component, AudioSource, AudioClip, resources, director, Director, isValid } from 'cc';
import { GameAudio, SfxName } from './GameAudio';
const { ccclass } = _decorator;

const WAVES_PATH = 'audio_amb/amb_waves_loop';
const WAVES_MAX_VOL = 0.55;
const GULLS: SfxName[] = ['sfx_amb_gull_1', 'sfx_amb_gull_2', 'sfx_amb_gull_3'];
const GULL_MIN_S = 8, GULL_MAX_S = 20, GULL_VOL = 0.6;   // gull v6（真实录音 + 混响尾巴，约 3.3 s）
// 出门风声段的海鸥 / 海浪参数（触发逻辑和音量都在这里调）。vol 是绝对音量（AudioSource.volume）。
// maxLateS：因为最小间隔要等的时候，最多晚多少秒；超过就丢掉（0 = 不等，间隔不够直接跳过 / 并掉）。
// 按 运镜bot 138bca5 的真实时间线（leaveHome 起：10.00 跨门 0.1 → 12.36 起 0.15 → 14.73 正面 1.0 → 14.82 围裙掀起 →
// 15.48 起升 → 21.62 回 0）：0.4 一声远处（越线 ~13.5 s 时决定，0.5 s 后 ~14.0 s 开始）；0.7 那声离得太近，并掉；近处在间隔满足后放；起升那声间隔不够就不放。
export const EXIT_AUDIO = {
  waveWindFloor: 0.35,          // 出门时海浪最低音量 = waveWindFloor * smoothstep(waveFloorFrom, waveFloorTo, s)
  waveFloorFrom: 0.1, waveFloorTo: 0.6,
  waveWindDuck: 0.25,           // 满风时海浪让 25%（× (1 - 0.25*smoothstep(0.3,1,s))，约 -2.5 dB），满风+海浪+近处海鸥峰值 <= -6 dBFS
  exitOn: 0.1,                  // s >= exitOn 视为出门风声段（不放随机海鸥）；回到以下就重置
  distant: [                    // 远处海鸥：s 第一次越过 at 时放一声
    { at: 0.4, clip: 'sfx_amb_gull_2' as SfxName, vol: 0.3, maxLateS: 4 },
    { at: 0.7, clip: 'sfx_amb_gull_3' as SfxName, vol: 0.38, maxLateS: 0 },
  ],
  nearDelayS: 0.4, nearClip: 'sfx_amb_gull_1' as SfxName, nearVol: 0.5, nearMaxLateS: 4,   // onApronLift('full') 之后的近处海鸥
  craneDelayS: 1.5, craneClip: 'sfx_amb_gull_1' as SfxName, craneVol: GULL_VOL, craneMaxLateS: 0,
  gullMinGapS: 2.5,             // 同距离（near-near / far-far）两声海鸥最小间隔（素材带 ~1 s 尾巴）；太近就按 maxLateS 顺延或丢掉
  gullCrossGapS: 1.2,           // near 和 far 之间只要 1.2 s（远近两声叠一点听得清）；出门近处那声因此能落在拍打后 0.4 s
};
const SMOOTH_PER_S = 4;          // 一阶平滑，避免 w 有台阶时音量跳
const REFIND_S = 1;              // 没找到 WorldFlowComponent 时每秒再找一次

// ---------------------------------------------------------------- gull call events (docs/audio-events.md)
export type GullDist = 'near' | 'far';
export type GullPhase = 'scheduled' | 'start' | 'cancelled';
export type GullKind = 'random' | 'distant' | 'near' | 'crane' | 'request';
export interface GullCallEvent {
  id: number; phase: GullPhase;
  /** 'scheduled'：计划开始的时间；'start'：实际开始的时间（AmbienceAudio.gameTime() 时钟，秒） */
  at: number;
  dist: GullDist; yawWorldDeg: number; distM: number; durS: number;
  /** 发出事件时距离开始还有多少秒（'start' / 'cancelled' 为 0） */
  leadS: number;
  kind: GullKind; clip: SfxName; vol: number;
}
export type GullCallListener = (e: GullCallEvent) => void;
export const GULL_EVENTS = {
  randomLeadS: 2.5,             // 随机海鸥提前 2.5 s 决定
  // 远处海鸥：风力越线时决定，延后 0.5 s 开始（lead 0.5 s）。没有用"预测越线"：出门风力先在 0.15 停 ~1.5 s 再加速上升，
  // 线性外推要么误报（停住后再取消），要么晚 ~1 s；固定延时最稳，0.4 那声从 ~13.5 s 移到 ~14.0 s，听不出差别。
  distantDelayS: 0.5,
  distantCancelBelow: 0.08,     // 到点时风力 < 阈值 - 0.08（风又回落了）就取消
  nearYawSpreadDeg: 60,         // 近处海鸥：方位在镜头水平朝向 ±60° 内
  nearTurnMinDeg: 5,            // 镜头在转：放在转向那一侧的 [5°, 60°]
  turnRateDegS: 4,              // 镜头水平角速度超过 4°/s 算"在转"
  panDepth: 0.5,                // pan = 0.5 * sin(相对方位)
  nearDistM: [6, 12], farDistM: [30, 60],
  nightRateScale: 0.4, nightVolDb: -3,   // 夜里随机海鸥：频率 x0.4，音量 -3 dB（按 propNightWeight 线性插值）
  durS: { sfx_amb_gull_1: 3.40, sfx_amb_gull_2: 3.29, sfx_amb_gull_3: 3.24 } as { [k: string]: number },
  lrDir: 'audio_sfx/gull_lr/',  // <clip>_L / <clip>_R：单声道素材分别放在左 / 右声道的立体声版本
};
const RANDOM_DIST: { [k: string]: GullDist } = { sfx_amb_gull_1: 'near', sfx_amb_gull_2: 'far', sfx_amb_gull_3: 'far' };

const wrap360 = (d: number) => { const r = d % 360; return r < 0 ? r + 360 : r; };
const wrap180 = (d: number) => { const r = wrap360(d); return r > 180 ? r - 360 : r; };
/** 镜头水平朝向（度）：forward 的 atan2(x, z)，0 = +Z，90 = +X（和 IslandAtmosphereFx 光束、运镜bot 相同的约定） */
export function cameraYawDeg(fwd: { x: number; z: number } | null | undefined): number | null {
  if (!fwd) return null; const x = Number(fwd.x), z = Number(fwd.z);
  if (!Number.isFinite(x) || !Number.isFinite(z) || x * x + z * z < 1e-8) return null;
  return wrap360(Math.atan2(x, z) * 180 / Math.PI);
}
/** 声像 -1（左）..1（右）：海鸥在镜头右侧为正。pan = panDepth * sin(camYaw - yawWorld) */
export function gullPan(yawWorldDeg: number, camYawDeg: number | null): number {
  if (camYawDeg === null || !Number.isFinite(camYawDeg) || !Number.isFinite(yawWorldDeg)) return 0;
  return GULL_EVENTS.panDepth * Math.sin((camYawDeg - yawWorldDeg) * Math.PI / 180);
}
/** L/R 增益：等功率曲线按较响的一边归一化——响的一边始终是 1（居中时两边都是 1，和原来单声道居中一样响），
 *  只把另一边压低，所以声像不会把任何一边推到 vol 以上（峰值余量，见 docs/audio-events.md）。pan 0.5 时 1 / 0.414。 */
export function panGains(pan: number): { l: number; r: number } {
  const p = Math.max(-1, Math.min(1, pan)), th = (p + 1) * Math.PI / 4, c = Math.cos(th), s = Math.sin(th), m = Math.max(c, s);
  return { l: c / m, r: s / m };
}
/** 近处海鸥方位：镜头朝向 ±60° 内；镜头在转（|rate| > 4°/s）时放在转向那一侧。镜头未知时任意方位。 */
export function nearGullYaw(camYawDeg: number | null, camRateDegS: number, rnd: () => number): number {
  const G = GULL_EVENTS;
  if (camYawDeg === null) return wrap360(rnd() * 360);
  if (Math.abs(camRateDegS) > G.turnRateDegS) {
    const side = camRateDegS > 0 ? 1 : -1;
    return wrap360(camYawDeg + side * (G.nearTurnMinDeg + rnd() * (G.nearYawSpreadDeg - G.nearTurnMinDeg)));
  }
  return wrap360(camYawDeg + (rnd() * 2 - 1) * G.nearYawSpreadDeg);
}
export interface GullSlotEntry { at: number; dist: GullDist | null }
/** 两声之间要隔多久：同距离（或距离未知）same，远近不同 cross */
export function gullGap(a: GullDist | null, b: GullDist | null, same: number, cross: number): number { return a === null || b === null || a === b ? same : cross; }
/** 最早可用的开始时间：离 taken 里每一声都满足 gullGap；比 due 晚超过 maxLate 返回 -1。taken 可以直接给数字（距离未知 = same）。 */
export function findGullSlot(due: number, maxLate: number, taken: (number | GullSlotEntry)[], same: number, dist: GullDist | null = null, cross = same): number {
  const es: GullSlotEntry[] = []; for (let i = 0; i < taken.length; i++) { const x = taken[i]; es.push(typeof x === 'number' ? { at: x, dist: null } : x); }
  es.sort((a, b) => a.at - b.at); let t = due;
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < es.length; i++) { const g = gullGap(es[i].dist, dist, same, cross); if (t > es[i].at - g + 1e-9 && t < es[i].at + g - 1e-9) { t = es[i].at + g; moved = true; } }
    if (!moved) break;
  }
  return t - due <= maxLate + 1e-9 ? t : -1;
}
/** 随机海鸥素材的洗牌袋：每轮三个素材各一次、顺序随机，新一轮第一个不等于上一个（绝不连续重复；6 声里每个正好 2 次） */
export function nextFromBag(bag: SfxName[], all: SfxName[], last: SfxName | null, rnd: () => number): SfxName {
  if (!bag.length) {
    const b = all.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)) % (i + 1); const x = b[i]; b[i] = b[j]; b[j] = x; }
    if (b.length > 1 && b[b.length - 1] === last) { const x = b[0]; b[0] = b[b.length - 1]; b[b.length - 1] = x; }
    for (let i = 0; i < b.length; i++) bag.push(b[i]);
  }
  return bag.pop() as SfxName;
}
/** 夜间随机海鸥：频率倍数、音量倍数（w: 0 白天 .. 1 夜里） */
export function nightGullScale(w: number): { rate: number; vol: number } {
  const k = Number.isFinite(w) ? Math.max(0, Math.min(1, w)) : 0, G = GULL_EVENTS;
  return { rate: 1 + (G.nightRateScale - 1) * k, vol: 1 + (Math.pow(10, G.nightVolDb / 20) - 1) * k };
}

interface GullCall { id: number; kind: GullKind; at: number; dist: GullDist; yawWorldDeg: number; distM: number; durS: number; clip: SfxName; vol: number; minWind: number; distantIdx: number }
interface GullVoice { l: AudioSource; r: AudioSource; call: GullCall | null; end: number; fadeAt: number }
const YIELD_FADE_S = 0.25;   // 让路的远处海鸥 0.25 s 淡出

@ccclass('AmbienceAudio')
export class AmbienceAudio extends Component {
  private src: AudioSource | null = null;
  private clip: AudioClip | null = null;
  private flow: any = null;
  private refindIn = 0;
  private vol = 0;
  private gullIn = GULL_MIN_S;       // 距离下一声随机海鸥开始还有多少"白天秒"（夜里按 nightRate 变慢）
  private alive = true;
  private craneHooked: any = null;   // 已订阅 onCraneStart 的 flow
  private clock = 0;                 // 本组件自己的秒表（update 累加）= 海鸥事件的 game time
  private lastGullAt = -1e9;         // 上一声实际开始的时间
  private lastGullDist: GullDist | null = null;
  private recent: { at: number; dist: GullDist; c: GullCall }[] = [];   // 最近开始的几声（算间隔、让路用）
  private bag: SfxName[] = []; private lastRandomClip: SfxName | null = null;
  private pending: GullCall[] = [];  // 已 'scheduled'、还没 'start' 的海鸥
  private distantDone: boolean[] = [];
  private exitActive = false;
  private lastOutdoor = -1;
  private canSoundNow = false;
  private camYaw: number | null = null; private camRate = 0;
  private lrClips: { [k: string]: AudioClip } = {};
  private voices: GullVoice[] = [];

  /** WindAudio 每帧调用：平滑后的 getWindStrength()（被静音/看不见世界时传 0） */
  static windExit = 0;
  private static nearRequests = 0;
  private static inst: AmbienceAudio | null = null;
  private static listeners: GullCallListener[] = [];
  private static nextId = 1;
  private static nightSource: (() => number) | null = null;
  static rnd: () => number = Math.random;
  static setWindExit(s: number) { AmbienceAudio.windExit = Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0; }
  /** WindAudio 在 onApronLift('full') 时调用：nearDelayS 后放一声近处海鸥 */
  static notifyApronFull() { AmbienceAudio.nearRequests++; }
  /** 夜间权重来源（AmbienceNight.ts 注册 IslandPropsLayout.propNightWeight）；没有就按白天 */
  static setNightSource(fn: (() => number) | null) { AmbienceAudio.nightSource = typeof fn === 'function' ? fn : null; }
  static nightWeight(): number { try { const f = AmbienceAudio.nightSource; const w = f ? Number(f()) : 0; return Number.isFinite(w) ? Math.max(0, Math.min(1, w)) : 0; } catch { return 0; } }
  /** 海鸥事件的时钟（秒）：事件里的 at 都是这个时钟 */
  static gameTime(): number { return AmbienceAudio.inst ? AmbienceAudio.inst.clock : 0; }
  /** 海浪循环的播放进度（秒）。正在播 amb_waves_loop 时等于 AudioSource.currentTime，否则 null。
   *  拍岸画面用它锁拍；室内暂停时返回 null，窗边的浪自己往前走。 */
  static wavePlayhead(): number | null {
    const a = AmbienceAudio.inst; if (!a || !a.alive) return null;
    const src = a.src; if (!src || !src.playing) return null;
    const t = src.currentTime; return typeof t === 'number' && Number.isFinite(t) ? t : null;
  }
  /** 订阅海鸥事件；返回取消订阅函数 */
  static onGullCall(cb: GullCallListener): () => void {
    if (typeof cb !== 'function') return () => {};
    AmbienceAudio.listeners.push(cb);
    return () => { const i = AmbienceAudio.listeners.indexOf(cb); if (i >= 0) AmbienceAudio.listeners.splice(i, 1); };
  }
  /** 立即放一声（离上一声 >= 2.5 s、且前后 2.5 s 内没有已排的海鸥、环境声允许、在室外）；返回 id 或 null */
  static requestGullCall(dist: GullDist, yawWorldDeg: number): number | null {
    const a = AmbienceAudio.inst; return a && a.alive ? a.request(dist, yawWorldDeg) : null;
  }

  static ensure() {
    try {
      const a = GameAudio.ensure();
      if (!a.node.getComponent(AmbienceAudio)) a.node.addComponent(AmbienceAudio);
    } catch (e) { console.warn('[AmbienceAudio] mount failed (silent, gameplay unaffected)', e); }
  }

  onLoad() {
    AmbienceAudio.inst = this;
    this.src = this.node.addComponent(AudioSource);
    this.src.playOnAwake = false; this.src.loop = true; this.src.volume = 0;
    resources.load(WAVES_PATH, AudioClip, (err, clip) => {
      if (!this.alive || !isValid(this.node, true)) return;
      if (err || !clip) { console.warn('[AmbienceAudio] waves load failed', err); return; }
      clip.addRef(); this.clip = clip; if (this.src) this.src.clip = clip;
    });
    // 声像用的 L/R 版本（缺了就退回 GameAudio.play 居中播放）
    for (let i = 0; i < GULLS.length; i++) {
      for (let s = 0; s < 2; s++) {
        const key = GULLS[i] + (s ? '_R' : '_L');
        resources.load(GULL_EVENTS.lrDir + key, AudioClip, (err, clip) => {
          if (!this.alive || !isValid(this.node, true)) return;
          if (err || !clip) { console.warn('[AmbienceAudio] gull L/R load failed', key, err); return; }
          clip.addRef(); this.lrClips[key] = clip;
        });
      }
    }
    this.gullIn = this.nextGull();
    this.exposeOnWorld();
  }

  onDestroy() {
    this.alive = false;
    if (AmbienceAudio.inst === this) AmbienceAudio.inst = null;
    try { this.src?.stop(); } catch { /* ignore */ }
    if (this.src) { try { this.src.clip = null; this.src.destroy(); } catch { /* ignore */ } }
    this.clip?.decRef(); this.clip = null; this.src = null; this.flow = null;
    for (let i = 0; i < this.voices.length; i++) { const v = this.voices[i]; this.stopVoice(v); try { v.l.destroy(); v.r.destroy(); } catch { /* ignore */ } }
    this.voices = [];
    const keys = Object.keys(this.lrClips); for (let i = 0; i < keys.length; i++) { try { this.lrClips[keys[i]].decRef(); } catch { /* ignore */ } }
    this.lrClips = {};
    this.pending = [];
  }

  private nextGull() { return GULL_MIN_S + AmbienceAudio.rnd() * (GULL_MAX_S - GULL_MIN_S); }

  /** __worldIntegration 由 WorldIntegrationBoot 创建 / 重建；每帧把海鸥接口挂上去（不改 Boot） */
  private exposeOnWorld() {
    try {
      const wi = (globalThis as any).__worldIntegration;
      if (wi && typeof wi === 'object' && (wi.onGullCall !== AmbienceAudio.onGullCall || wi.wavePlayhead !== AmbienceAudio.wavePlayhead)) {
        wi.onGullCall = AmbienceAudio.onGullCall; wi.requestGullCall = AmbienceAudio.requestGullCall; wi.gullClock = AmbienceAudio.gameTime;
        wi.wavePlayhead = AmbienceAudio.wavePlayhead;
      }
    } catch { /* optional */ }
  }

  /** 0 = 室内（无声），1 = 室外；-1 = 没有世界 / 没有 rig / 世界不可见（连出门风声段的海浪也不放） */
  private outdoorAmount(dt: number): number {
    if (!this.flow || !isValid(this.flow, true)) {
      this.flow = null; this.refindIn -= dt;
      if (this.refindIn > 0) return -1;
      this.refindIn = REFIND_S;
      try { this.flow = director.getScene()?.getComponentInChildren('WorldFlowComponent') ?? null; } catch { this.flow = null; }
      if (!this.flow) return -1;
      // T2+ 升降镜头起升时决定一声海鸥（1.5 s 后开始），配合画面拉高成海岛全景（接口不存在就跳过）
      if (this.craneHooked !== this.flow && typeof this.flow.onCraneStart === 'function') {
        try { this.flow.onCraneStart(() => { if (this.alive && this.canSoundNow) this.planGull('crane', 'near', this.clock + EXIT_AUDIO.craneDelayS, EXIT_AUDIO.craneClip, EXIT_AUDIO.craneVol, EXIT_AUDIO.craneMaxLateS); }); this.craneHooked = this.flow; } catch { /* optional */ }
      }
    }
    const get = this.flow.getRoomLightWeight;
    if (typeof get !== 'function') return -1;
    // getRoomLightWeight() 在岛上和"没有 rig"（天空城、关卡等）都返回 0；有 hasRoomLight() 时用它区分，拿不到 rig 一律按室内静音
    // 进关卡 / 天空城 / 切后台时海岛世界不卸载，只把层设成 NONE：hasRoomLight() 仍为 true、w 为 0，所以还要看 isWorldVisible()
    for (const name of ['hasRoomLight', 'isWorldVisible']) {
      const fn = this.flow[name];
      if (typeof fn === 'function') { try { if (!fn.call(this.flow)) return -1; } catch { return -1; } }
    }
    let w = Number(get.call(this.flow));
    if (!Number.isFinite(w)) return -1;
    w = Math.max(0, Math.min(1, w));
    return 1 - w;
  }

  /** 每帧读当前镜头水平朝向和角速度（没有镜头时为 null，声像居中） */
  private trackCamera(dt: number) {
    let yaw: number | null = null;
    try { const n = this.flow && this.flow.worldCamera && this.flow.worldCamera.node; if (n && isValid(n, true)) yaw = cameraYawDeg(n.forward); } catch { yaw = null; }
    if (yaw !== null && this.camYaw !== null && dt > 0) {
      const r = wrap180(yaw - this.camYaw) / dt; this.camRate += (r - this.camRate) * Math.min(1, dt * 8);
    } else this.camRate = 0;
    this.camYaw = yaw;
  }

  private emit(c: GullCall, phase: GullPhase) {
    const ls = AmbienceAudio.listeners.slice();
    for (let i = 0; i < ls.length; i++) {
      const e: GullCallEvent = { id: c.id, phase, at: c.at, dist: c.dist, yawWorldDeg: c.yawWorldDeg, distM: c.distM, durS: c.durS,
        leadS: phase === 'scheduled' ? Math.max(0, c.at - this.clock) : 0, kind: c.kind, clip: c.clip, vol: c.vol };
      try { ls[i](e); } catch (err) { console.warn('[AmbienceAudio] onGullCall listener threw', err); }
    }
  }

  private taken(): GullSlotEntry[] {
    const t: GullSlotEntry[] = []; let hasLast = false;
    for (let i = 0; i < this.recent.length; i++) { t.push({ at: this.recent[i].at, dist: this.recent[i].dist }); if (this.recent[i].at === this.lastGullAt) hasLast = true; }
    if (!hasLast) t.push({ at: this.lastGullAt, dist: this.lastGullDist });   // 测试 / 诊断直接设的 lastGullAt：距离未知按同距离
    for (let i = 0; i < this.pending.length; i++) t.push({ at: this.pending[i].at, dist: this.pending[i].dist });
    return t;
  }
  private gapTo(a: GullDist | null, b: GullDist | null) { return gullGap(a, b, EXIT_AUDIO.gullMinGapS, EXIT_AUDIO.gullCrossGapS); }
  /** 出门近处海鸥优先：和它冲突的远处 / 随机海鸥让路——还没开始的取消，已经开始的淡出并发 'cancelled' */
  private yieldTo(due: number) {
    const list = this.pending.slice();
    for (let i = 0; i < list.length; i++) { const p = list[i]; if ((p.kind === 'distant' || p.kind === 'random') && Math.abs(p.at - due) < this.gapTo(p.dist, 'near') - 1e-9) this.cancelGull(p); }
    for (let i = this.recent.length - 1; i >= 0; i--) {
      const r = this.recent[i]; if (r.c.kind !== 'distant' && r.c.kind !== 'random') continue;
      if (due - r.at >= this.gapTo(r.dist, 'near') - 1e-9) continue;
      let v: GullVoice | null = null; for (let k = 0; k < this.voices.length; k++) if (this.voices[k].call === r.c) v = this.voices[k];
      if (!v) continue;                                  // 居中兜底播放（GameAudio.play）停不了：近处那声按间隔顺延
      if (v.fadeAt < 0) v.fadeAt = this.clock;
      this.recent.splice(i, 1);
      if (this.lastGullAt === r.at) { this.lastGullAt = -1e9; this.lastGullDist = null; for (let k = 0; k < this.recent.length; k++) if (this.recent[k].at > this.lastGullAt) { this.lastGullAt = this.recent[k].at; this.lastGullDist = this.recent[k].dist; } }
      this.emit(r.c, 'cancelled');
    }
  }

  /** 决定一声海鸥：找满足最小间隔的时间（最多晚 maxLate），选好方位，发 'scheduled'。放不下返回 null（不发事件）。 */
  private planGull(kind: GullKind, dist: GullDist, due: number, clip: SfxName, vol: number, maxLate: number, yaw?: number, minWind = -1, distantIdx = -1): GullCall | null {
    if (kind === 'near') this.yieldTo(due);
    const at = findGullSlot(due, maxLate, this.taken(), EXIT_AUDIO.gullMinGapS, dist, EXIT_AUDIO.gullCrossGapS);
    if (at < 0) return null;
    const G = GULL_EVENTS, rnd = AmbienceAudio.rnd, range = dist === 'near' ? G.nearDistM : G.farDistM;
    const yawW = yaw !== undefined ? wrap360(yaw) : dist === 'near' ? nearGullYaw(this.camYaw, this.camRate, rnd) : wrap360(rnd() * 360);
    const c: GullCall = { id: AmbienceAudio.nextId++, kind, at, dist, yawWorldDeg: +yawW.toFixed(2), distM: +(range[0] + rnd() * (range[1] - range[0])).toFixed(1),
      durS: G.durS[clip] || 3.3, clip, vol, minWind, distantIdx };
    this.pending.push(c);
    this.emit(c, 'scheduled');
    return c;
  }

  private cancelGull(c: GullCall) {
    const i = this.pending.indexOf(c); if (i >= 0) this.pending.splice(i, 1);
    if (c.distantIdx >= 0) this.distantDone[c.distantIdx] = false;
    if (c.kind === 'random') this.gullIn = Math.max(this.gullIn, GULL_EVENTS.randomLeadS);   // 下次仍提前 2.5 s 决定
    this.emit(c, 'cancelled');
  }

  private request(dist: GullDist, yawWorldDeg: number): number | null {
    if (dist !== 'near' && dist !== 'far') return null;
    const y = Number(yawWorldDeg); if (!Number.isFinite(y)) return null;
    const audio = GameAudio.instance;
    if (!audio || !audio.canPlayAmbience() || !(this.lastOutdoor > 0.5 || (this.lastOutdoor >= 0 && AmbienceAudio.windExit >= EXIT_AUDIO.exitOn))) return null;
    const E = EXIT_AUDIO, d = E.distant[Math.floor(AmbienceAudio.rnd() * E.distant.length) % E.distant.length];
    const c = this.planGull('request', dist, this.clock, dist === 'near' ? E.nearClip : d.clip, dist === 'near' ? E.nearVol : d.vol, 0, y);
    if (!c) return null;
    this.startCall(audio, c);
    return c.id;
  }

  private startCall(audio: GameAudio, c: GullCall) {
    const i = this.pending.indexOf(c); if (i >= 0) this.pending.splice(i, 1);
    c.at = this.clock; this.lastGullAt = this.clock; this.lastGullDist = c.dist; this.gullIn = this.nextGull();
    this.recent.push({ at: c.at, dist: c.dist, c }); if (this.recent.length > 4) this.recent.shift();
    this.emit(c, 'start');
    const L = this.lrClips[c.clip + '_L'], R = this.lrClips[c.clip + '_R'];
    if (!L || !R) { audio.play(c.clip, c.vol); return; }   // 没有 L/R 版本：居中
    let v: GullVoice | null = null;
    for (let k = 0; k < this.voices.length; k++) if (!this.voices[k].call) { v = this.voices[k]; break; }
    if (!v && this.voices.length < 3) {   // near 0 s, far 1.2 s, near 2.5 s can overlap (3.4 s clips)
      const mk = () => { const s = this.node.addComponent(AudioSource); s.playOnAwake = false; s.loop = false; s.volume = 0; return s; };
      v = { l: mk(), r: mk(), call: null, end: 0, fadeAt: -1 }; this.voices.push(v);
    }
    if (!v) { v = this.voices[0]; for (let k = 1; k < this.voices.length; k++) if (this.voices[k].end < v.end) v = this.voices[k]; this.stopVoice(v); }
    v.call = c; v.end = this.clock + c.durS + 0.1; v.fadeAt = -1;
    try { v.l.stop(); v.r.stop(); } catch { /* ignore */ }
    v.l.clip = L; v.r.clip = R; this.applyPan(v);
    try { v.l.play(); v.r.play(); } catch (e) { console.warn('[AmbienceAudio] gull play failed', e); this.stopVoice(v); }
  }

  private applyPan(v: GullVoice) {
    if (!v.call) return;
    const g = panGains(gullPan(v.call.yawWorldDeg, this.camYaw));
    const f = v.fadeAt < 0 ? 1 : Math.max(0, 1 - (this.clock - v.fadeAt) / YIELD_FADE_S);
    v.l.volume = Math.min(1, v.call.vol * g.l * f); v.r.volume = Math.min(1, v.call.vol * g.r * f);
  }

  private stopVoice(v: GullVoice) {
    v.call = null; v.end = 0; v.fadeAt = -1;
    try { v.l.stop(); v.r.stop(); } catch { /* ignore */ }
  }

  /** 诊断：排队的海鸥、正在响的海鸥和声像 */
  gullDiagnostics() {
    const playing: { id: number; pan: number; l: number; r: number }[] = [];
    for (let i = 0; i < this.voices.length; i++) { const v = this.voices[i]; if (v.call) playing.push({ id: v.call.id, pan: +gullPan(v.call.yawWorldDeg, this.camYaw).toFixed(3), l: +v.l.volume.toFixed(3), r: +v.r.volume.toFixed(3) }); }
    return { clock: +this.clock.toFixed(3), camYaw: this.camYaw, camRate: +this.camRate.toFixed(2), night: AmbienceAudio.nightWeight(), lastGullAt: this.lastGullAt,
      pending: this.pending.map(c => ({ id: c.id, kind: c.kind, at: +c.at.toFixed(3), dist: c.dist, yaw: c.yawWorldDeg })), playing, lr: Object.keys(this.lrClips).length };
  }

  private static smoothstep(a: number, b: number, x: number) { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }

  update(dt: number) {
    const src = this.src; if (!src) return;
    this.clock += dt;
    this.exposeOnWorld();
    const audio = GameAudio.instance;
    const canSound = !!audio && audio.canPlayAmbience();
    this.canSoundNow = canSound;
    const allowed = canSound && !!this.clip;
    const outdoor = this.outdoorAmount(dt);
    this.lastOutdoor = outdoor;
    this.trackCamera(dt);
    const wind = outdoor >= 0 ? AmbienceAudio.windExit : 0;
    const E = EXIT_AUDIO, G = GULL_EVENTS;
    const floor = E.waveWindFloor * AmbienceAudio.smoothstep(E.waveFloorFrom, E.waveFloorTo, wind);
    const duck = 1 - E.waveWindDuck * AmbienceAudio.smoothstep(0.3, 1.0, wind);
    const target = allowed && outdoor >= 0 ? Math.max(outdoor * WAVES_MAX_VOL, floor) * duck : 0;
    const k = Math.min(1, dt * SMOOTH_PER_S);
    this.vol += (target - this.vol) * k;
    if (!allowed || this.vol < 0.002) {
      if (src.playing) { try { src.pause(); } catch { /* ignore */ } }
      if (!allowed) this.vol = 0;
    } else {
      src.volume = this.vol;
      if (!src.playing) { try { src.play(); } catch (e) { console.warn('[AmbienceAudio] waves play failed', e); } }
    }
    // 出门风声段：远处海鸥在风力越线时决定、distantDelayS 后开始；回到 exitOn 以下重置
    if (wind < E.exitOn) { this.exitActive = false; this.distantDone = []; }
    else {
      this.exitActive = true;
      for (let i = 0; i < E.distant.length; i++) {
        const d = E.distant[i]; if (this.distantDone[i]) continue;
        if (wind < d.at) continue;
        this.distantDone[i] = true;
        if (canSound && outdoor >= 0) this.planGull('distant', 'far', this.clock + G.distantDelayS, d.clip, d.vol, d.maxLateS, undefined, d.at - G.distantCancelBelow, i);
      }
    }
    // 随机海鸥在出门风声段、室内时不放：已排的取消
    const randomOk = allowed && !this.exitActive && outdoor * WAVES_MAX_VOL > WAVES_MAX_VOL * 0.8;
    while (AmbienceAudio.nearRequests > 0) {
      AmbienceAudio.nearRequests--;
      if (canSound) this.planGull('near', 'near', this.clock + E.nearDelayS, E.nearClip, E.nearVol, E.nearMaxLateS);
    }
    // 已排的海鸥：被静音 / 看不见世界时全部取消；到点就开始（时间在排的时候已经满足最小间隔）
    if (this.pending.length) {
      const list = this.pending.slice();
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!canSound || outdoor < 0 || (c.kind === 'random' && !randomOk)) { this.cancelGull(c); continue; }
        if (this.clock + 1e-9 < c.at) continue;
        if (c.minWind >= 0 && wind < c.minWind) { this.cancelGull(c); continue; }
        this.startCall(audio!, c);
      }
    }
    // 随机海鸥：只在基本处于室外、且不在出门风声段时计时；提前 randomLeadS 决定。夜里频率、音量按 propNightWeight 降低
    if (randomOk) {
      const night = nightGullScale(AmbienceAudio.nightWeight());
      this.gullIn -= dt * night.rate;
      let hasRandom = false; for (let i = 0; i < this.pending.length; i++) if (this.pending[i].kind === 'random') hasRandom = true;
      if (!hasRandom && this.gullIn / night.rate <= G.randomLeadS) {
        const clip = nextFromBag(this.bag, GULLS, this.lastRandomClip, AmbienceAudio.rnd); this.lastRandomClip = clip;
        const c = this.planGull('random', RANDOM_DIST[clip], this.clock + Math.max(0, this.gullIn / night.rate), clip, +(GULL_VOL * night.vol).toFixed(4), 30);
        if (!c) this.gullIn = E.gullMinGapS;
      }
    }
    // 声像：每帧按当前镜头朝向重算；到时间的声源收回；不能出声时立即停
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i]; if (!v.call) continue;
      if (!canSound || this.clock >= v.end || (v.fadeAt >= 0 && this.clock - v.fadeAt >= YIELD_FADE_S)) this.stopVoice(v); else this.applyPan(v);
    }
  }
}

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => AmbienceAudio.ensure());
