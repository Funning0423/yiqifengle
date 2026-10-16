// Oi audio repair: real BGM loader + gesture/lifecycle gate; device hearing remains a separate acceptance step.
// GameAudio.ts — 音频管理脚本 v0.3.3（cursor 接手 Voice Bot，2026-10-10）——基于 0005c v0.3.2，按 Oi 对 0005c 的复审修订
// v0.3.3：
//   a) 欠着的旧 End（staleGen）只在回前台后 staleEndWindowMs（默认 2 s）内有效；超时作废，之后的 End 结束当前打断，
//      一次丢 End 不再一轮轮带进以后的打断（复审 #1）。窗口内的迟到 End 仍按 v0.3.2 规则算旧打断的。
//   b) ensure() 和重复组件判定都要求组件未调用过 destroy()、节点 isValid(node, true)：已排队销毁的旧实例不算活实例，新实例接管它的
//      挂起 / 打断状态；旧实例停止响应事件，自己的声源和 clip 引用仍在它的 onDestroy 里释放（复审 #2）。
// v0.3.2（Voice Bot）：
//   a) 回前台只在“真正从后台回来”（hidden → 可见 的那一下）生效；重复的 Show（Cocos + wx 双路）是空操作，
//      不会吞掉回前台之后新开始的打断（审查 #1）。
//   b) 打断按“代”编号；End 按先后顺序对应最早一个还没收到 End 的打断。被回前台强制结束、还没收到 End 的那一代
//      记为 staleGen，下一个 End 先算给它，不会清掉更新的打断（审查 #2）。规则表见 README。
//   c) setInnerAudioOption 只有 success 回调后才算设置成功；fail / 抛异常允许重试（下次 onLoad、下次回前台）（审查 #3）。
//   d) 第二个 GameAudio 组件在 onLoad 里被拒绝：不覆盖 instance、不注册任何回调、不建声源，并销毁这个多余组件（审查 #4）。
//   e) update() 在静音时也按住循环声（审查 #5）。
// v0.3.1（Grok Bot 决定，保留）：从后台回到前台时，即使没收到 onAudioInterruptionEnd 也恢复（只对“开始于后台之前或期间、
//         一直持续到回前台”的打断）。这是有意的取舍：宁可通话中偶尔叠音，也不能永久无声。
//         前台期间开始、没有经历切后台的打断，只能由 InterruptionEnd 结束。
// SFX 使用独立、可停止的非循环 AudioSource；预算满时只丢弃新请求，不抢占胜利尾音。
// 基线：Oi R6 版 creator-build-project/assets/scripts/audio/GameAudio.ts（git blob 4b6f0ac，
//       SHA256 a2f40503278f6237c325aabb7816372da37db718b9caacec18b51a830ef7272e），R6 的行为全部保留。
// v0.3 新增：
//   1) 统一的“挂起”状态：原因集合 {hidden, interrupted}。只要还有任何一个原因，就不播新音效、循环声保持暂停；
//      所有原因都清掉后才恢复。重复事件是幂等的（同一个原因加两次/清两次不会重复暂停或恢复）。
//   2) 来电/其他 App 抢音频：wx.onAudioInterruptionBegin / wx.onAudioInterruptionEnd。
//      （Cocos 3.8.8 引擎自己只在 wx.onHide/onShow 时暂停/恢复播放器，不监听 audioInterruption，所以这里要补。）
//   3) 前后台：保留 R6 的 game.on(Game.EVENT_HIDE/EVENT_SHOW)，再加 wx.onHide/wx.onShow 兜底；切后台两路都映射到同一个
//      'hidden' 原因，所以同一次切后台收到两次事件也只算一次。从后台回前台清掉 'hidden' 和跨越了后台的 'interrupted'。
//   4) 启动时调一次 wx.setInnerAudioOption({ mixWithOther: true, obeyMuteSwitch: true })，理由见 README。
//   5) 每帧兜底：挂起期间如果循环声被引擎自动恢复（引擎 onShow 会恢复它自己暂停的播放器），立刻再暂停。
//   6) 静音存储 key 恢复为正式 key 'qfl.audio.muted'（R6 用的是隔离测试 key 'dot-audio-r1-test-20261009:muted'，不再读写）。
// 所有 wx 调用都先判断 typeof wx !== 'undefined' 且函数存在；Web / 编辑器预览里没有 wx，只走 Cocos 事件。
// 公共 API（ensure / instance / play / setMuted / isMuted / onBoardFrame / onRender / resetRenderBaseline /
// onChestResult / onClaimResult / onButton / onToolTap）与 R6、0005 完全一致，AudioBridge.ts 不用改。
// 资源位置：assets/resources/audio_sfx/sfx_*.mp3（resources 是启动时加载的分包，合计约 88 KB）。
// v0.4（Voice bot，场景 BGM）：
//   a) setMusic(path, bundle?)：bundle 为空 = resources（原行为，调用方式不变）；否则 assetManager.loadBundle(bundle) 后 bundle.load。
//   b) 无缝循环：MP3 编码延迟 + 尾部填充约 41–46 ms，平台 loop 每圈会空一下。改为两个声源交叉循环：播到
//      (时长 - MP3_PADDING_S - LOOP_XFADE_S) 时第二个声源从头起播，确认在播后做 LOOP_XFADE_S 的等功率交叉，然后它接任 loopSource。
//      旧声源 loop 仍为 true：第二个声源起不来时平台循环兜底（退回原来的“空一下”，不会断音）。
//   c) 切场景（setMusic 换曲且当前正在播）：旧声源先继续播，新曲确认在播后 SCENE_XFADE_S 等功率交叉；加载失败/超时则旧曲淡出。
//   d) 静音 / 挂起 / 音量 0 / setMusic(null) / 销毁：交叉用的额外声源立即停掉销毁，只保留 loopSource（原有的解锁、重试、冷却规则不变）。
//   loopSource 始终是“当前主声源”，T0 的 bgmInfo / pollBgm 照旧读它；musicDiagnostics() 增加 bundle / crossfade 字段。
// v0.5（Voice bot，包体）：
//   a) 小岛 BGM 挪出 resources，放进独立小分包 audio_bgm_island（DEFAULT_BGM_BUNDLE，设置与 region_skycity 相同）。
//      GameAudio.onLoad 不再自己加载默认 BGM（启动 / 加载页不碰音乐）；由 SceneMusic 在房间可操作后 setMusic(..., { fadeIn: true })。
//   b) setMusic 第三个参数 opts.fadeIn：这一曲第一次真正起播时从 0 等功率淡入 ROOM_FADE_IN_S（1.5 s）。
//   c) 解锁与加载谁先谁后都行：手势状态（gestureSeen）一直记着，分包晚到时 loaded 回调里直接起播，不需要再摸一次。
//   d) “音乐真正开始”的时刻：GameAudio.onMusicStart(cb) / globalThis.__gameAudioMusic.onMusicStart(cb)，
//      loopSource 第一次确认 playing 时发一次（每次 setMusic 一次；切后台回来的恢复记 first=false）。
import { _decorator, Component, Node, AudioSource, AudioClip, resources, assetManager, director, game, Game, sys, isValid, input, Input } from 'cc';
const { ccclass } = _decorator;

export type SfxName = 'sfx_match_normal' | 'sfx_combo_1' | 'sfx_combo_2' | 'sfx_combo_3'
  | 'sfx_chest_open' | 'sfx_ui_click' | 'sfx_level_clear'
  | 'sfx_cheer_1_great' | 'sfx_cheer_2_excellent' | 'sfx_cheer_3_amazing' | 'sfx_cheer_4_unbelievable'
  | 'sfx_amb_gull_1' | 'sfx_amb_gull_2' | 'sfx_amb_gull_3'
  | 'sfx_ui_bag' | 'sfx_ui_book' | 'sfx_ui_signpost' | 'sfx_ui_confirm' | 'sfx_ui_back';

/** A2（Voice bot）：连击鼓励音，第 2/3/4/5+ 波各一档，配合文字飘字。同一时间只保留一条，更高档顶掉正在播的低档。 */
const CHEERS: SfxName[] = ['sfx_cheer_1_great', 'sfx_cheer_2_excellent', 'sfx_cheer_3_amazing', 'sfx_cheer_4_unbelievable'];

/** A5（Voice bot）：岛上 3D 道具点击音。press 播各自的音，confirm 统一播确认音；设置没有专用音，播通用点击 sfx_ui_click。
 *  ui-soft 柔和版（Funning 选定）：行囊 / 旅程册 / 路牌 / 通用点击是 Kenney CC0 录音，确认 / 返回是自制毛毡槌两音，
 *  见 docs/audio-credits.md。2026-10-12 用 ffmpeg 把六个文件的积分响度收到约 -21.5 LUFS、真峰值不超过 -1 dBTP
 *  （bag / book / click / signpost 加了轻微限幅），所以 UI_TAP_VOLUME 仍是 1。
 *  鼓励音文件积分响度约 -12.0 ~ -13.6 LUFS、音量 1，按钮音仍比鼓励音低约 8 dB（至少 6 dB）。
 *  同一次点击会先 press 再 confirm（实测相隔 6–13 ms）。按下音已经播出后，150 ms 内不再叠确认音。 */
export type UiTapTarget = 'signpost' | 'bag' | 'book' | 'settings';
const UI_PRESS: Record<UiTapTarget, SfxName> = {
  bag: 'sfx_ui_bag', book: 'sfx_ui_book', settings: 'sfx_ui_click', signpost: 'sfx_ui_signpost',
};
const UI_TAP_VOLUME = 1;
const UI_CONFIRM_AFTER_PRESS_MS = 150;

/** 挂起原因：hidden = 切后台；interrupted = 来电/其他 App/系统抢走音频 */
export type SuspendReason = 'hidden' | 'interrupted';

const SFX_DIR = 'audio_sfx';
// One explicit default (island BGM), in its own small subpackage bundle; loaded by SceneMusic once the room is interactive.
export const DEFAULT_BGM_PATH = 'audio/bgm_main';
export const DEFAULT_BGM_BUNDLE = 'audio_bgm_island';
/** v0.5：进房第一次起播的淡入时长 */
export const ROOM_FADE_IN_S = 1.5;
export type MusicStartInfo = { path: string | null; bundle: string | null; at: number; first: boolean; fadeIn: boolean; requestedAt: number; loadedAt: number | null };
const MUSIC_VOLUME_KEY = 'qfl.audio.musicVolume';
const SFX_MUTE_KEY = 'qfl.audio.sfxMuted';   // 设置页「音效」开关：只关音效（含鼓励音），不关音乐
const MUTE_KEY = 'qfl.audio.muted';   // 正式 key。R6 实测用的是隔离 key 'dot-audio-r1-test-20261009:muted'，那份测试存档不迁移。
const MIN_GAP_MS = 60;        // 同一个音效 60 ms 内只播一次，防止同帧多次触发叠成爆音
// Cocos 3.8.8 may resolve a mini-game player load after its own 8 s fallback.
// This is an observation deadline, not proof of failure; retry requires a new gesture.
const LOOP_START_TIMEOUT_MS = 10000;
const MAX_LOOP_RECOVERIES = 1; // Consecutive failure retries; confirmed playback resets this.
const LOOP_REBUILD_GAP_MS = 10000; // Bound repeated gate cancellations before playback is confirmed.
const MAX_VOICES = 6;         // 同时最多 6 个音效；微信小游戏同时存在的音频实例数量有限，宁少勿多
const SFX_START_TIMEOUT_MS = 10000; // Only unconfirmed starts; never a playing clip's duration limit.
/** v0.4：LAME 编码延迟 + 尾部填充（44.1 kHz 下 1811–2016 个采样）。不裁 gapless 头的解码器把这段算进时长。 */
export const MP3_PADDING_S = 0.045;
/** v0.4：循环接缝的等功率交叉时长 */
export const LOOP_XFADE_S = 0.15;
/** v0.4：切场景 BGM 的等功率交叉时长 */
export const SCENE_XFADE_S = 1.5;
/** 交叉要在真正的尾巴之前做完：再留两帧余量（update 按帧检查） */
const LOOP_SAFETY_S = 0.03;
// 出门大风时 BGM 让一点（WindAudio 每帧调 setWindDuck(平滑后的风力 s)）：-4 dB x smoothstep(0.2, 1.0, s)，再按 0.5 s 时间常数平滑。
// 峰值余量见 docs/audio-events.md（风 + 海浪 + 拍打 + 近处海鸥 + BGM 循环交叉）。
const WIND_DUCK_DB = -4;
const WIND_DUCK_TAU_S = 0.5;
const WIND_DUCK_FROM = 0.2;
const WIND_DUCK_TO = 1.0;
/** currentTime 在小游戏里可能按 ~250 ms 更新；外推最多超前这么多 */
const POS_EXTRAPOLATE_MAX_S = 0.35;

type SfxVoice = { source: AudioSource; name: SfxName; requestedAt: number; started: boolean };

type WxFn = (cb: (...a: any[]) => void) => void;
/** 取 wx 上的某个函数；没有 wx（Web/编辑器）或没有这个函数（低版本基础库）就返回 null */
function wxFn(name: string): ((...a: any[]) => any) | null {
  const w: any = (typeof wx !== 'undefined') ? (wx as any) : null;
  if (!w) return null;
  const f = w[name];
  return typeof f === 'function' ? f.bind(w) : null;
}

@ccclass('GameAudio')
export class GameAudio extends Component {
  static instance: GameAudio | null = null;
  /** 只有 wx.setInnerAudioOption 的 success 回调到了才为 true（审查 #3） */
  private static innerAudioOptionApplied = false;
  /** 已发出、还没有 success/fail 回调；期间不重复调用 */
  private static innerAudioOptionPending = false;

  private sfxVoices = new Map<AudioSource, SfxVoice>();
  /** One-shot cinematic bed (island→meadow). Missing file is a no-op. Not part of the short-sfx voice budget. */
  private cineSource: AudioSource | null = null;
  private cineClip: AudioClip | null = null;
  private cineGen = 0;
  private cinePaused = false;
  private cineFadeAt: number | null = null;
  private cineFadeS = 0;
  private cineFadeFrom = 1;
  /** Existing ambience loop used only while a cinematic holds for a bundle load. */
  private holdSource: AudioSource | null = null;
  private holdClip: AudioClip | null = null;
  private holdPath: string | null = null;
  private holdGen = 0;
  private holdWanted = false;
  private holdLoading = false;
  private holdFadeAt: number | null = null;
  private holdFadeS = 0;
  private holdFadeFrom = 1;
  private readonly onSfxStarted = (source: AudioSource) => {
    const voice = this.sfxVoices.get(source);
    if (voice) voice.started = true;
  };
  private readonly onSfxEnded = (source: AudioSource) => {
    // Web PAL emits ENDED before setting its state to INIT. Identity is sufficient.
    if (this.sfxVoices.has(source)) this.retireSfx(source);
  };
  private loopSource!: AudioSource;
  private musicClip: AudioClip | null = null;
  private musicPath: string | null = null;
  private musicBundle: string | null = null;
  /** v0.4 循环交叉：接任的第二个声源；xfadeAt = 它确认在播的时刻（null = 还没确认） */
  private loopPartner: AudioSource | null = null;
  private loopXfadeAt: number | null = null;
  private loopXfades = 0;
  /** v0.4 切场景交叉：正在淡出的旧曲声源；sceneFadeAt = 交叉开始时刻；sceneFadeIn = 新 loopSource 需要从 0 淡入 */
  private fadeOutSource: AudioSource | null = null;
  private fadeOutFrom = 1;
  /** musicVolume at the moment fadeOutFrom was captured, so a later slider move scales that voice without dropping the wind-duck ratio baked into fadeOutFrom. */
  private fadeOutAtVolume = 1;
  private sceneSwitchAt = 0;
  private sceneFadeAt: number | null = null;
  private sceneFadeIn = false;
  /** v0.5：淡入 / 交叉的时长（切场景 SCENE_XFADE_S；进房淡入 ROOM_FADE_IN_S） */
  private sceneFadeS = SCENE_XFADE_S;
  /** v0.5：“真正开始”事件。startEmittedGen = 已为哪一次 setMusic 发过 first 事件 */
  private startEmittedGen = 0;
  private musicRequestedAt = 0;
  private musicLoadedAt: number | null = null;
  private musicFadeInRequested = false;
  private lastStart: MusicStartInfo | null = null;
  /** v0.5：loopSource.play() 已发出、还没报过“真正开始” */
  private startPending = false;
  /** currentTime 外推基准 */
  private posCt = NaN;
  private posAt = 0;
  private windDuckTarget = 0;   // 0..1（smoothstep 后）
  private windDuck = 0;         // 平滑后的 0..1
  private windDuckAt = -1;      // 上次平滑的 GameAudio.now()（ms）
  private musicGeneration = 0;
  private musicVolume = 0.4;
  private musicStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  private musicError: string | null = null;
  private gestureSeen = false;
  private loopRequested = false;
  private loopPendingSince: number | null = null;
  private loopNeedsReplacement = false;
  private loopRecoveries = 0;
  private loopRetryIsFailure = false;
  private loopNextReplacementAt = 0;
  private readonly onGesture = () => {
    if (!GameAudio.usable(this) || GameAudio.instance !== this) return;
    this.gestureSeen = true;
    // Attempt in the actual input callback. A pending engine request is coalesced.
    this.resumeLoopIfAllowed(true);
  };
  private clips = new Map<string, AudioClip>();
  private lastPlay = new Map<string, number>();
  private muted = false;
  private sfxMuted = false;
  private reasons = new Set<SuspendReason>();  // 挂起原因集合；为空 = 正常
  private cascade = 0;                         // 本次操作里第几波消除（0 = 还没消）
  /** 最近一次真正播出的道具按下音：同目标在 UI_CONFIRM_AFTER_PRESS_MS 内不再叠 confirm */
  private uiPressTarget = '';
  private uiPressAt = -1e9;
  private prevState: string | undefined;       // 上一次 render 的 state；undefined = 还没有基准
  // wx 回调要用同一个函数引用才能 off，所以存成字段
  private readonly wxOnHide = () => this.suspend('hidden');
  private readonly wxOnShow = () => this.onShowEvent();
  private readonly wxOnIntBegin = () => this.onInterruptBegin();
  private readonly wxOnIntEnd = () => this.onInterruptEnd();
  private wxRegistered: Array<[string, (...a: any[]) => void]> = [];
  private alive = true;                        // onDestroy 后置 false：低版本基础库没有 wx.off* 时，残留回调直接无效
  // 打断的“代”（审查 #2）：每个新的 Begin 一代；activeGen = 当前生效的打断（0 = 没有）；
  // staleGen = 被回前台强制结束、但还没收到它自己 End 的那一代（0 = 没有）。最多记一代。
  private interruptGen = 0;
  private activeGen = 0;
  private staleGen = 0;
  private staleSince = 0;                      // staleGen 产生（回前台）的时间
  private built = false;                       // onLoad 真正建了声源 / 注册了回调；被拒组件为 false
  /** v0.3.3（Oi 复审 #1）：欠着的旧 End 只在回前台后这段时间内有效。超时后 staleGen 作废，
   *  后面的 End 一律算当前打断的，所以一次丢 End 不会一轮轮滚到以后的打断里。 */
  static staleEndWindowMs = 2000;
  /** 测试可替换的时钟 */
  static now: () => number = () => Date.now();

  /** v0.3.3（Oi 复审 #2）：组件或节点已在本帧排队销毁（destroy 延迟到帧末）就不算活实例 */
  private static usable(a: GameAudio | null): a is GameAudio {
    return !!a && a.alive && !a.destroying && isValid(a.node, true);
  }
  private destroying = false;
  /** 记下“本帧已要求销毁”（Component.destroy 延迟到帧末才真正销毁；removeComponent 也走这里） */
  destroy(): boolean {
    this.destroying = true;
    // Stop immediately: Cocos destruction is deferred until the end of the frame.
    this.loopRequested = false;
    this.retireMusicExtras();
    this.detachLoopSource();
    this.stopAllSfx();
    this.stopCineSlot?.();
    this.stopHoldAmbience?.();
    // Creator 3.8.8 validates the direct parent destroy.call form in editor builds.
    return Component.prototype.destroy.call(this);
  }
  // Native teardown can throw; still invalidate late loads and finish owner cleanup.
  private detachLoopSource() {
    const source = this.loopSource;
    if (!source) return;
    try { source.volume = 0; } catch (e) { console.warn('[GameAudio] loop silence failed', e); }
    try { source.stop(); } catch (e) { console.warn('[GameAudio] loop stop failed', e); }
    try { source.clip = null; } catch (e) { console.warn('[GameAudio] loop detach failed', e); }
  }
  /** Forward only from a validated UI input callback, synchronously before navigation.
   * Cocos 3.8 UI consumes pointer events before the global input listeners below. */
  static notifyUserGesture() {
    try { GameAudio.instance?.onGesture(); }
    catch (error) { console.warn('[GameAudio] UI gesture notification failed (gameplay unaffected)', error); }
  }

  /** 在启动场景里调用一次即可：GameAudio.ensure() */
  static ensure(): GameAudio {
    if (GameAudio.usable(GameAudio.instance)) return GameAudio.instance;
    const node = new Node('GameAudio');
    director.getScene()!.addChild(node);
    director.addPersistRootNode(node);
    return node.addComponent(GameAudio);
  }

  onLoad() {
    // 审查 #4：已经有一个活着的 GameAudio 时拒绝第二个：不覆盖 instance、不注册回调、不建声源，只销毁这个组件本身
    // （不销毁节点，节点上可能挂着别人的组件）。正常路径都走 ensure()，不会走到这里。
    const cur = GameAudio.instance;
    if (cur && cur !== this && GameAudio.usable(cur)) {
      this.alive = false;
      console.warn('[GameAudio] duplicate GameAudio component rejected; keeping the existing instance');
      try { (this as any).destroy?.(); } catch (e) { /* ignore */ }
      return;
    }
    // 旧实例还在但已排队销毁：接管它的挂起 / 打断状态，旧实例立刻停止响应事件（它自己的资源仍由它的 onDestroy 释放）
    if (cur && cur !== this) {
      this.reasons = new Set(cur.reasons);
      this.interruptGen = cur.interruptGen; this.activeGen = cur.activeGen;
      this.staleGen = cur.staleGen; this.staleSince = cur.staleSince;
      cur.stopCineSlot();
      cur.stopHoldAmbience();
      cur.alive = false;
      cur.loopRequested = false;
      cur.retireMusicExtras();
      cur.detachLoopSource();
      cur.stopAllSfx();
      this.gestureSeen = cur.gestureSeen;
    }
    GameAudio.instance = this;
    this.built = true;
    this.loopSource = this.createLoopSource();
    this.node.on(AudioSource.EventType.STARTED, this.onSfxStarted, this);
    this.node.on(AudioSource.EventType.ENDED, this.onSfxEnded, this);
    try { this.muted = sys.localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
    try { this.sfxMuted = sys.localStorage.getItem(SFX_MUTE_KEY) === '1'; } catch { this.sfxMuted = false; }
    try {
      const saved = sys.localStorage.getItem(MUSIC_VOLUME_KEY);
      // WeChat can return an empty string for an absent key; Number('') would mute by mistake.
      // Preserve explicit '0', while null/undefined/whitespace keep the original default.
      const value = saved == null || String(saved).trim() === '' ? NaN : Number(saved);
      if (Number.isFinite(value)) this.musicVolume = Math.max(0, Math.min(1, value));
    } catch { /* storage denial must not prevent sound */ }
    if (cur && cur !== this) {
      this.muted = cur.muted; this.musicVolume = cur.musicVolume; this.sfxMuted = cur.sfxMuted;
    }
    this.applyMusicGains();
    input.on(Input.EventType.TOUCH_END, this.onGesture, this);
    input.on(Input.EventType.MOUSE_UP, this.onGesture, this);
    input.on(Input.EventType.KEY_DOWN, this.onGesture, this);
    // v0.5：不再自动加载默认 BGM。交接时沿用旧实例的曲目；否则等 SceneMusic 在房间可操作后 setMusic。
    if (cur && cur !== this && cur.musicPath) this.setMusic(cur.musicPath, cur.musicBundle);
    // 资源加载失败不影响游戏：没加载到的音效 play() 时直接跳过
    const loadedSfx = (err: any, list: AudioClip[]) => {
      if (!GameAudio.usable(this) || GameAudio.instance !== this) return;
      if (err || !Array.isArray(list)) { console.warn('[GameAudio] sfx load failed', err || 'empty clip list'); return; }
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const previous = this.clips.get(c.name);
        if (previous === c) continue;
        c.addRef(); this.clips.set(c.name, c); previous?.decRef();
      }
    };
    try { resources.loadDir(SFX_DIR, AudioClip, loadedSfx); }
    catch (e) { loadedSfx(e, []); }
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
    GameAudio.applyInnerAudioOption();
    this.registerWx('onHide', 'offHide', this.wxOnHide);
    this.registerWx('onShow', 'offShow', this.wxOnShow);
    this.registerWx('onAudioInterruptionBegin', 'offAudioInterruptionBegin', this.wxOnIntBegin);
    this.registerWx('onAudioInterruptionEnd', 'offAudioInterruptionEnd', this.wxOnIntEnd);
  }

  onDestroy() {
    this.alive = false;
    ++this.musicGeneration;
    input.off(Input.EventType.TOUCH_END, this.onGesture, this);
    input.off(Input.EventType.MOUSE_UP, this.onGesture, this);
    input.off(Input.EventType.KEY_DOWN, this.onGesture, this);
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    for (let i = 0; i < this.wxRegistered.length; i++) {
      const off = wxFn(this.wxRegistered[i][0]);
      try { off?.(this.wxRegistered[i][1]); } catch (e) { /* 忽略：残留回调由 alive 标志挡住 */ }
    }
    this.wxRegistered = [];
    this.reasons.clear();
    if (!this.built) return;   // 被拒绝的多余组件：什么都没建，也不能动现有实例
    this.node.off(AudioSource.EventType.STARTED, this.onSfxStarted, this);
    this.node.off(AudioSource.EventType.ENDED, this.onSfxEnded, this);
    this.stopAllSfx();
    this.stopCineSlot();
    this.stopHoldAmbience();
    this.retireMusicExtras();
    this.detachLoopSource();
    this.musicClip?.decRef(); this.musicClip = null;
    // loose ES5：Map 不能 for-of，先转数组
    const owned = Array.from(this.clips.values());
    for (let i = 0; i < owned.length; i++) owned[i].decRef();
    this.clips.clear(); this.lastPlay.clear();
    if (GameAudio.instance === this) GameAudio.instance = null;
  }

  /** 兜底：引擎在 onShow 时会自己恢复它暂停过的播放器；挂起或静音期间都要再按住（审查 #5） */
  update() {
    if (!GameAudio.usable(this)) return;
    this.tickCineFade();
    this.tickHoldFade();
    if (this.holdWanted && !this.holdSource && this.holdFadeAt === null) this.resumeHoldIfWanted();
    this.observeSfxVoices();
    if (this.reasons.size > 0 || this.muted || !this.gestureSeen || this.musicVolume === 0) {
      if (this.loopRequested || this.loopSource?.playing) this.pauseLoop();
      if (this.loopPartner || this.fadeOutSource) this.retireMusicExtras();
    } else { this.observeLoopRequest(); this.tickMusic(); }
  }

  // ---------- 通用 ----------
  play(name: SfxName, volume = 1) {
    if (!GameAudio.usable(this) || this.muted || this.sfxMuted || this.reasons.size > 0) return;   // 已交接 / 已销毁、静音或任何挂起原因：新音效直接丢弃（不排队、不补播）
    const clip = this.clips.get(name);
    if (!clip) return;
    const now = GameAudio.now();
    if (now - (this.lastPlay.get(name) || 0) < MIN_GAP_MS) return;
    this.observeSfxVoices();
    const limit = this.sfxLimit();
    const voices = Array.from(this.sfxVoices.values());
    const victory = name === 'sfx_level_clear', reward = name === 'sfx_chest_open';
    // Reserve victory first, then one reward slot; duplicate success feedback coalesces.
    // Ordinary pressure must never suppress the first reward or interrupt a victory tail.
    if (voices.length >= limit || (victory || reward
      ? (reward && limit < 2) || voices.some(v => v.name === name)
      : voices.filter(v => v.name !== 'sfx_level_clear' && v.name !== 'sfx_chest_open').length >= Math.max(0, limit - 2))) return;
    let source: AudioSource | null = null;
    try {
      source = this.node.addComponent(AudioSource);
      this.sfxVoices.set(source, { source, name, requestedAt: now, started: false });
      source.playOnAwake = false; source.loop = false;
      source.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1));
      source.clip = clip;
      source.play();
      this.lastPlay.set(name, now);
    } catch (e) {
      if (source) this.retireSfx(source);
      console.warn('[GameAudio] sfx playback request failed', name, e);
    }
  }

  private sfxLimit() {
    // One platform channel is reserved for BGM; other components remain outside this budget.
    try {
      const max = AudioSource.maxAudioChannel;
      if (Number.isFinite(max) && max >= 0) return Math.max(0, Math.min(MAX_VOICES, Math.floor(max) - 1));
    } catch { /* platform may not expose its channel limit */ }
    return MAX_VOICES;
  }
  private retireSfx(source: AudioSource) {
    // Remove ownership first: synchronous and late native events must not affect a new voice.
    if (!this.sfxVoices.delete(source)) return;
    try { source.volume = 0; } catch (e) { console.warn('[GameAudio] sfx silence failed', e); }
    try { source.stop(); } catch (e) { console.warn('[GameAudio] sfx stop failed', e); }
    try { source.clip = null; } catch (e) { console.warn('[GameAudio] sfx detach failed', e); }
    try { source.destroy(); } catch (e) { console.warn('[GameAudio] sfx source destroy failed', e); }
  }
  private stopAllSfx() {
    const sources = Array.from(this.sfxVoices.keys());
    for (let i = 0; i < sources.length; i++) this.retireSfx(sources[i]);
  }
  private observeSfxVoices() {
    const all = Array.from(this.sfxVoices.values());
    for (let i = 0; i < all.length; i++) {
      const voice = all[i];
      try {
        if (voice.source.playing) { voice.started = true; continue; }
        if (voice.started) {
          // ENDED can be lost. Reclaim only a confirmed stopped/finished player, never
          // a paused/interrupted tail, and never an unstarted player's initial INIT.
          const state = voice.source.state;
          if (state === AudioSource.AudioState.STOPPED || state === AudioSource.AudioState.INIT) {
            this.retireSfx(voice.source);
          }
          continue;
        }
      } catch (e) {
        this.retireSfx(voice.source);
        console.warn('[GameAudio] sfx state unavailable', voice.name, e); continue;
      }
      if (GameAudio.now() - voice.requestedAt >= SFX_START_TIMEOUT_MS) {
        this.retireSfx(voice.source);
        console.warn('[GameAudio] sfx start unconfirmed; discarded without replay', voice.name);
      }
    }
  }
  /** Owned SFX only; real device output and external audio sources need separate acceptance. */
  sfxDiagnostics() {
    const voices = Array.from(this.sfxVoices.values());
    const limit = this.sfxLimit();
    return { limit, normalLimit: Math.max(0, limit - 2), rewardLimit: limit >= 2 ? 1 : 0,
      victoryLimit: limit >= 1 ? 1 : 0, active: voices.length,
      pending: voices.filter(v => !v.started).length, started: voices.filter(v => v.started).length,
      playing: voices.filter(v => { try { return v.source.playing; } catch { return false; } }).length,
      voices: voices.map(v => ({ name: v.name, started: v.started, ageMs: GameAudio.now() - v.requestedAt })),
      audibleVerified: false };
  }

  setMuted(m: boolean) {
    if (!GameAudio.usable(this)) return;
    this.muted = m;
    try { sys.localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { console.warn('[GameAudio] mute preference not saved', e); }
    if (m) { this.stopAllSfx(); this.pauseLoop(); this.stopCineSlot(); this.stopHoldAmbience(); } else this.resumeLoopIfAllowed();
  }
  isMuted() { return this.muted; }
  /** 只关音效（含鼓励音），音乐照常；正在播的音效立即停 */
  setSfxMuted(m: boolean) {
    if (!GameAudio.usable(this)) return;
    this.sfxMuted = !!m;
    try { sys.localStorage.setItem(SFX_MUTE_KEY, m ? '1' : '0'); } catch (e) { console.warn('[GameAudio] sfx preference not saved', e); }
    if (m) { this.stopAllSfx(); this.stopCineSlot(); }
  }
  isSfxMuted() { return this.sfxMuted; }
  getMusicVolume() { return this.musicVolume; }

  /** 只读：当前是否挂起，以及原因（给日志/验收用，AudioBridge 不需要） */
  isSuspended() { return this.reasons.size > 0; }
  suspendReasons(): SuspendReason[] { return Array.from(this.reasons).sort(); }
  /** 只读：打断代数状态（给日志/验收用） */
  interruptionState() { return { gen: this.interruptGen, activeGen: this.activeGen, staleGen: this.staleGen }; }

  // ---------- 挂起 / 恢复 ----------
  private suspend(reason: SuspendReason) {
    if (!GameAudio.usable(this) || this.reasons.has(reason)) return;               // 幂等：重复事件不重复处理
    const wasActive = this.reasons.size === 0;
    this.reasons.add(reason);
    if (wasActive) { this.stopAllSfx(); this.pauseLoop(); this.stopCineSlot(); this.stopHoldAmbience(); }
  }
  private resume(reason: SuspendReason) {
    if (!this.alive || !this.reasons.delete(reason)) return;           // 幂等：没有这个原因就什么都不做
    if (this.reasons.size === 0) { this.resumeLoopIfAllowed(); this.resumeHoldIfWanted(); }
  }
  private createLoopSource() {
    const source = this.node.addComponent(AudioSource);
    source.playOnAwake = false; source.loop = true; source.volume = this.musicVolume;
    return source;
  }
  /** Never reuse a retired source: Cocos guards late loads by clip identity, not generation. */
  private replaceLoopSource() {
    this.retireLoopPartner();
    this.loopSource.destroy();
    this.loopSource = this.createLoopSource();
    this.loopNeedsReplacement = false;
  }
  private retireUnconfirmedLoop(message: string, failed = true) {
    this.loopRequested = false; this.loopPendingSince = null;
    this.loopNeedsReplacement = true; this.loopRetryIsFailure = failed;
    this.musicError = message;
    // Zero the old player's gain before canceling its queued operation and detaching it.
    // clip=null makes every late load stale; this source will NEVER receive this clip again.
    this.detachLoopSource();
    console.warn('[GameAudio]', message);
  }
  private observeLoopRequest() {
    if (!this.loopRequested) return;
    if (this.loopSource.playing) {
      this.loopPendingSince = null; this.musicError = null;
      this.loopRecoveries = 0; this.loopNextReplacementAt = 0;
      if (this.startPending) { this.startPending = false; this.emitMusicStart(); }
      return;
    }
    if (this.loopPendingSince === null) this.loopPendingSince = GameAudio.now();
    if (GameAudio.now() - this.loopPendingSince >= LOOP_START_TIMEOUT_MS) {
      this.retireUnconfirmedLoop('Playback unconfirmed after 10000 ms; '
        + (this.loopRecoveries < MAX_LOOP_RECOVERIES ? 'next allowed gesture may retry once.' : 'consecutive failure retry limit reached.'));
    }
  }
  private pauseLoop() {
    this.retireMusicExtras();
    // A start can complete between frames immediately before Hide/Muted arrives.
    if (this.loopSource?.playing) this.observeLoopRequest();
    if (this.loopRequested && !this.loopSource.playing) {
      // A pause queued behind an unresolved play does not cancel it in Cocos 3.8.8.
      this.retireUnconfirmedLoop('Unconfirmed playback canceled by audio gate; '
        + 'a later allowed gesture may rebuild after the retry cooldown.', false);
      return;
    }
    this.loopRequested = false; this.loopPendingSince = null;
    this.loopSource?.pause();
    this.posCt = NaN;
  }
  private resumeLoopIfAllowed(fromGesture = false) {
    if (!GameAudio.usable(this) || GameAudio.instance !== this || !this.loopSource) return;
    if (this.reasons.size || this.muted || !this.gestureSeen || this.musicVolume <= 0 || !this.musicClip) return;
    this.observeLoopRequest();
    if (this.loopSource.playing || this.loopRequested) return;
    if (this.loopNeedsReplacement) {
      if (!fromGesture || GameAudio.now() < this.loopNextReplacementAt) return;
      if (this.loopRetryIsFailure && this.loopRecoveries >= MAX_LOOP_RECOVERIES) return;
      if (this.loopRetryIsFailure) ++this.loopRecoveries;
      this.replaceLoopSource();
      this.loopNextReplacementAt = GameAudio.now() + LOOP_REBUILD_GAP_MS;
      this.loopSource.clip = this.musicClip;
    }
    if (!this.loopSource.clip) return;
    try {
      this.loopRequested = true; this.loopPendingSince = GameAudio.now();
      this.posCt = NaN;
      this.applyMusicGains();
      this.startPending = true;
      this.loopSource.play();
      this.musicError = null;
      this.observeLoopRequest();
    } catch (e) {
      this.loopRequested = false; this.loopPendingSince = null;
      this.musicError = 'Playback request failed: ' + String(e);
      console.warn('[GameAudio]', this.musicError);
    }
  }

  /** Explicit path without extension, relative to `bundle` (null/omitted = resources, the original behaviour).
   * null path intentionally stops music. A missing asset is an observable error, never a successful silent fallback.
   * v0.4: while the current track is audibly playing, a different track crossfades in (SCENE_XFADE_S) once it is confirmed playing. */
  setMusic(path: string | null, bundle?: string | null, opts?: { fadeIn?: boolean } | null) {
    if (!GameAudio.usable(this) || GameAudio.instance !== this) return;
    const bundleName = bundle ? String(bundle) : null;
    if (path === this.musicPath && bundleName === this.musicBundle && (this.musicStatus === 'loading' || this.musicStatus === 'ready')) {
      this.resumeLoopIfAllowed(); return;
    }
    const generation = ++this.musicGeneration;
    // v0.4: keep the audible track playing as the fade-out voice instead of cutting it.
    const crossfade = !!path && this.musicPath !== null && !this.loopNeedsReplacement && this.canHearMusic() && !!this.loopSource?.playing;
    this.loopRequested = false; this.loopPendingSince = null; this.loopRecoveries = 0;
    this.loopNextReplacementAt = 0; this.loopRetryIsFailure = false;
    if (crossfade) {
      this.retireLoopPartner();
      this.retireFadeOut();
      this.fadeOutSource = this.loopSource; this.fadeOutFrom = this.fadeOutSource.volume;
      this.fadeOutAtVolume = this.musicVolume > 1e-4 ? this.musicVolume : 1;
      this.loopSource = this.createLoopSource();
      this.loopNeedsReplacement = false;
      this.sceneSwitchAt = GameAudio.now(); this.sceneFadeAt = null; this.sceneFadeIn = true;
    } else {
      this.retireMusicExtras();
      this.detachLoopSource();
      // A -> B/null -> A can reuse the same cached clip. A fresh source keeps an old
      // native A load from matching the new A by identity and replacing its player.
      if (this.musicPath !== null || this.loopNeedsReplacement) this.replaceLoopSource();
    }
    this.musicClip?.decRef(); this.musicClip = null;
    this.musicPath = path; this.musicBundle = path ? bundleName : null; this.musicError = null;
    this.musicStatus = path ? 'loading' : 'idle';
    this.posCt = NaN;
    this.startPending = false;
    this.musicRequestedAt = GameAudio.now(); this.musicLoadedAt = null;
    // v0.5 进房淡入：只在没有旧曲在播（不是切场景交叉）时生效；第一次确认在播后开始 ROOM_FADE_IN_S 的等功率淡入。
    this.musicFadeInRequested = !!(path && opts && opts.fadeIn && !crossfade);
    if (this.musicFadeInRequested) { this.sceneFadeIn = true; this.sceneFadeAt = null; this.sceneFadeS = ROOM_FADE_IN_S; }
    else if (crossfade) this.sceneFadeS = SCENE_XFADE_S;
    else { this.sceneFadeIn = false; this.sceneFadeAt = null; this.sceneFadeS = SCENE_XFADE_S; }
    this.applyMusicGains();
    if (!path) return;
    const where = bundleName || 'resources';
    const loaded = (err: any, clip: AudioClip) => {
      if (!GameAudio.usable(this) || GameAudio.instance !== this || generation !== this.musicGeneration) return;
      if (err || !clip) {
        this.musicStatus = 'error';
        this.musicError = `Missing/unloadable BGM ${where}/${path}: ${String(err || 'empty clip')}`;
        console.warn('[GameAudio]', this.musicError); return;
      }
      clip.addRef(); this.musicClip = clip; this.musicLoadedAt = GameAudio.now();
      this.loopSource.clip = clip; this.loopSource.loop = true; this.applyMusicGains();
      this.musicStatus = 'ready'; this.resumeLoopIfAllowed();
    };
    try {
      if (!bundleName) { resources.load(path, AudioClip, loaded); return; }
      const ready = assetManager.getBundle(bundleName);
      if (ready) { ready.load(path, AudioClip, loaded); return; }
      assetManager.loadBundle(bundleName, (err: any, b: any) => {
        if (!GameAudio.usable(this) || GameAudio.instance !== this || generation !== this.musicGeneration) return;
        if (err || !b) { loaded(err || new Error('bundle ' + bundleName + ' unavailable'), null as any); return; }
        try { b.load(path, AudioClip, loaded); } catch (e) { loaded(e, null as any); }
      });
    } catch (e) { loaded(e, null as any); }
  }
  setMusicVolume(value: number) {
    if (!GameAudio.usable(this) || !Number.isFinite(value)) return;
    this.musicVolume = Math.max(0, Math.min(1, value));
    this.applyMusicGains();
    try { sys.localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume)); } catch { /* optional preference */ }
    if (this.musicVolume === 0) this.pauseLoop(); else this.resumeLoopIfAllowed();
  }

  // ---------- v0.4 crossfade looping / scene switch ----------
  private canHearMusic() {
    return this.reasons.size === 0 && !this.muted && this.gestureSeen && this.musicVolume > 0;
  }
  private static eqIn(t: number) { return Math.sin(Math.max(0, Math.min(1, t)) * Math.PI / 2); }
  private static eqOut(t: number) { return Math.cos(Math.max(0, Math.min(1, t)) * Math.PI / 2); }
  private sceneT() { return this.sceneFadeAt === null ? 0 : (GameAudio.now() - this.sceneFadeAt) / (this.sceneFadeS * 1000); }
  private loopT() { return this.loopXfadeAt === null ? 0 : (GameAudio.now() - this.loopXfadeAt) / (LOOP_XFADE_S * 1000); }
  /** WindAudio, every frame: smoothed wind strength s (0..1; 0 when wind is silent / not allowed). Ducks the BGM up to WIND_DUCK_DB. */
  setWindDuck(s: number) {
    const x = Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0;
    const u = Math.max(0, Math.min(1, (x - WIND_DUCK_FROM) / (WIND_DUCK_TO - WIND_DUCK_FROM)));
    this.windDuckTarget = u * u * (3 - 2 * u);
  }
  /** Current BGM gain from the wind duck (1 = none). */
  windDuckGain() { return Math.pow(10, WIND_DUCK_DB * this.windDuck / 20); }
  private tickWindDuck() {
    const now = GameAudio.now(), dt = this.windDuckAt < 0 ? 0 : Math.max(0, Math.min(0.25, (now - this.windDuckAt) / 1000));
    this.windDuckAt = now;
    this.windDuck += (this.windDuckTarget - this.windDuck) * (1 - Math.exp(-dt / WIND_DUCK_TAU_S));
    if (Math.abs(this.windDuck - this.windDuckTarget) < 1e-4) this.windDuck = this.windDuckTarget;
  }
  /** All music gains in one place: musicVolume x wind duck x scene fade-in x loop crossfade.
   *  The wind duck stays a ratio on the player's level (up to -4 dB); it does not replace the slider.
   *  Waves and wind read getMusicVolume() and scale their own design curves by it. */
  private applyMusicGains() {
    const v = this.musicVolume * this.windDuckGain();
    const scene = this.sceneFadeIn ? GameAudio.eqIn(this.sceneT()) : 1;
    const loopOut = this.loopPartner && this.loopXfadeAt !== null ? GameAudio.eqOut(this.loopT()) : 1;
    const loopIn = this.loopPartner ? (this.loopXfadeAt !== null ? GameAudio.eqIn(this.loopT()) : 0) : 0;
    const musicScale = this.fadeOutAtVolume > 1e-4 ? this.musicVolume / this.fadeOutAtVolume : 1;
    try { if (this.loopSource) this.loopSource.volume = v * scene * loopOut; } catch (e) { /* native getter/setter may fail */ }
    try { if (this.loopPartner) this.loopPartner.volume = v * scene * loopIn; } catch (e) { /* ignore */ }
    try { if (this.fadeOutSource) this.fadeOutSource.volume = this.fadeOutFrom * musicScale * (this.sceneFadeAt === null ? 1 : GameAudio.eqOut(this.sceneT())); } catch (e) { /* ignore */ }
  }
  private retireMusicSource(source: AudioSource | null) {
    if (!source) return;
    try { source.volume = 0; } catch (e) { /* ignore */ }
    try { source.stop(); } catch (e) { /* ignore */ }
    try { source.clip = null; } catch (e) { /* ignore */ }
    try { source.destroy(); } catch (e) { console.warn('[GameAudio] music source destroy failed', e); }
  }
  private retireLoopPartner() {
    const p = this.loopPartner; this.loopPartner = null; this.loopXfadeAt = null;
    this.retireMusicSource(p);
  }
  private retireFadeOut() {
    const f = this.fadeOutSource; this.fadeOutSource = null; this.sceneFadeAt = null;
    this.retireMusicSource(f);
  }
  /** Gate / stop / destroy: only loopSource survives, at its plain volume. */
  private retireMusicExtras() {
    this.retireLoopPartner();
    this.retireFadeOut();
    // v0.5：进房淡入还没开始过（首次起播前被静音 / 切后台挡住）就保留，起播时照样淡入；其他情况恢复原行为。
    const keepRoomFade = this.musicFadeInRequested && this.startEmittedGen !== this.musicGeneration;
    this.sceneFadeIn = keepRoomFade; this.sceneFadeS = keepRoomFade ? ROOM_FADE_IN_S : SCENE_XFADE_S;
    this.applyMusicGains();
  }
  private clipDuration(source: AudioSource): number {
    let d = NaN;
    try { d = Number(source.duration); } catch (e) { d = NaN; }
    if (!(d > 0)) { try { d = Number((this.musicClip as any)?.getDuration?.()); } catch (e) { d = NaN; } }
    return d > 0 ? d : NaN;
  }
  /** currentTime, extrapolated by wall clock between coarse platform updates (never more than POS_EXTRAPOLATE_MAX_S ahead). */
  private position(source: AudioSource): number {
    let ct = NaN;
    try { ct = Number(source.currentTime); } catch (e) { ct = NaN; }
    if (!Number.isFinite(ct)) return NaN;
    const now = GameAudio.now();
    if (ct !== this.posCt) { this.posCt = ct; this.posAt = now; return ct; }
    return ct + Math.min(POS_EXTRAPOLATE_MAX_S, Math.max(0, (now - this.posAt) / 1000));
  }
  /** Seconds into the clip at which the next loop pass must start (exported for tests). */
  static loopStartAt(duration: number) { return duration - MP3_PADDING_S - LOOP_XFADE_S - LOOP_SAFETY_S; }
  /** Called every unblocked frame. */
  private tickMusic() {
    if (!this.alive || !this.loopSource) return;
    // Scene switch: start the crossfade when the new track is confirmed playing; failure/timeout just fades the old one out.
    if (this.fadeOutSource && this.sceneFadeAt === null) {
      const failed = this.musicStatus === 'error' || this.loopNeedsReplacement || this.musicPath === null
        || GameAudio.now() - this.sceneSwitchAt >= LOOP_START_TIMEOUT_MS;
      if (this.loopSource.playing || failed) this.sceneFadeAt = GameAudio.now();
    }
    if (this.sceneFadeAt !== null && this.sceneT() >= 1) { this.retireFadeOut(); this.sceneFadeIn = false; }
    else if (this.sceneFadeIn && !this.fadeOutSource && this.sceneFadeAt === null && this.loopSource.playing) this.sceneFadeAt = GameAudio.now();
    this.tickLoopCrossfade();
    this.tickWindDuck();
    this.applyMusicGains();
  }
  private tickLoopCrossfade() {
    const src = this.loopSource, clip = this.musicClip;
    if (!clip || !src.playing || src.clip !== clip) { if (this.loopPartner && !src.playing) this.retireLoopPartner(); return; }
    const dur = this.clipDuration(src);
    if (!(dur > LOOP_XFADE_S * 4)) return;
    const pos = this.position(src), startAt = GameAudio.loopStartAt(dur);
    if (!Number.isFinite(pos)) return;
    if (!this.loopPartner) {
      if (pos < startAt) return;
      let p: AudioSource | null = null;
      try {
        p = this.createLoopSource(); p.volume = 0; p.clip = clip; p.loop = true;
        this.loopPartner = p; this.loopXfadeAt = null;
        p.play();
        if (p.playing) this.loopXfadeAt = GameAudio.now();   // platforms that report playing synchronously fade from this frame
      } catch (e) { this.retireLoopPartner(); console.warn('[GameAudio] loop partner failed; platform loop remains', e); }
      return;
    }
    const partner = this.loopPartner;
    if (this.loopXfadeAt === null) {
      // Platform loop already wrapped the old voice (partner never started in time): drop the partner, keep one voice.
      if (pos < startAt - 1) { this.retireLoopPartner(); return; }
      let started = false;
      try { started = !!partner.playing; } catch (e) { started = false; }
      if (started) this.loopXfadeAt = GameAudio.now();
      return;
    }
    if (this.loopT() >= 1) {
      // Swap roles: the partner is now the music source; the old voice is retired before it can wrap.
      this.loopPartner = null; this.loopXfadeAt = null; this.loopSource = partner; this.posCt = NaN; this.loopXfades++;
      this.retireMusicSource(src);
    }
  }
  /** Reports loading and player state only. It cannot establish audible device output. */
  musicDiagnostics() {
    return { path: this.musicPath, bundle: this.musicBundle, status: this.musicStatus, error: this.musicError,
      gestureSeen: this.gestureSeen, muted: this.muted, sfxMuted: this.sfxMuted, volume: this.musicVolume,
      suspended: this.suspendReasons(), playRequested: this.loopRequested,
      playing: !!this.loopSource?.playing,
      playbackState: this.loopNeedsReplacement ? (this.loopRetryIsFailure && this.loopRecoveries >= MAX_LOOP_RECOVERIES ? 'blocked'
        : GameAudio.now() < this.loopNextReplacementAt ? 'cooldown' : 'retryable')
        : this.loopSource?.playing ? 'playing' : this.loopRequested ? 'pending' : 'idle',
      playbackRecoveries: this.loopRecoveries, playbackRecoveryLimit: MAX_LOOP_RECOVERIES,
      playbackRetryReason: this.loopNeedsReplacement ? (this.loopRetryIsFailure ? 'unconfirmed' : 'gate-canceled') : null,
      playbackRetryAfterMs: this.loopNeedsReplacement ? Math.max(0, this.loopNextReplacementAt - GameAudio.now()) : 0,
      loopCrossfade: { partner: !!this.loopPartner, fading: this.loopXfadeAt !== null, completed: this.loopXfades,
        paddingS: MP3_PADDING_S, xfadeS: LOOP_XFADE_S },
      windDuck: { target: +this.windDuckTarget.toFixed(3), value: +this.windDuck.toFixed(3), gain: +this.windDuckGain().toFixed(3), maxDb: WIND_DUCK_DB },
      sceneCrossfade: { fadingOut: !!this.fadeOutSource, started: this.sceneFadeAt !== null, fadeIn: this.sceneFadeIn, xfadeS: this.sceneFadeS },
      lastStart: this.lastStart ? { path: this.lastStart.path, bundle: this.lastStart.bundle, at: this.lastStart.at, first: this.lastStart.first,
        fadeIn: this.lastStart.fadeIn, requestedAt: this.lastStart.requestedAt, loadedAt: this.lastStart.loadedAt } : null,
      audibleVerified: false };
  }

  // ---------- v0.5 “音乐真正开始” ----------
  private static musicStartListeners: Array<(info: MusicStartInfo) => void> = [];
  /** 订阅“BGM 真正开始”：loopSource 第一次确认 playing 的那一帧（每次 setMusic 一次 first=true；挂起 / 静音后恢复 first=false）。
   *  只说明播放器在播，不代表设备上真的听得到。返回取消订阅函数。 */
  static onMusicStart(listener: (info: MusicStartInfo) => void): () => void {
    if (typeof listener !== 'function') return () => {};
    GameAudio.musicStartListeners.push(listener);
    return () => { GameAudio.musicStartListeners = GameAudio.musicStartListeners.filter(l => l !== listener); };
  }
  private emitMusicStart() {
    const first = this.startEmittedGen !== this.musicGeneration;
    this.startEmittedGen = this.musicGeneration;
    const info: MusicStartInfo = { path: this.musicPath, bundle: this.musicBundle, at: GameAudio.now(), first,
      fadeIn: first && this.musicFadeInRequested, requestedAt: this.musicRequestedAt, loadedAt: this.musicLoadedAt };
    this.lastStart = info;
    try { console.info('[GameAudio] music started', JSON.stringify({ path: info.path, bundle: info.bundle, first: info.first, fadeIn: info.fadeIn,
      loadMs: info.loadedAt === null ? null : info.loadedAt - info.requestedAt })); } catch (e) { /* ignore */ }
    const list = GameAudio.musicStartListeners.slice();
    for (let i = 0; i < list.length; i++) { try { list[i](info); } catch (e) { console.warn('[GameAudio] music start listener failed', e); } }
  }
  /** 打断开始：已有生效的打断时是重复 Begin，忽略；否则开新的一代 */
  private staleExpired() { return this.staleGen !== 0 && GameAudio.now() - this.staleSince > GameAudio.staleEndWindowMs; }
  private onInterruptBegin() {
    if (!this.alive || this.activeGen !== 0) return;
    if (this.staleExpired()) this.staleGen = 0;
    this.activeGen = ++this.interruptGen;
    this.suspend('interrupted');
  }
  /** 打断结束：End 不带编号，按先后顺序对应最早一个还没收到 End 的打断。
   *  有 staleGen（被回前台提前结束的那一代）时，这个 End 算它的，当前打断不动；否则结束当前打断。 */
  private onInterruptEnd() {
    if (!this.alive) return;
    if (this.staleGen !== 0) {
      const expired = this.staleExpired();
      this.staleGen = 0;
      if (!expired || this.activeGen === 0) return;      // 窗口内：算旧打断的迟到 End；超时：落到下面结束当前打断
    }
    if (this.activeGen === 0) return;                    // 多余的 End
    this.activeGen = 0;
    this.resume('interrupted');
  }
  /** 回到前台：只在 hidden → 可见 那一下生效（重复 Show 是空操作，审查 #1）。
   *  这时如果还有打断，它一定开始于后台之前或期间并一直持续到现在 → 按 Grok Bot 的决定直接结束它，不等 End，
   *  并记为 staleGen（它的 End 以后到了只消耗掉，不影响新打断）。没有打断时清掉旧的 staleGen，
   *  所以“欠着的 End”最多活到下一次回前台。 */
  private onShowEvent() {
    if (!this.alive || !this.reasons.has('hidden')) return;
    if (this.activeGen !== 0) { this.staleGen = this.activeGen; this.staleSince = GameAudio.now(); this.activeGen = 0; this.reasons.delete('interrupted'); }
    else this.staleGen = 0;
    GameAudio.applyInnerAudioOption();                    // 之前失败过就在回前台时重试
    this.resume('hidden');
  }

  // R6 的 Cocos 事件入口（保留名字）
  private onHide() { this.suspend('hidden'); }
  private onShow() { this.onShowEvent(); }

  private registerWx(onName: string, offName: string, cb: (...a: any[]) => void) {
    const on = wxFn(onName) as WxFn | null;
    if (!on) return;
    try { on(cb); this.wxRegistered.push([offName, cb]); } catch (e) { console.warn('[GameAudio] wx.' + onName + ' failed', e); }
  }

  /** 全局设置，成功一次后不再调用。mixWithOther:true —— 不主动掐掉玩家自己的音乐（注意：官方文档说 speakerOn 为 true 时
   *  客户端会忽略 mixWithOther、强制互斥，所以实际是否混播以真机 I2 为准）；obeyMuteSwitch:true —— iOS 静音拨片拨到静音时
   *  游戏不出声。只有 success 回调才记为成功；fail / 抛异常时清掉 pending，下次 onLoad 或回前台再试（审查 #3）。 */
  private static applyInnerAudioOption() {
    if (GameAudio.innerAudioOptionApplied || GameAudio.innerAudioOptionPending) return;
    const set = wxFn('setInnerAudioOption');
    if (!set) return;
    GameAudio.innerAudioOptionPending = true;
    try {
      set({ mixWithOther: true, obeyMuteSwitch: true,
        success: () => { GameAudio.innerAudioOptionPending = false; GameAudio.innerAudioOptionApplied = true; },
        fail: (e: any) => { GameAudio.innerAudioOptionPending = false; console.warn('[GameAudio] setInnerAudioOption failed', e); } });
    } catch (e) {
      GameAudio.innerAudioOptionPending = false;
      console.warn('[GameAudio] setInnerAudioOption threw', e);
    }
  }

  // ---------- 棋盘 ----------
  /** 挂在 ManagedMobileBoardUI.bind() 里 animate 回调的开头，回调第一个参数就是 visual：GameAudio.instance?.onBoardFrame(v)
   *  切后台或 cancelAnimations 时剩余帧会被跳过，连击音效少播几下，可以接受（审稿意见 1）。 */
  onBoardFrame(visual: any) {
    const kind = visual?.kind;
    if (kind === 'action') { this.cascade = 0; return; }        // 玩家一次操作开始，连击计数清零
    if (kind === 'clear') {
      this.cascade++;
      const name: SfxName = this.cascade <= 1 ? 'sfx_match_normal'
        : this.cascade === 2 ? 'sfx_combo_1'
        : this.cascade === 3 ? 'sfx_combo_2' : 'sfx_combo_3';
      this.play(name);
      if (this.cascade >= 2) {
        const level = Math.min(this.cascade - 2, CHEERS.length - 1);
        GameAudio.emitCheer(level, visual);  // 飘字跟这里走，静音时也照样出字
        this.playCheer(level);
      }
      return;
    }
    // 'drop'（下落）、'shuffle'（洗牌）、'tool'（地区道具）暂时没有音效，见对照表
  }

  /** 每次 render 都调用：GameAudio.instance?.onRender(s.state, s.active?.status === 'won')
   *  第一次 render（含冷启动恢复到结算页、重新进入结算页）只记基准，不播（审稿 B）。
   *  只有从非结算状态切到 result.* 的那一下、且赢了，才播过关音效。 */
  onRender(state: string, won: boolean) {
    if (this.prevState === undefined) { this.prevState = state; return; }
    const entering = state.startsWith('result.') && !this.prevState.startsWith('result.');
    this.prevState = state;
    if (entering) { this.cascade = 0; if (won) this.play('sfx_level_clear'); }
  }
  /** 离开棋盘界面（销毁 ManagedMobileBoardUI）时调用，下次进来重新取基准 */
  resetRenderBaseline() { this.prevState = undefined; }

  /** 主线开宝箱：传 mainlineReward('openChest', …) 的返回值。有新发放的奖励才播（审稿 C）。 */
  onChestResult(r: any) { if (r?.newlyGrantedRewards?.length > 0) this.play('sfx_chest_open'); }
  /** 地区首通 claimR5FirstClear() 和四关全通纪念物 claimRegisteredMemento()：r.ok && !r.duplicate 才播（审稿 D）。 */
  onClaimResult(r: any) { if (r?.ok && !r.duplicate) this.play('sfx_chest_open'); }

  /** 飘字等视觉反馈订阅：level 0..3 = Great / Excellent / Amazing / Unbelievable；visual 是触发这一档的那一帧 kind==='clear'
   *  原始 visual 对象（和 onBoardFrame 收到的同一个），消除格子的位置从里面取。返回取消订阅函数。
   *  在连击判定的同一处触发，与鼓励音档位一致；静音、切后台时声音不播，但事件照发。 */
  private static cheerListeners: Array<(level: number, visual?: any) => void> = [];
  static onCheer(listener: (level: number, visual?: any) => void): () => void {
    GameAudio.cheerListeners.push(listener);
    return () => { GameAudio.cheerListeners = GameAudio.cheerListeners.filter(l => l !== listener); };
  }
  private static emitCheer(level: number, visual?: any) {
    for (const l of GameAudio.cheerListeners.slice()) {
      try { l(level, visual); } catch (e) { console.warn('[GameAudio] cheer listener failed (gameplay unaffected)', e); }
    }
  }

  /** 鼓励音：已有更高或同档在播就不重复；低档在播时先停掉再播高档，避免几条念词叠在一起听不清 */
  private playCheer(level: number) {
    if (!GameAudio.usable(this) || this.muted || this.sfxMuted || this.reasons.size > 0) return;
    let playingLevel = -1;
    const voices = Array.from(this.sfxVoices.values());   // loose ES5：Map 不能 for-of
    for (let i = 0; i < voices.length; i++) playingLevel = Math.max(playingLevel, CHEERS.indexOf(voices[i].name));
    if (playingLevel >= level) return;
    for (let i = 0; i < voices.length; i++) if (CHEERS.indexOf(voices[i].name) >= 0) this.retireSfx(voices[i].source);
    this.play(CHEERS[level]);
  }

  /**
   * Cinematic one-shot (path without extension). An empty bundle loads from resources;
   * otherwise assetManager.loadBundle then bundle.load, same as setMusic.
   * A missing clip is logged and ignored. Background / mute stops it; skip and the
   * cloud hold fade it with fadeCineSlot (equal-power, then stop once the gain is ~0).
   */
  playCineSlot(path: string, bundle?: string | null) {
    if (!GameAudio.usable(this) || this.muted || this.sfxMuted || this.reasons.size > 0 || !path) return;
    this.stopCineSlot();
    const gen = ++this.cineGen;
    this.cinePaused = false;
    const bundleName = bundle ? String(bundle) : '';
    const where = bundleName ? bundleName + '/' + path : path;
    const loaded = (err: any, clip: AudioClip) => {
      if (!GameAudio.usable(this) || gen !== this.cineGen) return;
      if (err || !clip) { console.warn('[GameAudio] cine slot missing', where, err || ''); return; }
      clip.addRef();
      this.cineClip = clip;
      try {
        const source = this.node.addComponent(AudioSource);
        source.playOnAwake = false;
        source.loop = false;
        source.clip = clip;
        source.volume = this.cineGainNow();
        this.cineSource = source;
        if (this.cineFadeAt !== null && this.cineGainNow() <= 0.001) { this.stopCineSlot(); return; }
        source.play();
        if (this.cinePaused) source.pause();
      } catch (error) { console.warn('[GameAudio] cine play failed', where, error); this.stopCineSlot(); }
    };
    try {
      if (!bundleName) { resources.load(path, AudioClip, loaded); return; }
      const ready = assetManager.getBundle(bundleName);
      if (ready) { ready.load(path, AudioClip, loaded); return; }
      assetManager.loadBundle(bundleName, (err: any, b: any) => {
        if (!GameAudio.usable(this) || gen !== this.cineGen) return;
        if (err || !b) { loaded(err || new Error('bundle ' + bundleName + ' unavailable'), null as any); return; }
        try { b.load(path, AudioClip, loaded); } catch (e) { loaded(e, null as any); }
      });
    } catch (e) { loaded(e, null as any); }
  }
  pauseCineSlot() {
    if (!GameAudio.usable(this)) return;
    this.cinePaused = true;
    try { if (this.cineSource?.playing) this.cineSource.pause(); } catch (error) { console.warn('[GameAudio] cine pause failed', error); }
  }
  resumeCineSlot() {
    if (!GameAudio.usable(this) || this.muted || this.sfxMuted || this.reasons.size > 0) return;
    this.cinePaused = false;
    try { if (this.cineSource && !this.cineSource.playing) this.cineSource.play(); } catch (error) { console.warn('[GameAudio] cine resume failed', error); }
  }
  /** Equal-power fade to silence, then stop. `seconds` comes from the timing file. */
  fadeCineSlot(seconds: number) {
    if (!GameAudio.usable(this)) return;
    this.cinePaused = false;
    this.cineFadeS = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    this.cineFadeAt = GameAudio.now();
    this.cineFadeFrom = this.cineSource ? this.cineSource.volume : 1;
    try { if (this.cineSource && !this.cineSource.playing) this.cineSource.play(); } catch { /* still loading */ }
    this.tickCineFade();
  }
  stopCineSlot() {
    this.cineGen++;
    this.cinePaused = false;
    this.cineFadeAt = null;
    this.retireOwned(this.cineSource, this.cineClip);
    this.cineSource = null;
    this.cineClip = null;
  }
  /**
   * Loop an existing ambience clip while a cinematic waits on a bundle.
   * Reuses the caller's path (the wind bed); no new asset. Fades out with fadeHoldAmbience.
   */
  loopHoldAmbience(path: string) {
    if (!GameAudio.usable(this) || !path) return;
    this.holdWanted = true;
    this.holdFadeAt = null;
    if (this.holdPath === path && this.holdSource?.playing) {
      try { this.holdSource.volume = this.holdBed(); } catch { /* ignore */ }
      return;
    }
    this.holdPath = path;
    if (!this.canPlayAmbience()) return;
    this.startHold(path);
  }
  fadeHoldAmbience(seconds: number) {
    if (!GameAudio.usable(this)) return;
    this.holdWanted = false;
    this.holdFadeS = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    this.holdFadeAt = GameAudio.now();
    this.holdFadeFrom = this.holdSource ? this.holdSource.volume : 1;
    this.tickHoldFade();
  }
  stopHoldAmbience() {
    this.holdGen++;
    this.holdWanted = false;
    this.holdLoading = false;
    this.holdFadeAt = null;
    this.holdPath = null;
    this.retireOwned(this.holdSource, this.holdClip);
    this.holdSource = null;
    this.holdClip = null;
  }
  private resumeHoldIfWanted() {
    if (this.holdWanted && this.holdPath && !this.holdLoading && this.canPlayAmbience()) this.startHold(this.holdPath);
  }
  private startHold(path: string) {
    if (this.holdLoading) return;
    const gen = ++this.holdGen;
    const existing = this.holdPath === path ? this.holdClip : null;
    const begin = (clip: AudioClip) => {
      this.holdLoading = false;
      if (!GameAudio.usable(this) || gen !== this.holdGen || !this.holdWanted) return;
      this.retireOwned(this.holdSource, this.holdClip && this.holdClip !== clip ? this.holdClip : null);
      if (this.holdClip !== clip) { clip.addRef(); this.holdClip = clip; }
      try {
        const source = this.node.addComponent(AudioSource);
        source.playOnAwake = false;
        source.loop = true;
        source.clip = clip;
        source.volume = this.holdBed();
        this.holdSource = source;
        source.play();
      } catch (error) { console.warn('[GameAudio] hold ambience failed', path, error); }
    };
    if (existing) { begin(existing); return; }
    this.holdLoading = true;
    resources.load(path, AudioClip, (err, clip) => {
      this.holdLoading = false;
      if (!GameAudio.usable(this) || gen !== this.holdGen) return;
      if (err || !clip) { console.warn('[GameAudio] hold ambience missing', path, err || ''); return; }
      begin(clip);
    });
  }
  private holdBed(): number {
    const music = this.musicVolume;
    return Math.max(0, Math.min(1, (Number.isFinite(music) ? music : 1) * 0.8));
  }
  private cineGainNow(): number {
    if (this.cineFadeAt === null) return 1;
    const t = this.cineFadeS <= 0 ? 1 : (GameAudio.now() - this.cineFadeAt) / (this.cineFadeS * 1000);
    return this.cineFadeFrom * Math.cos(Math.max(0, Math.min(1, t)) * Math.PI / 2);
  }
  private tickCineFade() {
    if (this.cineFadeAt === null) return;
    const gain = this.cineGainNow();
    if (gain <= 0.001) { this.stopCineSlot(); return; }
    try { if (this.cineSource) this.cineSource.volume = gain; } catch { /* ignore */ }
  }
  private tickHoldFade() {
    if (this.holdFadeAt === null) return;
    const t = this.holdFadeS <= 0 ? 1 : (GameAudio.now() - this.holdFadeAt) / (this.holdFadeS * 1000);
    if (t >= 1) { this.stopHoldAmbience(); return; }
    const gain = this.holdFadeFrom * Math.cos(Math.max(0, Math.min(1, t)) * Math.PI / 2);
    try { if (this.holdSource) this.holdSource.volume = gain; } catch { /* ignore */ }
  }
  private retireOwned(source: AudioSource | null, clip: AudioClip | null) {
    if (source) {
      try { source.volume = 0; } catch { /* ignore */ }
      try { source.stop(); } catch { /* ignore */ }
      try { source.clip = null; } catch { /* ignore */ }
      try { source.destroy(); } catch { /* ignore */ }
    }
    if (clip) { try { clip.decRef(); } catch { /* ignore */ } }
  }

  /** A4：环境声（AmbienceAudio）用来判断现在能不能出声：未静音、无挂起、已有过用户手势 */
  canPlayAmbience(): boolean {
    return GameAudio.usable(this) && GameAudio.instance === this && !this.muted && this.reasons.size === 0 && this.gestureSeen;
  }

  onButton() { this.play('sfx_ui_click', UI_TAP_VOLUME); }
  /** A5：T9 onPropTap 的回调（由 AudioBridge 订阅）。blocked 时什么都不播；静音 / 挂起由 play() 统一挡住。
   *  按下音已经播出时，同一目标 150 ms 内的 confirm 丢掉（点一次道具不再叠两声）。没播成按下音、已满 150 ms，
   *  或另一个目标，confirm 照播。 */
  onPropTap(target: UiTapTarget, phase: 'press' | 'confirm', info?: { blocked?: boolean } | null) {
    if (info?.blocked) return;
    if (phase === 'press') {
      const name = UI_PRESS[target];
      if (!name) return;
      const t = GameAudio.now();
      this.play(name, UI_TAP_VOLUME);
      if (this.lastPlay.get(name) === t) { this.uiPressTarget = target; this.uiPressAt = t; }
    } else if (phase === 'confirm') {
      if (this.uiPressTarget === target && GameAudio.now() - this.uiPressAt < UI_CONFIRM_AFTER_PRESS_MS) return;
      this.play('sfx_ui_confirm', UI_TAP_VOLUME);
    }
  }
  /** A5：关闭面板 / 返回上一页（目前是岛上旅程册弹层的 × 和“返回章节”，由 AudioBridge 按节点名接入） */
  onUiBack() { this.play('sfx_ui_back', UI_TAP_VOLUME); }
  /** 道具槽只点不拖时：挂在 endToolDrag() 里 !d.moved 的分支（审稿 E） */
  onToolTap() { this.play('sfx_ui_click', UI_TAP_VOLUME); }
}

declare const wx: any;

// v0.5：T0 / 日志用的只读出口（audio:unlock 之后记录 BGM 真正开始的时刻）
try {
  (globalThis as any).__gameAudioMusic = {
    onMusicStart: (cb: (info: MusicStartInfo) => void) => GameAudio.onMusicStart(cb),
    lastStart: () => { const a: any = GameAudio.instance; try { return a ? a.musicDiagnostics().lastStart : null; } catch (e) { return null; } },
  };
} catch (e) { /* globalThis unavailable: listeners still work via GameAudio.onMusicStart */ }
