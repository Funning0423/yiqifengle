// GameAudio.ts — 音频管理脚本草案 v0.2（Voice Bot，2026-10-09；按 GGbot 审稿 AUDIO-HOOK-v1-REVIEW 修改）
// 状态：草案，待 GGbot 审；未在 Cocos 里编译或运行（not_run）。不改任何现有文件，接入点见 AUDIO-EVENT-MAP-v1.md。
// 资源位置：assets/resources/audio_sfx/sfx_*.mp3（resources 是启动时加载的分包，合计约 88 KB）。
import { _decorator, Component, Node, AudioSource, AudioClip, resources, director, game, Game, sys } from 'cc';
const { ccclass } = _decorator;

export type SfxName = 'sfx_match_normal' | 'sfx_combo_1' | 'sfx_combo_2' | 'sfx_combo_3'
  | 'sfx_chest_open' | 'sfx_ui_click' | 'sfx_level_clear';

const SFX_DIR = 'audio_sfx';
const MUTE_KEY = 'qfl.audio.muted';
const MIN_GAP_MS = 60;        // 同一个音效 60 ms 内只播一次，防止同帧多次触发叠成爆音
const MAX_VOICES = 6;         // 同时最多 6 个音效；微信小游戏同时存在的音频实例数量有限，宁少勿多

@ccclass('GameAudio')
export class GameAudio extends Component {
  static instance: GameAudio | null = null;

  private sfxSource!: AudioSource;            // 只用 playOneShot
  private loopSource!: AudioSource;           // 以后放 BGM / 环境声（走远程包，按区域加载）
  private clips = new Map<string, AudioClip>();
  private lastPlay = new Map<string, number>();
  private voices: number[] = [];               // 最近播放的结束时间戳，用来粗略限制同时发声数
  private muted = false;
  private cascade = 0;                         // 本次操作里第几波消除（0 = 还没消）
  private prevState: string | undefined;       // 上一次 render 的 state；undefined = 还没有基准

  /** 在启动场景里调用一次即可：GameAudio.ensure() */
  static ensure(): GameAudio {
    if (GameAudio.instance) return GameAudio.instance;
    const node = new Node('GameAudio');
    director.getScene()!.addChild(node);
    director.addPersistRootNode(node);
    return node.addComponent(GameAudio);
  }

  onLoad() {
    GameAudio.instance = this;
    this.sfxSource = this.node.addComponent(AudioSource);
    this.loopSource = this.node.addComponent(AudioSource);
    this.loopSource.loop = true;
    this.muted = sys.localStorage.getItem(MUTE_KEY) === '1';
    // 资源加载失败不影响游戏：没加载到的音效 play() 时直接跳过
    resources.loadDir(SFX_DIR, AudioClip, (err, list) => {
      if (err) { console.warn('[GameAudio] sfx load failed', err); return; }
      for (const c of list) this.clips.set(c.name, c);
    });
    game.on(Game.EVENT_HIDE, this.onHide, this);
    game.on(Game.EVENT_SHOW, this.onShow, this);
  }

  onDestroy() {
    game.off(Game.EVENT_HIDE, this.onHide, this);
    game.off(Game.EVENT_SHOW, this.onShow, this);
    if (GameAudio.instance === this) GameAudio.instance = null;
  }

  // ---------- 通用 ----------
  play(name: SfxName, volume = 1) {
    if (this.muted) return;
    const clip = this.clips.get(name);
    if (!clip) return;
    const now = Date.now();
    if (now - (this.lastPlay.get(name) || 0) < MIN_GAP_MS) return;
    this.voices = this.voices.filter(t => t > now);
    if (this.voices.length >= MAX_VOICES) return;
    this.lastPlay.set(name, now);
    this.voices.push(now + clip.getDuration() * 1000);
    this.sfxSource.playOneShot(clip, volume);
  }

  setMuted(m: boolean) {
    this.muted = m;
    sys.localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    if (m) this.loopSource.pause(); else if (this.loopSource.clip) this.loopSource.play();
  }
  isMuted() { return this.muted; }

  // 切后台暂停循环声，回前台恢复（微信里来电、切出时音频会被系统打断）
  private onHide() { this.loopSource.pause(); }
  private onShow() { if (!this.muted && this.loopSource.clip) this.loopSource.play(); }

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
