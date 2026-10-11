// AudioUnlock.ts — GGbot 2026-10-11（Mac 第二轮 f0f3a13 的高优先级 bug）：全局“首次触摸解锁声音”。
// 问题：屋里的 RoomExploreOverlay 是一整屏的 UI 触摸面，Cocos 3.8 的 UI 节点先吃掉触摸，GameAudio 自己挂在
//   input.on(TOUCH_END) 上的全局手势监听永远收不到；所以在屋里滑动、点门都不会调 notifyUserGesture()，
//   BGM 一直等到岛上第一次点 WarmButton / 灯塔才响。
// 做法（与哪个节点吃掉触摸无关）：
//   1) wx.onTouchStart + wx.onTouchEnd（微信平台层，T1 L3 同款：UI 吃掉前就能看到每一根手指）→ source=wx
//   2) 没有 wx（Web 预览）时：window 上 capture 阶段的 touchstart/touchend/mousedown/mouseup/pointerup → source=canvas
//      （浏览器不把 touchstart 当作手势，所以 END 一定也要调）
//   3) Cocos input.on(TOUCH_START/TOUCH_END/MOUSE_UP)：只有没被 UI 吃掉的触摸才到这里 → source=cocos
//   4) RoomExploreOverlay 的滑动 / 点门处理器里显式调用 → source=room-swipe | door-tap
// 规则（Voice bot 2026-10-11）：
//   - 在触摸回调里**同步**调 GameAudio.notifyUserGesture()，不包 Promise / setTimeout / scheduleOnce。
//   - 监听**永久保留**、不注销：GameAudio 还没建好时调用会被忽略；起播 10 s 未确认时，后面的触摸要能重试。
//     重复调用对 GameAudio 是安全的（gestureSeen 置位 + resumeLoopIfAllowed(true)，请求中的起播会合并）。
//   - 微信平台层的 wx.offTouch* 本来就不调：低版本基础库不带参数的 off 会把引擎自己的触摸监听一起删掉。
// 只读出口：AudioUnlock.snapshot() / AudioUnlock.onUnlock(cb)，以及 globalThis.__audioUnlock（T0 打 audio:unlock 用）。
// “解锁”= 第一次调用后 GameAudio.musicDiagnostics().gestureSeen 为 true（之后 BGM 由 GameAudio 自己起播）。
// 这个文件被 RoomExploreOverlay import，模块加载时（任何组件 start 之前）就自安装；不改 WorldIntegrationBoot。
// ES5 安全：不对 Map/Set 用展开或 for-of。
import { input, Input } from 'cc';
import { EDITOR } from 'cc/env';
import { GameAudio } from './GameAudio';

export type UnlockSource = 'wx' | 'canvas' | 'cocos' | 'room-swipe' | 'door-tap';
export type UnlockInfo = { source: UnlockSource; event: string; at: number; ms: number; diagnostics: any };
type Listener = (info: UnlockInfo) => void;

const G: any = globalThis;
const clock = (): number => (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') ? performance.now() : Date.now();

export class AudioUnlock {
  private static installed = false;
  private static installedAt = 0;
  private static first: UnlockInfo | null = null;
  private static listeners: Listener[] = [];
  private static calls = 0;
  private static ignored = 0;            // GameAudio 还没建好时的调用
  private static bySource: Record<string, number> = {};
  private static hooks: string[] = [];
  private static wxStart: ((e: any) => void) | null = null;
  private static wxEnd: ((e: any) => void) | null = null;
  private static domHandler: ((e: any) => void) | null = null;
  private static readonly DOM_EVENTS = ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerup'];

  /** 幂等。模块加载时自动调用一次。 */
  static install() {
    if (AudioUnlock.installed) return;
    AudioUnlock.installed = true; AudioUnlock.installedAt = clock();
    const wx = G.wx;
    if (wx && typeof wx.onTouchStart === 'function') {
      AudioUnlock.wxStart = () => AudioUnlock.gesture('wx', 'touchstart');
      AudioUnlock.wxEnd = () => AudioUnlock.gesture('wx', 'touchend');
      try { wx.onTouchStart(AudioUnlock.wxStart); AudioUnlock.hooks.push('wx.onTouchStart'); } catch (e) { console.warn('[AudioUnlock] wx.onTouchStart failed', e); }
      try { if (typeof wx.onTouchEnd === 'function') { wx.onTouchEnd(AudioUnlock.wxEnd); AudioUnlock.hooks.push('wx.onTouchEnd'); } } catch (e) { console.warn('[AudioUnlock] wx.onTouchEnd failed', e); }
    } else if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
      AudioUnlock.domHandler = (e: any) => AudioUnlock.gesture('canvas', String(e && e.type || 'dom'));
      for (let i = 0; i < AudioUnlock.DOM_EVENTS.length; i++) {
        try { window.addEventListener(AudioUnlock.DOM_EVENTS[i], AudioUnlock.domHandler, { capture: true, passive: true } as any); AudioUnlock.hooks.push('window.' + AudioUnlock.DOM_EVENTS[i]); } catch (e) { /* ignore */ }
      }
    }
    try {
      input.on(Input.EventType.TOUCH_START, AudioUnlock.onCocosStart);
      input.on(Input.EventType.TOUCH_END, AudioUnlock.onCocosEnd);
      input.on(Input.EventType.MOUSE_UP, AudioUnlock.onCocosMouse);
      AudioUnlock.hooks.push('cc.input');
    } catch (e) { console.warn('[AudioUnlock] cc.input hook failed', e); }
    G.__audioUnlock = { snapshot: () => AudioUnlock.snapshot(), onUnlock: (cb: Listener) => AudioUnlock.onUnlock(cb) };
  }
  private static onCocosStart = () => AudioUnlock.gesture('cocos', 'touchstart');
  private static onCocosEnd = () => AudioUnlock.gesture('cocos', 'touchend');
  private static onCocosMouse = () => AudioUnlock.gesture('cocos', 'mouseup');

  /** 在触摸回调里同步调用。任何来源、任何次数都安全。 */
  static gesture(source: UnlockSource, event = '') {
    AudioUnlock.calls++;
    AudioUnlock.bySource[source] = (AudioUnlock.bySource[source] || 0) + 1;
    const audio: any = GameAudio.instance;
    if (!audio) { AudioUnlock.ignored++; return; }
    GameAudio.notifyUserGesture();          // 同步；GameAudio 自己 try/catch
    if (AudioUnlock.first) return;
    let d: any = null;
    try { d = typeof audio.musicDiagnostics === 'function' ? audio.musicDiagnostics() : null; } catch { d = null; }
    if (!d || !d.gestureSeen) return;       // 实例在但没接受（已交接 / 销毁中）：下次触摸再试
    const at = clock();
    const info: UnlockInfo = { source, event, at, ms: Math.round(at - AudioUnlock.installedAt), diagnostics: d };
    AudioUnlock.first = info;
    try { console.info('[AudioUnlock] first gesture accepted', JSON.stringify({ source, event, ms: info.ms, status: d.status, playbackState: d.playbackState })); } catch { /* ignore */ }
    const list = AudioUnlock.listeners.slice();
    for (let i = 0; i < list.length; i++) { try { list[i](info); } catch (e) { console.warn('[AudioUnlock] listener failed', e); } }
  }

  /** 已经解锁时立刻（同步）回调一次；返回取消订阅。 */
  static onUnlock(cb: Listener): () => void {
    if (typeof cb !== 'function') return () => {};
    AudioUnlock.listeners.push(cb);
    if (AudioUnlock.first) { try { cb(AudioUnlock.first); } catch (e) { console.warn('[AudioUnlock] listener failed', e); } }
    return () => { AudioUnlock.listeners = AudioUnlock.listeners.filter(l => l !== cb); };
  }

  static snapshot() {
    const f = AudioUnlock.first;
    return { installed: AudioUnlock.installed, hooks: AudioUnlock.hooks.slice(), unlocked: !!f,
      source: f ? f.source : null, event: f ? f.event : null, ms: f ? f.ms : null, at: f ? f.at : null,
      calls: AudioUnlock.calls, ignoredBeforeGameAudio: AudioUnlock.ignored, bySource: Object.assign({}, AudioUnlock.bySource) };
  }
}

if (!EDITOR) AudioUnlock.install();
