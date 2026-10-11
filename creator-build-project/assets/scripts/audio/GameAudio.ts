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
import { _decorator, Component, Node, AudioSource, AudioClip, resources, director, game, Game, sys, isValid, input, Input } from 'cc';
const { ccclass } = _decorator;

export type SfxName = 'sfx_match_normal' | 'sfx_combo_1' | 'sfx_combo_2' | 'sfx_combo_3'
  | 'sfx_chest_open' | 'sfx_ui_click' | 'sfx_level_clear';

/** 挂起原因：hidden = 切后台；interrupted = 来电/其他 App/系统抢走音频 */
export type SuspendReason = 'hidden' | 'interrupted';

const SFX_DIR = 'audio_sfx';
// One explicit default; callers can select another resources-relative track with setMusic().
export const DEFAULT_BGM_PATH = 'audio_bgm/bgm_main';
const MUSIC_VOLUME_KEY = 'qfl.audio.musicVolume';
const MUTE_KEY = 'qfl.audio.muted';   // 正式 key。R6 实测用的是隔离 key 'dot-audio-r1-test-20261009:muted'，那份测试存档不迁移。
const MIN_GAP_MS = 60;        // 同一个音效 60 ms 内只播一次，防止同帧多次触发叠成爆音
// Cocos 3.8.8 may resolve a mini-game player load after its own 8 s fallback.
// This is an observation deadline, not proof of failure; retry requires a new gesture.
const LOOP_START_TIMEOUT_MS = 10000;
const MAX_LOOP_RECOVERIES = 1; // Consecutive failure retries; confirmed playback resets this.
const LOOP_REBUILD_GAP_MS = 10000; // Bound repeated gate cancellations before playback is confirmed.
const MAX_VOICES = 6;         // 同时最多 6 个音效；微信小游戏同时存在的音频实例数量有限，宁少勿多
const SFX_START_TIMEOUT_MS = 10000; // Only unconfirmed starts; never a playing clip's duration limit.

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
  private reasons = new Set<SuspendReason>();  // 挂起原因集合；为空 = 正常
  private cascade = 0;                         // 本次操作里第几波消除（0 = 还没消）
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
    this.detachLoopSource();
    this.stopAllSfx();
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
      cur.alive = false;
      cur.loopRequested = false;
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
    try {
      const saved = sys.localStorage.getItem(MUSIC_VOLUME_KEY);
      // WeChat can return an empty string for an absent key; Number('') would mute by mistake.
      // Preserve explicit '0', while null/undefined/whitespace keep the original default.
      const value = saved == null || String(saved).trim() === '' ? NaN : Number(saved);
      if (Number.isFinite(value)) this.musicVolume = Math.max(0, Math.min(1, value));
    } catch { /* storage denial must not prevent sound */ }
    if (cur && cur !== this) {
      this.muted = cur.muted; this.musicVolume = cur.musicVolume;
    }
    this.loopSource.volume = this.musicVolume;
    input.on(Input.EventType.TOUCH_END, this.onGesture, this);
    input.on(Input.EventType.MOUSE_UP, this.onGesture, this);
    input.on(Input.EventType.KEY_DOWN, this.onGesture, this);
    this.setMusic(cur && cur !== this ? cur.musicPath : DEFAULT_BGM_PATH);
    // 资源加载失败不影响游戏：没加载到的音效 play() 时直接跳过
    const loadedSfx = (err: any, list: AudioClip[]) => {
      if (!GameAudio.usable(this) || GameAudio.instance !== this) return;
      if (err || !Array.isArray(list)) { console.warn('[GameAudio] sfx load failed', err || 'empty clip list'); return; }
      for (const c of list) {
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
    for (const [offName, cb] of this.wxRegistered) {
      const off = wxFn(offName);
      try { off?.(cb); } catch (e) { /* 忽略：残留回调由 alive 标志挡住 */ }
    }
    this.wxRegistered = [];
    this.reasons.clear();
    if (!this.built) return;   // 被拒绝的多余组件：什么都没建，也不能动现有实例
    this.node.off(AudioSource.EventType.STARTED, this.onSfxStarted, this);
    this.node.off(AudioSource.EventType.ENDED, this.onSfxEnded, this);
    this.stopAllSfx();
    this.detachLoopSource();
    this.musicClip?.decRef(); this.musicClip = null;
    for (const c of this.clips.values()) c.decRef();
    this.clips.clear(); this.lastPlay.clear();
    if (GameAudio.instance === this) GameAudio.instance = null;
  }

  /** 兜底：引擎在 onShow 时会自己恢复它暂停过的播放器；挂起或静音期间都要再按住（审查 #5） */
  update() {
    if (!GameAudio.usable(this)) return;
    this.observeSfxVoices();
    if (this.reasons.size > 0 || this.muted || !this.gestureSeen || this.musicVolume === 0) {
      if (this.loopRequested || this.loopSource?.playing) this.pauseLoop();
    } else this.observeLoopRequest();
  }

  // ---------- 通用 ----------
  play(name: SfxName, volume = 1) {
    if (!GameAudio.usable(this) || this.muted || this.reasons.size > 0) return;   // 已交接 / 已销毁、静音或任何挂起原因：新音效直接丢弃（不排队、不补播）
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
    for (const source of Array.from(this.sfxVoices.keys())) this.retireSfx(source);
  }
  private observeSfxVoices() {
    for (const voice of Array.from(this.sfxVoices.values())) {
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
    if (m) { this.stopAllSfx(); this.pauseLoop(); } else this.resumeLoopIfAllowed();
  }
  isMuted() { return this.muted; }

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
    if (wasActive) { this.stopAllSfx(); this.pauseLoop(); }
  }
  private resume(reason: SuspendReason) {
    if (!this.alive || !this.reasons.delete(reason)) return;           // 幂等：没有这个原因就什么都不做
    if (this.reasons.size === 0) this.resumeLoopIfAllowed();
  }
  private createLoopSource() {
    const source = this.node.addComponent(AudioSource);
    source.playOnAwake = false; source.loop = true; source.volume = this.musicVolume;
    return source;
  }
  /** Never reuse a retired source: Cocos guards late loads by clip identity, not generation. */
  private replaceLoopSource() {
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
      this.loopRecoveries = 0; this.loopNextReplacementAt = 0; return;
    }
    if (this.loopPendingSince === null) this.loopPendingSince = GameAudio.now();
    if (GameAudio.now() - this.loopPendingSince >= LOOP_START_TIMEOUT_MS) {
      this.retireUnconfirmedLoop('Playback unconfirmed after 10000 ms; '
        + (this.loopRecoveries < MAX_LOOP_RECOVERIES ? 'next allowed gesture may retry once.' : 'consecutive failure retry limit reached.'));
    }
  }
  private pauseLoop() {
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
      this.loopSource.play();
      this.musicError = null;
      this.observeLoopRequest();
    } catch (e) {
      this.loopRequested = false; this.loopPendingSince = null;
      this.musicError = 'Playback request failed: ' + String(e);
      console.warn('[GameAudio]', this.musicError);
    }
  }

  /** Explicit resources-relative path, without extension. null intentionally stops music.
   * A missing asset is an observable error, never a successful silent fallback. */
  setMusic(path: string | null) {
    if (!GameAudio.usable(this) || GameAudio.instance !== this) return;
    if (path === this.musicPath && (this.musicStatus === 'loading' || this.musicStatus === 'ready')) {
      this.resumeLoopIfAllowed(); return;
    }
    const generation = ++this.musicGeneration;
    this.loopRequested = false; this.loopPendingSince = null; this.loopRecoveries = 0;
    this.loopNextReplacementAt = 0; this.loopRetryIsFailure = false;
    this.detachLoopSource();
    // A -> B/null -> A can reuse the same cached clip. A fresh source keeps an old
    // native A load from matching the new A by identity and replacing its player.
    if (this.musicPath !== null || this.loopNeedsReplacement) this.replaceLoopSource();
    this.musicClip?.decRef(); this.musicClip = null;
    this.musicPath = path; this.musicError = null;
    this.musicStatus = path ? 'loading' : 'idle';
    if (!path) return;
    const loaded = (err: any, clip: AudioClip) => {
      if (!GameAudio.usable(this) || GameAudio.instance !== this || generation !== this.musicGeneration) return;
      if (err || !clip) {
        this.musicStatus = 'error';
        this.musicError = `Missing/unloadable BGM resources/${path}: ${String(err || 'empty clip')}`;
        console.warn('[GameAudio]', this.musicError); return;
      }
      clip.addRef(); this.musicClip = clip;
      this.loopSource.clip = clip; this.loopSource.loop = true; this.loopSource.volume = this.musicVolume;
      this.musicStatus = 'ready'; this.resumeLoopIfAllowed();
    };
    try { resources.load(path, AudioClip, loaded); } catch (e) { loaded(e, null as any); }
  }
  setMusicVolume(value: number) {
    if (!GameAudio.usable(this) || !Number.isFinite(value)) return;
    this.musicVolume = Math.max(0, Math.min(1, value));
    this.loopSource.volume = this.musicVolume;
    try { sys.localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume)); } catch { /* optional preference */ }
    if (this.musicVolume === 0) this.pauseLoop(); else this.resumeLoopIfAllowed();
  }
  /** Reports loading and player state only. It cannot establish audible device output. */
  musicDiagnostics() {
    return { path: this.musicPath, status: this.musicStatus, error: this.musicError,
      gestureSeen: this.gestureSeen, muted: this.muted, volume: this.musicVolume,
      suspended: this.suspendReasons(), playRequested: this.loopRequested,
      playing: !!this.loopSource?.playing,
      playbackState: this.loopNeedsReplacement ? (this.loopRetryIsFailure && this.loopRecoveries >= MAX_LOOP_RECOVERIES ? 'blocked'
        : GameAudio.now() < this.loopNextReplacementAt ? 'cooldown' : 'retryable')
        : this.loopSource?.playing ? 'playing' : this.loopRequested ? 'pending' : 'idle',
      playbackRecoveries: this.loopRecoveries, playbackRecoveryLimit: MAX_LOOP_RECOVERIES,
      playbackRetryReason: this.loopNeedsReplacement ? (this.loopRetryIsFailure ? 'unconfirmed' : 'gate-canceled') : null,
      playbackRetryAfterMs: this.loopNeedsReplacement ? Math.max(0, this.loopNextReplacementAt - GameAudio.now()) : 0,
      audibleVerified: false };
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

  onButton() { this.play('sfx_ui_click', 0.8); }
  /** 道具槽只点不拖时：挂在 endToolDrag() 里 !d.moved 的分支（审稿 E） */
  onToolTap() { this.play('sfx_ui_click', 0.8); }
}

declare const wx: any;
