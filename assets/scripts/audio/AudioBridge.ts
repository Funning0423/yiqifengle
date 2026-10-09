// AudioBridge.ts — 0005 (grokbot-2/ggbot). Connects Voice Bot's GameAudio to the game WITHOUT editing any existing file
// (ManagedMobileBoardUI / WorldIntegrationBoot / MainlineHost are owned by Oi's branch). It self-mounts after every scene
// launch and only OBSERVES public state: board presentation snapshots, mainline journey reward flags, R5 claimed regions,
// and button nodes (extra TOUCH_END listeners, never replacing existing ones). Every path is wrapped so a failure here
// can never affect gameplay; with no audio clips loaded it is silent.
import { _decorator, Component, Node, director, Director, Graphics, Label, EventTouch, isValid } from 'cc';
import { GameAudio } from './GameAudio';
import { ManagedMobileBoardUI } from '../ManagedMobileBoardUI';
const { ccclass } = _decorator;
const TAGGED = '__qflAudioTagged';
const SCAN_INTERVAL = 0.25;

@ccclass('AudioBridge')
export class AudioBridge extends Component {
  static instance: AudioBridge | null = null;
  private board: ManagedMobileBoardUI | null = null;
  private lastVisualKey = '';
  private rewardBaseline: string | null = null;
  private scanTimer = 0;
  private taggedNodes = new Set<Node>();

  static ensure() {
    try {
      const audio = GameAudio.ensure();
      if (!audio.node.getComponent(AudioBridge)) audio.node.addComponent(AudioBridge);
    } catch (e) { console.warn('[AudioBridge] mount failed (silent, gameplay unaffected)', e); }
  }
  onLoad() { AudioBridge.instance = this; }
  onDestroy() {
    for (const n of this.taggedNodes) if (isValid(n, true)) { n.targetOff(this); if ((n as any)[TAGGED] === this) delete (n as any)[TAGGED]; }
    this.taggedNodes.clear(); this.board = null; this.rewardBaseline = null;
    if (AudioBridge.instance === this) AudioBridge.instance = null;
  }

  update(dt: number) {
    try { this.observeBoard(); } catch (e) { /* observation only */ }
    this.scanTimer -= dt;
    if (this.scanTimer <= 0) { this.scanTimer = SCAN_INTERVAL; try { this.scanButtons(); } catch (e) { /* ignore */ } }
  }

  private findBoard(): ManagedMobileBoardUI | null {
    if (this.board && isValid(this.board.node, true)) return this.board;
    const scene = director.getScene();
    const found = scene ? scene.getComponentsInChildren(ManagedMobileBoardUI).find(x => isValid(x.node, true)) || null : null;
    if (found !== this.board) { // board appeared or went away: new baselines, no sounds for restored state
      this.board = found; this.lastVisualKey = ''; this.rewardBaseline = null; GameAudio.instance?.resetRenderBaseline();
    }
    return found;
  }

  private observeBoard() {
    const audio = GameAudio.instance; if (!audio) return;
    const board = this.findBoard(); if (!board) return;
    const s: any = board.hostPresentation(); if (!s) return;
    // 1) animation frames: each visual frame has a unique token (mainline 'mlv:…', R5 'r5v:…')
    const v = s.visual;
    if (v && s.state === 'run.resolving') {
      const key = String(v.token ?? `${v.kind}:${s.active?.moves}:${v.index ?? ''}`);
      if (key !== this.lastVisualKey) { this.lastVisualKey = key; audio.onBoardFrame(v); }
    }
    // 2) result transition (GameAudio keeps the first observation as baseline: no sound on cold restore)
    if (typeof s.state === 'string') audio.onRender(s.state, s.active?.status === 'won');
    // 3) one-time rewards: a claim flag flipping false->true while this board is open
    const sig = this.rewardSignature(s);
    if (sig !== null) {
      if (this.rewardBaseline !== null && sig !== this.rewardBaseline && this.countClaims(sig) > this.countClaims(this.rewardBaseline))
        audio.onClaimResult({ ok: true, duplicate: false });
      this.rewardBaseline = sig;
    }
  }
  private rewardSignature(s: any): string | null {
    const j = s.journey, p = s.progress;
    const chests = Array.isArray(j?.chests) ? j.chests.map((c: any) => c.opened ? 1 : 0).join('') : '';
    const regions = Array.isArray(j?.regionRewards) ? j.regionRewards.map((r: any) => r.claimed ? 1 : 0).join('') : '';
    const r5 = Array.isArray(p?.claimedRegions) ? p.claimedRegions.length : 0;
    const r5fc = Array.isArray(j?.r5Claims) ? j.r5Claims.length : 0;
    if (!chests && !regions && !p) return null;
    return `${chests}|${regions}|${r5}|${r5fc}`;
  }
  private countClaims(sig: string) { const [c, r, a, b] = sig.split('|'); return (c.match(/1/g) || []).length + (r.match(/1/g) || []).length + Number(a || 0) + Number(b || 0); }

  // 4) click sound on real buttons only: nav buttons, board back/pause, result/stage panel buttons, tool slot taps
  private scanButtons() {
    for (const n of this.taggedNodes) if (!isValid(n, true)) this.taggedNodes.delete(n);
    const scene = director.getScene(); if (!scene) return;
    const nav = this.findNode(scene, 'WorldNavigationCanvas');
    if (nav) for (const n of nav.children) if (n.name !== 'LabelPlate' && !n.name.startsWith('Approved') && n.getComponent(Graphics)) this.tag(n, false);
    const boardCanvas = this.board && isValid(this.board.node, true) ? this.findNode(this.board.node, 'NativeBoardCanvas') : null;
    if (boardCanvas) {
      for (const n of boardCanvas.children) if (n.name === 'back' || n.name === 'pause') this.tag(n, false);
      const tray = boardCanvas.getChildByName('CompactToolTray'); if (tray) for (const n of tray.children) if (n.name === 'slot') this.tag(n, true);
      for (const panel of ['NativeResult', 'NativeStageSelection']) {
        const p = boardCanvas.getChildByName(panel); if (!p) continue;
        const caption = (this.board!.hostPresentation() as any)?.uiResultCaption;
        for (const n of p.children) if (n.name !== 'ResultContrastBadge' && n.name !== 'Text' && n.name !== caption && n.getComponent(Graphics) && n.getComponentInChildren(Label)) this.tag(n, false);
      }
    }
  }
  private tag(n: Node, tapOnly: boolean) {
    if ((n as any)[TAGGED]) return; (n as any)[TAGGED] = this; this.taggedNodes.add(n);
    let start: { x: number, y: number } | null = null;
    if (tapOnly) n.on(Node.EventType.TOUCH_START, (e: EventTouch) => { const p = e.getUILocation(); start = { x: p.x, y: p.y }; }, this);
    n.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      try {
        if (tapOnly) { const p = e.getUILocation(); const moved = start ? Math.hypot(p.x - start.x, p.y - start.y) >= 12 : false; start = null; if (moved) return; GameAudio.instance?.onToolTap(); }
        else GameAudio.instance?.onButton();
      } catch (err) { /* ignore */ }
    }, this);
  }
  private findNode(root: Node, name: string): Node | null {
    if (root.name === name) return root;
    for (const c of root.children) { const f = this.findNode(c, name); if (f) return f; }
    return null;
  }
}

// Mount once after the first scene. GameAudio is persistent across subsequent scene changes; no permanent director listener.
director.once(Director.EVENT_AFTER_SCENE_LAUNCH, () => AudioBridge.ensure());
