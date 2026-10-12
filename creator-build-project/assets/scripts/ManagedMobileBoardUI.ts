import { ManagedToolArt } from './ManagedToolArt';
import { managedTools, TOOL_NAMES, type ManagedTool } from './world-r2/ManagedTools';
import { _decorator, Component, Node, Canvas, Camera, Layers, UITransform, UIOpacity, Graphics, Color, Label, Vec3, EventTouch, game, Game, view, ResolutionPolicy, tween, Tween, profiler, Sprite, director, input, isValid } from 'cc';
import type { LevelBackgroundStatus, LevelBackgroundFrame } from './world-r2/LevelBackground';
import { GameAudio } from './audio/GameAudio';
import { BoardArt, PIECE_KEYS, TOOL_KEYS, toolDisplaySize } from './ui/BoardArt';
import { boardLayout, cellCenter, pickToolBar, toolSlots, CELL, IdleHintClock, TOAST_S, type BoardLayout, type SafeArea } from './ui/BoardLayout';
import { PopupStack, TintSet, artButton, makeLabel, measure, playSound } from './ui/PopupKit';
import { INTRO_TEXT, SEEN_ID, openBag, openReward, openSettings, openToolIntro, type RewardItem } from './ui/CommonPanels';
import { openPause, openRestartConfirm, openResult, type ResultModel, type ResultReward } from './ui/BoardPanels';
import { hasSeenTool, reducedMotion } from './ui/UiPrefs';
import Controller from './r4-cloud-compat/runtime/challenge-controller.js';
import Port from './r4-cloud-compat/adapter/cocos-port.js';
const { ccclass } = _decorator;
const { createSynchronousStorage, bindChallengeController } = Port;
/** Result-page actions owned by the world host (WorldIntegrationBoot): availability is pushed every frame. */
export interface HostResultAction { visible: boolean; claimed?: boolean; run: () => void }
export interface HostResultActions { mainNext?: HostResultAction; chest?: HostResultAction; regionReward?: HostResultAction; next?: HostResultAction; claim?: HostResultAction }
const GOAL_ART: Record<string, string> = { moss: 'board/obstacle_moss', roots: 'board/obstacle_roots', beacons: 'r2/beacon_lighthouse', pearls: 'board/obstacle_shell_2', shells: 'board/obstacle_shell_2', lines: 'board/special_line_h', specials: 'board/special_bomb', blooms: 'board/piece_flower', relays: 'board/special_line_v' };
export function goalArt(key: string): string { return /^type[0-5]$/.test(key) ? PIECE_KEYS[Number(key.slice(4))] : GOAL_ART[key] || 'board/piece_flower'; }
/** b-board v3.1 board skin: wood tray with tile_a/b bases, piece_* art, obstacles, specials; top-left pause + one info
 *  plate; ≤3 tool slots; transient toast; idle auto-hint (5 s, then every 8 s); every dialog is a lite popup. */
@ccclass('ManagedMobileBoardUI')
export class ManagedMobileBoardUI extends Component {
  private managed: any = null; private disposing = false; private frameKinds = new Set<string>();
  initializeManaged(fixture: any, binding: any, backgroundFrame?: (portrait: boolean, layout?: LevelBackgroundFrame) => void, backgroundStatus?: () => LevelBackgroundStatus) {
    if (this.managed || this.root) throw Error('Already initialized'); if (this.deferPresentation) this.presented = false; this.managed = binding; this.backgroundStatus = backgroundStatus; this.initialize(fixture, backgroundFrame);
  }
  managedViewVersion() { return 'mobile-managed-v2-board-ui'; }
  diagnostics() {
    return { background: this.backgroundStatus?.() ?? { state: 'missing-provider' }, snapshot: this.controller.snapshot(), checkpoint: this.controller.session?.checkpoint() || null, presentation: this.snapshot,
      layout: this.measureLayout(), storage: this.managed?.storageEntries?.() || [], frameKinds: Array.from(this.frameKinds), goalSemantics: this.goalKeys.map((key, i) => ({ key, value: this.goalLabels[i]?.string, icon: goalArt(key) })),
      toolBar: this.toolBar.slice(), popups: this.popups ? this.popups.names() : [], hintCells: this.hintCells.slice(), hints: this.hintClock.count(), toast: this.toastLabel?.string || '', art: BoardArt.shared().diagnostics() };
  }
  lateEnd(index: number) { this.cells[index]?.emit(Node.EventType.TOUCH_END); }
  private backgroundStatus?: () => LevelBackgroundStatus; private backgroundFrame?: (portrait: boolean, layout?: LevelBackgroundFrame) => void;
  private root!: Node; private grid!: Node; private camera!: Camera; private hud!: Node; private tray!: Node; private boardFrame!: Node; private regionalFocus!: Node; private stagePanel!: Node;
  private layers: Record<string, Node> = {}; private glow!: Graphics; private marks!: Graphics;
  private bases: Sprite[] = []; private moss: Sprite[] = []; private under: Sprite[] = []; private over: Sprite[] = []; private covers: Sprite[] = [];
  private beaconRing!: Sprite; private beaconHouse!: Sprite; private beaconCoin!: Node; private beaconCoinPiece!: Sprite;
  private controller: any; private host: any; private cells: Node[] = []; private selected = -1;
  private snapshot: any; private fixture: any; private epoch = 0; private timer: any = null;
  private values = new Map<string, string>(); private attempt = 0; private dragStart: any = null;
  private journey = { readOnly: false, records: Array.from({ length: 12 }, () => ({ bestStars: 3 })) };
  private layoutInfo: any = null; private geo: BoardLayout | null = null; private cell = 42.6; private goalLabels: Label[] = [];
  private goalNodes: Node[] = []; private goalKeys: string[] = []; private targets: Record<string, Node> = {}; private boardCenter = new Vec3();
  private pause!: Node; private plate!: Node; private plateSprite!: Sprite; private titleLabel!: Label; private moves!: Label; private movesIcon!: Sprite; private plateDivider!: Graphics;
  private tools: Node[] = []; private toolBar: string[] = []; private toolBarKey = ''; private spriteReady = false;
  private toast!: Node; private toastLabel!: Label; private toastBg!: Graphics; private toastT = -1;
  private hintCells: number[] = []; private hintClock = new IdleHintClock(); private hintT = 0; private spinT = 0;
  private popups!: PopupStack; private tint = new TintSet(); private resultKey = ''; private hostActions: HostResultActions = {};
  private claimBase: { key: string; tools: Record<string, number>; charms: number; chests: string; regions: string; mementos: string } | null = null;
  private introQueue: string[] = []; private guideShown = ''; private artOff: (() => void) | null = null;
  /** World entry sets this before initializeManaged so a finger cannot land until presentForPlay. Standalone and test boards stay presented. */
  deferPresentation = false;
  /** Managed entry keeps the board off-screen until the island shot ends and a finger can land. Standalone boards start presented. */
  private presented = true; private readyWait: (() => void) | null = null; private entryFinish: (() => void) | null = null; private entryTimer: any = null;
  /** Last presentation was hidden (lock / background). The next visible paused frame asks update() to open the pause panel. */
  private boardWasHidden = false; private returnPause = false;
  private hide = () => { this.selected = -1; this.host?.hide(); }; private show = () => this.host?.show();
  private resize = () => { if (!this.disposing && this.root && isValid(this.root, true)) this.layout(); };
  initialize(fixture: any, backgroundFrame?: (portrait: boolean, layout?: LevelBackgroundFrame) => void) {
    this.fixture = fixture; this.backgroundFrame = backgroundFrame; if (!this.managed) profiler.hideStats(); view.resizeWithBrowserSize(true);
    this.root = this.box('NativeBoardCanvas', this.node, 0, 0, 1, 1);
    const canvas = this.root.addComponent(Canvas); canvas.alignCanvasWithScreen = false;
    const cameraNode = new Node('NativeUICamera'); cameraNode.layer = Layers.Enum.UI_2D; this.node.addChild(cameraNode); cameraNode.setPosition(0, 0, 1000);
    this.camera = cameraNode.addComponent(Camera); this.camera.projection = Camera.ProjectionType.ORTHO; this.camera.near = .1; this.camera.far = 2000; this.camera.priority = 50; this.camera.visibility = Layers.Enum.UI_2D; this.camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; canvas.cameraComponent = this.camera;
    if (this.deferPresentation) this.holdBoardCamera();
    this.boardFrame = this.box('IslandBoardCarving', this.root, 0, 0, 1, 1);
    const trayShadow = this.box('TrayShadow', this.boardFrame, 0, 0, 1, 1); trayShadow.addComponent(Graphics);
    this.tint.sprite(this.sprite(this.boardFrame, 'board/tray_frame', 'Tray'), 'ui');
    this.grid = this.box('CenteredNativeGrid', this.root, 0, 0, 1, 1);
    for (const name of ['Bases', 'Moss', 'Under', 'Glow']) this.layers[name] = this.box(name, this.grid, 0, 0, 1, 1);
    this.glow = this.layers.Glow.addComponent(Graphics);
    for (let i = 0; i < 49; i++) {
      this.bases.push(this.tint.sprite(this.sprite(this.layers.Bases, (Math.floor(i / 7) + i % 7) % 2 ? 'board/tile_b' : 'board/tile_a', 'Base-' + i), 'ui'));
      this.moss.push(this.tint.sprite(this.sprite(this.layers.Moss, 'board/obstacle_moss', 'Moss-' + i), 'ui'));
      this.under.push(this.tint.sprite(this.sprite(this.layers.Under, 'board/special_bomb', 'Pinwheel-' + i), 'ui'));
      const n = this.box('Tile-' + i, this.grid, 0, 0, 50, 50);
      this.tint.sprite(this.sprite(n, PIECE_KEYS[0], 'ProjectPieceArt'), 'ui');
      n.on(Node.EventType.TOUCH_START, (e: EventTouch) => { this.input(); if (!this.presented || this.modalOpen() || this.snapshot?.state !== 'run.ready' || this.snapshot?.readOnly) return; const p = e.getUILocation(); this.dragStart = { index: i, pointer: e.getID(), point: { x: p.x, y: p.y }, x: p.x, y: p.y, yDown: typeof this.layoutYDown === 'function' && this.layoutYDown(n, p.x, p.y), prior: this.selected }; }, this);
      n.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => { const d = this.dragStart; if (!d || d.index !== i) return; const p = e.getUILocation(), dx = p.x - d.point.x, dy = p.y - d.point.y; d.x = p.x; d.y = p.y; if (!d.consumed && Math.max(Math.abs(dx), Math.abs(dy)) < Math.min(18, this.cell * .35)) return; if (!d.consumed) { this.armedTool = null; if (this.paintToolTray) this.paintToolTray(); } d.consumed = true; const j = i + (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : (dy > 0 ? -7 : 7)); d.aim = j >= 0 && j < 49 && Math.abs(i % 7 - j % 7) + Math.abs(Math.floor(i / 7) - Math.floor(j / 7)) === 1 ? j : -1; if (this.followPiece) this.followPiece(); }, this);
      n.on(Node.EventType.TOUCH_END, (e: EventTouch) => { const d = this.dragStart; this.dragStart = null; if (e && d && d.index === i) GameAudio.notifyUserGesture(); if (!d || d.index !== i) return; if (this.releasePiece) { this.releasePiece(i, d, e); return; } if (d.consumed) { if (typeof d.aim === 'number' && d.aim >= 0) this.swap(i, d.aim); return; } this.tap(i); }, this);
      n.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => { const d = this.dragStart; if (d && e && typeof e.getID === 'function' && d.pointer !== e.getID()) return; this.dragStart = null; if (this.hidePieceGhost) this.hidePieceGhost(); this.cancelToolInput(); this.paintToolTray(); this.paint(); }, this); this.cells.push(n);
    }
    for (const name of ['Over', 'Covers', 'Marks', 'BeaconArt']) this.layers[name] = this.box(name, this.grid, 0, 0, 1, 1);
    for (let i = 0; i < 49; i++) { this.over.push(this.tint.sprite(this.sprite(this.layers.Over, 'board/special_line_h', 'Ribbon-' + i), 'ui')); this.covers.push(this.tint.sprite(this.sprite(this.layers.Covers, 'board/obstacle_roots', 'Cover-' + i), 'ui')); }
    this.marks = this.layers.Marks.addComponent(Graphics);
    this.beaconRing = this.tint.sprite(this.sprite(this.layers.BeaconArt, 'r2/beacon_ring', 'BeaconRing'), 'ui');
    this.beaconHouse = this.tint.sprite(this.sprite(this.layers.BeaconArt, 'r2/beacon_lighthouse', 'BeaconLighthouse'), 'ui');
    this.beaconCoin = this.box('BeaconTypeCoin', this.layers.BeaconArt, 0, 0, 1, 1); this.beaconCoin.addComponent(Graphics);
    this.beaconCoinPiece = this.tint.sprite(this.sprite(this.beaconCoin, PIECE_KEYS[0], 'Piece'), 'ui');
    this.regionalFocus = this.box('RegionalFocusCue', this.root, 0, 0, 1, 1); this.regionalFocus.addComponent(Graphics);
    this.hud = this.box('LightGoalHUD', this.root, 0, 0, 1, 1);
    this.pause = this.box('pause', this.hud, 0, 0, 44, 44);
    const pauseFace = this.box('Face', this.pause, 0, 0, 41, 41); this.tint.sprite(this.sprite(pauseFace, 'board/hud_pause', 'Art'), 'ui');
    this.pressable(this.pause, pauseFace, () => this.openPausePanel());
    this.plate = this.box('InfoPlate', this.hud, 0, 0, 411, 129);
    this.plateSprite = this.tint.sprite(this.sprite(this.plate, 'board/hud_levelplate', 'Plate'), 'ui');
    this.titleLabel = makeLabel(this.plate, '', 0, 30, 26, { width: 380, name: 'LevelTitle' }); this.tint.label(this.titleLabel, 'brown');
    for (let i = 0; i < 4; i++) {
      const n = this.box('Goal-' + i, this.plate, 0, -21, 120, 60);
      this.tint.sprite(this.sprite(n, PIECE_KEYS[0], 'GoalPieceArt'), 'ui');
      const l = makeLabel(n, '', 0, 0, 32, { width: 80, align: 'left', name: 'Count' }); this.tint.label(l, 'brown'); this.goalLabels.push(l); this.goalNodes.push(n);
    }
    const div = this.box('Divider', this.plate, 0, -21, 4, 40); this.plateDivider = div.addComponent(Graphics);
    const steps = this.box('Moves', this.plate, 0, -21, 100, 60); this.movesIcon = this.tint.sprite(this.sprite(steps, 'board/icon_moves', 'Hourglass'), 'ui');
    this.moves = makeLabel(steps, '', 0, 0, 32, { width: 80, align: 'left', name: 'MovesLeft' }); this.tint.label(this.moves, 'teal'); this.targets.moves = steps;
    this.tray = this.box('CompactToolTray', this.root, 0, 0, 1, 1);
    for (let i = 0; i < 3; i++) this.tools.push(this.toolSlot(i));
    this.toolArt = this.tray.addComponent(ManagedToolArt); this.toolArt.initialize(() => this.paintToolTray());
    this.toast = this.box('Toast', this.root, 0, 0, 300, 40); this.toast.addComponent(UIOpacity).opacity = 0;
    this.toastBg = this.box('ToastPlate', this.toast, 0, 0, 300, 40).addComponent(Graphics);
    this.toastLabel = makeLabel(this.toast, '', 0, 0, 15, { width: 320, name: 'ToastText' }); this.tint.label(this.toastLabel, 'brown');
    this.stagePanel = this.box('NativeStageSelection', this.root, 0, 0, 1, 1);
    this.popups = new PopupStack(this.root, () => ({ width: this.layoutInfo?.width || 390, height: this.layoutInfo?.height || 844 }));
    const art = BoardArt.shared(); this.artOff = art.onChange(() => { if (!this.disposing && isValid(this.root, true)) this.refreshArt(); });
    void art.load('board'); void art.load('popup'); void art.load('r2');
    this.layout(); this.bind(); if (!this.managed) { game.on(Game.EVENT_HIDE, this.hide); game.on(Game.EVENT_SHOW, this.show); } view.on('canvas-resize', this.resize, this); if (typeof window !== 'undefined') window.addEventListener('resize', this.resize);
    this.refreshArt();
    if (this.deferPresentation) { this.holdBoardCamera(); this.node.active = false; }
    if (!this.managed) (globalThis as any).__nativeBoard = { snapshot: () => this.controller.snapshot(), storage: () => Array.from(this.values), coldReload: () => this.coldReload(), hide: () => this.hide(), show: () => this.show(), fixture: () => this.fixture, layout: () => this.measureLayout(), scope: 'Native Cocos UI; board-ui phase-1 art; disposable memory' };
  }
  /** World entry: the board camera must not draw over the island before presentForPlay. An inactive host is not enough on device. */
  private holdBoardCamera() {
    if (!this.camera) return;
    this.camera.enabled = false; this.camera.visibility = 0;
    const n = this.camera.node; if (n && isValid(n, true)) n.active = false;
  }
  private releaseBoardCamera() {
    if (!this.camera) return;
    const n = this.camera.node; if (n && isValid(n, true)) n.active = true;
    this.camera.visibility = Layers.Enum.UI_2D; this.camera.enabled = true;
  }
  /** Art lands asynchronously: rebind every sprite that was created before its directory loaded. */
  private refreshArt() {
    const art = BoardArt.shared(); this.spriteReady = art.loaded('board');
    const rebind = (s: Sprite, key: string) => { const f = art.frame(key); if (f && s.spriteFrame !== f) s.spriteFrame = f; };
    rebind(this.boardFrame.getChildByName('Tray')!.getComponent(Sprite)!, 'board/tray_frame');
    for (let i = 0; i < 49; i++) { rebind(this.bases[i], (Math.floor(i / 7) + i % 7) % 2 ? 'board/tile_b' : 'board/tile_a'); rebind(this.moss[i], 'board/obstacle_moss'); rebind(this.under[i], 'board/special_bomb'); }
    rebind(this.beaconRing, 'r2/beacon_ring'); rebind(this.beaconHouse, 'r2/beacon_lighthouse');
    rebind(this.pause.getChildByName('Face')!.getChildByName('Art')!.getComponent(Sprite)!, 'board/hud_pause');
    const plate = art.frame('board/hud_levelplate'); if (plate) { this.plateSprite.spriteFrame = plate; this.plateSprite.type = Sprite.Type.SLICED; }
    rebind(this.movesIcon, 'board/icon_moves');
    this.layout();
  }
  private sprite(parent: Node, key: string, name: string): Sprite {
    const n = this.box(name, parent, 0, 0, 10, 10), s = n.addComponent(Sprite); s.sizeMode = Sprite.SizeMode.CUSTOM; s.trim = false; s.spriteFrame = BoardArt.shared().frame(key); return s;
  }
  private setFrame(s: Sprite, key: string | null) { const f = key ? BoardArt.shared().frame(key) : null; s.node.active = !!f; if (f && s.spriteFrame !== f) s.spriteFrame = f; }
  private place(n: Node, x: number, y: number, w: number, h = w) { n.setPosition(x, y, 0); n.getComponent(UITransform)!.setContentSize(w, h); }
  private pressable(node: Node, face: Node, tap: () => void, sound: 'button' | 'back' | 'tool' = 'button') {
    let down = false;
    node.on(Node.EventType.TOUCH_START, (e: EventTouch) => { e.propagationStopped = true; this.input(); if (!this.presented || this.modalOpen()) return; down = true; face.setPosition(0, -3, 0); }, this);
    node.on(Node.EventType.TOUCH_CANCEL, () => { down = false; face.setPosition(0, 0, 0); }, this);
    node.on(Node.EventType.TOUCH_END, (e: EventTouch) => { e.propagationStopped = true; const was = down; down = false; face.setPosition(0, 0, 0); if (!was || this.modalOpen()) return; GameAudio.notifyUserGesture(); playSound(sound); tap(); }, this);
  }
  // ---------------- tools ----------------
  private toolArt!: ManagedToolArt; private armedTool: string | null = null; private toolTapAccepted = false;
  private toolDrag: { kind: string, slot: number, pointer: number, start: { x: number, y: number }, point: { x: number, y: number }, moved: boolean, version: string, yDown?: boolean } | null = null; private toolGhost: Node | null = null; private pieceGhost: Node | null = null;
  private toolCatalog(): ManagedTool[] { return this.managed?.tools?.() || managedTools(this.snapshot); }
  private barTools(): ManagedTool[] { const c = this.toolCatalog(), out: ManagedTool[] = []; for (const k of this.toolBar) { const t = c.find(x => x.kind === k); if (t) out.push(t); } return out; }
  private toolVersion() { const a = this.snapshot?.active; return `${a?.attemptId || a?.stageId}:${a?.actions?.length ?? a?.turn ?? 0}:${a?.version ?? 0}`; }
  private canUseTools() { return this.presented && !this.modalOpen() && this.snapshot?.state === 'run.ready' && !this.snapshot?.readOnly; }
  /** run.ready can take a finger. A settled pause, result or readonly screen is the real screen too — not a half board. */
  private entryShowable(s = this.snapshot) {
    if (!s || !this.geo || this.cells.length !== 49) return false;
    if (s.state === 'run.ready' && !s.readOnly) return true;
    if (s.readOnly || s.state === 'error.readonly' || s.state === 'run.unsaved' || s.state === 'run.paused' || s.state === 'book.ready' || s.state === 'stage.detail') return true;
    return typeof s.state === 'string' && s.state.indexOf('result.') === 0;
  }
  private wakeEntry() { if (!this.readyWait || !this.entryShowable()) return; const go = this.readyWait; this.readyWait = null; go(); }
  private pieceArtReady() { const art = BoardArt.shared(); return art.loaded('board') && !!art.frame(PIECE_KEYS[0]); }
  /** Piece art and a showable session (run.ready, or a settled pause/result). A hung load rejects so the island can take the finger again. */
  whenInteractive(): Promise<void> {
    const cap = 8000;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true; this.entryFinish = null; this.readyWait = null;
        if (this.entryTimer != null) { clearTimeout(this.entryTimer); this.entryTimer = null; }
        if (err && !this.disposing) reject(err); else resolve();
      };
      this.entryFinish = () => finish();
      const consider = () => {
        if (settled || this.disposing) { finish(); return; }
        if (this.entryShowable() && this.pieceArtReady()) { finish(); return; }
        this.readyWait = consider;
      };
      this.entryTimer = setTimeout(() => {
        this.entryTimer = null;
        if (settled) return;
        if (this.disposing || this.entryShowable()) finish();
        else finish(Error('enter-level-not-ready'));
      }, cap);
      const art = BoardArt.shared(), loaded = art.loaded('board') ? Promise.resolve(true) : art.load('board');
      loaded.then(ok => {
        if (settled || this.disposing) { finish(); return; }
        if (this.entryShowable() && (!ok || this.pieceArtReady())) { finish(); return; }
        consider();
      }, () => { if (settled || this.disposing) finish(); else if (this.entryShowable()) finish(); else consider(); });
      consider();
    });
  }
  /** Called once the enter shot has finished and whenInteractive has resolved. The camera stays dark until this turn. */
  presentForPlay() {
    this.presented = true; this.releaseBoardCamera();
    if (this.node && isValid(this.node, true)) this.node.active = true;
    if (!this.disposing && this.root && isValid(this.root, true)) this.layout();
  }
  private cancelToolInput() { this.toolDrag = null; this.armedTool = null; this.toolTapAccepted = false; if (!this.disposing && this.toolGhost && isValid(this.toolGhost, true)) this.toolGhost.active = false; if (!this.disposing && this.pieceGhost && isValid(this.pieceGhost, true)) this.pieceGhost.active = false; this.selected = -1; }
  /** Freeze the tool bar per run: only tools in stock at the start, priority order, max 3; used-up ones stay greyed in place. */
  private syncToolBar() {
    const a = this.snapshot?.active; if (!a) { this.toolBar = []; this.toolBarKey = ''; return; }
    const key = [this.snapshot.provider, a.stageId, a.attemptId, a.seed].join('|'), fresh = !(a.actions?.length) && !(a.turn);
    if (key === this.toolBarKey && !(fresh && this.toolBar.length === 0)) return;
    if (key === this.toolBarKey && !fresh) return;
    this.toolBarKey = key; this.toolBar = pickToolBar(this.toolCatalog());
    for (const k of this.toolBar) if (INTRO_TEXT[k] && !hasSeenTool(SEEN_ID[k] || k) && this.introQueue.indexOf(k) < 0) this.introQueue.push(k);
  }
  private useToolAt(kind: string, index: number) {
    if (!this.canUseTools() || !this.managed) return false;
    const tool = this.toolCatalog().find(t => t.kind === kind);
    if (!tool?.available) { this.say(tool?.reason || '本关没有可用道具'); return false; }
    if (tool.targeted && (!Number.isInteger(index) || index < 0 || index > 48)) { this.say('先点道具再选格子，或把道具拖到格子上'); return false; }
    const r = this.managed.useTool(kind, index);
    if (!r.ok) this.say(r.reason === 'illegal-or-unsupported-action' ? '换一个有作用的落点，道具还在' : '暂不可操作 · ' + r.reason);
    else { this.armedTool = null; this.selected = -1; this.toastT = Math.min(this.toastT, TOAST_S); }
    this.paintToolTray(); this.paint(); return !!r.ok;
  }
  private tapTool(slot: number) {
    if (!this.canUseTools()) return false;
    const tool = this.barTools()[slot];
    if (!tool?.available) { this.cancelToolInput(); this.say(tool?.reason || '本关没有可用道具'); this.paintToolTray(); this.paint(); return false; }
    if (!tool.targeted) return this.useToolAt(tool.kind, -1);
    this.armedTool = this.armedTool === tool.kind ? null : tool.kind; this.selected = -1;
    this.say(this.armedTool ? `${tool.name} · 点选目标` : '已收回，道具没有消耗'); this.paintToolTray(); this.paint(); return true;
  }
  /** A press is layout pt (origin top-left, y down) when that reading sits on the node, otherwise Cocos UI (y up). */
  private layoutYDown(node: Node, x: number, y: number) {
    const d = this.layoutInfo; if (!d || !node || !node.worldPosition) return false;
    const w = node.worldPosition, px = x - d.width / 2, upY = y - d.height / 2, downY = d.height / 2 - y;
    return Math.hypot(px - w.x, downY - w.y) + 0.5 < Math.hypot(px - w.x, upY - w.y);
  }
  private cellAt(x: number, y: number, yDown?: boolean) {
    const d = this.layoutInfo; if (!d) return -1; const g = this.grid.worldPosition;
    const wy = yDown ? d.height / 2 - y : y - d.height / 2, lx = x - d.width / 2 - g.x, ly = wy - g.y;
    const col = Math.round(lx / this.cell) + 3, row = 3 - Math.round(ly / this.cell); if (Math.abs(lx) >= this.cell * 3.5 || Math.abs(ly) >= this.cell * 3.5 || col < 0 || col > 6 || row < 0 || row > 6) return -1; return row * 7 + col;
  }
  private pointerWorldY(y: number, yDown?: boolean) { const d = this.layoutInfo; return yDown ? d.height / 2 - y : y - d.height / 2; }
  private moveGhost(x: number, y: number) {
    const d = this.layoutInfo; if (!this.toolGhost) { this.toolGhost = this.box('ToolDragGhost', this.root, 0, 0, 56, 56); this.tint.sprite(this.toolGhost.addComponent(Sprite), 'ui'); }
    const sprite = this.toolGhost.getComponent(Sprite)!; sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = this.toolFrame(this.toolDrag!.kind);
    const ghost = toolDisplaySize(this.toolDrag!.kind, 56); this.toolGhost.getComponent(UITransform)!.setContentSize(ghost.width, ghost.height);
    this.toolGhost.active = true; this.toolGhost.setSiblingIndex(this.root.children.length - 1); this.toolGhost.setWorldPosition(x - d.width / 2, this.pointerWorldY(y, this.toolDrag?.yDown), 0);
  }
  /** Pin the ghost to the pointer every frame while the finger is down. No fixed lift. A live touch can start the drag without a node move. */
  private followGhost() {
    const d = this.toolDrag;
    if (!d || !d.point || this.disposing || !this.layoutInfo) return;
    if (!this.canUseTools() || d.version !== this.toolVersion()) { this.cancelToolInput(); this.paintToolTray(); return; }
    const live = this.livePoint(d.pointer);
    if (live) { d.point.x = live.x; d.point.y = live.y; }
    if (!d.moved && Math.hypot(d.point.x - d.start.x, d.point.y - d.start.y) < 12) return;
    if (!d.moved) { d.moved = true; this.armedTool = null; }
    this.moveGhost(d.point.x, d.point.y);
    const i = this.cellAt(d.point.x, d.point.y, d.yDown);
    if (i !== this.selected) { this.selected = i; this.paint(); }
  }
  /** Latest finger from the engine touch list. Headless doubles keep the last move point. */
  private livePoint(id: number) {
    let list: any = null;
    try { const src: any = input; if (src && typeof src.getAllTouches === 'function') list = src.getAllTouches(); } catch (err) { list = null; }
    if (!list || !list.length) return null;
    for (let n = 0; n < list.length; n++) {
      const t = list[n];
      if (!t || typeof t.getID !== 'function' || t.getID() !== id || typeof t.getUILocation !== 'function') continue;
      const p = t.getUILocation();
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
    return null;
  }
  /** Orthogonal neighbors only. A diagonal, the same cell, or a miss is not a swap. */
  private beside(a: number, b: number) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || a > 48 || b < 0 || b > 48 || a === b) return false;
    return Math.abs(a % 7 - b % 7) + Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) === 1;
  }
  /** Move the held piece with the finger. Crossing the dead-zone clears a sticky armed tool; it does not swap. */
  private followPiece() {
    const d = this.dragStart;
    if (!d || this.disposing || !this.layoutInfo) return;
    if (this.modalOpen() || !this.snapshot || this.snapshot.state !== 'run.ready' || this.snapshot.readOnly) { this.retractPiece(); return; }
    const live = this.livePoint(d.pointer);
    if (live) { d.x = live.x; d.y = live.y; }
    if (typeof d.x !== 'number' || !d.point || typeof d.point.x !== 'number') return;
    const dx = d.x - d.point.x, dy = d.y - d.point.y;
    if (!d.consumed && Math.max(Math.abs(dx), Math.abs(dy)) < Math.min(18, this.cell * .35)) return;
    if (!d.consumed) { this.armedTool = null; this.paintToolTray(); }
    d.consumed = true;
    const hit = this.cellAt(d.x, d.y, d.yDown);
    d.aim = this.beside(d.index, hit) ? hit : -1;
    this.placePieceGhost(d);
    const mark = d.aim >= 0 ? d.aim : -1;
    if (mark !== this.selected) { this.selected = mark; this.paint(); }
  }
  private placePieceGhost(d: { index: number, x: number, y: number, yDown?: boolean }) {
    const info = this.layoutInfo; if (!info || !this.cells) return;
    const n = this.cells[d.index]; if (!n || !n.isValid) return;
    const art = n.getChildByName('ProjectPieceArt'); if (!art) return;
    const src = art.getComponent(Sprite);
    if (!this.pieceGhost) { this.pieceGhost = this.box('PieceDragGhost', this.root, 0, 0, this.cell, this.cell); this.tint.sprite(this.pieceGhost.addComponent(Sprite), 'ui'); }
    const sprite = this.pieceGhost.getComponent(Sprite)!; sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = src ? src.spriteFrame : null;
    const ui = art.getComponent(UITransform)!; this.pieceGhost.getComponent(UITransform)!.setContentSize(ui.width, ui.height);
    art.active = false; const ribbon = this.over[d.index]; if (ribbon && ribbon.node.active) ribbon.node.active = false;
    this.pieceGhost.active = true; this.pieceGhost.setSiblingIndex(this.root.children.length - 1);
    this.pieceGhost.setWorldPosition(d.x - info.width / 2, this.pointerWorldY(d.y, d.yDown), 0);
  }
  private hidePieceGhost() { if (!this.disposing && this.pieceGhost && isValid(this.pieceGhost, true)) this.pieceGhost.active = false; }
  private retractPiece() { this.dragStart = null; this.hidePieceGhost(); this.selected = -1; if (!this.disposing) this.paint(); }
  /** Real touch end only. Adjacent cell swaps. A still finger, or a release back on the start cell, stays a tap. */
  private releasePiece(i: number, d: any, e: EventTouch) {
    this.hidePieceGhost();
    if (!d) return;
    const p = e && typeof e.getUILocation === 'function' ? e.getUILocation() : null;
    const x = p && typeof p.x === 'number' ? p.x : d.x, y = p && typeof p.y === 'number' ? p.y : d.y;
    const hit = typeof x === 'number' && typeof y === 'number' ? this.cellAt(x, y, d.yDown) : -1;
    if (!d.consumed || hit === i) { if (typeof d.prior === 'number') this.selected = d.prior; this.tap(i); return; }
    this.armedTool = null; this.selected = -1; this.paint();
    if (this.beside(i, hit)) this.swap(i, hit);
  }
  private toolFrame(kind: string) { const key = TOOL_KEYS[kind]; return (key && BoardArt.shared().frame(key)) || this.toolArt?.frame(kind) || null; }
  private endToolDrag(e: EventTouch, slot?: number) {
    const d = this.toolDrag; if (!d || d.pointer !== e.getID() || (slot !== undefined && slot !== d.slot)) return; this.toolDrag = null; this.toolTapAccepted = false; if (!this.disposing && this.toolGhost && isValid(this.toolGhost, true)) this.toolGhost.active = false;
    if (!this.canUseTools() || d.version !== this.toolVersion()) { this.cancelToolInput(); this.paintToolTray(); this.paint(); return; }
    GameAudio.notifyUserGesture();
    const p = e.getUILocation(), moved = d.moved || Math.hypot(p.x - d.start.x, p.y - d.start.y) >= 12;
    if (!moved) { if (this.tools[d.slot].getComponent(UITransform)!.hitTest(e.getLocation(), e.windowId)) { this.toolTapAccepted = this.tapTool(d.slot); if (this.toolTapAccepted) playSound('tool'); } return; }
    const i = this.cellAt(p.x, p.y, d.yDown); this.armedTool = null; this.selected = -1; this.paintToolTray(); this.paint();
    if (i < 0) { this.say('已收回，道具没有消耗'); return; } this.useToolAt(d.kind, i);
  }
  private toolSlot(slot: number) {
    const n = this.box('slot-' + slot, this.tray, 0, 0, 64, 64);
    const face = this.box('Face', n, 0, 0, 64, 64);
    const sel = this.box('ToolSelection', face, 0, 0, 64, 64); sel.addComponent(Graphics);
    const art = this.box('OriginalToolArt', face, 0, 0, 60, 60); this.tint.sprite(art.addComponent(Sprite), 'ui'); art.addComponent(Graphics); art.addComponent(UIOpacity);
    const count = this.box('ToolCount', face, 22, 21, 24, 24); count.addComponent(Graphics); const q = makeLabel(count, '', 0, 0, 14, { width: 26, name: 'Quantity' }); this.tint.label(q, 'brown');
    n.on(Node.EventType.TOUCH_START, (e: EventTouch) => { this.input(); if (this.toolDrag || !this.canUseTools()) return; const tool = this.barTools()[slot]; if (!tool?.available) { this.cancelToolInput(); this.paintToolTray(); this.paint(); this.say(tool?.reason || '本关没有可用道具'); return; } this.toolTapAccepted = false; const p = e.getUILocation(); face.setPosition(0, -3, 0); this.toolDrag = { kind: tool.kind, slot, pointer: e.getID(), start: { x: p.x, y: p.y }, point: { x: p.x, y: p.y }, moved: false, version: this.toolVersion(), yDown: typeof this.layoutYDown === 'function' && this.layoutYDown(n, p.x, p.y) }; }, this);
    n.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => { const d = this.toolDrag; if (!d || d.pointer !== e.getID()) return; if (!this.canUseTools() || d.version !== this.toolVersion()) { this.cancelToolInput(); this.paintToolTray(); return; } const p = e.getUILocation(); d.point.x = p.x; d.point.y = p.y; if (!d.moved && Math.hypot(p.x - d.start.x, p.y - d.start.y) < 12) return; d.moved = true; this.armedTool = null; this.moveGhost(p.x, p.y); const i = this.cellAt(p.x, p.y, d.yDown); if (i !== this.selected) { this.selected = i; this.paint(); } this.paintToolTray(); }, this);
    n.on(Node.EventType.TOUCH_END, (e: EventTouch) => { face.setPosition(0, 0, 0); this.endToolDrag(e, slot); }, this);
    n.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => { face.setPosition(0, 0, 0); if (this.toolDrag?.pointer !== e.getID()) return; this.cancelToolInput(); this.paintToolTray(); this.paint(); }, this);
    return n;
  }
  private paintToolTray() {
    if (this.disposing || !this.root || !isValid(this.root, true) || !this.snapshot || !this.geo) return;
    const g = this.geo, bar = this.barTools(), xs = toolSlots(g, bar.length), d = this.layoutInfo;
    for (const key of Object.keys(this.targets)) if (key === 'bomb' || key.startsWith('tool-')) delete this.targets[key];
    this.tray.active = bar.length > 0 && this.playing();
    this.tools.forEach((n, i) => {
      const tool = bar[i]; n.active = !!tool; if (!tool) return;
      n.setPosition(xs[i] - d.width / 2, d.height / 2 - g.tools.y, 0); n.getComponent(UITransform)!.setContentSize(Math.max(64, g.tools.hit), Math.max(64, g.tools.hit));
      const size = g.tools.size, artNode = n.getChildByName('Face')!.getChildByName('OriginalToolArt')!, sprite = artNode.getComponent(Sprite)!, frame = this.toolFrame(tool.kind);
      const legacy = !TOOL_KEYS[tool.kind], box = legacy ? size * 0.72 : size, fit = legacy ? { width: box, height: box } : toolDisplaySize(tool.kind, box);
      artNode.getComponent(UITransform)!.setContentSize(fit.width, fit.height); artNode.setPosition(0, legacy ? 4 : 0, 0);
      sprite.spriteFrame = frame; sprite.grayscale = !tool.available; artNode.getComponent(UIOpacity)!.opacity = tool.available ? 255 : 140;
      const fallback = artNode.getComponent(Graphics)!; fallback.clear(); if (!frame) this.drawToolEmblem(fallback, tool.kind, tool.available);
      const badge = n.getChildByName('Face')!.getChildByName('ToolCount')!, bg = badge.getComponent(Graphics)!, night = this.tint.weight(), k = 1 - 0.38 * night, r = 11 * g.k;
      badge.setPosition(size * 0.29, size * 0.28, 0); bg.clear();
      bg.fillColor = new Color(60, 40, 20, 70); bg.circle(0.5, -1.5, r); bg.fill();
      bg.fillColor = new Color(Math.round(248 * k), Math.round(242 * k), Math.round(226 * k), 255); bg.circle(0, 0, r); bg.fill();
      bg.strokeColor = new Color(149, 103, 55, 255); bg.lineWidth = 1.5; bg.circle(0, 0, r); bg.stroke();
      const q = badge.getChildByName('Quantity')!.getComponent(Label)!; q.string = tool.available ? String(tool.count) : '+'; q.fontSize = Math.round(13.5 * g.k); q.lineHeight = q.fontSize + 2;
      const sel = n.getChildByName('Face')!.getChildByName('ToolSelection')!.getComponent(Graphics)!; sel.clear();
      if (this.armedTool === tool.kind || this.toolDrag?.kind === tool.kind) { sel.fillColor = new Color(255, 226, 140, 90); sel.circle(0, -4, size * 0.5); sel.fill(); sel.strokeColor = new Color(255, 214, 110, 255); sel.lineWidth = 3; sel.circle(0, -4, size * 0.5); sel.stroke(); }
      this.targets['tool-' + tool.kind] = n; if (tool.kind === 'bomb') this.targets.bomb = n;
    });
  }
  private drawToolEmblem(g: Graphics, kind: string, available: boolean) {
    if (kind === 'prismShift') {
      const polygon = (points: number[][], color: string) => { g.fillColor = new Color(available ? color : '#91afa0'); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.close(); g.fill(); };
      polygon([[-13, -1], [0, -18], [13, -1], [0, 15]], '#234f52'); polygon([[-12, 1], [0, 17], [0, 1]], '#f7e3a2'); polygon([[0, 17], [12, 1], [0, 1]], '#a7e4d0'); polygon([[-12, 1], [0, 1], [0, -15]], '#58b7ac'); polygon([[0, 1], [12, 1], [0, -15]], '#398e91');
    } else if (kind === 'tideAnchor') {
      g.strokeColor = new Color(available ? '#f0ce81' : '#96b3a3'); g.lineWidth = 3; g.circle(0, 11, 4); g.stroke(); g.moveTo(0, 7); g.lineTo(0, -13); g.moveTo(-8, 1); g.lineTo(8, 1); g.moveTo(-12, -5); g.lineTo(-9, -11); g.lineTo(0, -16); g.lineTo(9, -11); g.lineTo(12, -5); g.stroke();
    }
  }
  // ---------------- layout ----------------
  private safeInsets(w: number, h: number): SafeArea & { portrait: boolean } {
    const portrait = w < h * 1.1; let top = portrait ? 47 : 12, bottom = portrait ? 34 : 21, left = portrait ? 0 : 44, right = left;
    if (typeof document !== 'undefined' && document.documentElement && typeof getComputedStyle === 'function') { const css = getComputedStyle(document.documentElement); const read = (name: string) => parseFloat(css.getPropertyValue(name)) || 0; top = Math.max(top, read('--safe-top')); bottom = Math.max(bottom, read('--safe-bottom')); left = Math.max(left, read('--safe-left')); right = Math.max(right, read('--safe-right')); }
    const wx = (globalThis as any).wx; let info: any = null, capsule: any = null;
    try { info = wx?.getWindowInfo?.(); } catch { } if (!info) try { info = wx?.getSystemInfoSync?.(); } catch { }
    const ww = Number(info?.windowWidth) || w, hh = Number(info?.windowHeight) || h, sx = w / ww, sy = h / hh;
    const finite = (x: any) => typeof x === 'number' && Number.isFinite(x);
    if (ww > 0 && hh > 0 && Number.isFinite(sx) && Number.isFinite(sy)) {
      const a = info?.safeArea;
      if (a && [a.top, a.bottom, a.left, a.right].every(finite) && a.top >= 0 && a.bottom >= a.top && a.bottom <= hh && a.left >= 0 && a.right >= a.left && a.right <= ww) { top = Math.max(top, a.top * sy); bottom = Math.max(bottom, (hh - a.bottom) * sy); left = Math.max(left, a.left * sx); right = Math.max(right, (ww - a.right) * sx); }
      try { const r = wx?.getMenuButtonBoundingClientRect?.(); if (r && [r.top, r.bottom, r.left, r.right].every(finite) && r.top >= 0 && r.bottom > r.top && r.bottom < hh * .35 && r.left >= 0 && r.right > r.left && r.right <= ww) capsule = { top: r.top * sy, bottom: r.bottom * sy, left: r.left * sx, right: r.right * sx }; } catch { }
    }
    if (!capsule && portrait) capsule = { top: top + 4, bottom: top + 36, left: w - 93, right: w - 6 };
    return { top, bottom, left, right, portrait, capsule };
  }
  private layout() {
    const frame = typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : view.getFrameSize(); const w = Math.max(240, frame.width), h = Math.max(320, frame.height);
    if (!this.managed) view.setDesignResolutionSize(w, h, ResolutionPolicy.EXACT_FIT); if (game.canvas) director.root?.resize(game.canvas.width, game.canvas.height); this.camera.orthoHeight = h / 2; this.root.getComponent(UITransform)!.setContentSize(w, h);
    const safe = this.safeInsets(w, h), g = boardLayout(w, h, safe, Math.max(2, this.goalKeys.length)); this.geo = g;
    const X = (x: number) => x - w / 2, Y = (y: number) => h / 2 - y, P = g.pitch; this.cell = P;
    this.boardCenter.set(X(g.grid.x), Y(g.grid.y), 0); this.grid.setPosition(this.boardCenter); this.grid.getComponent(UITransform)!.setContentSize(g.grid.size, g.grid.size);
    this.regionalFocus.setPosition(this.boardCenter); this.boardFrame.setPosition(this.boardCenter);
    this.place(this.boardFrame.getChildByName('Tray')!, 0, 0, g.tray.width, g.tray.height);
    const sh = this.boardFrame.getChildByName('TrayShadow')!.getComponent(Graphics)!; sh.clear(); for (let i = 0; i < 4; i++) { sh.fillColor = new Color(40, 30, 20, 14 - i * 3); sh.roundRect(-g.tray.width / 2 - i * 3 + 3, -g.tray.height / 2 - 8 - i * 3, g.tray.width + i * 6, g.tray.height + i * 6, 18 + i * 3); sh.fill(); }
    this.cells.forEach((n, i) => { const c = cellCenter(g, i); n.setPosition(c.x - g.grid.x, g.grid.y - c.y, 0); n.getComponent(UITransform)!.setContentSize(P, P); });
    this.place(this.pause, X(g.pause.x), Y(g.pause.y), g.pause.hit); this.place(this.pause.getChildByName('Face')!.getChildByName('Art')!, 0, 0, g.pause.size * 126 / 128, g.pause.size);
    this.layoutPlate();
    this.toast.setPosition(X(g.toast.x), Y(g.toast.y), 0);
    this.layoutInfo = { width: w, height: h, safe, board: g.grid.size, cell: P, boardCenter: { x: this.boardCenter.x, y: this.boardCenter.y }, toolY: Y(g.tools.y), pitch: P, geometry: g, skyReserved: g.tray.y - g.tray.height / 2 };
    this.backgroundFrame?.(safe.portrait, { width: w, height: h, boardTop: g.tray.y - g.tray.height / 2 });
    this.popups.layout(); this.paint(); this.paintToolTray(); if (this.snapshot) this.render(this.snapshot);
  }
  /** Info plate: row 1 level title (the only place the name appears), row 2 goal pieces + counts | hourglass + moves. */
  private layoutPlate() {
    const g = this.geo; if (!g) return; const d = { w: this.root.getComponent(UITransform)!.width, h: this.root.getComponent(UITransform)!.height };
    const s = g.plate.width / 411, wpx = g.plate.width / s, hpx = 129;
    this.plate.setPosition(g.plate.x - d.w / 2, d.h / 2 - g.plate.y - 3, 0); this.plate.setScale(s, s, 1); this.place(this.plateSprite.node, 0, 0, wpx, hpx);
    const keys = this.goalKeys.slice(0, 4), icon = 50; let x = -wpx * 0.40;
    const movesW = 30 + 12 + measure(this.moves.string || '00', 32), divX = wpx / 2 - 34 - movesW - 18;
    this.goalNodes.forEach((n, i) => {
      n.active = i < keys.length; if (!n.active) return;
      const key = keys[i], label = this.goalLabels[i], tw = measure(label.string || '0', 32), art = n.getChildByName('GoalPieceArt')!.getComponent(Sprite)!;
      this.setFrame(art, goalArt(key)); const big = /^type/.test(key) ? icon : icon * 0.86; this.place(art.node, big / 2, 0, big, big);
      label.node.setPosition(big + 2, 2, 0); n.setPosition(x, -21, 0); x += big + 2 + tw + 18;
    });
    const end = Math.max(x - 18 + 14, -wpx * 0.40), dx = Math.max(end, divX);
    this.plateDivider.node.setPosition(dx, -21, 0); this.plateDivider.clear(); const k = 1 - 0.4 * this.tint.weight(); this.plateDivider.strokeColor = new Color(Math.round(196 * k), Math.round(166 * k), Math.round(120 * k), 255); this.plateDivider.lineWidth = 3; this.plateDivider.moveTo(0, -18); this.plateDivider.lineTo(0, 18); this.plateDivider.stroke();
    const mv = this.targets.moves; mv.setPosition(dx + 14, -21, 0); this.place(this.movesIcon.node, 11, 0, 21, 33); this.moves.node.setPosition(30, 2, 0);
    this.titleLabel.node.getComponent(UITransform)!.setContentSize(wpx - 40, 40); this.titleLabel.overflow = Label.Overflow.SHRINK;
  }
  private measureLayout() {
    const info = this.layoutInfo; const point = (n: Node) => ({ x: n.worldPosition.x + info.width / 2, y: info.height / 2 - n.worldPosition.y });
    const rect = (n: Node) => { const p = point(n), t = n.getComponent(UITransform)!, sx = n.worldScale.x, sy = n.worldScale.y; return { x: p.x - t.width * sx / 2, y: p.y - t.height * sy / 2, width: t.width * sx, height: t.height * sy }; };
    const popupTargets: Record<string, any> = {}; const walk = (n: Node) => { if (/^(Resume|Home|Next|Replay|RetrySave|Restart|Stay|Accept|GotIt|Close|Day|Night|SfxToggle|MusicToggle|MusicVolume|ReducedMotion|AboutRow|LicenseLink|PrevPage|NextPage|Tile-.+|Claim-.+|OpenChest-.+)$/.test(n.name) && n.activeInHierarchy) popupTargets[n.name] = point(n); for (const c of n.children) walk(c); };
    if (this.popups) for (const c of this.root.children) if (c.getComponent('cc.BlockInputEvents') || /Panel|Confirm/.test(c.name)) walk(c);
    return { ...info, geometry: undefined, layout: this.geo, spriteReady: this.spriteReady, tiles: this.cells.map(point), targets: { ...Object.fromEntries(Object.entries(this.targets).map(([k, n]) => [k, point(n)])), pause: point(this.pause), ...popupTargets },
      tileRects: this.cells.map(rect), pause: point(this.pause), plateRect: rect(this.plateSprite.node), goalRects: this.goalNodes.filter(n => n.active).map(n => rect(n.getChildByName('GoalPieceArt')!)), controlRects: [this.pause, ...this.tools.filter(n => n.active)].map(rect),
      toolRects: this.tools.filter(n => n.active).map(rect), spriteSizes: this.cells.map(n => { const t = n.getChildByName('ProjectPieceArt')!.getComponent(UITransform)!; return { width: t.width, height: t.height }; }),
      canvasPixels: game.canvas ? { width: game.canvas.width, height: game.canvas.height } : null, renderPixels: this.camera.camera ? { width: this.camera.camera.width, height: this.camera.camera.height } : null };
  }
  // ---------------- binding ----------------
  private bind() {
    const storage = createSynchronousStorage({ getItem: (k: string) => this.values.get(k) ?? null, setItem: (k: string, v: string) => this.values.set(k, v) });
    this.controller = this.managed ? this.managed.controller : new Controller({ platform: storage, journey: this.journey });
    this.host = (this.managed ? this.managed.bind : bindChallengeController)(this.controller, {
      render: (s: any) => this.render(s), animate: (_: any, s: any, done: () => void) => {
        if (this.disposing || !this.root || !isValid(this.root, true)) return;
        const epoch = this.epoch; for (const c of this.cells) tween(c).to(0.08, { scale: new Vec3(.94, .94, 1) }).to(.08, { scale: Vec3.ONE }).start();
        this.timer = setTimeout(() => { this.timer = null; if (epoch === this.epoch) done(); }, 180);
      }, cancelAnimations: () => this.cancelAnimations()
    });
  }
  private cancelAnimations() {
    this.epoch++; if (this.timer !== null) clearTimeout(this.timer); this.timer = null;
    this.cancelToolInput(); this.selected = -1; this.dragStart = null;
    for (const c of this.cells) { Tween.stopAllByTarget(c); if (!this.disposing && isValid(c, true)) c.setScale(1, 1, 1); }
    if (!this.disposing) this.paintToolTray();
  }
  private coldReload() { const before = this.controller.snapshot(); this.host.dispose(); this.bind(); return { before: before.state, after: this.controller.snapshot().state }; }
  private command(name: string, ...args: any[]) { this.cancelToolInput(); this.paintToolTray(); this.selected = -1; this.dragStart = null; const r = this.managed?.intercept?.(name, ...args) ?? this.host.command(name, ...args); if (r && r.ok === false) this.say('暂不可操作 · ' + r.reason); return r; }
  private swap(a: number, b: number) {
    if (!this.presented || this.modalOpen() || this.snapshot.state !== 'run.ready' || this.snapshot.readOnly) return;
    this.selected = -1; const p = this.host.command('previewAction', ['swap', a, b]);
    if (!p.ok) { this.paint(); this.shake(a, b); return; }
    const c = this.host.command('commitAction', p.token); if (!c.ok) this.say('行动未提交 · ' + c.reason);
  }
  /** Not swappable: small head-shake of both pieces. */
  private shake(a: number, b: number) {
    if (reducedMotion()) return;
    for (const i of [a, b]) { const n = this.cells[i]?.getChildByName('ProjectPieceArt'); if (!n) continue; const p = n.position.clone(); Tween.stopAllByTarget(n); tween(n).to(.05, { position: new Vec3(p.x - 4, p.y, 0) }).to(.07, { position: new Vec3(p.x + 4, p.y, 0) }).to(.07, { position: new Vec3(p.x - 2, p.y, 0) }).to(.05, { position: p }).start(); }
  }
  private tap(i: number) {
    if (!this.presented || this.modalOpen() || this.snapshot.state !== 'run.ready' || this.snapshot.readOnly) return; if (this.armedTool) { this.useToolAt(this.armedTool, i); return; } if (this.selected < 0) { this.selected = i; this.paint(); return; }
    const a = this.selected; if (a === i) { if (this.managed && this.snapshot.active?.board[i]?.special) this.managed.submit(['activate', i]); this.selected = -1; this.paint(); return; }
    if (Math.abs(a % 7 - i % 7) + Math.abs(Math.floor(a / 7) - Math.floor(i / 7)) === 1) this.swap(a, i); else { this.selected = i; this.paint(); }
  }
  hostPresentation() { return this.snapshot; }
  /** Dialogs that block the world host. The result page itself is not one: its actions are host commands. */
  hostModalOpen() { return this.modalOpen(); }
  hostLayout() { return this.layoutInfo; }
  setHostActions(a: HostResultActions | null) { this.hostActions = a || {}; if (this.snapshot && this.isResult(this.snapshot)) this.paintResult(this.snapshot); }
  private modalOpen() { return !!this.popups && this.popups.names().some(n => n !== 'ResultPanel'); }
  private isResult(s: any) { return s.state.startsWith('result.') || s.state === 'run.unsaved' || s.state === 'error.readonly'; }
  private playing() { const s = this.snapshot; return !!s?.active && !this.isResult(s) && !['book.ready', 'stage.detail'].includes(s.state); }
  private render(s: any) {
    if (this.disposing || !this.root || !isValid(this.root, true)) return;
    this.snapshot = s; if (s.visual?.kind) this.frameKinds.add(s.visual.kind); if (!this.managed) (globalThis as any).__forestLiveSnapshot = s;
    const back = this.boardWasHidden && !s.hidden;
    this.boardWasHidden = !!s.hidden;
    if (s.hidden || s.state !== 'run.paused' || !s.active) this.returnPause = false;
    else if (back && !this.modalOpen()) this.returnPause = true;
    if (s.state !== 'run.paused' && this.popups?.find('PausePanel')) this.popups.close('PausePanel');
    const book = ['book.ready', 'stage.detail'].includes(s.state), result = this.isResult(s), board = !book && !result;
    this.grid.active = board; this.boardFrame.active = board; this.regionalFocus.active = board && s.provider === 'regional-r05'; this.stagePanel.active = book; this.hud.active = board && !!s.active;
    if (s.state !== 'run.ready' || s.readOnly) this.cancelToolInput();
    const goalKeys = s.provider === 'mainline-v33' ? (s.active?.goalOrder || []) : s.provider === 'regional-r05' ? Object.keys(s.active?.goals || {}) : Object.keys(s.active?.goals || { beacons: 0, moss: 0, type5: 0 });
    const relayout = goalKeys.length !== this.goalKeys.length; this.goalKeys = goalKeys;
    this.moves.string = s.active ? String(s.active.moves) : '';
    this.goalLabels.forEach((l, i) => l.string = String(s.active?.goals?.[goalKeys[i]] ?? 0));
    this.titleLabel.string = s.active?.name ? `${String((s.active.level ?? Math.max(0, (s.active.ordinal ?? 1) - 1)) + 1).padStart(2, '0')}  ${s.active.name}` : '';
    if (relayout && this.geo) { this.layout(); return; }
    this.layoutPlate(); this.syncToolBar(); this.paintToolTray();
    if (!board) { this.hintCells = []; this.hintClock.reset(); }
    if (s.state === 'run.ready' && !this.modalOpen() && s.provider === 'regional-r05' && s.active?.guide) { const key = s.active.stageId + '|' + s.active.attemptId; if (this.guideShown !== key) { this.guideShown = key; this.showRuleGuide(); } }
    this.paint();
    if (book) this.paintBook(s); else this.clearChildren(this.stagePanel);
    if (result) this.paintResult(s); else if (this.resultKey) { this.resultKey = ''; this.closeResult(); }
    this.watchClaims(s); this.wakeEntry();
  }
  private clearChildren(n: Node) { for (const child of [...n.children]) { child.removeFromParent(); child.destroy(); } }
  private paintBook(s: any) {
    this.clearChildren(this.stagePanel); const stages = s.stages.filter((x: any) => x.region === 'tide').slice(0, 3);
    stages.forEach((x: any, i: number) => {
      const b = artButton(this.stagePanel, this.tint, 'secondary', `${x.ordinal}  ${x.name}${x.record ? '  ✓' : !x.unlocked ? '  ·' : ''}`, 0, 70 - i * 62, 290, 48, () => {
        if (this.snapshot.active) { this.say('请先继续当前旅程'); return; } if (!this.command('selectStage', x.id).ok) return;
        this.command('startStage', x.id, { seed: x.id === this.fixture?.stageId ? this.fixture.seed : undefined, attemptId: 'native-ui-' + (++this.attempt) });
      }, { fontSize: 18, name: 'Stage-' + i }); this.targets['stage' + i] = b.node;
    });
    if (s.active) this.targets.resume = artButton(this.stagePanel, this.tint, 'primary', '继续', 0, -135, 150, 44, () => this.command('resumeActive'), { fontSize: 18, name: 'Resume' }).node;
  }
  // ---------------- board paint ----------------
  private paint() {
    if (this.disposing || !this.root || !isValid(this.root, true) || !this.snapshot?.active || !this.geo) return;
    const a = this.snapshot.active, P = this.cell, lift = P * CELL.pieceLift, region = this.snapshot.provider === 'regional-r05' ? a.region : null;
    const pieces: any[] = a.regionPieces || [], roots: any[] = a.roots || [], moss: number[] = a.moss || [];
    for (let i = 0; i < 49; i++) {
      const n = this.cells[i], x = n.position.x, y = n.position.y, tile = a.board[i], special = tile?.special || null, bomb = special === 'bomb' || special === 'color';
      this.place(this.bases[i].node, x, y, P * CELL.tile);
      const mossOn = moss.indexOf(i) >= 0; this.moss[i].node.active = mossOn; if (mossOn) this.place(this.moss[i].node, x, y - 1, P * CELL.obstacle);
      this.under[i].node.active = bomb && !!tile; if (bomb) this.place(this.under[i].node, x, y + lift * 2, P * CELL.bomb);
      const art = n.getChildByName('ProjectPieceArt')!, sprite = art.getComponent(Sprite)!; Tween.stopAllByTarget(art);
      sprite.spriteFrame = tile ? BoardArt.shared().frame(PIECE_KEYS[tile.type % 6]) : null; art.active = !!tile;
      const sel = this.selected === i, size = P * CELL.piece * (bomb ? CELL.bombPiece : 1);
      art.setPosition(0, lift + (sel ? 4 : 0), 0); art.getComponent(UITransform)!.setContentSize(size, size);
      const ribbon = special === 'row' ? 'board/special_line_h' : special === 'column' ? 'board/special_line_v' : null;
      if (ribbon && tile) { this.setFrame(this.over[i], ribbon); this.place(this.over[i].node, x, y + lift + (sel ? 4 : 0), P * CELL.special); } else this.over[i].node.active = false;
      const root = roots.find((r: any) => Array.isArray(r) ? r[0] === i : r === i), piece = region === 'tide' ? pieces.find((p: any) => p.index === i && !p.done) : null;
      const left = piece ? Math.max(0, (piece.layers ?? 1) - (piece.progress ?? 0)) : 0;
      const cover = root !== undefined ? 'board/obstacle_roots' : left >= 2 ? 'board/obstacle_shell_2' : left === 1 ? 'board/obstacle_shell_1' : null;
      if (cover) { this.setFrame(this.covers[i], cover); if (root !== undefined) this.place(this.covers[i].node, x, y + 3, P * CELL.obstacle); else this.place(this.covers[i].node, x, y + P * .13, P * .9); } else this.covers[i].node.active = false;
    }
    if (this.managed) this.managed.afterPaint(this.snapshot, this.cells);
    this.paintMarks(); this.paintRegionalFocus();
    if (this.dragStart && this.dragStart.consumed) this.placePieceGhost(this.dragStart);
  }
  /** Glow (under pieces): current beacon warm pool. Marks (above): selection glow, hint breathing frame, beacon halo + route dots. */
  private paintMarks() {
    const g = this.glow, m = this.marks, a = this.snapshot?.active, P = this.cell; g.clear(); m.clear(); if (!a) return;
    const pos = (i: number) => this.cells[i].position;
    const target = a.beaconTarget && Number.isInteger(a.beaconTarget.index) ? a.beaconTarget : null;
    this.beaconRing.node.active = !!target; this.beaconHouse.node.active = !!target; this.beaconCoin.active = !!target?.typed && Number.isInteger(target?.type);
    if (target) {
      const c = pos(target.index);
      for (let k = 4; k >= 1; k--) { g.fillColor = new Color(255, 190, 80, 22 + (4 - k) * 10); g.circle(c.x, c.y, P * 0.625 * (0.6 + k * 0.1)); g.fill(); }
      g.fillColor = new Color(255, 222, 140, 220); g.roundRect(c.x - P * 0.37, c.y - P * 0.37, P * 0.74, P * 0.74, P * 0.16); g.fill();
      g.fillColor = new Color(255, 252, 232, 230); g.circle(c.x, c.y, P * 0.12); g.fill();
      this.place(this.beaconRing.node, c.x, c.y, P * 1.16, P * 1.16 * 92 / 96);
      this.place(this.beaconHouse.node, c.x + P * 0.36, c.y + P * 0.30, P * 0.3, P * 0.56);
      for (let k = 0; k < 3; k++) { m.strokeColor = new Color(255, 214, 120, 60 - k * 18); m.lineWidth = 4; m.roundRect(c.x - P * 0.55 - k * 2, c.y - P * 0.55 - k * 2, P * 1.1 + k * 4, P * 1.1 + k * 4, P * 0.2); m.stroke(); }
      if (this.beaconCoin.active) {
        this.beaconCoin.setPosition(c.x + P * 0.36, c.y - P * 0.02, 0); const cg = this.beaconCoin.getComponent(Graphics)!; cg.clear(); const r = P * 0.17;
        cg.fillColor = new Color(248, 242, 226, 255); cg.circle(0, 0, r); cg.fill(); cg.strokeColor = new Color(196, 150, 70, 255); cg.lineWidth = 1.5; cg.circle(0, 0, r); cg.stroke();
        this.beaconCoinPiece.spriteFrame = BoardArt.shared().frame(PIECE_KEYS[(target.type ?? 0) % 6]); this.place(this.beaconCoinPiece.node, 0, 0, r * 1.7);
      }
      const route: number[] = Array.isArray(a.beaconRoute) ? a.beaconRoute : [], next = route.slice((target.cursor ?? 0) + 1);
      let prev = c;
      for (let k = 0; k < next.length; k++) {
        const q = pos(next[k]); if (!q) continue; const dot = { x: q.x, y: q.y - P * 0.40 };
        for (let t = 1; t <= 3; t++) { const f = t / 4, from = { x: prev.x, y: prev.y - P * 0.40 }; m.fillColor = new Color(255, 214, 130, 128); m.circle(from.x + (dot.x - from.x) * f, from.y + (dot.y - from.y) * f, 3); m.fill(); }
        m.fillColor = new Color(255, 214, 130, 166); m.circle(dot.x, dot.y, 5); m.fill(); prev = q;
      }
    }
    if (this.selected >= 0 && this.selected < 49) {
      const c = pos(this.selected); for (let k = 0; k < 3; k++) { m.strokeColor = new Color(255, 214, 110, 180 - k * 55); m.lineWidth = 3 + k * 2; m.roundRect(c.x - P * 0.53 - k, c.y - P * 0.53 - k + 2, P * 1.06 + k * 2, P * 1.06 + k * 2, P * 0.2); m.stroke(); }
    }
    if (this.hintCells.length) {
      const breath = reducedMotion() ? 0.8 : 0.5 + 0.5 * Math.sin(this.hintT * Math.PI * 2 / 1.2);
      for (const i of this.hintCells) { const c = pos(i); if (!c) continue; m.strokeColor = new Color(255, 226, 140, Math.round(90 + 140 * breath)); m.lineWidth = 3; m.roundRect(c.x - P * 0.51, c.y - P * 0.51, P * 1.02, P * 1.02, P * 0.19); m.stroke(); m.strokeColor = new Color(255, 240, 196, Math.round(60 + 120 * breath)); m.lineWidth = 6; m.roundRect(c.x - P * 0.55, c.y - P * 0.55, P * 1.1, P * 1.1, P * 0.22); m.stroke(); }
    }
  }
  private paintRegionalFocus() {
    const s = this.snapshot, a = s?.active, g = this.regionalFocus.getComponent(Graphics)!; g.clear(); if (s?.provider !== 'regional-r05') return;
    const pieces = a.regionPieces || [], current = pieces.find((p: any) => !p.done), p = pieces.find((p: any) => p.index === this.selected) || current;
    const stable = s.state === 'run.ready' || s.state === 'run.paused', target = stable ? a.guide?.targets?.find((t: any) => t.cell.index === this.selected) : null;
    if (target && !this.armedTool && !this.toolDrag && this.selected >= 0) this.say(target.instruction);
    if (a.region !== 'sky' || !p || p.done || !Number.isInteger(p.partner) || p.partner < 0 || p.partner > 48) return;
    const point = (i: number) => this.cells[i].position, from = point(p.index), to = point(p.partner), length = Math.hypot(to.x - from.x, to.y - from.y), segments = Math.max(1, Math.ceil(length / 10));
    g.strokeColor = new Color(255, 214, 130, 190); g.lineWidth = 2.5;
    for (let i = 0; i < segments; i++) { const start = i / segments, end = Math.min(1, (i + .55) / segments); g.moveTo(from.x + (to.x - from.x) * start, from.y + (to.y - from.y) * start); g.lineTo(from.x + (to.x - from.x) * end, from.y + (to.y - from.y) * end); g.stroke(); }
    g.strokeColor = new Color(255, 226, 140, 255); g.lineWidth = 3; g.circle(from.x, from.y, this.cell * .5); g.stroke(); g.strokeColor = new Color(120, 200, 190, 255); g.circle(to.x, to.y, this.cell * .46); g.stroke();
  }
  private box(name: string, parent: Node, x: number, y: number, w: number, h: number) { const n = new Node(name); n.layer = Layers.Enum.UI_2D; parent.addChild(n); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, h); return n; }
  // ---------------- toast / input / hint ----------------
  /** Transient strip above the tool bar: tool prompts and errors only, fades after 2 s. */
  private say(text: string) {
    if (!text || !this.toastLabel) return; this.toastLabel.string = text; this.toastT = 0;
    const w = Math.min(330, measure(text, 15) + 40), h = 32; this.toast.getComponent(UITransform)!.setContentSize(w, h); this.paintToast(w, h); this.toast.setSiblingIndex(this.root.children.length - 1);
  }
  private paintToast(w: number, h: number) { const g = this.toastBg, k = 1 - 0.38 * this.tint.weight(); g.clear(); g.fillColor = new Color(40, 30, 20, 40); g.roundRect(-w / 2 + 1, -h / 2 - 2, w, h, h / 2); g.fill(); g.fillColor = new Color(Math.round(248 * k), Math.round(242 * k), Math.round(226 * k), 240); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill(); g.strokeColor = new Color(201, 177, 133, 255); g.lineWidth = 1.5; g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.stroke(); }
  private input() { this.hintClock.reset(); if (this.hintCells.length) { this.hintCells = []; this.paintMarks(); } }
  private autoHint() {
    const s = this.snapshot, a = s?.active; if (!a) return;
    if (s.provider === 'regional-r05' && a.guide) { const t = (a.guide.targets || []).filter((x: any) => x.current && !x.done); this.hintCells = t.map((x: any) => x.cell.index); if (t[0]?.instruction) this.say(t[0].instruction); }
    else { const hint = this.managed?.hint?.(); this.hintCells = Array.isArray(hint?.cells) ? hint.cells.slice() : []; }
    this.hintT = 0; this.paintMarks();
  }
  update(dt: number) {
    if (this.disposing || !this.root || !isValid(this.root, true)) return;
    this.followGhost(); this.followPiece();
    if (this.returnPause) { this.returnPause = false; if (this.snapshot?.state === 'run.paused' && !this.snapshot.hidden && this.snapshot.active && !this.modalOpen()) this.openPausePanel(); }
    this.tint.update(); this.popups.update(dt);
    const s = this.snapshot, active = !!s && s.state === 'run.ready' && !s.readOnly && !this.modalOpen() && !this.armedTool && !this.toolDrag && !this.dragStart && (typeof this.managed?.hint === 'function' || !!s.active?.guide);
    if (this.hintClock.tick(dt, active)) this.autoHint();
    if (this.hintCells.length) { this.hintT += dt; this.paintMarks(); }
    if (!reducedMotion()) { this.spinT = (this.spinT + dt * 120) % 360; for (let i = 0; i < 49; i++) if (this.under[i].node.active) this.under[i].node.setRotationFromEuler(0, 0, -this.spinT); }
    if (this.toastT >= 0) { this.toastT += dt; const op = this.toast.getComponent(UIOpacity)!, k = this.toastT < 0.2 ? this.toastT / 0.2 : this.toastT < TOAST_S ? 1 : Math.max(0, 1 - (this.toastT - TOAST_S) / 0.3); op.opacity = Math.round(255 * k); if (k <= 0 && this.toastT > TOAST_S) this.toastT = -1; }
    if (this.introQueue.length && s?.state === 'run.ready' && !this.popups.any()) { const kind = this.introQueue.shift()!; if (!hasSeenTool(SEEN_ID[kind] || kind)) openToolIntro(this.popups, kind); }
  }
  // ---------------- dialogs ----------------
  private openPausePanel() {
    const s = this.snapshot; if (!s?.active || this.modalOpen() || (s.state !== 'run.ready' && s.state !== 'run.paused')) return;
    this.cancelToolInput(); this.dragStart = null; this.paintToolTray(); this.paint();
    if (s.state === 'run.ready') this.command('pause');
    const name = s.active.name ? `${String((s.active.level ?? 0) + 1).padStart(2, '0')} ${s.active.name}` : '';
    const mainline = s.provider === 'mainline-v33';
    openPause(this.popups, {
      line: (name ? name + ' · ' : '') + '还剩 ' + (s.active.moves ?? 0) + ' 步',
      canRestart: typeof this.managed?.restart === 'function', canBag: mainline && !!s.journey?.inventory,
      resume: () => { if (this.snapshot?.state === 'run.paused') this.command('resume'); },
      restart: () => openRestartConfirm(this.popups, () => { this.popups.close('PausePanel'); const r = this.managed?.restart?.(); if (!r?.ok) this.say(r?.reason || '暂时不能重来'); }),
      bag: () => { const j = this.snapshot?.journey; if (!j?.inventory) { this.say('这一关没有行囊'); return; } openBag(this.popups, j, 'level', this.toolArt, level => { const r = this.command('openChest', level); if (!r?.ok) this.say(r?.reason || '现在还不能打开'); }); },
      settings: () => openSettings(this.popups),
      home: () => { this.popups.clear(); this.command('requestExit'); },
    });
  }
  private showRuleGuide() {
    const guide = this.snapshot?.active?.guide; if (!guide || this.modalOpen()) return;
    this.cancelToolInput(); this.dragStart = null; this.paintToolTray();
    const body = [guide.rule, guide.tool?.description].filter(Boolean).join('\n'), lines = Math.min(8, Math.ceil(measure(body, 28) / 560) + body.split('\n').length);
    const ph = 104 + 48 + 40 + lines * 40 + 48 + 104 + 72, p = this.popups.open({ name: 'RuleGuidePanel', height: ph, title: guide.title || '这一关的规则' });
    p.text(guide.phaseLabel + (guide.heldTurns ? ' · 固定 ' + guide.heldTurns + ' 次行动' : ''), 0, 128, 26, 'brown2', { bold: false, width: 600 });
    p.text(body, 0, 192 + lines * 20, 28, 'brown', { bold: false, width: 580, lines, height: lines * 40 + 8 });
    p.button('primary', '明白了', 0, ph - 72 - 52, 400, 104, () => p.close(), { fontSize: 36, name: 'GotIt' });
  }
  private closeResult() { const p = this.popups.find('ResultPanel'); if (p) p.destroy(); }
  private resultModel(s: any): ResultModel {
    const a = s.active || {}, mainline = s.provider === 'mainline-v33', won = a.status === 'won', h = this.hostActions;
    const kind = s.state === 'error.readonly' ? 'readonly' : (s.state === 'result.unsaved' || s.state === 'run.unsaved') ? 'unsaved' : won ? 'win' : 'lose';
    const stars = typeof s.result?.stars === 'number' ? s.result.stars : typeof s.result?.earnedStars === 'number' ? s.result.earnedStars : won ? 1 : 0;
    const goalsLeft = Object.keys(a.goals || {}).filter(k => (a.goals[k] || 0) > 0).map(k => ({ art: goalArt(k), count: a.goals[k] }));
    const chest = mainline ? s.journey?.chests?.find((x: any) => x.level === a.level) : null, rewards: ResultReward[] = [];
    if (kind === 'win' && mainline && chest?.earned) rewards.push({ id: 'chest', label: chest.opened ? '宝箱已打开' : '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state: chest.opened ? 'claimed' : h.chest?.visible ? 'ready' : 'locked', claim: h.chest?.run });
    if (kind === 'win' && mainline) { const region = s.journey?.regionRewards?.find((x: any) => x.region === Math.floor((a.level ?? 0) / 4)); if (region?.unlocked) { const tool = ['tideNet', 'sunSeed', 'starShears'][region.region] || 'tideNet'; rewards.push({ id: 'regionReward', label: region.claimed ? '地区道具已领取' : '领取地区道具', icon: '', iconKind: 'tool', tool, state: region.claimed ? 'claimed' : h.regionReward?.visible ? 'ready' : 'locked', claim: h.regionReward?.run }); } }
    if (kind === 'win' && s.provider === 'regional-r05' && (h.claim?.visible || s.progress?.claimedRegions?.includes(a.region))) { const owned = !!s.progress?.claimedRegions?.includes(a.region); rewards.push({ id: 'claim', label: owned ? '地区印记已领取' : '领取地区印记', icon: 'popup/reward_seal_' + (a.region || 'tide'), iconKind: 'seal', state: owned ? 'claimed' : 'ready', claim: h.claim?.run }); }
    const next = h.mainNext?.visible ? h.mainNext.run : h.next?.visible ? h.next.run : null;
    return { kind, score: a.score || 0, stars, movesUsed: Array.isArray(a.actions) ? a.actions.length : null, movesLeft: a.moves ?? null, goalsLeft, chestHint: mainline && kind !== 'readonly', rewards,
      next, replay: kind === 'lose' && mainline && s.state === 'result.saved' ? () => this.command('startStage', a.stageId, {}) : null,
      retrySave: () => this.command('retrySave'), home: () => { this.popups.clear(); this.resultKey = ''; this.command('requestExit'); } };
  }
  private paintResult(s: any) {
    const m = this.resultModel(s), key = [s.state, s.provider, s.active?.stageId, s.active?.attemptId, m.kind, m.stars, m.score, !!m.next, m.rewards.map(r => r.id + ':' + r.state).join(',')].join('|');
    if (key === this.resultKey && this.popups.find('ResultPanel')) return;
    this.resultKey = key; this.closeResult(); this.cancelToolInput(); this.toastT = -1; this.toast.getComponent(UIOpacity)!.opacity = 0;
    const p = openResult(this.popups, m, this.toolArt); if (this.modalOpen()) p.root.setSiblingIndex(Math.max(0, this.root.children.length - 2));
  }
  /** Reward claim popup: shown when a chest / regional tool / memento flips to claimed while this board is open. */
  private watchClaims(s: any) {
    const j = s.journey, a = s.active, key = s.provider + '|' + (a?.stageId ?? '');
    const now = { key, tools: { ...(j?.inventory?.tools || {}) }, charms: (j?.inventory?.charms || []).length, chests: (j?.chests || []).filter((c: any) => c.opened).map((c: any) => c.level).join(','), regions: (j?.regionRewards || []).filter((r: any) => r.claimed).map((r: any) => r.region).join(','), mementos: (s.progress?.claimedRegions || []).join(',') };
    const before = this.claimBase; this.claimBase = now; if (!before || before.key !== key) return;
    const chest = now.chests !== before.chests, region = now.regions !== before.regions, memento = now.mementos !== before.mementos; if (!chest && !region && !memento) return;
    const items: RewardItem[] = [];
    for (const kind of Object.keys(now.tools)) { const d = (Number(now.tools[kind]) || 0) - (Number(before.tools[kind]) || 0); if (d > 0) items.push({ kind, count: d, label: (TOOL_NAMES[kind] || kind) + ' ×' + d }); }
    if (now.charms > before.charms) items.push({ kind: 'charm', count: now.charms - before.charms, label: '装扮 ×' + (now.charms - before.charms), seal: 'r2/icon_charm' });
    if (memento) { const r = a?.region || 'tide'; items.push({ kind: 'seal', count: 0, label: ({ tide: '潮汐', meadow: '草甸', sky: '天空城' } as any)[r] + '印记', seal: 'popup/reward_seal_' + r }); }
    if (!items.length) items.push({ kind: 'seal', count: 0, label: '一份海风的礼物', seal: 'popup/star_full' });
    const gained = items.map(i => i.kind);
    const behind = this.popups.find('ResultPanel'); if (behind) behind.root.active = false;
    const desc = memento ? '地区印记收进旅程册了。' : region && !chest ? '收进旅人的行囊了。' : '海风吹开了宝箱，收进行囊吧。';
    openReward(this.popups, items, this.toolArt, { chest: !!chest, description: desc, done: () => { if (behind && behind.alive) behind.root.active = true; for (const k of gained) if (INTRO_TEXT[k] && !hasSeenTool(SEEN_ID[k] || k) && this.introQueue.indexOf(k) < 0) this.introQueue.push(k); this.flushIntro(); } });
  }
  private flushIntro() { if (!this.introQueue.length || this.modalOpen()) return; const kind = this.introQueue.shift()!; if (!hasSeenTool(SEEN_ID[kind] || kind)) openToolIntro(this.popups, kind, () => this.flushIntro()); else this.flushIntro(); }
  onDestroy() {
    if (this.disposing) return; this.disposing = true;
    if (this.entryTimer != null) { clearTimeout(this.entryTimer); this.entryTimer = null; }
    if (this.entryFinish) { const go = this.entryFinish; this.entryFinish = null; this.readyWait = null; go(); }
    else if (this.readyWait) { const go = this.readyWait; this.readyWait = null; go(); }
    this.cancelAnimations(); this.backgroundFrame = undefined; this.backgroundStatus = undefined; this.artOff?.(); this.artOff = null;
    game.off(Game.EVENT_HIDE, this.hide); game.off(Game.EVENT_SHOW, this.show); view.off('canvas-resize', this.resize, this); if (typeof window !== 'undefined') window.removeEventListener('resize', this.resize);
    try { this.popups?.clear(); this.host?.dispose(); } finally { this.tint.clear(); if (!this.managed) delete (globalThis as any).__nativeBoard; }
  }
}
