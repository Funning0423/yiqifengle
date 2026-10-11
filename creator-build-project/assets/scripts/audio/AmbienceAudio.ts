// AmbienceAudio.ts — A4（Voice bot）：室外海浪循环 + 随机海鸥。
// 音量跟着 WorldFlowComponent.getRoomLightWeight() 走：w=0（海岛光）满音量，w=1（室内）静音，和光照用同一条曲线。
// 只读轮询，不改任何游戏状态；找不到 WorldFlowComponent 或接口时按"室内"处理，保持无声。
// 静音 / 切后台 / 来电 / 还没有用户手势时，一律跟随 GameAudio.canPlayAmbience() 暂停。
import { _decorator, Component, AudioSource, AudioClip, resources, director, Director, isValid } from 'cc';
import { GameAudio, SfxName } from './GameAudio';
const { ccclass } = _decorator;

const WAVES_PATH = 'audio_amb/amb_waves_loop';
const WAVES_MAX_VOL = 0.55;
const GULLS: SfxName[] = ['sfx_amb_gull_1', 'sfx_amb_gull_2', 'sfx_amb_gull_3'];
const GULL_MIN_S = 8, GULL_MAX_S = 20, GULL_VOL = 0.5;
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
  private craneGullIn = -1;          // >0 时倒计时，到点放一声海鸥

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

  /** 0 = 室内（无声），1 = 室外 */
  private outdoorAmount(dt: number): number {
    if (!this.flow || !isValid(this.flow, true)) {
      this.flow = null; this.refindIn -= dt;
      if (this.refindIn > 0) return 0;
      this.refindIn = REFIND_S;
      try { this.flow = director.getScene()?.getComponentInChildren('WorldFlowComponent') ?? null; } catch { this.flow = null; }
      if (!this.flow) return 0;
      // T2+ 升降镜头起升后约 1.5 秒放一声海鸥，配合画面拉高成海岛全景（接口不存在就跳过）
      if (this.craneHooked !== this.flow && typeof this.flow.onCraneStart === 'function') {
        try { this.flow.onCraneStart(() => { if (this.alive) this.craneGullIn = 1.5; }); this.craneHooked = this.flow; } catch { /* optional */ }
      }
    }
    const get = this.flow.getRoomLightWeight;
    if (typeof get !== 'function') return 0;
    // getRoomLightWeight() 在岛上和"没有 rig"（天空城、关卡等）都返回 0；有 hasRoomLight() 时用它区分，拿不到 rig 一律按室内静音
    // 进关卡 / 天空城 / 切后台时海岛世界不卸载，只把层设成 NONE：hasRoomLight() 仍为 true、w 为 0，所以还要看 isWorldVisible()
    for (const name of ['hasRoomLight', 'isWorldVisible']) {
      const fn = this.flow[name];
      if (typeof fn === 'function') { try { if (!fn.call(this.flow)) return 0; } catch { return 0; } }
    }
    let w = Number(get.call(this.flow));
    if (!Number.isFinite(w)) return 0;
    w = Math.max(0, Math.min(1, w));
    return 1 - w;
  }

  update(dt: number) {
    const src = this.src; if (!src) return;
    const audio = GameAudio.instance;
    const allowed = !!audio && audio.canPlayAmbience() && !!this.clip;
    const target = allowed ? this.outdoorAmount(dt) * WAVES_MAX_VOL : 0;
    const k = Math.min(1, dt * SMOOTH_PER_S);
    this.vol += (target - this.vol) * k;
    if (!allowed || this.vol < 0.002) {
      if (src.playing) { try { src.pause(); } catch { /* ignore */ } }
      if (!allowed) this.vol = 0;
    } else {
      src.volume = this.vol;
      if (!src.playing) { try { src.play(); } catch (e) { console.warn('[AmbienceAudio] waves play failed', e); } }
    }
    if (this.craneGullIn > 0) {
      this.craneGullIn -= dt;
      if (this.craneGullIn <= 0) {
        this.craneGullIn = -1;
        if (allowed) { audio!.play('sfx_amb_gull_1', GULL_VOL); this.gullIn = this.nextGull(); }
      }
    }
    // 海鸥：只在基本处于室外时计时
    if (allowed && target > WAVES_MAX_VOL * 0.8) {
      this.gullIn -= dt;
      if (this.gullIn <= 0) {
        this.gullIn = this.nextGull();
        audio!.play(GULLS[Math.floor(Math.random() * GULLS.length)], GULL_VOL);
      }
    }
  }
}

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => AmbienceAudio.ensure());
