import { ManagedToolArt } from './ManagedToolArt';
import { managedTools, TOOL_NAMES, type ManagedTool } from './world-r2/ManagedTools';
import { _decorator, Component, Node, Canvas, Camera, Layers, UITransform, UIOpacity, Graphics, Color, Label, Vec3, EventTouch, game, Game, view, ResolutionPolicy, tween, Tween, profiler, Sprite, director, input, isValid, sys } from 'cc';
import type { LevelBackgroundStatus, LevelBackgroundFrame } from './world-r2/LevelBackground';
import { GameAudio } from './audio/GameAudio';
import { BoardArt, PIECE_KEYS, TOOL_KEYS, toolDisplaySize } from './ui/BoardArt';
import { MINIGAME } from 'cc/env';
import { ruleGuideDy, RULE_GUIDE_MAX_LINES, wrapKinsoku, boardLayout, boardSafeInsets, cellCenter, pickToolBar, qaForcedToolBar, toolSlots, CELL, IdleHintClock, TOAST_S, type BoardLayout, type SafeArea } from './ui/BoardLayout';
import { PopupStack, popupScale, TintSet, artButton, makeLabel, measure, playSound, pressable as bindPressable, resetPresses, type PressHandle } from './ui/PopupKit';
import { INTRO_TEXT, SEEN_ID, openBag, openReward, openSettings, openToolIntro, type RewardItem } from './ui/CommonPanels';
import { openPause, openRestartConfirm, openResult, type ResultModel, type ResultReward } from './ui/BoardPanels';
import { hasSeenTool, reducedMotion } from './ui/UiPrefs';
import { RegionArrivalTitle } from './ui/RegionArrivalTitle';
import { RegionTitleGate, markRegionTitleSeen, regionTitleFor } from './ui/RegionArrivalTitleCore';
import Controller from './r4-cloud-compat/runtime/challenge-controller.js';
import Port from './r4-cloud-compat/adapter/cocos-port.js';
const { ccclass } = _decorator;
const { createSynchronousStorage, bindChallengeController } = Port;
/** Result-page actions owned by the world host (WorldIntegrationBoot): availability is pushed every frame. */
export interface HostResultAction { visible: boolean; claimed?: boolean; run: (then?: () => any) => void }
export interface HostResultActions { mainNext?: HostResultAction; chest?: HostResultAction; regionReward?: HostResultAction; next?: HostResultAction; claim?: HostResultAction; ending?: HostResultAction; afterClaims?: HostResultAction }
const GOAL_ART: Record<string, string> = { moss: 'board/obstacle_moss', roots: 'board/obstacle_roots', beacons: 'r2/beacon_lighthouse', pearls: 'board/obstacle_shell_2', shells: 'board/obstacle_shell_2', lines: 'board/special_line_h', specials: 'board/special_bomb', blooms: 'board/piece_flower', relays: 'board/special_line_v' };
export function goalArt(key: string): string { return /^type[0-5]$/.test(key) ? PIECE_KEYS[Number(key.slice(4))] : GOAL_ART[key] || 'board/piece_flower'; }
/** b-board v3.1 board skin: wood tray with tile_a/b bases, piece_* art, obstacles, specials; top-left pause + one info
 *  plate; ≤3 tool slots; transient toast; idle auto-hint (5 s, then every 8 s); every dialog is a lite popup. */
function countNodes(n: Node): number { let k = 1; for (const c of n.children) k += countNodes(c); return k; }
/** Toast / say(): enter = toastFade (200 ms), exit 150 ms (U1 audit 2026-10-29). */
const TOAST_OUT_S = 0.15;
@ccclass('ManagedMobileBoardUI')
export class ManagedMobileBoardUI extends Component {
  private managed: any = null; private disposing = false; private frameKinds = new Set<string>(); private presentationError: string | null = null;
  initializeManaged(fixture: any, binding: any, backgroundFrame?: (portrait: boolean, layout?: LevelBackgroundFrame) => void, backgroundStatus?: () => LevelBackgroundStatus) {
    if (this.managed || this.root) throw Error('Already initialized'); if (this.deferPresentation) this.presented = false; this.managed = binding; this.backgroundStatus = backgroundStatus; this.initialize(fixture, backgroundFrame);
  }
  managedViewVersion() { return 'mobile-managed-v2-board-ui'; }
  diagnostics() {
    return { presentationError: this.presentationError,
      inputGate: { presented: this.presented, active: this.inputVisible(), state: this.snapshot?.state, piecePointer: this.dragStart?.pointer ?? null, toolPointer: this.toolDrag?.pointer ?? null,
        visualPending: !!this.visualDone, visualLeft: this.visualLeft, entryPending: !!this.entryFinish },
      prewarm: { ...this.prewarmStats, pending: this.prewarm ? this.prewarm.parked.length - this.prewarm.next : 0, laidOut: this.prewarmedFrame }, background: this.backgroundStatus?.() ?? { state: 'missing-provider' }, snapshot: this.controller.snapshot(), checkpoint: this.controller.session?.checkpoint() || null, presentation: this.snapshot,
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
  private toast!: Node; private toastLabel!: Label; private toastBg!: Graphics; private toastT = -1; private toastFade = 0.2; private toastEnd = TOAST_S; private noticeShown = false; private noticeUp = false; private queuedTip = '';
  /** region-title SPEC §6/§7: the 2.0 s place name at a new region's first board; tips, the stale notice and tool intros wait behind it. */
  private regionTitle: RegionArrivalTitle | null = null; private titleGate = new RegionTitleGate(); private titleClock = 0; private titleStage = '';
  private hintCells: number[] = []; private hintClock = new IdleHintClock(); private hintT = 0; private spinT = 0;
  private popups!: PopupStack; private tint = new TintSet(); private resultKey = ''; private resultAttemptKey = ''; private hostActions: HostResultActions = {}; private hostResultError='';
  private claimBase: { key: string; tools: Record<string, number>; charms: number; chests: string; regions: string; mementos: string } | null = null;
  private rewardShown: RewardItem[] = []; private rewardChest = false;
  private introQueue: string[] = []; private guideShown = ''; private artOff: (() => void) | null = null; private boardArtRequest: Promise<boolean> | null = null;
  /** World entry sets this before initializeManaged so a finger cannot land until presentForPlay. Standalone and test boards stay presented. */
  deferPresentation = false;
  /** Managed entry keeps the board off-screen until the island shot ends and a finger can land. Standalone boards start presented. */
  private presented = true; private entryReleased = false; private readyWait: (() => void) | null = null; private entryFinish: (() => void) | null = null; private entryTimer: any = null;
  /** Clear/drop frames advance on the component clock. A stalled setTimeout must not leave the pre-clear board on screen. */
  private visualStamp = 0; private visualDone: (() => void) | null = null; private visualLeft = -1;
  /** Last presentation was hidden (lock / background). The next visible paused frame asks update() to open the pause panel. */
  private boardWasHidden = false; private returnPause = false;
  /** r4-prep (lead): set by the world adapter for 风铃湖畔 boards, which are only reached by landing from the island→lakeside
   *  journey. A restored unfinished attempt there resumes straight into a playable board on reveal (steps shown as usual,
   *  first-time tool intros still queue on run.ready) instead of opening 「暂停一下」. Other boards keep the explicit Resume. */
  resumeRestoredOnPresent = false;
  private pressHandles: PressHandle[] = [];
  private resetOnHide = () => this.resetInput();
  private presentationActive = () => { if (this.root && !this.root.activeInHierarchy) this.resetInput(); };
  private hide = () => { this.resetInput(); this.host?.hide(); }; private show = () => this.host?.show();
  private resize = () => { if (!this.disposing && this.root && isValid(this.root, true)) this.layout(); };
  initialize(fixture: any, backgroundFrame?: (portrait: boolean, layout?: LevelBackgroundFrame) => void) {
    this.fixture = fixture; this.backgroundFrame = backgroundFrame; if (!this.managed) profiler.hideStats(); view.resizeWithBrowserSize(true);
    this.root = this.box('NativeBoardCanvas', this.node, 0, 0, 1, 1);
    this.root.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this.presentationActive);
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
      n.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, () => { if (!n.activeInHierarchy && this.dragStart?.index === i) this.resetInput(); });
      n.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
        if (!n.activeInHierarchy || this.dragStart || this.toolDrag || !this.canUseTools() || !this.pointerEvent(e)) return;
        this.input(); const p = e.getUILocation(); let yDown = this.layoutYDown(n, p.x, p.y);
        if (this.cellAt(p.x, p.y, yDown) !== i && this.cellAt(p.x, p.y, !yDown) === i) yDown = !yDown;
        const axis = this.cellAt(p.x, p.y, yDown) === i ? 'ui' : 'screen';
        const loc = typeof e.getLocation === 'function' ? e.getLocation() : null;
        if (axis === 'screen' && this.cellHit(loc, e.windowId) !== i) return;
        this.dragStart = { index: i, pointer: e.getID(), originWindow: e.windowId, start: { x: p.x, y: p.y }, point: { x: p.x, y: p.y }, x: p.x, y: p.y,
          yDown, axis, version: this.toolVersion(), prior: this.selected, sx: loc?.x, sy: loc?.y, startSX: loc?.x, startSY: loc?.y, sw: e.windowId,
          legacyLayoutAlias: yDown && !!loc && Math.hypot(loc.x - p.x, loc.y - p.y) <= 1 && this.cellHit(loc, e.windowId) !== i, latestHit: i };
      }, this);
      n.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => { const d = this.dragStart; if (!d || d.index !== i || !this.owns(d, e)) return; this.followPiece(e); }, this);
      n.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
        const d = this.dragStart;
        if (!d) { this.releaseOnto(i, e); return; }
        if (!this.owns(d, e)) return;
        if (d.index !== i) { this.finishForeignRelease(i, d, e); return; }
        this.dragStart = null; if (!this.canUseTools()) { this.resetInput(); return; }
        GameAudio.notifyUserGesture(); this.releasePiece(i, d, e);
      }, this);
      n.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => {
        if (!this.owns(this.dragStart, e) && !this.owns(this.toolDrag, e)) return;
        if (!isValid(n, true) || this.cells[i] !== n) { this.dragStart = null; this.cancelToolInput(); return; }
        const d = this.dragStart;
        if (d?.index === i && this.nodeCancelIsRelease(n, d, e) && this.beside(i, this.cellFromEvent(e, d))) {
          this.dragStart = null; GameAudio.notifyUserGesture(); this.releasePiece(i, d, e); return;
        }
        this.resetInput();
      }, this); this.cells.push(n);
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
    this.regionTitle = new RegionArrivalTitle(this.root);
    this.stagePanel = this.box('NativeStageSelection', this.root, 0, 0, 1, 1);
    this.popups = new PopupStack(this.root, () => ({ width: this.layoutInfo?.width || 390, height: this.layoutInfo?.height || 844, safeInsets: this.layoutInfo?.safe }));
    const art = BoardArt.shared(); this.artOff = art.onChange(() => { if (!this.disposing && isValid(this.root, true)) this.refreshArt(); });
    this.boardArtRequest = art.load('board'); void art.load('popup'); void art.load('r2');
    this.layout(); this.bind(); game.on(Game.EVENT_HIDE, this.resetOnHide); if (!this.managed) { game.on(Game.EVENT_HIDE, this.hide); game.on(Game.EVENT_SHOW, this.show); } view.on('canvas-resize', this.resize, this); if (typeof window !== 'undefined') window.addEventListener('resize', this.resize);
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
    this.pressHandles.push(bindPressable(node, face, () => { this.input(); tap(); },
      { sound, enabled: () => this.inputVisible() && !this.modalOpen() && !this.dragStart && !this.toolDrag }));
  }
  private inputVisible() { return !this.disposing && !this.entryReleased && this.enabled !== false && this.node?.activeInHierarchy !== false && this.root?.activeInHierarchy !== false && this.presented && !this.snapshot?.hidden; }
  private pointerEvent(e?: EventTouch) { const p = e && typeof e.getUILocation === 'function' ? e.getUILocation() : null; return !!e && typeof e.getID === 'function' && Number.isFinite(e.getID()) && Number.isFinite(e.windowId) && !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }
  // Window identity belongs to START, not the latest observed coordinate sample.
  private owns(d: any, e?: EventTouch) { return !!d && !!e && typeof e.getID === 'function' && d.pointer === e.getID() && d.originWindow === e.windowId; }
  /** Cocos 3.8.8 changes node type to CANCEL for a normal release outside the
   * source hit box; getEventCode() retains the original input type. Its deprecated
   * API is intentionally version-scoped. Missing evidence stays a cancellation. */
  private nodeCancelIsRelease(source: Node, d: any, e: EventTouch) {
    if (!this.owns(d, e) || !this.pointerEvent(e) || !this.canUseTools() || d.version !== this.toolVersion()
      || !isValid(source, true) || !source.activeInHierarchy || e.type !== Node.EventType.TOUCH_CANCEL
      || e.target !== source || e.currentTarget !== source || e.windowId !== d.originWindow) return false;
    try {
      if (typeof e.getEventCode !== 'function' || e.getEventCode() !== Node.EventType.TOUCH_END) return false;
      const screen = e.getLocation();
      if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)
        || source.getComponent(UITransform)?.hitTest(screen, e.windowId) !== false) return false;
      // No old aim, receiving-cell hint or PR52 origin rollback may authorize a
      // cancel adaptation. Also verify the destination in the engine's screen
      // hit-test channel; UI-coordinate calculations alone are not independent.
      const hit = this.cellFromEvent(e, d);
      const target = hit >= 0 ? this.cells[hit] : null;
      return !!target && isValid(target, true) && target.activeInHierarchy
        && this.releaseHit(d, e) === hit
        && target.getComponent(UITransform)?.hitTest(screen, d.originWindow) === true;
    } catch { return false; }
  }
  private resetInput() {
    this.dragStart = null; this.cancelToolInput(); for (const h of this.pressHandles) h.cancel();
    if (this.root && isValid(this.root, true)) resetPresses(this.root);
    if (!this.disposing && this.snapshot && this.root && isValid(this.root, true)) { this.paintToolTray(); this.paint(); }
  }
  onDisable() { this.resetInput(); }
  // ---------------- tools ----------------
  private toolArt!: ManagedToolArt; private armedTool: string | null = null; private toolTapAccepted = false;
    private toolDrag: { x?: number, y?: number, axis?: string, startSX?: number, startSY?: number, latestHit?: number, legacyLayoutAlias?: boolean, kind: string, slot: number, pointer: number, readonly originWindow: number, start: { x: number, y: number }, point: { x: number, y: number }, moved: boolean, version: string, yDown?: boolean, sx?: number, sy?: number, sw?: number, hover?: number, hx?: number, hy?: number, mx?: number, my?: number } | null = null; private toolGhost: Node | null = null; private pieceGhost: Node | null = null;
  private toolCatalog(): ManagedTool[] { return this.managed?.tools?.() || managedTools(this.snapshot); }
  private barTools(): ManagedTool[] { const c = this.toolCatalog(), out: ManagedTool[] = [], qa = this.qaTools(); for (const k of this.toolBar) { const t = c.find(x => x.kind === k); if (t) out.push(t); else if (qa) out.push({ kind: k, name: TOOL_NAMES[k] || k, count: 0, targeted: false, available: false, reason: 'QA' }); } return out; }
  /** QA frames only (`qaTools=N` URL); the wechat player build constant-folds this to null (`MINIGAME`). */
  private qaTools(): string[] | null { if (MINIGAME) return null; try { return qaForcedToolBar(typeof location !== 'undefined' ? String(location.search || '') : null, false); } catch { return null; } }
  private toolVersion() { const a = this.snapshot?.active; return `${a?.attemptId || a?.stageId}:${a?.actions?.length ?? a?.turn ?? 0}:${a?.version ?? 0}`; }
  private canUseTools() { return this.inputVisible() && !this.modalOpen() && this.snapshot?.state === 'run.ready' && !this.snapshot?.readOnly; }
  /** run.ready can take a finger. A settled pause, result or readonly screen is the real screen too — not a half board. */
  private entryShowable(s = this.snapshot) {
    if (!s || !this.geo || this.cells.length !== 49) return false;
    if (s.state === 'run.ready' && !s.readOnly) return true;
    if (s.readOnly || s.state === 'error.readonly' || s.state === 'run.unsaved' || s.state === 'storage.unsaved' || s.state === 'run.paused' || s.state === 'book.ready' || s.state === 'stage.detail') return true;
    return typeof s.state === 'string' && s.state.indexOf('result.') === 0;
  }
  private wakeEntry() { if (!this.readyWait || !this.entryShowable()) return; const go = this.readyWait; this.readyWait = null; go(); }
  private pieceArtReady() { const art = BoardArt.shared(); return art.loaded('board') && PIECE_KEYS.every(key => !!art.frame(key)); }
  /** Piece art and a showable session (run.ready, or a settled pause/result). A hung load rejects so the island can take the finger again. */
  whenInteractive(): Promise<void> {
    if (this.entryReleased || this.disposing) return Promise.reject(Error('enter-level-not-ready'));
    const cap = 8000;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const art = BoardArt.shared(), loaded = this.boardArtRequest = art.load('board');
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true; this.entryFinish = null; this.readyWait = null;
        if (this.entryTimer != null) { clearTimeout(this.entryTimer); this.entryTimer = null; }
        if (err || this.disposing || this.entryReleased) art.cancelLoad('board', loaded);
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
        if (this.disposing) finish();
        else if (this.entryShowable() && this.pieceArtReady()) finish();
        else finish(Error('enter-level-not-ready'));
      }, cap);
      loaded.then(ok => {
        if (settled || this.disposing) { finish(); return; }
        if (!ok) { finish(Error('enter-level-not-ready')); return; }
        if (this.entryShowable() && this.pieceArtReady()) { finish(); return; }
        consider();
      }, () => { if (settled || this.disposing) finish(); else finish(Error('enter-level-not-ready')); });
      consider();
    });
  }
  /** Release this lease's pending entry synchronously, before Cocos' deferred onDestroy.
   * A later UI must never inherit a request that this old UI can still cancel. */
  releaseEntryResources() {
    if (this.entryReleased) return;
    this.entryReleased = true;
    const pending = this.boardArtRequest; this.boardArtRequest = null;
    this.artOff?.(); this.artOff = null;
    if (this.entryTimer != null) { clearTimeout(this.entryTimer); this.entryTimer = null; }
    if (pending) BoardArt.shared().cancelLoad('board', pending);
    if (this.entryFinish) { const finish = this.entryFinish; this.entryFinish = null; this.readyWait = null; finish(); }
    else this.readyWait = null;
  }
  /** Called once the enter shot has finished and whenInteractive has resolved. The camera stays dark until this turn. */
  presentForPlay() {
    if (this.entryReleased || this.disposing) return;
    this.presented = true; this.finishPrewarm(); this.releaseBoardCamera();
    if (this.node && isValid(this.node, true)) this.node.active = true;
    // r4.2 items 10/11: a finished hidden pre-activation already laid out this frame size; the swap frame only toggles visibility.
    if (!this.disposing && this.root && isValid(this.root, true) && (!this.prewarmedFrame || this.prewarmedFrame !== this.frameKey())) this.layout();
    if (this.veil && isValid(this.veil, true)) this.veil.opacity = 255;
    this.maybeShowRegionTitle();
    // Restored attempts intentionally stay paused. Unlike an OS hide/show,
    // a new view has no boardWasHidden edge to request the recovery controls.
    // Offer explicit Resume on its first visible update; never unlock silently.
    if (this.snapshot?.state === 'run.paused' && !this.snapshot.hidden) {
      if (this.resumeRestoredOnPresent && this.snapshot.active && !this.modalOpen()) { let r: any = null; try { r = this.managed?.intercept?.('resume') ?? this.host.command('resume'); } catch { r = null; } if (!r || r.ok === false) this.returnPause = true; }
      else this.returnPause = true;
    }
  }
  // ---------------- r4.2 items 10/11: hidden pre-activation ----------------
  /** Nodes switched on per frame by the hidden pre-activation (a whole unit at a time; a grid layer of 49 sprites is one unit). */
  static PREWARM_NODE_BUDGET = 64;
  private prewarm: { parked: Node[]; next: number } | null = null; private prewarmedFrame = ''; private veil: UIOpacity | null = null;
  private prewarmStats = { started: false, frames: 0, done: false, flushed: 0 };
  /** World entry (r4.2 items 10/11, Mac r4: swap frame 29-42 ms). The swap frame used to switch the whole board UI on at once (~400 nodes,
   *  label textures, the rule guide). The level adapter calls this after initializeManaged; afterFrame(go) runs go on a later frame. The host
   *  is then switched on while nothing can draw it (board camera held, root at opacity 0 so no other UI_2D camera batches it), and the big
   *  subtrees follow a budget per frame from update(); the last step lays out once. presentForPlay finishes whatever is left synchronously,
   *  so visibility/input semantics are unchanged if frames never come. Only nodes no other code toggles are parked: the grid's layers and
   *  cells, the HUD's pause button and info plate. */
  prewarmPresentation(afterFrame: (go: () => void) => void) {
    if (!this.deferPresentation || this.presented || this.prewarmStats.started || this.entryReleased || this.disposing || !this.root) return;
    afterFrame(() => this.beginPrewarm());
  }
  private beginPrewarm() {
    if (this.presented || this.prewarmStats.started || this.entryReleased || this.disposing || !this.node || !isValid(this.node, true) || !this.root || !isValid(this.root, true) || this.node.active) return;
    this.prewarmStats.started = true;
    const parked: Node[] = [];
    for (const holder of [this.grid, this.hud]) if (holder && isValid(holder, true)) for (const c of holder.children.slice()) if (c.active) { c.active = false; parked.push(c); }
    this.veil = this.root.getComponent(UIOpacity) || this.root.addComponent(UIOpacity); this.veil.opacity = 0;
    this.prewarm = { parked, next: 0 };
    this.holdBoardCamera(); this.node.active = true;
  }
  private stepPrewarm() {
    const p = this.prewarm; if (!p) return;
    let used = 0;
    while (p.next < p.parked.length && used < ManagedMobileBoardUI.PREWARM_NODE_BUDGET) { const n = p.parked[p.next++]; if (isValid(n, true) && !n.active) { n.active = true; used += countNodes(n); } }
    this.prewarmStats.frames++;
    if (p.next < p.parked.length) return;
    this.prewarm = null; this.prewarmStats.done = true;
    if (!this.disposing && this.root && isValid(this.root, true)) { this.layout(); this.prewarmedFrame = this.frameKey(); }
  }
  private finishPrewarm() {
    const p = this.prewarm; if (!p) return; this.prewarm = null;
    for (; p.next < p.parked.length; p.next++) { const n = p.parked[p.next]; if (isValid(n, true) && !n.active) { n.active = true; this.prewarmStats.flushed++; } }
  }
  private frameKey() { const f = typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : view.getFrameSize(); return Math.max(240, f.width) + 'x' + Math.max(320, f.height); }
  /** b18 (UI设计部): cancelling a tool drops the tip held behind the stale notice (it no longer applies); the notice itself keeps its full 0.3/2/0.3. */
  private dropHeldTip() { if (this.noticeUp) this.queuedTip = ''; }
  private cancelToolInput() { this.dropHeldTip(); for (const n of this.tools) { if (!isValid(n, true)) continue; const f = n.getChildByName('Face'); if (f && isValid(f, true)) f.setPosition(0, 0, 0); } this.toolDrag = null; this.armedTool = null; this.toolTapAccepted = false; if (!this.disposing && this.toolGhost && isValid(this.toolGhost, true)) this.toolGhost.active = false; if (!this.disposing && this.pieceGhost && isValid(this.pieceGhost, true)) this.pieceGhost.active = false; this.selected = -1; }
  /** Freeze the tool bar per run: only tools in stock at the start, priority order, max 3; used-up ones stay greyed in place. */
  private syncToolBar() {
    const a = this.snapshot?.active; if (!a) { this.toolBar = []; this.toolBarKey = ''; return; }
    const key = [this.snapshot.provider, a.stageId, a.attemptId, a.seed].join('|'), fresh = !(a.actions?.length) && !(a.turn);
    if (key === this.toolBarKey && !(fresh && this.toolBar.length === 0)) return;
    if (key === this.toolBarKey && !fresh) return;
    this.toolBarKey = key; this.toolBar = this.qaTools() || pickToolBar(this.toolCatalog());
    for (const k of this.toolBar) if (INTRO_TEXT[k] && !hasSeenTool(SEEN_ID[k] || k) && this.introQueue.indexOf(k) < 0) this.introQueue.push(k);
  }
  private useToolAt(kind: string, index: number) {
    if (!this.canUseTools() || !this.managed) return false;
    const tool = this.toolCatalog().find(t => t.kind === kind);
    if (!tool?.available) { this.say(tool?.reason || '本关没有可用道具'); return false; }
    if (tool.targeted && (!Number.isInteger(index) || index < 0 || index > 48)) { this.say('先点道具再选格子，或把道具拖到格子上'); return false; }
    const r = this.managed.useTool(kind, index);
    if (!r.ok) this.say(r.reason === 'illegal-or-unsupported-action' ? '换一个有作用的落点，道具还在' : '暂不可操作 · ' + r.reason);
    else { this.armedTool = null; this.selected = -1; if (!this.noticeUp) this.toastT = Math.min(this.toastT, this.toastEnd); }
    this.paintToolTray(); this.paint(); return !!r.ok;
  }
  private tapTool(slot: number) {
    if (!this.canUseTools()) return false;
    const tool = this.barTools()[slot];
    if (!tool?.available) { this.cancelToolInput(); this.say(tool?.reason || '本关没有可用道具'); this.paintToolTray(); this.paint(); return false; }
    if (!tool.targeted) return this.useToolAt(tool.kind, -1);
    this.armedTool = this.armedTool === tool.kind ? null : tool.kind; this.selected = -1;
    if (!this.armedTool && this.noticeUp) this.dropHeldTip(); else { const armed = this.armedTool; this.say(armed ? `${tool.name} · 点选目标` : '已收回，道具没有消耗', 0.2, armed ? () => this.armedTool === armed : undefined); } this.paintToolTray(); this.paint(); return true;
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
  /** Screen point through the UI camera when the engine has one; otherwise the layout/UI reading already stored on the drag. */
  private pointerWorld(x: number, y: number, yDown?: boolean, screen?: { x: number, y: number } | null) {
    const info = this.layoutInfo, cam: any = this.camera;
    if (screen && cam && typeof cam.screenToWorld === 'function') {
      try { const w = cam.screenToWorld(new Vec3(screen.x, screen.y, 0)); if (w && Number.isFinite(w.x) && Number.isFinite(w.y)) return { x: w.x, y: w.y }; } catch (err) { /* formula below */ }
    }
    return { x: x - info.width / 2, y: this.pointerWorldY(y, yDown) };
  }
  /** The cell whose own rect contains the finger. Independent of which axis the logged point uses. */
  private cellHit(p: { x: number, y: number } | null, windowId?: number) {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || !this.cells) return -1;
    for (let i = 0; i < this.cells.length; i++) {
      const t = this.cells[i] && this.cells[i].getComponent(UITransform);
      if (t && typeof t.hitTest === 'function' && t.hitTest(p, windowId)) return i;
    }
    return -1;
  }
  /** Screen hit when the press did not land in cellAt, or when the screen point and the UI point differ. A locked axis never flips, so a y-down point is not mirrored onto another row. */
  private cellFromEvent(e: EventTouch | null, tracked: any) {
    const screen = e && typeof e.getLocation === 'function' ? e.getLocation() : null;
    const ui = e && typeof e.getUILocation === 'function' ? e.getUILocation() : null;
    if (tracked?.axis === 'screen') return this.cellHit(screen || (Number.isFinite(tracked.sx) ? { x: tracked.sx, y: tracked.sy } : null), e?.windowId ?? tracked.sw);
    const p = ui || (Number.isFinite(tracked?.x) ? { x: tracked.x, y: tracked.y } : tracked?.point);
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? this.cellAt(p.x, p.y, !!tracked?.yDown) : -1;
  }
  /** Latest owner observation replaces prior reach, including a return to origin or an off-board sample. */
  private observePointer(d: any, e?: EventTouch) {
    const live = e ? null : this.livePoint(d.pointer), p = e && this.pointerEvent(e) ? e.getUILocation() : live;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    const screen = e && typeof e.getLocation === 'function' ? e.getLocation() : live && Number.isFinite(live.sx) ? { x: live.sx as number, y: live.sy as number } : null;
    d.x = d.mx = p.x; d.y = d.my = p.y;
    if (screen && Number.isFinite(screen.x) && Number.isFinite(screen.y)) { d.sx = screen.x; d.sy = screen.y; }
    if (e) d.sw = e.windowId;
    d.latestHit = this.cellFromEvent(e || null, d); if (Number.isInteger(d.index) && d.latestHit !== d.index) d.leftStart = true; return true;
  }
  private pointerTravel(d: any) { return d.axis === 'screen' && Number.isFinite(d.sx) && Number.isFinite(d.startSX)
    ? Math.hypot(d.sx - d.startSX, d.sy - d.startSY) : Math.hypot(d.x - d.start.x, d.y - d.start.y); }
  /** PR52 compatibility is narrow: a known layout/screen alias may roll END back exactly to START.
   * A newer owner move/live observation invalidates that old destination. Explicit outside releases always cancel.
   * A different receiving cell is additional evidence only when it equals the latest owner hit and END is the known origin/sentinel anomaly. */
  private releaseHit(d: any, e: EventTouch, receivingCell = -1) {
    if (!this.pointerEvent(e)) return -1;
    const ui = e.getUILocation(), p = d.axis === 'screen' && typeof e.getLocation === 'function' ? e.getLocation() : ui;
    const start = d.axis === 'screen' ? { x: d.startSX, y: d.startSY } : d.start;
    const hit = this.cellFromEvent(e, d), origin = !!p && Math.hypot(p.x - start.x, p.y - start.y) <= 1;
    const last = Number.isInteger(d.latestHit) ? d.latestHit : -1;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return -1;
    const outsideViewport = p.x < 0 || p.y < 0 || (d.axis !== 'screen' && (p.x > this.layoutInfo.width || p.y > this.layoutInfo.height));
    if (outsideViewport) return -1;
    if (receivingCell >= 0 && receivingCell === last && (origin || (p.x === 1 && p.y === 1))) return receivingCell;
    if (origin && d.legacyLayoutAlias && last >= 0 && last !== d.index) return last;
    return hit;
  }
  private moveGhost(x: number, y: number) {
    const d = this.layoutInfo; if (!this.toolGhost) { this.toolGhost = this.box('ToolDragGhost', this.root, 0, 0, 56, 56); this.tint.sprite(this.toolGhost.addComponent(Sprite), 'ui'); this.box('ToolFallback', this.toolGhost, 0, 0, 56, 56).addComponent(Graphics); }
    const sprite = this.toolGhost.getComponent(Sprite)!; sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = this.toolFrame(this.toolDrag!.kind);
    const ghost = toolDisplaySize(this.toolDrag!.kind, 56); this.toolGhost.getComponent(UITransform)!.setContentSize(ghost.width, ghost.height);
    this.paintToolFallback(this.toolGhost, this.toolDrag!.kind, true, !!sprite.spriteFrame);
    const at = this.pointerWorld(x, y, this.toolDrag?.yDown, this.toolDrag && typeof this.toolDrag.sx === 'number' ? { x: this.toolDrag.sx, y: this.toolDrag.sy as number } : null);
    this.toolGhost.active = true; this.toolGhost.setSiblingIndex(this.root.children.length - 1); this.toolGhost.setWorldPosition(at.x, at.y, 0);
  }
  /** Pin the ghost to the pointer every frame while the finger is down. No fixed lift. A live touch can start the drag without a node move. */
  private followGhost() {
    const d = this.toolDrag;
    if (!d || this.disposing || !this.layoutInfo) return;
    if (!this.canUseTools() || d.version !== this.toolVersion()) { this.cancelToolInput(); this.paintToolTray(); return; }
    this.observePointer(d); d.point.x = d.x ?? d.point.x; d.point.y = d.y ?? d.point.y;
    if (!d.moved && this.pointerTravel(d) < 12) return;
    d.moved = true; this.armedTool = null; this.moveGhost(d.point.x, d.point.y);
    const i = this.cellFromEvent(null, d); d.latestHit = d.hover = i;
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
      if (p && typeof p.x === 'number' && typeof p.y === 'number') { const s = typeof t.getLocation === 'function' ? t.getLocation() : null; return { x: p.x, y: p.y, sx: s && typeof s.x === 'number' ? s.x : undefined, sy: s && typeof s.y === 'number' ? s.y : undefined }; }
    }
    return null;
  }
  /** Orthogonal neighbors only. A diagonal, the same cell, or a miss is not a swap. */
  private beside(a: number, b: number) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || a > 48 || b < 0 || b > 48 || a === b) return false;
    return Math.abs(a % 7 - b % 7) + Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) === 1;
  }
  /** Move only the owning finger's piece. No historical maximum may replace a newer return/outside sample. */
  private followPiece(e?: EventTouch) {
    const d = this.dragStart; if (!d || this.disposing || !this.layoutInfo || (e && !this.owns(d, e))) return;
    if (!this.canUseTools() || d.version !== this.toolVersion()) { this.retractPiece(); return; }
    this.observePointer(d, e);
    if (!d.consumed && this.pointerTravel(d) < Math.min(18, this.cell * .35)) return;
    if (!d.consumed) { this.armedTool = null; this.paintToolTray(); }
    d.consumed = true; const hit = this.cellFromEvent(null, d); d.latestHit = hit;
    d.aim = this.beside(d.index, hit) ? hit : -1; this.placePieceGhost(d);
    if (d.aim !== this.selected) { this.selected = d.aim; this.paint(); }
  }
  private placePieceGhost(d: { index: number, x: number, y: number, yDown?: boolean, sx?: number, sy?: number }) {
    const info = this.layoutInfo; if (!info || !this.cells) return;
    const n = this.cells[d.index]; if (!n || !n.isValid) return;
    const art = n.getChildByName('ProjectPieceArt'); if (!art) return;
    const src = art.getComponent(Sprite);
    if (!this.pieceGhost) { this.pieceGhost = this.box('PieceDragGhost', this.root, 0, 0, this.cell, this.cell); this.tint.sprite(this.pieceGhost.addComponent(Sprite), 'ui'); }
    const sprite = this.pieceGhost.getComponent(Sprite)!; sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = src ? src.spriteFrame : null;
    const ui = art.getComponent(UITransform)!; this.pieceGhost.getComponent(UITransform)!.setContentSize(ui.width, ui.height);
    art.active = false; const ribbon = this.over[d.index]; if (ribbon && ribbon.node.active) ribbon.node.active = false;
    this.pieceGhost.active = true; this.pieceGhost.setSiblingIndex(this.root.children.length - 1);
    const at = this.pointerWorld(d.x, d.y, d.yDown, typeof d.sx === 'number' ? { x: d.sx, y: d.sy as number } : null);
    this.pieceGhost.setWorldPosition(at.x, at.y, 0);
  }
  private hidePieceGhost() { if (!this.disposing && this.pieceGhost && isValid(this.pieceGhost, true)) this.pieceGhost.active = false; }
  private retractPiece() { this.dragStart = null; this.hidePieceGhost(); this.selected = -1; if (!this.disposing) this.paint(); }
  /** Real touch end only. Adjacent cell swaps. A still finger, or a release back on the start cell, stays a tap. */
  private releasePiece(i: number, d: any, e: EventTouch, receivingCell = -1) {
    this.hidePieceGhost(); if (!d || !this.canUseTools() || d.version !== this.toolVersion()) { this.selected = -1; this.paint(); return; }
    const hit = this.releaseHit(d, e, receivingCell);
    if (this.beside(i, hit)) { this.armedTool = null; this.selected = -1; this.paint(); this.swap(i, hit); return; }
    if ((!d.consumed || !d.leftStart) && hit === i) { this.selected = typeof d.prior === 'number' ? d.prior : -1; this.tap(i); return; }
    this.armedTool = null; this.selected = -1; this.paint();
  }
  private finishForeignRelease(i: number, d: any, e: EventTouch) {
    if (this.dragStart !== d || !this.owns(d, e)) return;
    this.dragStart = null; this.releasePiece(d.index, d, e, i);
  }
  private releaseOnto(i: number, e: EventTouch) {
    const d = this.toolDrag; if (!d || !d.moved || !this.owns(d, e)) return;
    this.finishToolRelease(d, e, i);
  }
  private toolFrame(kind: string) { const key = TOOL_KEYS[kind]; return (key && BoardArt.shared().frame(key)) || this.toolArt?.frame(kind) || null; }
  private endToolDrag(e: EventTouch, slot?: number) {
    const d = this.toolDrag; if (!d || !this.owns(d, e) || (slot !== undefined && slot !== d.slot)) return;
    this.finishToolRelease(d, e);
  }
  private finishToolRelease(d: any, e: EventTouch, receivingCell = -1) {
    if (!this.owns(d, e)) return;
    this.toolDrag = null; this.toolTapAccepted = false;
    this.tools[d.slot]?.getChildByName('Face')?.setPosition(0, 0, 0);
    if (this.toolGhost && isValid(this.toolGhost, true)) this.toolGhost.active = false;
    if (!this.canUseTools() || d.version !== this.toolVersion() || !this.pointerEvent(e)) { this.cancelToolInput(); this.paintToolTray(); this.paint(); return; }
    GameAudio.notifyUserGesture(); const p = e.getUILocation(), moved = d.moved || Math.hypot(p.x - d.start.x, p.y - d.start.y) >= 12;
    if (!moved) { if (this.tools[d.slot].getComponent(UITransform)!.hitTest(e.getLocation(), e.windowId)) { this.toolTapAccepted = this.tapTool(d.slot); if (this.toolTapAccepted) playSound('tool'); } return; }
    const i = this.releaseHit(d, e, receivingCell); this.armedTool = null; this.selected = -1; this.paintToolTray(); this.paint();
    if (i < 0) { this.say('已收回，道具没有消耗'); return; } this.useToolAt(d.kind, i);
  }
  private toolSlot(slot: number) {
    const n = this.box('slot-' + slot, this.tray, 0, 0, 64, 64);
    const face = this.box('Face', n, 0, 0, 64, 64);
    const sel = this.box('ToolSelection', face, 0, 0, 64, 64); sel.addComponent(Graphics);
    const art = this.box('OriginalToolArt', face, 0, 0, 60, 60); this.tint.sprite(art.addComponent(Sprite), 'ui'); art.addComponent(UIOpacity);
    this.box('ToolFallback', art, 0, 0, 60, 60).addComponent(Graphics);
    const count = this.box('ToolCount', face, 22, 21, 24, 24); count.addComponent(Graphics); const q = makeLabel(count, '', 0, 0, 14, { width: 26, name: 'Quantity' }); this.tint.label(q, 'brown');
    n.on(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, () => { if (!n.activeInHierarchy && this.toolDrag?.slot === slot) this.resetInput(); });
    n.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      if (!n.activeInHierarchy || this.toolDrag || this.dragStart || !this.canUseTools() || !this.pointerEvent(e)) return;
      this.input(); const tool = this.barTools()[slot]; if (!tool?.available) { this.cancelToolInput(); this.paintToolTray(); this.paint(); this.say(tool?.reason || '本关没有可用道具'); return; }
      const p = e.getUILocation(), yDown = this.layoutYDown(n, p.x, p.y), loc = e.getLocation();
      const uiScreen = { x: p.x, y: yDown ? this.layoutInfo.height - p.y : p.y };
      const uiHit = n.getComponent(UITransform)!.hitTest(uiScreen, e.windowId), axis = uiHit ? 'ui' : 'screen';
      if (!uiHit && !n.getComponent(UITransform)!.hitTest(loc, e.windowId)) return;
      this.toolTapAccepted = false; face.setPosition(0, -3, 0);
      this.toolDrag = { kind: tool.kind, slot, pointer: e.getID(), originWindow: e.windowId, start: { x: p.x, y: p.y }, point: { x: p.x, y: p.y }, x: p.x, y: p.y,
        moved: false, version: this.toolVersion(), yDown, axis, sx: loc.x, sy: loc.y, startSX: loc.x, startSY: loc.y, sw: e.windowId, latestHit: -1,
        legacyLayoutAlias: yDown && Math.hypot(loc.x - p.x, loc.y - p.y) <= 1 && !n.getComponent(UITransform)!.hitTest(loc, e.windowId) };
    }, this);
    n.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      const d = this.toolDrag; if (!d || d.slot !== slot || !this.owns(d, e)) return;
      if (!this.canUseTools() || d.version !== this.toolVersion()) { this.cancelToolInput(); this.paintToolTray(); return; }
      if (!this.observePointer(d, e)) return; d.point.x = d.x!; d.point.y = d.y!;
      if (!d.moved && this.pointerTravel(d) < 12) return;
      d.moved = true; this.armedTool = null; this.moveGhost(d.point.x, d.point.y); d.hover = d.latestHit;
      if (d.latestHit !== this.selected) { this.selected = d.latestHit!; this.paint(); } this.paintToolTray();
    }, this);
    n.on(Node.EventType.TOUCH_END, (e: EventTouch) => this.endToolDrag(e, slot), this);
    n.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => {
      const d = this.toolDrag; if (d?.slot !== slot || !this.owns(d, e)) return;
      if (!isValid(n, true) || this.tools[slot] !== n) { this.cancelToolInput(); return; }
      if (this.nodeCancelIsRelease(n, d, e)) { this.endToolDrag(e, slot); return; }
      this.cancelToolInput(); this.paintToolTray(); this.paint();
    }, this);
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
      this.paintToolFallback(artNode, tool.kind, tool.available, !!frame);
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
  private paintToolFallback(art: Node, kind: string, available: boolean, hasFrame: boolean) {
    // Creator allows one UI renderer per node; keep vector art beneath its own node.
    const node = art.getChildByName('ToolFallback')!, size = art.getComponent(UITransform)!.contentSize;
    node.getComponent(UITransform)!.setContentSize(size.width, size.height); node.active = !hasFrame;
    const graphics = node.getComponent(Graphics)!; graphics.clear(); if (!hasFrame) this.drawToolEmblem(graphics, kind, available);
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
  private safeInsets(w: number, h: number): SafeArea & { portrait: boolean } { return boardSafeInsets(w, h); }
  private layout() {
    const frame = typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : view.getFrameSize(); const w = Math.max(240, frame.width), h = Math.max(320, frame.height);
    if (!this.managed) view.setDesignResolutionSize(w, h, ResolutionPolicy.EXACT_FIT); if (game.canvas) director.root?.resize(game.canvas.width, game.canvas.height); this.camera.orthoHeight = h / 2; this.root.getComponent(UITransform)!.setContentSize(w, h);
    const safe = this.safeInsets(w, h), g = boardLayout(w, h, safe, Math.max(2, this.goalKeys.length));
    if (this.geo && JSON.stringify(this.geo) !== JSON.stringify(g)) this.resetInput();
    this.geo = g;
    const X = (x: number) => x - w / 2, Y = (y: number) => h / 2 - y, P = g.pitch; this.cell = P;
    this.boardCenter.set(X(g.grid.x), Y(g.grid.y), 0); this.grid.setPosition(this.boardCenter); this.grid.getComponent(UITransform)!.setContentSize(g.grid.size, g.grid.size);
    this.regionalFocus.setPosition(this.boardCenter); this.boardFrame.setPosition(this.boardCenter);
    this.place(this.boardFrame.getChildByName('Tray')!, 0, 0, g.tray.width, g.tray.height);
    const sh = this.boardFrame.getChildByName('TrayShadow')!.getComponent(Graphics)!; sh.clear(); for (let i = 0; i < 4; i++) { sh.fillColor = new Color(40, 30, 20, 14 - i * 3); sh.roundRect(-g.tray.width / 2 - i * 3 + 3, -g.tray.height / 2 - 8 - i * 3, g.tray.width + i * 6, g.tray.height + i * 6, 18 + i * 3); sh.fill(); }
    this.cells.forEach((n, i) => { const c = cellCenter(g, i); n.setPosition(c.x - g.grid.x, g.grid.y - c.y, 0); n.getComponent(UITransform)!.setContentSize(P, P); });
    this.place(this.pause, X(g.pause.x), Y(g.pause.y), g.pause.hit); this.place(this.pause.getChildByName('Face')!.getChildByName('Art')!, 0, 0, g.pause.size * 126 / 128, g.pause.size);
    this.layoutPlate();
    this.toast.setPosition(X(g.toast.x), Y(g.toast.y), 0); this.sizeToast(); this.regionTitle?.place(w, h, g.toast.y, { top: g.plate.y + g.plate.height / 2, bottom: g.tray.y - g.tray.height / 2 });
    this.layoutInfo = { width: w, height: h, safe, board: g.grid.size, cell: P, boardCenter: { x: this.boardCenter.x, y: this.boardCenter.y }, toolY: Y(g.tools.y), pitch: P, geometry: g, skyReserved: g.tray.y - g.tray.height / 2 };
    this.backgroundFrame?.(safe.portrait, { width: w, height: h, boardTop: g.tray.y - g.tray.height / 2, board: { x: g.grid.x, y: g.grid.y, size: g.grid.size } });
    this.popups.layout(); this.paint(); this.paintToolTray(); if (this.snapshot) this.render(this.snapshot);
  }
  /** Info plate: row 1 level title (the only place the name appears), row 2 goal pieces + counts | hourglass + moves.
   *  hud_levelplate is a 411×129 sliced sprite; the beige fill ends 15 px in from the left and 19 px in from the right,
   *  and those caps do not stretch. A wide goal row used to push the moves past that fill, so the center slice grows
   *  until the row fits. On a narrow phone, or in the landscape column, the plate cannot grow and the row scales down. */
  private layoutPlate() {
    const g = this.geo; if (!g) return;
    const root = this.root.getComponent(UITransform)!, d = { w: root.width, h: root.height };
    const native = 411, hpx = 129, beigeL = 15, beigeR = 19, pad = 12;
    const keys = this.goalKeys.slice(0, 4);
    const s = g.plate.width / native;
    const maxVisual = d.w > d.h ? g.plate.width : Math.max(g.plate.width, d.w - 24);
    const maxWpx = Math.max(native, maxVisual / s);
    const movesStr = this.moves.string || '00';
    const countStr = (i: number) => this.goalLabels[i]?.string || '0';
    const row = (wpx: number, k: number) => {
      const icon = 50 * k, font = 32 * k, gap = 18 * k, labelGap = 2 * k, after = 14 * k, lead = 14 * k, labelX = 30 * k;
      const start = -wpx * 0.40; let x = start;
      const movesTw = measure(movesStr, font), movesW = labelX + 12 * k + movesTw;
      const divX = wpx / 2 - 34 * k - movesW - gap;
      const placed: { key: string; x: number; big: number; tw: number }[] = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i], tw = measure(countStr(i), font), big = /^type/.test(key) ? icon : icon * 0.86;
        placed.push({ key, x, big, tw }); x += big + labelGap + tw + gap;
      }
      const end = Math.max(x - gap + after, start);
      const limitR = wpx / 2 - beigeR - pad, limitL = -wpx / 2 + beigeL + pad;
      const maxDx = limitR - lead - labelX - movesTw;
      const dx = Math.min(Math.max(end, divX), maxDx);
      const textRight = dx + lead + labelX + movesTw;
      const fits = end + lead + labelX + movesTw <= limitR + 0.05 && (placed.length === 0 || placed[0].x >= limitL - 0.05);
      return { font, labelGap, lead, labelX, placed, dx, limitL, limitR, textRight, fits, k };
    };
    let wpx = native, lay = row(wpx, 1);
    if (!lay.fits) {
      let lo = native, hi = maxWpx;
      for (let n = 0; n < 18; n++) { const mid = (lo + hi) / 2; if (row(mid, 1).fits) hi = mid; else lo = mid; }
      if (row(hi, 1).fits) { wpx = hi; lay = row(wpx, 1); }
      else {
        wpx = maxWpx; let best = 0.5, loK = 0.5, hiK = 1;
        for (let n = 0; n < 18; n++) { const mid = (loK + hiK) / 2; if (row(wpx, mid).fits) { best = mid; loK = mid; } else hiK = mid; }
        lay = row(wpx, best);
      }
    }
    this.plate.setPosition(g.plate.x - d.w / 2, d.h / 2 - g.plate.y - 3, 0); this.plate.setScale(s, s, 1); this.place(this.plateSprite.node, 0, 0, wpx, hpx);
    const k = lay.k;
    this.goalNodes.forEach((n, i) => {
      const p = lay.placed[i]; n.active = !!p; if (!p) return;
      const label = this.goalLabels[i], art = n.getChildByName('GoalPieceArt')!.getComponent(Sprite)!;
      this.setFrame(art, goalArt(p.key)); this.place(art.node, p.big / 2, 0, p.big, p.big);
      label.fontSize = lay.font; label.lineHeight = Math.round(lay.font * 1.4);
      label.node.setPosition(p.big + lay.labelGap, 2 * k, 0); n.setPosition(p.x, -21, 0);
    });
    this.plateDivider.node.setPosition(lay.dx, -21, 0); this.plateDivider.clear();
    const night = 1 - 0.4 * this.tint.weight();
    this.plateDivider.strokeColor = new Color(Math.round(196 * night), Math.round(166 * night), Math.round(120 * night), 255);
    this.plateDivider.lineWidth = 3; const half = 18 * k; this.plateDivider.moveTo(0, -half); this.plateDivider.lineTo(0, half); this.plateDivider.stroke();
    const mv = this.targets.moves; mv.setPosition(lay.dx + lay.lead, -21, 0);
    this.place(this.movesIcon.node, 11 * k, 0, 21 * k, 33 * k);
    this.moves.fontSize = lay.font; this.moves.lineHeight = Math.round(lay.font * 1.4); this.moves.node.setPosition(lay.labelX, 2 * k, 0);
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
        if (this.disposing || !this.root || !isValid(this.root, true)) { done(); return; }
        for (const c of this.cells) tween(c).to(0.08, { scale: new Vec3(.94, .94, 1) }).to(.08, { scale: Vec3.ONE }).start();
        this.armVisual(done);
      }, cancelAnimations: () => this.cancelAnimations(), onError: (error: Error) => {
        this.presentationError = String(error?.stack || error);
        if (!this.disposing) { this.returnPause = true; this.say('画面刷新中断，已暂停 · 可继续或返回小岛'); }
      }
    });
  }
  /** One visual step. update() and setTimeout share this so a dropped timer still reveals the clear. */
  private armVisual(done: () => void) {
    const stamp = ++this.visualStamp; this.visualDone = done; this.visualLeft = 0.18;
    this.timer = setTimeout(() => this.finishVisual(stamp), 180);
  }
  private finishVisual(stamp?: number) {
    if (stamp !== undefined && stamp !== this.visualStamp) return;
    const done = this.visualDone; if (!done) return;
    this.visualDone = null; this.visualLeft = -1; this.visualStamp++;
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    done();
  }
  private cancelAnimations() {
    this.epoch++; this.visualStamp++; this.visualDone = null; this.visualLeft = -1; if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    this.resetInput();
    for (const c of this.cells) { Tween.stopAllByTarget(c); if (!this.disposing && isValid(c, true)) c.setScale(1, 1, 1); }
    if (!this.disposing) this.paintToolTray();
  }
  private coldReload() { const before = this.controller.snapshot(); this.host.dispose(); this.bind(); return { before: before.state, after: this.controller.snapshot().state }; }
  private command(name: string, ...args: any[]) { this.cancelToolInput(); if (!this.presentationError) this.paintToolTray(); this.selected = -1; this.dragStart = null; const r = this.managed?.intercept?.(name, ...args) ?? this.host.command(name, ...args); if (r && r.ok === false) this.say('暂不可操作 · ' + r.reason); return r; }
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
  showHostResultError(text:string) { this.hostResultError=text; if(this.snapshot&&this.isResult(this.snapshot)&&this.root?.activeInHierarchy&&!this.modalOpen())this.paintResult(this.snapshot); }
  clearHostResultError() { if(!this.hostResultError)return; this.hostResultError=''; if(this.snapshot&&this.isResult(this.snapshot)&&this.root?.activeInHierarchy&&!this.modalOpen())this.paintResult(this.snapshot); }
  setHostActions(a: HostResultActions | null) { this.hostActions = a || {}; if (this.snapshot && this.isResult(this.snapshot)) this.paintResult(this.snapshot); }
  private modalOpen() { return !!this.popups && this.popups.names().some(n => n !== 'ResultPanel'); }
  private isResult(s: any) { return s.state.startsWith('result.') || s.state === 'run.unsaved' || s.state === 'storage.unsaved' || (s.state === 'error.readonly' || s.state === 'storage.readOnly'); }
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
    if (s.hidden) this.resetInput(); else if (s.state !== 'run.ready' || s.readOnly) { this.dragStart = null; this.cancelToolInput(); for (const h of this.pressHandles) h.cancel(); }
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
  /** region-title SPEC §6/§8.3: after presentForPlay (and on any later new board in the same view) show the region's name once.
   *  The flag is written when the title starts, so leaving mid-title never replays it. */
  private maybeShowRegionTitle() {
    if (!this.presented || this.disposing || !this.regionTitle) return;
    const s = this.snapshot, stage = String(s?.active?.stageId ?? ''); if (!stage || stage === this.titleStage) return; this.titleStage = stage;
    let store: any = null; try { store = sys.localStorage; } catch { store = null; }
    const id = regionTitleFor(s, store); if (!id) return;
    markRegionTitleSeen(store, id); this.titleGate.begin(this.titleClock); this.regionTitle.show(id); this.regionTitle.node.setSiblingIndex(this.root.children.length - 1);
  }
  // ---------------- toast / input / hint ----------------
  /** Transient strip above the board tray (BoardLayout.toast, every region alike): tool prompts and errors only, fades after 2 s. */
  private say(text: string, fade = 0.2, valid?: () => boolean) {
    if (!text || !this.toastLabel) return;
    // region-title SPEC §7: the place name owns the toast slot for its 2.0 s; tips wait and come out afterwards in order.
    if (this.titleGate.active(this.titleClock)) { this.titleGate.hold({ text, fade, valid }); return; }
    // b18 (UI设计部): the stale-board notice has top priority; a tip arriving during it waits (latest wins) and shows after it fades.
    if (this.noticeUp) { this.queuedTip = text; return; } this.toastLabel.string = text; this.toastT = 0; this.toastFade = fade; this.toastEnd = fade === 0.2 ? TOAST_S : fade + TOAST_S;
    this.sizeToast(); this.toast.setSiblingIndex(this.root.children.length - 1); this.regionTitle?.node.setSiblingIndex(this.root.children.length - 1);
  }
  /** Pill = text + 40, capped by the layout's max width (≤ 330, inset from the edges); a longer line scales down to stay inside the caps. */
  private sizeToast() {
    const text = this.toastLabel?.string; if (!text) return;
    const tw = measure(text, 15), w = Math.min(this.geo?.toast.maxWidth ?? 330, tw + 40), h = this.geo?.toast.height ?? 32, fit = Math.min(1, (w - 28) / tw);
    this.toast.getComponent(UITransform)!.setContentSize(w, h); this.toastLabel.node.setScale(fit, fit, 1); this.paintToast(w, h);
  }
  private paintToast(w: number, h: number) { const g = this.toastBg, k = 1 - 0.38 * this.tint.weight(); g.clear(); g.fillColor = new Color(40, 30, 20, 40); g.roundRect(-w / 2 + 1, -h / 2 - 2, w, h, h / 2); g.fill(); g.fillColor = new Color(Math.round(248 * k), Math.round(242 * k), Math.round(226 * k), 240); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill(); g.strokeColor = new Color(201, 177, 133, 255); g.lineWidth = 1.5; g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.stroke(); }
  /** b18 (UI设计部): an old unfinished lake board was dropped on load → once, after presentForPlay (entry shot + transition done),
   *  the board toast says 「关卡已调整，从头开始」: fade 0.3 s, hold 2 s, fade 0.3 s; no button, no popup, touches pass through; the
   *  provider flag is cleared at once (in memory, so a restart never shows it). Toast sits in the plate→tray band like every tip. */
  private staleNotice(s: any) {
    if (this.titleGate.active(this.titleClock)) return; // §7: the place name first, then 「关卡已调整」
    if (this.noticeShown || !s?.notice?.text || !s.active || s.state !== 'run.ready' || s.readOnly || this.modalOpen()) return;
    if (Array.isArray(s.notice.stageIds) && !s.notice.stageIds.includes(s.active.stageId)) return;
    this.noticeShown = true; this.say(String(s.notice.text), 0.3); this.noticeUp = true;
    try { this.managed?.clearNotice?.(); } catch { }
  }
  private input() { this.hintClock.reset(); if (this.hintCells.length) { this.hintCells = []; this.paintMarks(); } }
  private autoHint() {
    const s = this.snapshot, a = s?.active; if (!a) return;
    if (s.provider === 'regional-r05' && a.guide) { const t = (a.guide.targets || []).filter((x: any) => x.current && !x.done); this.hintCells = t.map((x: any) => x.cell.index); if (t[0]?.instruction) this.say(t[0].instruction); }
    else { const hint = this.managed?.hint?.(); this.hintCells = Array.isArray(hint?.cells) ? hint.cells.slice() : []; }
    this.hintT = 0; this.paintMarks();
  }
  update(dt: number) {
    if (this.disposing || !this.root || !isValid(this.root, true)) return;
    // r4.2: before presentForPlay the host is only active for the hidden pre-activation; nothing else runs (as when it was inactive).
    if (!this.presented) { this.stepPrewarm(); return; }
    if (this.visualLeft >= 0) { this.visualLeft -= Math.max(0, dt); if (this.visualLeft <= 0) this.finishVisual(); }
    this.followGhost(); this.followPiece();
    if (this.returnPause) { this.returnPause = false; if (this.snapshot?.state === 'run.paused' && !this.snapshot.hidden && this.snapshot.active && !this.modalOpen()) this.openPausePanel(); }
    this.tint.update(); this.popups.update(dt);
    this.titleClock += Math.max(0, dt); this.regionTitle?.update(dt); this.maybeShowRegionTitle();
    if (this.titleGate.ended(this.titleClock)) this.hintClock.reset()/* §7: the 5 s auto-hint counts from the title's end */;
    const titleUp = this.titleGate.active(this.titleClock);
    const s = this.snapshot, active = !titleUp && !!s && s.state === 'run.ready' && !s.readOnly && !this.modalOpen() && !this.armedTool && !this.toolDrag && !this.dragStart && (typeof this.managed?.hint === 'function' || !!s.active?.guide);
    if (this.hintClock.tick(dt, active)) this.autoHint();
    if (this.hintCells.length) { this.hintT += dt; this.paintMarks(); }
    if (!reducedMotion()) { this.spinT = (this.spinT + dt * 120) % 360; for (let i = 0; i < 49; i++) if (this.under[i].node.active) this.under[i].node.setRotationFromEuler(0, 0, -this.spinT); }
    if (this.toastT >= 0) { this.toastT += dt; const op = this.toast.getComponent(UIOpacity)!, f = this.toastFade, e = this.toastEnd, k = this.toastT < f ? this.toastT / f : this.toastT < e ? 1 : Math.max(0, 1 - (this.toastT - e) / TOAST_OUT_S); op.opacity = Math.round(255 * k); if (k <= 0 && this.toastT > e) { this.toastT = -1; if (this.noticeUp) { this.noticeUp = false; const q = this.queuedTip; this.queuedTip = ''; if (q) this.say(q); } } }
    this.staleNotice(s);
    if (!titleUp && this.toastT < 0 && !this.noticeUp && this.titleGate.pending()) { const q = this.titleGate.next(); if (q) this.say(q.text, q.fade, q.valid); }
    if (!titleUp && this.introQueue.length && s?.state === 'run.ready' && !this.popups.any()) { const kind = this.introQueue.shift()!; if (!hasSeenTool(SEEN_ID[kind] || kind)) openToolIntro(this.popups, kind); }
  }
  // ---------------- dialogs ----------------
  /** QA board frames: the checkpoint is paused, so the recovery sheet would cover the playfield. */
  revealPlayfield() {
    this.returnPause = false;
    this.introQueue.length = 0;
    this.popups?.clear();
    if (this.snapshot?.state === 'run.paused') {
      try { this.managed?.intercept?.('resume') ?? this.host?.command?.('resume'); } catch { /* panel is already gone */ }
    }
    this.introQueue.length = 0;
    this.popups?.clear();
  }
  private openPausePanel() {
    const s = this.snapshot; if (!s?.active || this.modalOpen() || (s.state !== 'run.ready' && s.state !== 'run.paused')) return;
    this.cancelToolInput(); this.dragStart = null;
    // Recovery controls must not call the same failed board painter before opening.
    if (!this.presentationError) { this.paintToolTray(); this.paint(); }
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
    // b16-fix P2（build05 全流程测试 P2-3：L13 规则弹窗正文左侧被裁约 10px）：正文原来居中、宽 580，比木框内沿（680 宽、两侧木边）还宽，
    // 左右都压到木边下面。改为左对齐、文字盒宽 RULE_BODY_W=480，两侧各留 100（木边约 70 + 安全边距约 30，即屏幕上约 15pt），行数按每段 472 估算，避免 CLAMP 裁字。
    const RULE_BODY_W = 480;
    // b16 真机复核 ⑤：自己按 472 折行并做避头尾（行首不出现「）」等），Label 宽 480 不会再折一次。
    const wrapped = wrapKinsoku([guide.rule, guide.tool?.description].filter(Boolean).join('\n'), RULE_BODY_W - 8, t => measure(t, 28)).slice(0, RULE_GUIDE_MAX_LINES),
      body = wrapped.join('\n'), lines = wrapped.length;
    const ph = 104 + 48 + 40 + lines * 40 + 48 + 104 + 72, vw = this.layoutInfo?.width || 390, vh = this.layoutInfo?.height || 844, plateBottom = this.geo ? this.geo.plate.y + this.geo.plate.height / 2 : 0,
      p = this.popups.open({ name: 'RuleGuidePanel', height: ph, title: guide.title || '这一关的规则', dy: ruleGuideDy(vw, vh, ph, plateBottom, this.layoutInfo?.safe?.bottom ?? 34, popupScale(vw, vh)) });
    p.text(guide.phaseLabel + (guide.heldTurns ? ' · 固定 ' + guide.heldTurns + ' 次行动' : ''), 0, 128, 26, 'brown2', { bold: false, width: RULE_BODY_W });
    p.text(body, -RULE_BODY_W / 2, 192 + lines * 20, 28, 'brown', { bold: false, width: RULE_BODY_W, lines, height: lines * 40 + 8, align: 'left', name: 'RuleBody' });
    p.button('primary', '明白了', 0, ph - 72 - 52, 400, 104, () => p.close(), { fontSize: 36, name: 'GotIt' });
  }
  private closeResult() { const p = this.popups.find('ResultPanel'); if (p) p.destroy(); }
  private resultModel(s: any): ResultModel {
    const a = s.active || {}, mainline = s.provider === 'mainline-v33', won = a.status === 'won', h = this.hostActions;
    const kind = (s.state === 'error.readonly' || s.state === 'storage.readOnly') ? 'readonly' : (s.state === 'result.unsaved' || s.state === 'run.unsaved' || s.state === 'storage.unsaved') ? 'unsaved' : won ? 'win' : 'lose';
    const stars = typeof s.result?.stars === 'number' ? s.result.stars : typeof s.result?.earnedStars === 'number' ? s.result.earnedStars : won ? 1 : 0;
    const goalsLeft = Object.keys(a.goals || {}).filter(k => (a.goals[k] || 0) > 0).map(k => ({ art: goalArt(k), count: a.goals[k] }));
    const chest = mainline ? s.journey?.chests?.find((x: any) => x.level === a.level) : null, rewards: ResultReward[] = [];
    if (kind === 'win' && mainline && chest?.earned) rewards.push({ id: 'chest', label: chest.opened ? '宝箱已打开' : '打开宝箱', icon: 'popup/chest_closed', iconKind: 'chest', state: chest.opened ? 'claimed' : h.chest?.visible ? 'ready' : 'locked', claim: h.chest?.run });
    if (kind === 'win' && mainline) { const region = s.journey?.regionRewards?.find((x: any) => x.region === Math.floor((a.level ?? 0) / 4)); if (region?.unlocked) { const tool = ['tideNet', 'sunSeed', 'starShears'][region.region] || 'tideNet'; rewards.push({ id: 'regionReward', label: TOOL_NAMES[tool] || (region.claimed ? '地区道具已领取' : '地区道具'), icon: '', iconKind: 'tool', tool, state: region.claimed ? 'claimed' : h.regionReward?.visible ? 'ready' : 'locked', claim: h.regionReward?.run }); } }
    if (kind === 'win' && s.provider === 'regional-r05' && (h.claim?.visible || s.progress?.claimedRegions?.includes(a.region))) { const owned = !!s.progress?.claimedRegions?.includes(a.region); rewards.push({ id: 'claim', label: owned ? '地区印记已领取' : '领取地区印记', icon: 'popup/reward_seal_' + (a.region || 'tide'), iconKind: 'seal', state: owned ? 'claimed' : 'ready', claim: h.claim?.run }); }
    const ending = !h.mainNext?.visible && !h.next?.visible && !!h.ending?.visible, next = h.mainNext?.visible ? h.mainNext.run : h.next?.visible ? h.next.run : ending ? h.ending.run : null;
    return { kind, score: a.score || 0, stars, movesUsed: Array.isArray(a.actions) ? a.actions.length : null, movesLeft: a.moves ?? null, goalsLeft, chestHint: mainline && kind !== 'readonly', rewards,
      unlockHint: mainline && kind === 'win' && s.state === 'result.saved' && s.result?.completionRecorded ? a.level === 3 ? '主线 05 与潮汐挑战已开放；前往风车草甸' : a.level === 7 ? '主线 09 与草甸挑战已开放；天空挑战需通关主线 12' : a.level === 11 ? '天空挑战已开放；天空城另有 3D 场景入口' : undefined : undefined,
      hostError: this.hostResultError || undefined, failHint: kind === 'lose' && typeof s.uiFailHint === 'string' && s.uiFailHint ? s.uiFailHint : undefined,
      next, nextLabel: ending ? '继续' : undefined, replay: kind === 'lose' && s.state === 'result.saved' ? mainline ? () => this.command('startStage', a.stageId, {}) : s.provider === 'regional-r05' ? () => this.command('retryStage') : null : null,
      retrySave: () => this.command('retrySave'), home: () => {
        // 回小岛 joins the host's claim batch: the chest / region claims fired by the same tap are written first, then we leave.
        const go = () => { this.popups.clear(); this.resultKey = ''; return this.command('requestExit'); }, after = this.hostActions.afterClaims;
        if (after) after.run(go); else go();
      } };
  }
  private paintResult(s: any) {
    const attemptKey = (s.active?.stageId || '') + '|' + (s.active?.attemptId || '');
    if (this.resultAttemptKey && attemptKey !== this.resultAttemptKey) this.hostResultError = '';
    this.resultAttemptKey = attemptKey;
    const m = this.resultModel(s), key = [s.state, s.provider, s.active?.stageId, s.active?.attemptId, m.kind, m.stars, m.score, m.unlockHint, m.failHint, m.hostError, !!m.next, m.rewards.map(r => r.id + ':' + r.state).join(',')].join('|');
    if (key === this.resultKey && this.popups.find('ResultPanel')) return;
    this.resultKey = key; this.closeResult(); this.cancelToolInput(); this.toastT = -1; this.noticeUp = false; this.queuedTip = ''; this.toast.getComponent(UIOpacity)!.opacity = 0;
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
    if (memento) { const r = a?.region || 'tide'; items.push({ kind: 'seal', count: 0, label: ({ tide: '潮汐', meadow: '草甸', sky: '天空城', lake: '湖畔', coast: '夜航', snow: '雪山' } as any)[r] + '印记', seal: 'popup/reward_seal_' + r }); }
    if (!items.length) items.push({ kind: 'seal', count: 0, label: '一份海风的礼物', seal: 'popup/star_full' });
    // SPEC v2.1: the result screen shows its rewards on the panel itself (badges over the chest); no separate 「获得」 popup there.
    if (this.isResult(s) || this.popups.find('ResultPanel')) return;
    const behind = this.popups.find('ResultPanel'); if (behind) behind.root.active = false;
    const open = this.popups.find('RewardPanel');
    const merged = open ? this.rewardShown.slice() : [];
    for (let i = 0; i < items.length; i++) { const it = items[i]; let hit: RewardItem | null = null; for (let j = 0; j < merged.length; j++) if (merged[j].kind === it.kind && merged[j].label === it.label) hit = merged[j]; if (hit) hit.count += it.count; else merged.push(it); }
    this.rewardShown = merged.length ? merged : items.slice(); this.rewardChest = (open && this.rewardChest) || !!chest;
    if (open) open.destroy();
    const desc = memento ? '地区印记收进旅程册了。' : region && !chest && !this.rewardChest ? '收进旅人的行囊了。' : '海风吹开了宝箱，收进行囊吧。';
    const shown = this.rewardShown.slice(), hadChest = this.rewardChest;
    openReward(this.popups, shown, this.toolArt, { chest: hadChest, description: desc, done: () => { this.rewardShown = []; this.rewardChest = false; if (behind && behind.alive) behind.root.active = true; for (let i = 0; i < shown.length; i++) { const k = shown[i].kind; if (INTRO_TEXT[k] && !hasSeenTool(SEEN_ID[k] || k) && this.introQueue.indexOf(k) < 0) this.introQueue.push(k); } this.flushIntro(); } });
  }
  private flushIntro() { if (!this.introQueue.length || this.modalOpen() || this.titleGate.active(this.titleClock)) return; const kind = this.introQueue.shift()!; if (!hasSeenTool(SEEN_ID[kind] || kind)) openToolIntro(this.popups, kind, () => this.flushIntro()); else this.flushIntro(); }
  onDestroy() {
    if (this.disposing) return; this.disposing = true;
    // Cocos destroys child nodes before this component. Detach global listeners
    // before cleanup and never assume a child still owns its event/child arrays.
    game.off(Game.EVENT_HIDE, this.resetOnHide); game.off(Game.EVENT_HIDE, this.hide); game.off(Game.EVENT_SHOW, this.show); view.off('canvas-resize', this.resize, this);
    this.resetInput(); for (const h of this.pressHandles) h.dispose(); this.pressHandles.length = 0;
    this.releaseEntryResources();
    this.cancelAnimations(); this.backgroundFrame = undefined; this.backgroundStatus = undefined; this.artOff?.(); this.artOff = null;
    if (this.root && isValid(this.root, true)) this.root.off(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, this.presentationActive); if (typeof window !== 'undefined') window.removeEventListener('resize', this.resize);
    try { this.popups?.clear(); this.host?.dispose(); } finally { this.tint.clear(); if (!this.managed) delete (globalThis as any).__nativeBoard; }
  }
}
