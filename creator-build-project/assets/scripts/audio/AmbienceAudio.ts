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
import { _decorator, Component, AudioSource, AudioClip, resources, director, Director, isValid } from 'cc';
import { GameAudio, SfxName } from './GameAudio';
const { ccclass } = _decorator;

const WAVES_PATH = 'audio_amb/amb_waves_loop';
const WAVES_MAX_VOL = 0.55;
const GULLS: SfxName[] = ['sfx_amb_gull_1', 'sfx_amb_gull_2', 'sfx_amb_gull_3'];
const GULL_MIN_S = 8, GULL_MAX_S = 20, GULL_VOL = 0.5;
// 出门风声段的海鸥 / 海浪参数（海鸥素材会换，触发逻辑和音量都在这里调）
export const EXIT_AUDIO = {
  waveWindFloor: 0.35,          // 出门时海浪最低音量 = waveWindFloor * smoothstep(waveFloorFrom, waveFloorTo, s)
  waveFloorFrom: 0.1, waveFloorTo: 0.6,
  exitOn: 0.1,                  // s >= exitOn 视为出门风声段（不放随机海鸥）；回到以下就重置
  distant: [                    // 远处海鸥：s 第一次越过 at 时放一声，音量 = rel * GULL_VOL
    { at: 0.4, clip: 'sfx_amb_gull_2' as SfxName, rel: 0.35 },
    { at: 0.7, clip: 'sfx_amb_gull_3' as SfxName, rel: 0.45 },
  ],
  nearDelayS: 0.4, nearClip: 'sfx_amb_gull_1' as SfxName, nearRel: 0.8,   // onApronLift('full') 之后的近处海鸥
  craneDelayS: 1.5, craneClip: 'sfx_amb_gull_1' as SfxName, craneRel: 1,
  gullMinGapS: 0.8,             // 任意两声海鸥最小间隔，太近就顺延
};
const SMOOTH_PER_S = 4;          // 一阶平滑，避免 w 有台阶时音量跳
const REFIND_S = 1;              // 没找到 WorldFlowComponent 时每秒再找一次

@ccclass('AmbienceAudio')
export class AmbienceAudio extends Component {
  private src: AudioSource | null = null;
  private clip: AudioClip | null = null;
  private flow: any = null;
  private refindIn = 0;
  private vol = 0;
  private gullIn = GULL_MIN_S;
  private alive = true;
  private craneHooked: any = null;   // 已订阅 onCraneStart 的 flow
  private clock = 0;                 // 本组件自己的秒表（update 累加）
  private lastGullAt = -1e9;
  private pending: { at: number; clip: SfxName; vol: number }[] = [];
  private distantDone: boolean[] = [];
  private exitActive = false;

  /** WindAudio 每帧调用：平滑后的 getWindStrength()（被静音/看不见世界时传 0） */
  static windExit = 0;
  private static nearRequests = 0;
  static setWindExit(s: number) { AmbienceAudio.windExit = Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0; }
  /** WindAudio 在 onApronLift('full') 时调用：nearDelayS 后放一声近处海鸥 */
  static notifyApronFull() { AmbienceAudio.nearRequests++; }

  static ensure() {
    try {
      const a = GameAudio.ensure();
      if (!a.node.getComponent(AmbienceAudio)) a.node.addComponent(AmbienceAudio);
    } catch (e) { console.warn('[AmbienceAudio] mount failed (silent, gameplay unaffected)', e); }
  }

  onLoad() {
    this.src = this.node.addComponent(AudioSource);
    this.src.playOnAwake = false; this.src.loop = true; this.src.volume = 0;
    resources.load(WAVES_PATH, AudioClip, (err, clip) => {
      if (!this.alive || !isValid(this.node, true)) return;
      if (err || !clip) { console.warn('[AmbienceAudio] waves load failed', err); return; }
      clip.addRef(); this.clip = clip; if (this.src) this.src.clip = clip;
    });
    this.gullIn = this.nextGull();
  }

  onDestroy() {
    this.alive = false;
    try { this.src?.stop(); } catch { /* ignore */ }
    if (this.src) { try { this.src.clip = null; this.src.destroy(); } catch { /* ignore */ } }
    this.clip?.decRef(); this.clip = null; this.src = null; this.flow = null;
  }

  private nextGull() { return GULL_MIN_S + Math.random() * (GULL_MAX_S - GULL_MIN_S); }

  /** 0 = 室内（无声），1 = 室外；-1 = 没有世界 / 没有 rig / 世界不可见（连出门风声段的海浪也不放） */
  private outdoorAmount(dt: number): number {
    if (!this.flow || !isValid(this.flow, true)) {
      this.flow = null; this.refindIn -= dt;
      if (this.refindIn > 0) return -1;
      this.refindIn = REFIND_S;
      try { this.flow = director.getScene()?.getComponentInChildren('WorldFlowComponent') ?? null; } catch { this.flow = null; }
      if (!this.flow) return -1;
      // T2+ 升降镜头起升后约 1.5 秒放一声海鸥，配合画面拉高成海岛全景（接口不存在就跳过）
      if (this.craneHooked !== this.flow && typeof this.flow.onCraneStart === 'function') {
        try { this.flow.onCraneStart(() => { if (this.alive) this.queueGull(this.clock + EXIT_AUDIO.craneDelayS, EXIT_AUDIO.craneClip, EXIT_AUDIO.craneRel * GULL_VOL); }); this.craneHooked = this.flow; } catch { /* optional */ }
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

  private queueGull(at: number, clip: SfxName, vol: number) {
    this.pending.push({ at, clip, vol });
  }

  /** 放一声海鸥并记下时间（最小间隔由调用方检查） */
  private playGull(audio: GameAudio, clip: SfxName, vol: number) {
    audio.play(clip, vol); this.lastGullAt = this.clock;
  }

  private static smoothstep(a: number, b: number, x: number) { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); }

  update(dt: number) {
    const src = this.src; if (!src) return;
    this.clock += dt;
    const audio = GameAudio.instance;
    const canSound = !!audio && audio.canPlayAmbience();
    const allowed = canSound && !!this.clip;
    const outdoor = this.outdoorAmount(dt);
    const wind = outdoor >= 0 ? AmbienceAudio.windExit : 0;
    const E = EXIT_AUDIO;
    const floor = E.waveWindFloor * AmbienceAudio.smoothstep(E.waveFloorFrom, E.waveFloorTo, wind);
    const target = allowed && outdoor >= 0 ? Math.max(outdoor * WAVES_MAX_VOL, floor) : 0;
    const k = Math.min(1, dt * SMOOTH_PER_S);
    this.vol += (target - this.vol) * k;
    if (!allowed || this.vol < 0.002) {
      if (src.playing) { try { src.pause(); } catch { /* ignore */ } }
      if (!allowed) this.vol = 0;
    } else {
      src.volume = this.vol;
      if (!src.playing) { try { src.play(); } catch (e) { console.warn('[AmbienceAudio] waves play failed', e); } }
    }
    // 出门风声段：越过阈值的远处海鸥，回到 exitOn 以下重置
    if (wind < E.exitOn) { this.exitActive = false; this.distantDone = []; }
    else {
      this.exitActive = true;
      for (let i = 0; i < E.distant.length; i++) {
        const d = E.distant[i];
        if (!this.distantDone[i] && wind >= d.at) { this.distantDone[i] = true; if (canSound) this.queueGull(this.clock, d.clip, d.rel * GULL_VOL); }
      }
    }
    while (AmbienceAudio.nearRequests > 0) {
      AmbienceAudio.nearRequests--;
      if (canSound) this.queueGull(this.clock + E.nearDelayS, E.nearClip, E.nearRel * GULL_VOL);
    }
    // 排队的海鸥：到点且离上一声 >= gullMinGapS 才放，否则顺延（被静音时丢弃）
    if (this.pending.length) {
      if (!canSound || outdoor < 0) this.pending = [];
      else {
        this.pending.sort((x, y) => x.at - y.at);
        const g = this.pending[0];
        if (this.clock >= g.at && this.clock - this.lastGullAt >= E.gullMinGapS) {
          this.pending.shift(); this.playGull(audio!, g.clip, g.vol); this.gullIn = this.nextGull();
        }
      }
    }
    // 随机海鸥：只在基本处于室外、且不在出门风声段时计时
    if (allowed && !this.exitActive && outdoor * WAVES_MAX_VOL > WAVES_MAX_VOL * 0.8) {
      this.gullIn -= dt;
      if (this.gullIn <= 0) {
        if (this.clock - this.lastGullAt < E.gullMinGapS || this.pending.length) { this.gullIn = E.gullMinGapS; }
        else { this.gullIn = this.nextGull(); this.playGull(audio!, GULLS[Math.floor(Math.random() * GULLS.length)], GULL_VOL); }
      }
    }
  }
}

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => AmbienceAudio.ensure());
