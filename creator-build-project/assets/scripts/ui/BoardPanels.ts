import { Color, Graphics, Label, Node, Sprite, SpriteFrame, UIOpacity, UITransform, isValid } from 'cc';
import { GameAudio } from '../audio/GameAudio';
import { PopupPanel, PopupStack, resetPresses, uiNode, measure, type ArtButtonHandle, type ButtonOptions } from './PopupKit';
import { toolArt, type ToolArtSource } from './CommonPanels';
import { ResultChest3D } from '../ResultChest3D';
import { BoardArt } from './BoardArt';
import { reducedMotion } from './UiPrefs';
/** Board-only panels (c-popups compose.py / compose2.py): pause (layout frozen by PM, only the lite frame and width 680
 *  changed), restart confirmation and the four result pages. */
export interface PauseActions { line: string; resume(): void; restart(): void; bag(): void; settings(): void; home(): void; canRestart: boolean; canBag: boolean }
let lastMusic = 0.4;
export function openPause(stack: PopupStack, a: PauseActions): PopupPanel {
  const top = 380, ph = 800, p = stack.open({ name: 'PausePanel', height: ph, title: '暂停一下', titleArt: 'popup/title_0', dy: top + ph / 2 - 812 });
  p.text(a.line, 0, 92, 28, 'brown2', { bold: false, width: 600, name: 'PauseLine' });
  const tiles: Array<[string, string, () => void, boolean]> = [['popup/tile_restart', '重来', a.restart, a.canRestart], ['popup/tile_bag', '行囊', a.bag, a.canBag], ['popup/tile_settings', '设置', a.settings, true]];
  for (let i = 0; i < tiles.length; i++) {
    const cx = (i - 1) * 178, t = tiles[i], b = p.button('secondary', '', cx, 228, 150, 150, t[2], { name: 'Tile-' + t[1] });
    const plate = b.node.getChildByName('Face')!.getChildByName('Plate')!; plate.active = false;
    p.sprite(t[0], 0, 0, 150, undefined, 'ui', b.node.getChildByName('Face')!).node.setPosition(0, 0, 0);
    p.text(t[1], cx, 322, 30, 'brown'); b.setEnabled(t[3]);
  }
  const div = uiNode('Divider', p.body, 540, 4), dp = p.at(0, 378); div.setPosition(dp[0], dp[1], 0);
  p.tint.shape(div.addComponent(Graphics), (g, night, al) => { const k = 1 - 0.4 * night; g.strokeColor = new Color(Math.round(196 * k), Math.round(166 * k), Math.round(120 * k), Math.round(255 * al)); g.lineWidth = 3; for (let x = -270; x < 270; x += 18) { g.moveTo(x, 0); g.lineTo(x + 9, 0); } g.stroke(); });
  const audio = GameAudio.instance;
  const rows: Array<[string, string, boolean, (on: boolean) => void]> = [
    ['popup/icon_music', '音乐', (audio?.getMusicVolume() ?? 0.4) > 0, on => { const g = GameAudio.instance; if (!g) return; if (!on) { const v = g.getMusicVolume(); if (v > 0) lastMusic = v; g.setMusicVolume(0); } else g.setMusicVolume(lastMusic > 0 ? lastMusic : 0.4); }],
    ['popup/icon_sfx', '音效', !(audio?.isSfxMuted() ?? false), on => GameAudio.instance?.setSfxMuted(!on)],
  ];
  for (let i = 0; i < rows.length; i++) {
    const bx = -340 + 64 + i * 278, cy = 446, r = rows[i];
    p.sprite(r[0], bx + 25, cy, undefined, 50); p.text(r[1], bx + 68, cy, 32, 'brown', { align: 'left', width: 120 });
    p.toggle(bx + 196, cy, 46, r[2], r[3], i ? 'SfxToggle' : 'MusicToggle');
  }
  p.button('primary', '继续', 0, 580, 480, 104, () => p.close(a.resume), { icon: 'popup/icon_play', fontSize: 36, name: 'Resume' });
  p.button('secondary', '回到小岛', 0, 700, 480, 96, () => a.home(), { icon: 'popup/icon_home', fontSize: 32, name: 'Home', sound: 'back' });
  return p;
}
export function openRestartConfirm(stack: PopupStack, restart: () => void): PopupPanel {
  const p = stack.open({ name: 'RestartConfirm', height: 440, title: '重来这一关？', titleArt: 'popup/title_1', dy: 592 + 220 - 812 });
  p.sprite('popup/tile_restart', 0, 152, 128);
  p.text('这一局会从头再来', 0, 256, 30, 'brown', { bold: false });
  p.button('secondary', '留下', -136, 344, 248, 96, () => p.close(), { fontSize: 32, name: 'Stay', sound: 'back' });
  p.button('primary', '重来', 136, 344, 248, 96, () => p.close(restart), { fontSize: 32, name: 'Restart' });
  return p;
}
export type ResultKind = 'win' | 'lose' | 'unsaved' | 'readonly';
export interface ResultReward { id: string; label: string; icon: string; iconKind?: 'chest' | 'seal' | 'tool'; tool?: string; state: 'ready' | 'claimed' | 'locked'; claim?: () => void; count?: number }
export interface ResultModel {
  kind: ResultKind; score: number; stars: number | null; movesUsed: number | null; movesLeft: number | null;
  goalsLeft: Array<{ art: string; count: number }>; chestHint: boolean; rewards: ResultReward[];
  unlockHint?: string; nextUnavailable?: string; next?: (() => void) | null; replay?: (() => void) | null; retrySave?: (() => void) | null; home: () => void;
}
const TITLES: Record<ResultKind, [string, string]> = { win: ['过关啦', 'popup/title_4'], lose: ['差一点点', 'popup/title_5'], unsaved: ['还没存上', 'r2/title_unsaved'], readonly: ['旅途回顾', 'r2/title_review'] };
/** Steps, saved and the unlock hint are one secondary line under the score. */
function resultSummary(m: ResultModel): string {
  if (m.kind !== 'win') return '';
  const parts: string[] = [];
  // v2 spec: "用了 6 步 · 剩余 22 步"; no 成绩已保存; the unlock hint is its own line shown once the chest is open.
  if (m.movesUsed !== null) parts.push('用了 ' + m.movesUsed + ' 步');
  if (m.movesLeft !== null) parts.push('剩余 ' + m.movesLeft + ' 步');
  return parts.join(' · ');
}
export function openResult(stack: PopupStack, m: ResultModel, legacy: ToolArtSource | null): PopupPanel {
  const wideReward = m.kind === 'win' && m.rewards.some(r => r.label.length >= 6);
  // Include the real 88-design-px claim hit area, not just its 64px painted face.
  const rewardsH = m.kind === 'win' && m.rewards.length ? 256 : 0, nextH = m.kind === 'win' && !m.next ? -120 : 0;
  const ph = m.kind === 'win' ? 808 + rewardsH + nextH : m.kind === 'lose' ? (m.chestHint ? 920 : 808) - (m.replay ? 0 : 120) : m.kind === 'unsaved' ? (m.chestHint ? 880 : 768) : 680;
  const p = stack.open({ name: 'ResultPanel', height: ph, title: TITLES[m.kind][0], titleArt: TITLES[m.kind][1] });
  const groups: Record<string, ResultSection> = {}, actions: ResultAction[] = [], rewards: ResultSection[] = [];
  const section = <T>(name: string, x: number, y: number, build: () => T): T => {
    const before = new Set(p.body.children), value = build(), children = p.body.children.filter(n => !before.has(n));
    const node = uiNode(name, p.body), pos = p.at(x, y); node.setPosition(pos[0], pos[1], 0);
    for (const child of children) { const q = child.position.clone(); node.addChild(child); child.setPosition(q.x - pos[0], q.y - pos[1], q.z); }
    groups[name] = { node, x, y, original: captureResultNodes(node, name !== 'ResultStars') }; return value;
  };
  const button = (kind: 'primary' | 'secondary', label: string, y: number, w: number, h: number, tap: () => void, opts: ButtonOptions) => {
    const handle = p.button(kind, label, 0, y, w, h, tap, opts); actions.push({ handle, y, width: w, height: h, original: captureResultNodes(handle.node, true) }); return handle;
  };
  const starNodes = section('ResultStars', 0, 184, () => stars(p, 184, m.kind === 'lose' ? 0 : m.stars ?? 0));
  section('ResultScore', 0, 336, () => m.kind === 'lose'
    ? p.text('步数用完了，换个顺序试试？', 0, 336, 28, 'brown', { bold: false, name: 'ResultMessage' })
    : p.text(m.score + ' 分', 0, 336, 64, 'brown', { name: 'Score' }));
  if (m.kind === 'win') {
    // SPEC v2.2 text list: a win page keeps only 过关啦 / the score / 下一关 / 回小岛 (no step line, hint, names or unlock line).
    let y = 600;
    if (m.rewards.length) {
      const n = m.rewards.length, step = n === 1 ? 0 : n === 2 ? (wideReward ? 280 : 220) : 200;
      for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * step, name = 'ResultReward-' + i;
        section(name, x, y, () => rewardSlot(p, m.rewards[i], x, y, legacy, wideReward)); rewards.push(groups[name]); }
      y += rewardsH;
    }
    const ready = m.rewards.filter(r => r.state === 'ready' && r.claim);
    if (ready.length) {
      let spent = false;
      // Funning 2026-10-16: no 「全部领取」 button. The chest itself is the tap target (an invisible hit area over it,
      // guided by the pulsing light); one tap claims every ready reward once, later taps are ignored.
      const handle = p.button('primary', '', 0, y, 220, 56, () => {
        if (spent) return;
        spent = true; handle.setEnabled(false); handle.node.active = false;
        (p as any).resultChestTapped?.();
        try { (globalThis as any).wx?.vibrateShort?.({ type: 'light' }); } catch { }
        for (let i = 0; i < ready.length; i++) { const claim = ready[i].claim; if (claim) claim(); }
      }, { name: 'ResultChestTap' });
      (p as any).resultClaimAll = () => { if (!spent && isValid(handle.node, true)) { spent = true; handle.setEnabled(false); handle.node.active = false; for (let i = 0; i < ready.length; i++) { const claim = ready[i].claim; if (claim) claim(); } } };
    }
    // Spec v2 (provisional): leaving before opening claims everything first, no confirmation popup.
    const claimFirst = (go: () => void) => () => { (p as any).resultClaimAll?.(); go(); };
    if (m.next) m = { ...m, next: claimFirst(m.next) };
    const home0 = m.home; m = { ...m, home: claimFirst(home0) };
    if (m.next) { button('primary', m.nextUnavailable ? '草原待就绪' : '下一关', y - 24, 480, 104, m.next, { fontSize: 36, name: 'Next' }).setEnabled(!m.nextUnavailable); button('secondary', '回小岛', y + 96, 320, 88, m.home, { icon: 'popup/icon_home', fontSize: 30, name: 'Home', sound: 'back' }); }
    else button('primary', '回小岛', y - 24, 480, 104, m.home, { icon: 'popup/icon_home', fontSize: 36, name: 'Home', sound: 'back' });
  } else if (m.kind === 'lose') {
    section('ResultGoals', 0, 440, () => {
      const goals = m.goalsLeft.slice(0, 2);
      for (let i = 0; i < goals.length; i++) { const cx = goals.length === 1 ? 0 : -112 + i * 224; p.sprite(goals[i].art, cx - 32, 440, 96, 96); p.text('×' + goals[i].count, cx + 24, 440, 40, 'brown', { align: 'left', width: 120 }); }
    });
    let by = 688;
    if (m.chestHint) section('ResultChest', 0, 568, () => chestLine(p, 568, '过关后可以打开')); else by = 576;
    if (m.replay) button('primary', '再试一次', by, 480, 104, m.replay, { icon: 'popup/icon_play', fontSize: 36, name: 'Replay' });
    button(m.replay ? 'secondary' : 'primary', '回小岛', m.replay ? by + 120 : by, m.replay ? 320 : 480, m.replay ? 88 : 104, m.home, { icon: 'popup/icon_home', fontSize: 30, name: 'Home', sound: 'back' });
  } else if (m.kind === 'unsaved') {
    section('ResultNotice', 0, 424, () => {
      const n = uiNode('Warn', p.body, 36, 36), wp = p.at(-198, 424); n.setPosition(wp[0], wp[1], 0);
      p.tint.shape(n.addComponent(Graphics), (g, _n, a) => { g.fillColor = new Color(232, 150, 70, Math.round(255 * a)); g.circle(0, 0, 18); g.fill(); });
      p.text('!', -198, 424, 26, 'white', { width: 36, name: 'WarnText' }); p.text('成绩还没存进旅程册', -170, 424, 28, 'brown', { align: 'left', width: 400, bold: false });
    });
    let by = 656; if (m.chestHint) section('ResultChest', 0, 536, () => chestLine(p, 536, '存好后就能打开')); else by = 544;
    button('primary', '重试保存', by, 480, 104, () => m.retrySave?.(), { fontSize: 36, name: 'RetrySave' });
    button('secondary', '返回海岛', by + 120, 320, 88, m.home, { icon: 'popup/icon_home', fontSize: 30, name: 'Home', sound: 'back' });
  } else {
    section('ResultNotice', 0, 424, () => { p.sprite('r2/icon_lock', -228, 424, undefined, 36); p.text('记录暂时不能写入，这局只看不存', -200, 424, 28, 'brown2', { align: 'left', width: 460, bold: false }); });
    button('primary', '返回海岛', 552, 440, 104, m.home, { icon: 'popup/icon_home', fontSize: 36, name: 'Home', sound: 'back' });
  }
  configureResultLayout(p, ph, m, groups, actions, rewards);
  dropStars(p, starNodes);
  return p;
}
type ResultPose = { node: Node; x: number; y: number; sx: number; sy: number; width: number; height: number; font?: number; line?: number; wrap?: boolean; overflow?: number };
type ResultSection = { node: Node; x: number; y: number; original: ResultPose[] };
type ResultAction = { handle: ArtButtonHandle; y: number; width: number; height: number; original: ResultPose[] };
function captureResultNodes(root: Node, descendants: boolean): ResultPose[] {
  const out: ResultPose[] = [];
  const visit = (n: Node) => { const ui = n.getComponent(UITransform), l = n.getComponent(Label);
    out.push({ node: n, x: n.position.x, y: n.position.y, sx: n.scale.x, sy: n.scale.y, width: ui?.width || 0, height: ui?.height || 0, font: l?.fontSize, line: l?.lineHeight, wrap: l?.enableWrapText, overflow: l?.overflow });
    if (descendants) for (const child of n.children) visit(child);
  }; visit(root); return out;
}
function fitResultButton(node: Node, width: number, height: number, font?: number) {
  node.getComponent(UITransform)!.setContentSize(width, height);
  const face = node.getChildByName('Face')!; face.getComponent(UITransform)!.setContentSize(width, height);
  const plate = face.getChildByName('Plate')!; plate.getComponent(UITransform)!.setContentSize(width / plate.scale.x, height / plate.scale.y);
  const label = face.getChildByName('Label')?.getComponent(Label);
  if (label) { if (font) { label.fontSize = font; label.lineHeight = Math.round(font * 1.4); } label.node.getComponent(UITransform)!.setContentSize(width - 40, label.lineHeight); }
}
/** Readable result flow in logical UI units. The title and navigation stay fixed;
 * dense content uses finite, explicit pages instead of making its text smaller.
 * 48-unit buttons and 16-unit text include the 0.92 opening animation allowance.
 * This is not a guarantee about camera projection or physical device pixels. */
function configureResultLayout(p: PopupPanel, _originalHeight: number, m: ResultModel, groups: Record<string, ResultSection>, actions: ResultAction[], rewards: ResultSection[]) {
  type Row = { node: Node; height: number; keepWithNext?: boolean };
  const pool = new Map<string, Node>();
  const original = new Map<Node, ResultPose>();
  const scoreLabel = groups.ResultScore.node.getComponentInChildren(Label)!;
  const scoreText = scoreLabel.string;
  const rewardIcons = rewards.map(g => g.node.children.filter(n => !n.name.startsWith('Claim-') && !n.getComponent(Label)));
  const goalIcons = groups.ResultGoals?.node.children.filter(n => !n.getComponent(Label)) || [];
  // SPEC v2.1 (2026-10-16 16:35): result panel 9-slice inset 212 source px (the shared frame keeps 276 for other popups),
  // shown ≈ 23 pt; the centre is the asset's own plain paper, no light or colour layer on top.
  const frame = p.body.getChildByName('PanelFrame')!, PANEL_INSET = 212, PANEL_EDGE_PT = 23;
  { const sp = frame.getComponent(Sprite), sf: any = sp?.spriteFrame;
    let own: any = null; if (sf && sf.texture) { own = new SpriteFrame(); own.texture = sf.texture; }
    if (sp && own) { own.insetLeft = own.insetTop = own.insetRight = own.insetBottom = PANEL_INSET; sp.spriteFrame = own; const pd = p.destroy.bind(p); p.destroy = () => { pd(); try { own.destroy?.(); } catch { } }; }
    const k = own ? PANEL_EDGE_PT / (PANEL_INSET * Math.abs(frame.scale.x || 1)) : 0.45; frame.setScale(frame.scale.x * k, frame.scale.y * k, 1); }
  const plateScales = new Map<Node, number>();
  const buttonTextInset = 16;
  let rowGap = 6;
  const buttonTextWidth = (width: number) => width - buttonTextInset;
  for (const g of Object.values(groups)) for (const v of g.original) original.set(v.node, v);
  for (const g of Object.values(groups)) g.node.active = false;
  const getRow = (id: string, height: number): Row => {
    let node = pool.get(id); if (!node) { node = uiNode('ResultFlow-' + id, p.body); pool.set(id, node); }
    node.active = false; return { node, height };
  };
  const add = (row: Row, n: Node, x: number, y = 0) => { row.node.addChild(n); n.active = true; n.setPosition(x, y, 0); };
  const fitArt = (n: Node, w: number, h: number) => {
    const v = original.get(n), ui = n.getComponent(UITransform)!;
    const ow = v ? v.width * v.sx : ui.width * n.scale.x, oh = v ? v.height * v.sy : ui.height * n.scale.y;
    const k = Math.min(w / Math.max(1, ow), h / Math.max(1, oh));
    n.setScale((v?.sx ?? 1) * k, (v?.sy ?? 1) * k, 1);
  };
  /** Soft drop shadow under a wooden button or card: same rounded box, offset down, dark warm brown. */
  const dropShadow = (host: Node, name: string, w: number, h: number, offset: number, radius: number) => {
    let n = host.getChildByName(name);
    if (!n) {
      n = uiNode(name, host, w, h); n.setSiblingIndex(0); const shadowNode = n;
      p.tint.shape(n.addComponent(Graphics), (g, night, alpha) => {
        const ui = shadowNode.getComponent(UITransform)!, off = (shadowNode as any).__offset ?? offset;
        g.fillColor = new Color(Math.round(74 - 30 * night), Math.round(50 - 20 * night), Math.round(30 - 6 * night), Math.round(110 * alpha));
        g.roundRect(-ui.width / 2, -ui.height / 2 - off, ui.width, ui.height, radius); g.fill();
      });
    }
    (n as any).__offset = offset; n.getComponent(UITransform)!.setContentSize(w, h); n.setPosition(0, 0, 0); n.active = true; return n;
  };
  const actionShadow = (n: Node, w: number, h: number) => dropShadow(n, 'ActionShadow', w - 4, h - 2, ACTION_SHADOW, Math.min(18, h / 2));
  const layoutButton = (n: Node, w: number, text?: string, height = 48, artK = 0.45) => {
    const plate = n.getChildByName('Face')!.getChildByName('Plate')!;
    if (!plateScales.has(plate)) plateScales.set(plate, plate.scale.x);
    const artScale = plateScales.get(plate)! * (w < 80 ? 0.25 : artK); plate.setScale(artScale, artScale, 1);
    fitResultButton(n, w, height, 16); n.setScale(1, 1, 1);
    const face = n.getChildByName('Face')!, label = face.getChildByName('Label')?.getComponent(Label);
    const icon = face.getChildByName('Icon'); if (icon) icon.active = false;
    if (label) {
      if (text !== undefined) label.string = text;
      label.node.setScale(1, 1, 1); label.node.setPosition(0, 0, 0);
      label.node.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
      label.node.getComponent(UITransform)!.setContentSize(buttonTextWidth(w), 40);
      label.horizontalAlign = Label.HorizontalAlign.CENTER; label.lineHeight = 20;
      label.enableWrapText = false; label.overflow = Label.Overflow.CLAMP;
    }
  };
  // Canvas measurement is used where available, with a conservative code-point
  // bound as the fallback (including wide Latin and CJK, rather than .56em Latin).
  let context: any = null;
  try { const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : (globalThis as any).wx?.createCanvas?.(); context = canvas?.getContext?.('2d'); } catch { }
  const textWidth = (text: string, size: number) => {
    const fallback = Array.from(text).reduce((w, ch) => w + (ch === ' ' ? size * 0.5 : size), 0);
    if (!context) return fallback;
    try { context.font = `${size}px Arial`; const measured = context.measureText(text).width; return Math.max(fallback, Number.isFinite(measured) ? measured + 1 : 0); } catch { return fallback; }
  };
  const wrap = (text: string, width: number, size: number) => {
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const ch of Array.from(paragraph)) { if (line && textWidth(line + ch, size) > width) { lines.push(line); line = ''; } line += ch; }
      lines.push(line);
    }
    return lines;
  };
  let page = 0, pages: Row[][] = [], layoutKey = '', contentTop = 58, available = 0;
  const previous = p.button('secondary', '‹', 0, 0, 48, 48, () => changePage(-1), { name: 'ResultPreviousPage', fontSize: 24 });
  const next = p.button('secondary', '›', 0, 0, 48, 48, () => changePage(1), { name: 'ResultNextPage', fontSize: 24 });
  const counter = p.text('', 0, 0, 16, 'brown2', { width: 100, name: 'ResultPageNumber', bold: false });
  const readableTitle = p.text(TITLES[m.kind][0], 0, 0, 18, 'brown', { width: 160, name: 'ResultReadableTitle' }); readableTitle.node.active = false;
  const spaceNotice = p.text('', 0, 0, 16, 'brown2', { width: 160, name: 'ResultSpaceNotice', bold: false }); spaceNotice.node.active = false;
  const showPage = () => {
    for (const n of pool.values()) n.active = false;
    const rows = pages[page] || []; const used = rows.reduce((sum, row) => sum + row.height + rowGap, -rowGap);
    let y = contentTop + Math.max(0, (available - used) / 2);
    for (const row of rows) { row.node.active = true; row.node.setPosition(0, p.height / 2 - y - row.height / 2, 0); y += row.height + rowGap; }
    previous.node.active = next.node.active = counter.node.active = pages.length > 1;
    previous.setEnabled(page > 0); next.setEnabled(page + 1 < pages.length);
    counter.string = `${page + 1} / ${pages.length}`;
  };
  function changePage(delta: number) {
    const target = Math.max(0, Math.min(pages.length - 1, page + delta));
    if (target === page) return;
    resetPresses(p.root); page = target; showPage();
  }
  let compactViewport = false, shortPhone = false, specCompact = false;
  let chestRig: ResultChest3D | null = null;
  let raysNode: Node | null = null, haloNode: Node | null = null;
  let floatNodes: { node: Node; x: number; y: number; phase: number; fromY: number }[] = [];
  let chestPose: { node: Node; flat: Node | null; y: number; rigY: number; w: number; h: number } | null = null;
  let guideT = 0, riseT = 0, flatScale = { x: 1, y: 1 };
  // Pulsing light guide on a ready chest; floating rewards rise out of the open chest, then bob gently.
  const baseUpdate = p.update.bind(p);
  p.update = (dt: number) => {
    baseUpdate(dt); const d = Math.max(0, Math.min(dt, 0.1)); guideT += d; riseT += d; chestRig?.update(d);
    const still = reducedMotion(), wave = Math.sin(guideT * 2 * Math.PI / GUIDE_PERIOD);
    if (guideDiag.pulsing && !still) {
      const sine = 0.5 - 0.5 * Math.cos(guideT * 2 * Math.PI / GUIDE_PERIOD); // sineInOut 0→1→0
      if (haloNode && isValid(haloNode, true)) { const hk = 0.95 + 0.1 * sine; haloNode.setScale(hk, hk, 1); const o = haloNode.getComponent(UIOpacity) || haloNode.addComponent(UIOpacity); o.opacity = Math.round(255 * (0.7 + 0.3 * sine)); }
      if (hintLabel && isValid(hintLabel.node, true)) { const o = hintLabel.node.getComponent(UIOpacity) || hintLabel.node.addComponent(UIOpacity); o.opacity = Math.round(255 * (0.55 + 0.45 * sine)); }
      if (chestPose) {
        const c = 1 + 0.04 * sine;
        // hop: after 3 s idle, every 2.4 s, 420 ms: up 8 (quadOut) then bounceOut down, ±3° wobble.
        const idle = guideT - 3, ph = idle >= 0 ? idle % 2.4 : 9, hop = ph < 0.21 ? 1 - Math.pow(1 - ph / 0.21, 2) : ph < 0.42 ? 1 - bounceOut((ph - 0.21) / 0.21) : 0, rot = ph < 0.42 ? 3 * Math.sin(ph / 0.42 * 2 * Math.PI) : 0;
        const rig = chestPose.node, flat = chestPose.flat;
        if (isValid(rig, true)) { rig.setPosition(0, chestPose.rigY + 8 * hop, 0); rig.setScale(c, c, 1); rig.setRotationFromEuler(0, 0, rot); }
        if (flat && isValid(flat, true)) { flat.setPosition(0, chestPose.y + 8 * hop, 0); flat.setScale(flatScale.x * c, flatScale.y * c, 1); flat.setRotationFromEuler(0, 0, rot); }
      }
    }
    if (raysNode && isValid(raysNode, true) && raysNode.active && !still) raysNode.setRotationFromEuler(0, 0, -riseT * 18); // 20 s per turn
    for (const f of floatNodes) {
      if (!isValid(f.node, true)) continue;
      const k = still ? 1 : Math.max(0, Math.min(1, (riseT - f.phase) / 0.42)), e = backOut(k, 1.4), bob = still || k < 1 ? 0 : 3 * Math.sin((riseT - f.phase - 0.42) * Math.PI);
      const sc = 0.3 + 0.7 * e;
      // The plate + icon scale 0.3 → 1; the name keeps its readable 16-unit size throughout.
      for (const c of f.node.children) { if (c.getComponent(Label)) continue; const b = (c as any).__floatBase || ((c as any).__floatBase = { x: c.scale.x, y: c.scale.y }); c.setScale(b.x * sc, b.y * sc, 1); }
      f.node.setPosition(f.x * Math.min(1, e), f.fromY + (f.y - f.fromY) * e + bob, 0); const o = f.node.getComponent(UIOpacity) || f.node.addComponent(UIOpacity); o.opacity = Math.round(255 * Math.min(1, k * 2));
    }
  };
  (p as any).resultChestTapped = () => { guideDiag.pulsing = false; chestTappedAt = Date.now(); chestRig?.open(true); };
  const prevDestroy = p.destroy.bind(p);
  p.destroy = () => { chestRig?.dispose(); chestRig = null; prevDestroy(); };
  const isChest = (r: ResultReward) => r.iconKind === 'chest' || r.id === 'chest';
  // Chest hero: 240 × 216 when the page has room, never under 96 × 86 (the 3D render keeps its aspect).
  // Spec v2: chest 168 × 130 (compact 120 × 93), halo / hit area 220 (compact 160), rays 280 only once open.
  // ResultChest3D v2.2 camera (36° pitch, 38° azimuth, fov 36, look-at y 0.68): the closed chest spans 60% of the square frame,
  // its centre 2.8% of the frame below the frame centre; the open lid (−118°) reaches 47% of the frame above the chest centre.
  const CHEST_FRAME = { width: 0.60, offsetY: 0.028 }, LID_REACH = 0.47;
  // SPEC v2.1: chest shown 180 wide closed / 176 open (compact 120), hit area 220 (compact 160), glow r120 closed / r150 open
  // (compact r80), rays 300 centred 48 above the chest, only once open. 2D fallback art aspect: closed 380×329, open 380×412.
  const CHEST_W = 180, CHEST_H = 147, CHEST_W_C = 120, CHEST_H_C = 98, HALO = 220, HALO_C = 160, RAY = 300, CHEST_MIN_H = 72;
  const CHEST_OPEN_W = 176 / 180, FLAT_OPEN_ASPECT = 387 / 400, /* chest_v3 fallback art (400 × 327 closed / 400 × 387 open, outline + contact shadow baked in) */ GLOW_R = 74, GLOW_R_OPEN = 78, GLOW_R_C = 50, RAY_LIFT = 48;
  // Glow hugs the chest (radius ≤ 0.45 × chest width): closed centre 4 below the chest centre, open 26 above; peak α 47% (night 59%) / open 59%.
  // SPEC v2.2: the chest sits 8 right of centre so the shadow to its right/back doesn't pull it off-centre visually.
  const CHEST_DX = 8, GLOW_DY = -4, GLOW_DY_OPEN = 26, GLOW_A = 0.47, GLOW_A_NIGHT = 0.59, GLOW_A_OPEN = 0.59, BADGE_GLOW_R = 40, BADGE_GLOW_A = 0.43;
  // Bottom actions match the home-screen wooden buttons: 56 high, plate art 0.6, a 5-unit drop shadow, equal widths.
  const ACTION_H = 56, ACTION_ART = 0.6, ACTION_SHADOW = 6, GUIDE_PERIOD = 1.6;
  // Rewards float above the open chest: icon + name, a gentle rise then bob. No card module under the chest.
  // FLOAT_PLATE: the mockup's flat cream plate behind each reward; off (keep the game's art), one switch for the redesign.
  const FLOAT_PLATE = true; // SPEC v2.1 RewardBadge (existing icon on a cream round badge)
  const FLOAT_ICON = 68, FLOAT_ICON_DENSE = 56, FLOAT_NAME = 22, FLOAT_GAP = 28, FLOAT_STEP = 76, FLOAT_STEP_MANY = 64;
  // Bottom row keeps clear of the panel edge (28 inside a 12-unit panel inset = 40 from a 390-wide screen) and the bottom.
  const ACTION_SIDE = 26, ACTION_SIDE_TIGHT = 12, ACTION_GAP = 16, ACTION_BOTTOM = 24, ACTION_H_C = 52;
  (p as any).resultDiagnostics = () => ({ chestOpen: m.rewards.some(r => isChest(r) && r.state === 'claimed'), chest: chestRig ? chestRig.diagnostics() : null, action: { height: specCompact ? ACTION_H_C : ACTION_H, artScale: ACTION_ART, shadow: ACTION_SHADOW, side: ACTION_SIDE, gap: ACTION_GAP, bottom: ACTION_BOTTOM }, float: floatDiag, guide: guideDiag });
  let floatDiag: { name: string; x: number; y: number; icon: number }[] = []; const guideDiag: any = { pulsing: false, period: GUIDE_PERIOD };
  let hintLabel: Label | null = null;
  const anyReady = () => m.rewards.some(r => r.state === 'ready' && r.claim);
  const hasChest = () => m.rewards.some(isChest);
  /** Items float over the chest once it is open (or on their own when there is no chest). */
  const floating = () => sideRewards().filter(r => !hasChest() || m.rewards.some(c => isChest(c) && c.state === 'claimed') || r.state === 'claimed');
  const floatBand = (dense: boolean) => floating().length ? (dense ? FLOAT_ICON_DENSE : FLOAT_ICON) + FLOAT_NAME + 12 : 0;
  const chestOpened = () => m.rewards.some(c => isChest(c) && c.state === 'claimed');
  const chestReady = () => m.rewards.some(c => isChest(c) && c.state === 'ready' && !!c.claim);
  const heroHeightFor = (inner: number, r: ResultReward) => {
    const halo = Math.min(inner, specCompact ? HALO_C : HALO), cw = specCompact ? CHEST_W_C : CHEST_W;
    // Size the panel for the open state in both states, so it does not jump when the chest opens (SPEC: one panel size).
    const band = sideRewards().length && r.state !== 'locked' ? (specCompact ? FLOAT_ICON_DENSE : FLOAT_ICON) + FLOAT_NAME + 12 : 0;
    if (!band) return halo;
    return specCompact ? halo + Math.round(band * 0.6) : halo + band + Math.max(0, Math.round(LID_REACH * cw / CHEST_FRAME.width - halo / 2));
  };
  const sideRewards = () => m.rewards.filter(r => !isChest(r));
  // Measure the same content used by reflow. Tall phones no longer turn a short
  // result into a near-full-screen panel with a vertically centred empty area.
  const naturalHeight = (w: number) => {
    const roomy = w >= 320, inner = w - (roomy ? 48 : 16), reserve = roomy ? 92 : 68, heights: number[] = [];
    const lines = (text: string, size: number, line?: number) => { const lh = line || Math.ceil(size * 1.35); for (const _ of wrap(text, inner - 4, size)) heights.push(lh); };
    heights.push(shortPhone ? 44 : 88);
    if (m.kind === 'lose') lines(scoreText, 16); else lines(scoreText, 34, 46);
    if (m.kind === 'win') { /* SPEC v2.2: no step line */ }
    else if (m.kind === 'lose') { for (const _ of goalIcons) heights.push(40); }
    else lines(m.kind === 'unsaved' ? '成绩还没存进旅程册' : '记录暂时不能写入，这局只看不存', 16);
    if (m.chestHint && m.kind !== 'win') lines(m.kind === 'lose' ? '过关后可以打开宝箱' : '存好后就能打开宝箱', 16);
    const side = sideRewards();
    for (let i = 0; i < m.rewards.length; i++) { const r = m.rewards[i]; if (isChest(r)) { heights.push(heroHeightFor(inner, r)); } }
    if (side.length && !hasChest()) heights.push(floatBand(shortPhone) + 24);
    return contentTop + reserve + heights.reduce((sum, h) => sum + h, 0) + Math.max(0, heights.length - 1) * rowGap;
  };
  p.setLayoutStrategy((width, height, safeInsets) => {
    const number = (v: number | undefined) => Number.isFinite(v) ? Math.max(0, v!) : 0;
    const left = number(safeInsets?.left), right = number(safeInsets?.right), bottom = number(safeInsets?.bottom);
    // Reserve the capsule's whole top band: the result title and pager never
    // overlap the system menu even when its horizontal position is asymmetric.
    const top = Math.max(number(safeInsets?.top), number(safeInsets?.capsule?.bottom));
    // Spec v2: 350-wide panel on a 390 screen (20 each side); narrower screens keep a 12-unit inset.
    const w = Math.min(350, Math.max(1, width - left - right - (width - left - right >= 360 ? 40 : 24)));
    const maxHeight = Math.max(1, height - top - bottom - 24);
    shortPhone = height <= 700 && width >= 360 && width < height; specCompact = height <= 700;
    compactViewport = maxHeight < 400 || shortPhone; rowGap = compactViewport ? 1 : 6;
    const h = Math.min(maxHeight, naturalHeight(w));
    return { width: w, height: h, scale: 1, titleY: h / 2 - 23, offsetX: (left - right) / 2, offsetY: (bottom - top) / 2 };
  }, geometry => {
    const key = `${geometry.width}/${geometry.height}/${compactViewport}/${shortPhone}`;
    // Opening animation must not rebuild the pages or reset a held finger.
    if (layoutKey === key) return; layoutKey = key;
    resetPresses(p.root);
    const w = geometry.width, h = geometry.height, roomy = w >= 320, inner = w - (roomy ? 48 : 16), reserve = roomy ? 92 : 68, dense = compactViewport;
    // 216 × 196 safe rectangle, less the 12-unit frame margin on each side.
    const supported = w >= 192 && h >= 172;
    p.body.getChildByName('TitlePlank')!.active = supported;
    for (const a of actions) a.handle.node.active = supported;
    const walkNamed = (n: Node, name: string): Node | null => {
      if (n.name === name) return n;
      for (let i = 0; i < n.children.length; i++) { const f = walkNamed(n.children[i], name); if (f) return f; }
      return null;
    };
    const claimAll = walkNamed(p.root, 'ResultChestTap');
    spaceNotice.node.active = !supported; readableTitle.node.active = false;
    if (!supported) {
      if (claimAll) claimAll.active = false;
      // A bounded host fallback, not another text shrink. Keep the modal guard,
      // cancel every old gesture and require a larger safe rectangle to act.
      for (const n of pool.values()) n.active = false;
      previous.node.active = next.node.active = counter.node.active = false;
      const lines = wrap('空间不足\n请旋转屏幕\n或放大窗口', Math.max(1, inner), 16);
      spaceNotice.string = lines.join('\n'); spaceNotice.fontSize = 16; spaceNotice.lineHeight = 22;
      spaceNotice.enableWrapText = false; spaceNotice.overflow = Label.Overflow.CLAMP;
      spaceNotice.node.getComponent(UITransform)!.setContentSize(Math.max(1, inner), lines.length * 22);
      spaceNotice.node.setPosition(0, 0, 0);
      spaceNotice.node.active = inner >= 16 && lines.length * 22 <= h - 8;
      return;
    }
    available = h - contentTop - reserve;
    // Short pages (SE-class) keep everything on one page: smaller stars, compact cards, the claim button names the chest.
    const tight = !dense && available < 520, snug = !dense && available < 600;
    const rows: Row[] = [];
    const labelRows = (id: string, text: string, size = 16, role: 'brown' | 'brown2' | 'teal' | 'grey' = 'brown') => {
      const lines = wrap(text, inner - 4, size);
      for (let i = 0; i < lines.length; i++) {
        const row = getRow(id + '-' + i, Math.ceil(size * 1.35)); row.keepWithNext = ['Score', 'ResultNotice', 'ResultMessage', 'ResultChestHint'].includes(id) && i + 1 < lines.length;
        let l = row.node.getComponentInChildren(Label);
        if (!l) l = p.text('', 0, 0, size, role, { name: id + (i ? '-continued-' + i : ''), bold: size >= 20, width: inner, parent: row.node });
        l.string = lines[i]; l.fontSize = size; l.lineHeight = Math.ceil(size * 1.35); l.enableWrapText = false; l.overflow = Label.Overflow.CLAMP;
        l.node.getComponent(UITransform)!.setContentSize(inner, l.lineHeight); l.node.setPosition(0, 0, 0); rows.push(row);
      }
    };
    const plank = p.body.getChildByName('TitlePlank')!, plankUI = plank.getComponent(UITransform)!;
    const titleWidth = Math.max(1, w - 112), titleScale = Math.min(0.42, titleWidth / plankUI.width);
    plank.setScale(titleScale, titleScale, 1); plank.setPosition(0, h / 2 - 23, 0);
    const title = plank.getChildByName('Title')!, titleLabel = title.getComponent(Label);
    const replaceTitleArt = !titleLabel && title.getComponent(UITransform)!.height * titleScale < 20;
    title.active = !replaceTitleArt; readableTitle.node.active = replaceTitleArt;
    if (replaceTitleArt) { readableTitle.node.setPosition(0, h / 2 - 23, 0); readableTitle.node.getComponent(UITransform)!.setContentSize(titleWidth, 24); }
    if (titleLabel) { titleLabel.fontSize = 18 / titleScale; titleLabel.lineHeight = 22 / titleScale; title.getComponent(UITransform)!.setContentSize(titleWidth / titleScale, 24 / titleScale); }
    counter.node.setPosition(0, h / 2 - 46, 0); counter.node.getComponent(UITransform)!.setContentSize(titleWidth, 20);
    for (const [b, x] of [[previous, -w / 2 + 24], [next, w / 2 - 24]] as const) { layoutButton(b.node, 48); b.node.setPosition(x, h / 2 - 28, 0); }
    for (let i = 0; i < actions.length; i++) {
      const side = roomy ? ACTION_SIDE : ACTION_SIDE_TIGHT, span = Math.max(1, w - 2 * side);
      const a = actions[i], width = actions.length === 1 ? Math.min(240, span) : (span - ACTION_GAP) / 2;
      const x = actions.length === 1 ? 0 : (i - 0.5) * (width + ACTION_GAP);
      const bh = specCompact ? ACTION_H_C : ACTION_H;
      layoutButton(a.handle.node, width, undefined, bh, ACTION_ART); actionShadow(a.handle.node, width, bh);
      a.handle.node.setPosition(x, -h / 2 + (roomy ? ACTION_BOTTOM : 12) + bh / 2, 0);
    }
    const stars = groups.ResultStars.node;
    if (m.kind !== 'lose' && dense && !shortPhone && textWidth(scoreText, 20) <= inner - 100) {
      const row = getRow('summary', 48); stars.setScale(0.14, 0.14, 1); add(row, stars, -inner / 2 + 45, -4);
      add(row, scoreLabel.node, 50); scoreLabel.fontSize = 20; scoreLabel.lineHeight = 28;
      scoreLabel.node.getComponent(UITransform)!.setContentSize(inner - 100, 28); rows.push(row);
    } else {
      const starH = shortPhone ? 44 : dense ? 44 : specCompact ? 50 : tight ? 56 : snug ? 64 : 88, starS = shortPhone ? 0.248 : dense ? 0.14 : specCompact ? 0.19 : tight ? 0.2 : snug ? 0.24 : 0.32;
      const row = getRow('stars', starH); stars.setScale(starS, starS, 1); add(row, stars, 0, shortPhone || dense ? -4 : -12); rows.push(row);
      scoreLabel.node.active = false;
      if (m.kind === 'lose') labelRows('ResultMessage', scoreText, 16);
      else {
        // 34/46 is the settled score. A number that cannot stay on one page at that size
        // drops to the 16-unit body so the opening scale (0.92) still clears the 14px floor.
        const big = wrap(scoreText, inner - 4, 34);
        const block = big.length * 46 + Math.max(0, big.length - 1) * rowGap;
        const scoreSize = block <= available ? 34 : 16, scoreLine = scoreSize === 34 ? 46 : 22;
        const lines = scoreSize === 34 ? big : wrap(scoreText, inner - 4, scoreSize);
        for (let i = 0; i < lines.length; i++) {
          const scoreRow = getRow('Score-' + i, scoreLine); scoreRow.keepWithNext = i + 1 < lines.length;
          let l = scoreRow.node.getComponentInChildren(Label);
          if (!l) l = p.text('', 0, 0, scoreSize, 'brown', { name: i ? 'Score-continued-' + i : 'Score', bold: true, width: inner, parent: scoreRow.node });
          l.string = lines[i]; l.fontSize = scoreSize; l.lineHeight = scoreLine; l.enableWrapText = false; l.overflow = Label.Overflow.CLAMP;
          l.node.getComponent(UITransform)!.setContentSize(inner, scoreLine); l.node.setPosition(0, 0, 0); rows.push(scoreRow);
        }
      }
    }
    if (m.kind === 'win') { /* SPEC v2.2: no step line */ }
    else if (m.kind === 'lose') {
      const goals = groups.ResultGoals;
      if (goals) {
        const sourceLabels = goals.original.filter(v => v.font !== undefined);
        for (let i = 0; i < sourceLabels.length; i++) {
          const value = sourceLabels[i].node.getComponent(Label)!;
          const row = getRow('goal-' + i, 40), icon = goalIcons[i];
          if (icon) { fitArt(icon, 32, 32); add(row, icon, -inner / 2 + 24); }
          let l = row.node.getComponentInChildren(Label); if (!l) l = p.text('', 0, 0, 16, 'brown', { name: 'ResultGoalCount-' + i, parent: row.node });
          const long = textWidth(value.string, 16) > inner - 64;
          l.string = long ? '剩余目标' : value.string; l.fontSize = 16; l.lineHeight = 22; l.node.getComponent(UITransform)!.setContentSize(inner - 64, 24); add(row, l.node, 30); rows.push(row);
          if (long) labelRows('ResultGoalCountFull-' + i, value.string);
        }
      }
    } else labelRows('ResultNotice', m.kind === 'unsaved' ? '成绩还没存进旅程册' : '记录暂时不能写入，这局只看不存', 16, 'brown2');
    if (m.chestHint && m.kind !== 'win') labelRows('ResultChestHint', m.kind === 'lose' ? '过关后可以打开宝箱' : '存好后就能打开宝箱', 16, 'brown2');
    const fitBox = (n: Node, boxW: number, boxH: number) => {
      const v = original.get(n), ui = n.getComponent(UITransform)!;
      const ow = Math.max(1, v ? v.width * Math.abs(v.sx) : ui.width * Math.abs(n.scale.x));
      const oh = Math.max(1, v ? v.height * Math.abs(v.sy) : ui.height * Math.abs(n.scale.y));
      const sx = v?.sx ?? 1, sy = v?.sy ?? 1;
      n.setScale(sx * (boxW / ow), sy * (boxH / oh), 1);
    };
    /** The chest (or, with no chest, the floating items) is the claim: an invisible hit area, no button art. */
    const placeTap = (row: Row, y: number, tw: number, th: number) => {
      if (!claimAll || !anyReady()) return;
      const face = claimAll.getChildByName('Face')!;
      for (const c of face.children) c.active = false;
      claimAll.getComponent(UITransform)!.setContentSize(tw, th); face.getComponent(UITransform)!.setContentSize(tw, th);
      add(row, claimAll, 0, y); claimAll.setSiblingIndex(row.node.children.length - 1);
    };
    if (claimAll && !anyReady()) claimAll.active = false;
    const floatIcon = dense || specCompact ? FLOAT_ICON_DENSE : FLOAT_ICON;
    floatNodes = []; floatDiag.length = 0;
    /** Reward items hovering in a centred row: icon above, name under it. */
    const placeFloating = (row: Row, baseY: number, mouthY = baseY - 40, fit = Infinity) => {
      const list = floating(); if (!list.length) return;
      const colW = Math.min(inner / list.length, list.length > 4 ? FLOAT_STEP_MANY : FLOAT_STEP); const icon = Math.max(16, Math.min(list.length > 4 ? 56 : floatIcon, fit - FLOAT_NAME - 12));
      list.forEach((r, k) => {
        const i = m.rewards.indexOf(r), x = (k - (list.length - 1) / 2) * colW;
        let holder = row.node.getChildByName('ResultFloat-' + i);
        const hh = icon + FLOAT_NAME + 12, iconY = hh / 2 - icon / 2;
        if (!holder) holder = uiNode('ResultFloat-' + i, row.node, colW, hh);
        holder.getComponent(UITransform)!.setContentSize(colW, hh); add(row, holder, x, baseY);
        // Plate: 64 × 64 r20 #FFF8E6, 4-unit base #E2C58C, 18-unit outer glow #FFDC78 α90% (not dimmed at night).
        let plate = holder.getChildByName('ResultFloatPlate');
        if (!plate) {
          plate = uiNode('ResultFloatPlate', holder, icon, icon); const pn = plate;
          pn.addComponent(Graphics); (pn as any).__draw = () => {
            const g = pn.getComponent(Graphics)!, ui = pn.getComponent(UITransform)!, s2 = ui.width / 2; g.clear();
            // RewardBadge: glow r40 #FFE28C peak α43% → 6pt base #C4A06C (night #A0805C) → outer #FFF8E4 → inner #FAECCC Ø60/68.
            const night = !!(pn as any).__night, k2 = s2 / 34;
            { const n = 8, st = 1 - Math.pow(1 - BADGE_GLOW_A, 1 / n); for (let k = 0; k < n; k++) { const r = BADGE_GLOW_R * k2 * (1 - k / n) + s2 * (k / n); g.fillColor = new Color(0xFF, 0xE2, 0x8C, Math.round(255 * st)); g.circle(0, 0, r); g.fill(); } }
            g.fillColor = night ? new Color(0xA0, 0x80, 0x5C, 255) : new Color(0xC4, 0xA0, 0x6C, 255); g.circle(0, -6 * k2, s2); g.fill();
            g.fillColor = new Color(0xFF, 0xF8, 0xE4, 255); g.circle(0, 0, s2); g.fill();
            g.fillColor = new Color(0xFA, 0xEC, 0xCC, 255); g.circle(0, 0, s2 * 60 / 68); g.fill();
          };
        }
        delete (plate as any).__floatBase; plate.setScale(1, 1, 1); plate.getComponent(UITransform)!.setContentSize(icon, icon); plate.setPosition(0, iconY, 0); (plate as any).__night = isNight(); (plate as any).__draw(); plate.active = FLOAT_PLATE;
        // Art style stays the game's own: the existing reward icon with the existing fx_rays glow behind it.
        let glow = holder.getChildByName('ResultFloatGlow');
        if (!glow) { glow = p.sprite('popup/fx_rays', 0, 0, icon * 1.6, icon * 1.6, 'half').node; glow.name = 'ResultFloatGlow'; holder.addChild(glow); glow.setSiblingIndex(0); }
        glow.getComponent(UITransform)!.setContentSize(icon * 1.6, icon * 1.6); glow.setPosition(0, iconY, 0); glow.active = !FLOAT_PLATE && r.state !== 'locked';
        for (const n of rewardIcons[i]) {
          if (n.name === 'stamp_claimed') { n.active = false; continue; }
          delete (n as any).__floatBase; fitArt(n, FLOAT_PLATE ? icon * 54 / 68 : icon, FLOAT_PLATE ? icon * 54 / 68 : icon); holder.addChild(n); n.active = true; n.setPosition(0, iconY, 0);
        }
        let l = holder.getChildByName('ResultRewardState-' + i)?.getComponent(Label);
        if (!l) l = p.text('', 0, 0, 16, r.state === 'locked' ? 'grey' : 'brown', { name: 'ResultRewardState-' + i, parent: holder });
        l.string = ''; l.node.active = false; l.fontSize = 16; l.lineHeight = FLOAT_NAME; // SPEC v2.2: icons only, no names
        l.enableWrapText = false; l.overflow = Label.Overflow.CLAMP;
        l.node.getComponent(UITransform)!.setContentSize(colW - 4, FLOAT_NAME); l.node.setPosition(0, -hh / 2 + FLOAT_NAME / 2, 0);
        // CountBadge (count > 1 only): Ø24 at the badge centre +(24, 26 up); #E88034 face, 2pt #B05C1E base, 2pt #FFF8E4 ring, 14pt bold white.
        let cb = holder.getChildByName('ResultCountBadge-' + i);
        if ((r.count || 0) > 1) {
          const k3 = icon / 68;
          if (!cb) { cb = uiNode('ResultCountBadge-' + i, holder, 24, 24); const g = cb.addComponent(Graphics);
            g.fillColor = new Color(0xFF, 0xF8, 0xE4, 255); g.circle(0, -1, 13); g.fill(); g.fillColor = new Color(0xB0, 0x5C, 0x1E, 255); g.circle(0, -2, 10); g.fill(); g.fillColor = new Color(0xE8, 0x80, 0x34, 255); g.circle(0, 0, 10); g.fill();
            const t = p.text(String(r.count), 0, 0, 14, 'white', { name: 'ResultCount', width: 24, parent: cb }); t.lineHeight = 16; t.node.setPosition(0, 0, 0); }
          delete (cb as any).__floatBase; cb.setScale(k3, k3, 1); cb.setPosition(24 * k3, iconY + 26 * k3, 0); cb.active = true; cb.setSiblingIndex(holder.children.length - 1);
        } else if (cb) cb.active = false;
        holder.setSiblingIndex(row.node.children.length - 1); floatNodes.push({ node: holder, x, y: baseY, phase: k * 0.09, fromY: mouthY }); floatDiag.push({ name: r.label, x, y: baseY, icon });
      });
    };
    for (let i = 0; i < rewards.length; i++) {
      const r = m.rewards[i], claim = rewards[i].original.map(v => v.node).find(n => n.name === 'Claim-' + r.id);
      if (claim) claim.active = false; // the chest is the one claim on this page
      if (!isChest(r)) continue;
      let band = floatBand(dense || specCompact), split = false;
      const usedAbove = rows.reduce((sum, row) => sum + row.height + rowGap, 0);
      const labelled = false; // SPEC v2.2: no reward names
      const cwS = specCompact ? CHEST_W_C : CHEST_W, haloS = specCompact ? HALO_C : HALO;
      // Closed: rewards would hover over the halo's top edge. Open: they must clear the raised lid, which reaches 53% of the
      // square chest frame above the chest centre (result_chest.glb at −118°), so the band starts above it.
      let lap = !band ? 0 : r.state === 'claimed' && !specCompact ? -Math.max(0, Math.round(LID_REACH * cwS / CHEST_FRAME.width - haloS / 2)) : Math.round(band * 0.4);
      const after = 0;
      const room = available - usedAbove - (labelled ? 22 + rowGap : 0) - (band - lap) - after;
      const cw0 = specCompact ? CHEST_W_C : CHEST_W, ch0 = specCompact ? CHEST_H_C : CHEST_H, halo = specCompact ? HALO_C : HALO;
      let chestH = Math.max(Math.min(CHEST_MIN_H, ch0), Math.min(ch0, room * ch0 / halo, inner * ch0 / cw0)), chestW = chestH * cw0 / ch0;
      let raySize = Math.min(inner, Math.max(chestH, room), chestH * RAY / ch0), body = Math.min(Math.max(chestH, room), chestH * halo / ch0, inner);
      let rowH = body + band - lap;
      const budget = Math.max(1, available);
      if (rowH > budget && band && budget - band < Math.min(CHEST_MIN_H, ch0)) { split = true; rowH -= band - lap; band = 0; lap = 0; }
      if (rowH > budget) { body = Math.max(1, budget - band + lap); raySize = Math.min(raySize, body); chestH = Math.min(chestH, body); chestW = Math.min(chestW, body); rowH = body + band - lap; }
      if (labelled) labelRows('ResultRewardLabel-' + i, r.label, 16, 'grey');
      const row = getRow('reward-chest', rowH), chestY = -rowH / 2 + body / 2, art = rewardIcons[i], opened = r.state === 'claimed';
      const flat = art.find(n => n.name !== 'stamp_claimed') || art[0];
      // Warm halo under the chest: the light that invites the tap (pulses while the chest is ready).
      // Glow: closed r120 #FFDE8C α82% (night α94%), open r150 #FFD678 α90%. Not night-tinted: at night the chest is the focus.
      if (!haloNode || !isValid(haloNode, true)) {
        haloNode = uiNode('ResultChestHalo', row.node, chestW, chestH); const hn = haloNode; hn.addComponent(Graphics);
        (hn as any).__draw = (open: boolean, night: boolean) => {
          const g = hn.getComponent(Graphics)!, r0 = hn.getComponent(UITransform)!.width / 2, c = open ? [0xFF, 0xD6, 0x78] : [0xFF, 0xDE, 0x8C], a0 = open ? GLOW_A_OPEN : night ? GLOW_A_NIGHT : GLOW_A; g.clear();
          // 16 stacked discs: the centre reaches the peak α, the edge fades out completely (soft, not an ellipse block).
          const n = 16, step = 1 - Math.pow(1 - a0, 1 / n);
          for (let k = 0; k < n; k++) { const f = 1 - k / n; g.fillColor = new Color(c[0], c[1], c[2], Math.round(255 * step)); g.circle(0, 0, r0 * f); g.fill(); }
        };
      }
      const sk = chestW / (specCompact ? CHEST_W_C : CHEST_W), glowD = 2 * Math.min(0.45 * chestW, (specCompact ? GLOW_R_C : opened ? GLOW_R_OPEN : GLOW_R) * sk);
      haloNode.getComponent(UITransform)!.setContentSize(glowD, glowD); add(row, haloNode, 0, chestY + (opened ? GLOW_DY_OPEN : GLOW_DY) * sk); (haloNode as any).__draw(opened, isNight());
      // Contact shadow (SPEC v2.2, 3D only; the 2D fallback art has it baked in): soft ellipse #3C2614 α45% day / 30% night,
      // 220 × 60 for a 220-wide chest, offset to the right/back (light from the top-left), feathered edge.
      let floor = row.node.getChildByName('ResultChestFloor');
      if (!floor) { floor = uiNode('ResultChestFloor', row.node, 220, 60); const fl = floor; fl.addComponent(Graphics); (fl as any).__draw = (night: boolean) => {
        const g = fl.getComponent(Graphics)!, n = 10, a0 = night ? 0.30 : 0.45, st = 1 - Math.pow(1 - a0, 1 / n); g.clear();
        for (let k = 0; k < n; k++) { const f = 1 - k / n * 0.6; g.fillColor = new Color(0x3C, 0x26, 0x14, Math.round(255 * st)); g.ellipse(0, 0, 110 * f, 30 * f); g.fill(); } }; }
      (floor as any).__draw(isNight()); floor.setScale(chestW / 220, chestW / 220, 1); add(row, floor, chestW * 0.06, chestY - chestH / 2 + chestW * 0.06); floor.active = !!chestRig?.ready;
      if (!raysNode || !isValid(raysNode, true)) { raysNode = p.sprite('popup/fx_rays', 0, 0, raySize, raySize, 'half').node; raysNode.name = 'ResultChestRays'; }
      else raysNode.getComponent(UITransform)!.setContentSize(raySize, raySize);
      const rs = Math.min(RAY * sk, inner, rowH); raysNode.getComponent(UITransform)!.setContentSize(rs, rs); add(row, raysNode, 0, Math.max(-rowH / 2 + rs / 2, Math.min(chestY + RAY_LIFT * sk, rowH / 2 - rs / 2))); raysNode.active = opened; // rays only once open
      if (flat) {
        flat.name = 'ResultChestArt';
        // 2D fallback: popup/chest_open once claimed (bottom-aligned with the closed art), popup/chest_closed before.
        const openFrame = opened ? BoardArt.shared().frame('popup/chest_open') : null, sp = flat.getComponent(Sprite);
        if (openFrame && sp) { sp.spriteFrame = openFrame; const ow = chestW * CHEST_OPEN_W, oh = ow * FLAT_OPEN_ASPECT; fitBox(flat, ow, oh); add(row, flat, CHEST_DX * sk, chestY - chestH / 2 + oh / 2); }
        else { fitBox(flat, chestW, chestH); add(row, flat, CHEST_DX * sk, chestY); }
        if (chestRig?.ready) flat.active = false;
      }
      for (let j = 0; j < art.length; j++) { const n = art[j]; if (n !== flat) n.active = false; } // no stamp: the open lid says it
      if (!chestRig) {
        chestRig = new ResultChest3D(row.node, Math.max(chestW, chestH)); chestRig.node.active = false;
        // Claimed: the chest stays open (lid at the end of chest_open) instead of returning to the closed pose.
        if (r.state === 'claimed') chestRig.open(Date.now() - chestTappedAt < 3000); // just tapped: play the lid open; otherwise already open
        const shown = flat;
        const fl0 = floor; void chestRig.load().then(ok => { if (!ok || !chestRig || !isValid(chestRig.node, true)) return; chestRig.node.active = true; if (shown && isValid(shown, true)) shown.active = false; if (fl0 && isValid(fl0, true)) fl0.active = true; });
      } else if (chestRig.node.parent !== row.node) row.node.addChild(chestRig.node);
      // The 512² RenderTexture is square: show it square (no squash) so the closed chest body spans chestW
      // (it fills 60% of the frame width and sits 15.5% below the frame centre, measured on result_chest.glb).
      const frameSide = chestW / CHEST_FRAME.width, frameY = chestY + CHEST_FRAME.offsetY * frameSide;
      chestRig.node.setPosition(CHEST_DX * sk, frameY, 0); chestRig.node.getComponent(UITransform)!.setContentSize(frameSide, frameSide);
      chestPose = { node: chestRig.node, flat: flat || null, y: chestY, rigY: frameY, w: chestW, h: chestH }; if (flat) flatScale = { x: flat.scale.x, y: flat.scale.y };
      guideDiag.pulsing = r.state === 'ready' && anyReady(); guideDiag.chest = { w: chestW, h: chestH, halo: body, hit: Math.max(44, body) };
      // Items hover just above the open lid (lower edge overlaps the chest top by a quarter of the band).
      if (!split) placeFloating(row, rowH / 2 - (floatIcon + FLOAT_NAME + 12) / 2, chestY + chestH * 0.3);
      placeTap(row, chestY, Math.min(inner, Math.max(44, body)), Math.max(44, Math.min(rowH, body)));
      rows.push(row);
      if (split) { const fh = Math.max(1, Math.min(floatBand(true), available)); const fr = getRow('reward-floating', fh); placeFloating(fr, 0, 0, fh); rows.push(fr); }
      // SPEC v2.2: no 点宝箱领取 line; breathing + hop + the glow are the guide.
    }
    if (!hasChest() && sideRewards().length) {
      const fh = Math.max(1, Math.min(floatBand(dense || tight) + 24, available)); const row = getRow('reward-floating', fh); placeFloating(row, 0, -20, fh);
      placeTap(row, 0, inner, row.height); rows.push(row);
    }
    pages = [[]]; let used = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]; let needed = row.height;
      if (row.keepWithNext) for (let j = i + 1; j < rows.length; j++) { needed += rows[j].height + rowGap; if (!rows[j].keepWithNext) break; }
      if (used && used + rowGap + needed > available) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(row); used += row.height + (used ? rowGap : 0);
    }
    page = Math.min(page, pages.length - 1); showPage(); p.tint.update(true);
  });
}
/** The host repaints the result after a claim; the next (claimed) panel plays the lid opening when this is recent. */
let chestTappedAt = -1e12;
function isNight(): boolean { try { const m = (globalThis as any).__worldDayNight?.snapshot?.()?.mode; return typeof m === 'string' && m.includes('night'); } catch { return false; } }
function bounceOut(t: number) { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; }
function backOut(t: number, s = 1.70158) { const u = t - 1; return u * u * ((s + 1) * u + s) + 1; }
function chestLine(p: PopupPanel, y: number, text: string) {
  const s = p.sprite('popup/chest_closed', -150, y, 144, undefined, 'half'); s.grayscale = true; p.tint.setBase(s, [255, 255, 255], 153);
  p.text(text, -60, y, 28, 'brown2', { align: 'left', width: 320, bold: false });
}
function rewardSlot(p: PopupPanel, r: ResultReward, x: number, y: number, legacy: ToolArtSource | null, wide = false) {
  if (r.iconKind === 'tool' && r.tool) toolArt(p, r.tool, x, y - 36, 120, legacy);
  else { const s = p.sprite(r.icon, x, y - 36, r.iconKind === 'seal' ? undefined : 150, r.iconKind === 'seal' ? 112 : undefined, r.iconKind === 'chest' ? 'half' : 'ui'); if (r.state === 'locked') s.grayscale = true; }
  const by = y + 112, bw = wide && r.label.length >= 6 ? 248 : 176;
  if (r.state === 'claimed') p.sprite('popup/stamp_claimed', x + 40, y - 32, 112, 112).node.setRotationFromEuler(0, 0, 12);
  p.text(r.label, x, by, 24, r.state === 'locked' ? 'grey' : 'brown2', { bold: false, width: bw });
}
/** Three stars, middle one larger; empty stars dimmed (alpha 0.75). Chest and stars take the half night tint. */
function stars(p: PopupPanel, cy: number, filled: number): Node[] {
  const out: Node[] = [];
  for (let i = 0; i < 3; i++) {
    const big = i === 1, h = big ? 170 : 132, on = i < filled;
    const s = p.sprite(on ? 'popup/star_full' : 'popup/star_empty', (i - 1) * 170, cy - (big ? 26 : 0), undefined, h, 'half');
    if (!on) p.tint.setBase(s, [235, 235, 235], 191);
    s.node.name = 'Star-' + i; out.push(s.node);
  }
  return out;
}
/** Stars drop in one after another, 0.18 s each (reduced motion: shown at once). */
function dropStars(p: PopupPanel, nodes: Node[]) {
  if (reducedMotion()) return;
  const base = nodes.map(n => n.position.y), ops = nodes.map(n => n.addComponent(UIOpacity));
  for (let i = 0; i < ops.length; i++) ops[i].opacity = 0;
  const update = p.update.bind(p); let t = 0;
  p.update = (dt: number) => {
    update(dt); t += Math.max(0, Math.min(dt, 0.1));
    for (let i = 0; i < nodes.length; i++) {
      if (!isValid(nodes[i], true)) continue; const k = Math.max(0, Math.min(1, (t - 0.2 - i * 0.18) / 0.18)), e = 1 - Math.pow(1 - k, 3);
      nodes[i].setPosition(nodes[i].position.x, base[i] + 60 * (1 - e), 0); ops[i].opacity = Math.round(255 * k); const sc = 1.25 - 0.25 * e; nodes[i].setScale(sc, sc, 1);
    }
  };
}
