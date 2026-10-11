// VbWindSeamTest.ts — Voice bot 测试专用（windseam）：在真机 / 开发者工具里听风声循环的接缝。
// 只有启动参数 voiceScenario=windseam（或全局 VB_SCENARIO='windseam'）时才挂载；正常流程里只做一次参数检查，不建节点、不加载资源、不出声。
// 流程：等 GameAudio 已有用户手势且未静音、未挂起 → 暂停 BGM → soft 循环 vbWindSec 秒（默认 30）→ strong 循环 vbWindSec 秒 → 恢复 BGM → 自毁。
// 用 AudioSource.loop=true（与正式风声同一条播放路径），每帧读 currentTime 检测回绕，统计回绕的实际间隔：
//   mp3 无缝信息被尊重时间隔 ≈ 2900 ms；被忽略时 ≈ 2952 ms（帧对齐时长）或更长（播放器重启开销）。
// 日志：console 里的 [VB_WINDSEAM] 行，同时写 wx.env.USER_DATA_PATH/VB_WINDSEAM.log。
import { _decorator, Component, AudioSource, AudioClip, resources, director, Director, isValid, Node } from 'cc';
import { GameAudio } from './GameAudio';
const { ccclass } = _decorator;

const CLIPS = ['audio_amb/amb_wind_soft_loop', 'audio_amb/amb_wind_strong_loop'];
const NAMES = ['soft', 'strong'];
declare const GameGlobal: any;
const G: any = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});

/** 启动参数：全局宏 VB_SCENARIO / VB_QUERY（inject_windseam.sh）< wx 启动 query < location.search（后者优先） */
export function vbWindSeamQuery(): Record<string, string> {
  const q: Record<string, string> = {};
  const parse = (str: string) => {
    const parts = str.replace(/^\?/, '').split('&');
    for (let i = 0; i < parts.length; i++) { const kv = parts[i].split('='); if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }
  };
  try {
    const GG: any = typeof GameGlobal !== 'undefined' ? GameGlobal : G;
    const sc = typeof G.VB_SCENARIO === 'string' ? G.VB_SCENARIO : GG && GG.VB_SCENARIO;
    const extra = typeof G.VB_QUERY === 'string' ? G.VB_QUERY : GG && GG.VB_QUERY;
    if (typeof sc === 'string') q.voiceScenario = sc;
    if (typeof extra === 'string') parse(extra);
  } catch { /* ignore */ }
  try { const o = G.wx && G.wx.getLaunchOptionsSync && G.wx.getLaunchOptionsSync(); if (o && o.query) { for (const k in o.query) q[k] = String(o.query[k]); } } catch { /* ignore */ }
  try {
    if (typeof location !== 'undefined' && location.search) parse(location.search);
  } catch { /* ignore */ }
  return q;
}

function num(v: string | undefined, def: number, lo: number, hi: number) {
  const n = Number(v); return v !== undefined && v !== '' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
}

@ccclass('VbWindSeamTest')
export class VbWindSeamTest extends Component {
  static now: () => number = () => Date.now();
  private t0 = 0;
  private sink: ((l: string) => void) | null = null;
  private src: AudioSource | null = null;
  private clips: Array<AudioClip | null> = [null, null];
  private loaded = 0;
  private phase = -1;            // -1 等待；0 soft；1 strong；2 结束
  private phaseStart = 0;
  private lastWrap = 0;
  private prevCt = 0;
  private wraps: number[] = [];  // 本段第 2 次起每次回绕的墙钟间隔（ms）；第 1 次含起播延迟，不计入
  private wrapCount = 0;
  private waitLogAt = 0;
  private bgmPath: string | null = null;
  private bgmPaused = false;
  private alive = true;
  private sec = 30;
  private delayMs = 1000;
  private readyAt = 0;
  private keepBgm = false;

  static maybeMount(): boolean {
    let q: Record<string, string>;
    try { q = vbWindSeamQuery(); } catch { return false; }
    if (q.voiceScenario !== 'windseam') return false;
    try {
      const scene = director.getScene(); if (!scene) return false;
      const node = new Node('VbWindSeamTest');
      scene.addChild(node); director.addPersistRootNode(node);
      const c = node.addComponent(VbWindSeamTest);
      c.sec = num(q.vbWindSec, 30, 3, 300);
      c.delayMs = num(q.vbWindDelay, 1000, 0, 10000);
      c.keepBgm = q.vbBgm === 'keep';
      return true;
    } catch (e) { console.warn('[VB_WINDSEAM] mount failed', e); return false; }
  }

  log(ev: string, extra = '') {
    const line = `[VB_WINDSEAM] ${ev} t=${Math.round(VbWindSeamTest.now() - this.t0)}ms wall=${new Date(VbWindSeamTest.now()).toISOString()}${extra ? ' ' + extra : ''}`;
    console.log(line);
    if (this.sink) this.sink(line);
  }

  onLoad() {
    this.t0 = VbWindSeamTest.now();
    try {
      const wx = G.wx;
      if (wx && wx.getFileSystemManager && wx.env && wx.env.USER_DATA_PATH) {
        const fs = wx.getFileSystemManager(), path = wx.env.USER_DATA_PATH + '/VB_WINDSEAM.log';
        fs.writeFileSync(path, '', 'utf8');
        this.sink = (l: string) => { try { fs.appendFileSync(path, l + '\n', 'utf8'); } catch { /* ignore */ } };
      }
    } catch { this.sink = null; }
    this.src = this.node.addComponent(AudioSource);
    this.src.playOnAwake = false; this.src.loop = true; this.src.volume = 1;
    this.log('armed', `sec=${this.sec} delayMs=${this.delayMs} bgm=${this.keepBgm ? 'keep' : 'pause'} clips=${CLIPS.join(',')}`);
    for (let i = 0; i < CLIPS.length; i++) {
      const idx = i;
      resources.load(CLIPS[idx], AudioClip, (err: any, clip: AudioClip) => {
        if (!this.alive || !isValid(this.node, true)) return;
        if (err || !clip) { this.log('load-failed', `clip=${NAMES[idx]} err=${String(err)}`); return; }
        clip.addRef(); this.clips[idx] = clip; this.loaded++;
        this.log('loaded', `clip=${NAMES[idx]} dur=${Number(clip.getDuration()).toFixed(3)}s`);
      });
    }
  }

  onDestroy() {
    this.alive = false;
    try { this.src?.stop(); } catch { /* ignore */ }
    for (let i = 0; i < this.clips.length; i++) { const c = this.clips[i]; if (c) c.decRef(); }
    this.clips = [null, null];
    this.restoreBgm();
  }

  private pauseBgm() {
    if (this.keepBgm) return;
    const a = GameAudio.instance; if (!a) return;
    try { this.bgmPath = a.musicDiagnostics().path; a.setMusic(null); this.bgmPaused = true; this.log('bgm-paused', `path=${this.bgmPath}`); }
    catch (e) { this.log('bgm-pause-failed', String(e)); }
  }
  private restoreBgm() {
    if (!this.bgmPaused) return; this.bgmPaused = false;
    const a = GameAudio.instance; if (!a) return;
    try { a.setMusic(this.bgmPath); console.log('[VB_WINDSEAM] bgm-restored path=' + this.bgmPath); if (this.sink) this.sink('[VB_WINDSEAM] bgm-restored path=' + this.bgmPath); }
    catch (e) { console.warn('[VB_WINDSEAM] bgm restore failed', e); }
  }

  private startPhase(i: number) {
    const src = this.src!, clip = this.clips[i]!;
    try { src.stop(); } catch { /* ignore */ }
    src.clip = clip; src.loop = true; src.volume = 1;
    const now = VbWindSeamTest.now();
    this.phase = i; this.phaseStart = now; this.lastWrap = now; this.prevCt = 0; this.wraps = []; this.wrapCount = 0;
    try { src.play(); } catch (e) { this.log('play-failed', `clip=${NAMES[i]} err=${String(e)}`); }
    this.log('start', `clip=${NAMES[i]} dur=${Number(clip.getDuration()).toFixed(3)}s loop=${src.loop ? 1 : 0}`);
  }

  private endPhase() {
    const i = this.phase, w = this.wraps;
    let sum = 0, mn = Infinity, mx = 0;
    for (let k = 0; k < w.length; k++) { sum += w[k]; if (w[k] < mn) mn = w[k]; if (w[k] > mx) mx = w[k]; }
    const dur = this.clips[i] ? Number(this.clips[i]!.getDuration()) : NaN;
    this.log('end', `clip=${NAMES[i]} wraps=${this.wrapCount} measured=${w.length} meanPeriodMs=${w.length ? (sum / w.length).toFixed(1) : 'na'} minMs=${w.length ? mn : 'na'} maxMs=${w.length ? mx : 'na'} clipDurMs=${(dur * 1000).toFixed(0)} playing=${this.src && this.src.playing ? 1 : 0}`);
  }

  update(dt: number) {
    if (!this.alive || !this.src) return;
    const now = VbWindSeamTest.now();
    if (this.phase === -1) {
      const a = GameAudio.instance;
      const ok = !!a && a.canPlayAmbience() && this.loaded === CLIPS.length;
      if (!ok) {
        this.readyAt = 0;
        if (now >= this.waitLogAt) {
          this.waitLogAt = now + 5000;
          const d = a ? a.musicDiagnostics() : null;
          this.log('waiting', `gameAudio=${a ? 1 : 0} gesture=${d ? (d.gestureSeen ? 1 : 0) : 'na'} muted=${d ? (d.muted ? 1 : 0) : 'na'} suspended=${d ? String(d.suspended) : 'na'} loaded=${this.loaded}/${CLIPS.length} (tap the screen once)`);
        }
        return;
      }
      if (!this.readyAt) { this.readyAt = now; this.log('gesture-ok', `startInMs=${this.delayMs}`); }
      if (now - this.readyAt < this.delayMs) return;
      this.pauseBgm(); this.startPhase(0); return;
    }
    if (this.phase > 1) return;
    const src = this.src;
    const ct = Number(src.currentTime);
    if (Number.isFinite(ct)) {
      if (ct + 0.5 < this.prevCt) {
        const period = Math.round(now - this.lastWrap); this.lastWrap = now;
        this.wrapCount++;
        if (this.wrapCount > 1) this.wraps.push(period);
        this.log('loop', `clip=${NAMES[this.phase]} n=${this.wrapCount} periodMs=${period} prevCt=${this.prevCt.toFixed(3)} ct=${ct.toFixed(3)} frameMs=${Math.round(dt * 1000)} playing=${src.playing ? 1 : 0}`);
      }
      this.prevCt = ct;
    }
    if (now - this.phaseStart >= this.sec * 1000) {
      this.endPhase();
      if (this.phase === 0) { this.startPhase(1); return; }
      this.phase = 2;
      try { src.stop(); } catch { /* ignore */ }
      this.restoreBgm();
      this.log('done', 'scenario=windseam');
      this.node.destroy();
    }
  }
}

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => { VbWindSeamTest.maybeMount(); });
