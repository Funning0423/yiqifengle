import { Color, Graphics, Label, Node, UIOpacity, UITransform, isValid } from 'cc';
import { GameAudio } from '../audio/GameAudio';
import { PopupPanel, PopupStack, resetPresses, uiNode, measure, type ArtButtonHandle, type ButtonOptions } from './PopupKit';
import { toolArt, type ToolArtSource } from './CommonPanels';
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
export interface ResultReward { id: string; label: string; icon: string; iconKind?: 'chest' | 'seal' | 'tool'; tool?: string; state: 'ready' | 'claimed' | 'locked'; claim?: () => void }
export interface ResultModel {
  kind: ResultKind; score: number; stars: number | null; movesUsed: number | null; movesLeft: number | null;
  goalsLeft: Array<{ art: string; count: number }>; chestHint: boolean; rewards: ResultReward[];
  unlockHint?: string; next?: (() => void) | null; replay?: (() => void) | null; retrySave?: (() => void) | null; home: () => void;
}
const TITLES: Record<ResultKind, [string, string]> = { win: ['过关啦', 'popup/title_4'], lose: ['差一点点', 'popup/title_5'], unsaved: ['还没存上', 'r2/title_unsaved'], readonly: ['旅途回顾', 'r2/title_review'] };
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
    section('ResultDetails', 0, 416, () => {
      const line = (m.movesUsed !== null ? '用了 ' + m.movesUsed + ' 步 · ' : '') + '剩余 ' + (m.movesLeft ?? 0) + ' 步';
      p.sprite('board/icon_moves', -150, 416, undefined, 48).node.name = 'MovesSymbol';
      p.text(line, -118, 416, 28, 'brown', { align: 'left', width: 400, bold: false, name: 'MovesInfo' });
      p.well(0, 472, 196, 48, [224, 238, 232], 24).name = 'SavedWell'; p.text('成绩已保存', 0, 472, 28, 'teal', { bold: false, width: 196, name: 'SavedText' });
    });
    let y = 600;
    if (m.rewards.length) {
      const n = m.rewards.length, step = n === 1 ? 0 : n === 2 ? (wideReward ? 280 : 220) : 200;
      for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * step, name = 'ResultReward-' + i;
        section(name, x, y, () => rewardSlot(p, m.rewards[i], x, y, legacy, wideReward)); rewards.push(groups[name]); }
      y += rewardsH;
    }
    if (m.next) { button('primary', '下一关', y - 24, 480, 104, m.next, { fontSize: 36, name: 'Next' }); button('secondary', '回小岛', y + 96, 320, 88, m.home, { icon: 'popup/icon_home', fontSize: 30, name: 'Home', sound: 'back' }); }
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
  const frame = p.body.getChildByName('PanelFrame')!; frame.setScale(frame.scale.x * 0.45, frame.scale.y * 0.45, 1);
  const plateScales = new Map<Node, number>();
  const buttonTextInset = 16, rewardIconLane = 60;
  const buttonTextWidth = (width: number) => width - buttonTextInset;
  const rewardTextWidth = (cell: number) => buttonTextWidth(cell - rewardIconLane);
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
  const layoutButton = (n: Node, w: number, text?: string) => {
    const plate = n.getChildByName('Face')!.getChildByName('Plate')!;
    if (!plateScales.has(plate)) plateScales.set(plate, plate.scale.x);
    const artScale = plateScales.get(plate)! * (w < 80 ? 0.25 : 0.45); plate.setScale(artScale, artScale, 1);
    fitResultButton(n, w, 48, 16); n.setScale(1, 1, 1);
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
    const rows = pages[page] || []; const used = rows.reduce((sum, row) => sum + row.height + 1, -1);
    let y = contentTop + Math.max(0, (available - used) / 2);
    for (const row of rows) { row.node.active = true; row.node.setPosition(0, p.height / 2 - y - row.height / 2, 0); y += row.height + 1; }
    previous.node.active = next.node.active = counter.node.active = pages.length > 1;
    previous.setEnabled(page > 0); next.setEnabled(page + 1 < pages.length);
    counter.string = `${page + 1} / ${pages.length}`;
  };
  function changePage(delta: number) {
    const target = Math.max(0, Math.min(pages.length - 1, page + delta));
    if (target === page) return;
    resetPresses(p.root); page = target; showPage();
  }
  p.setLayoutStrategy((width, height, safeInsets) => {
    const number = (v: number | undefined) => Number.isFinite(v) ? Math.max(0, v!) : 0;
    const left = number(safeInsets?.left), right = number(safeInsets?.right), bottom = number(safeInsets?.bottom);
    // Reserve the capsule's whole top band: the result title and pager never
    // overlap the system menu even when its horizontal position is asymmetric.
    const top = Math.max(number(safeInsets?.top), number(safeInsets?.capsule?.bottom));
    const w = Math.min(680, Math.max(1, width - left - right - 24));
    const h = Math.min(720, Math.max(1, height - top - bottom - 24));
    return { width: w, height: h, scale: 1, titleY: h / 2 - 23, offsetX: (left - right) / 2, offsetY: (bottom - top) / 2 };
  }, geometry => {
    const key = `${geometry.width}/${geometry.height}`;
    // Opening animation must not rebuild the pages or reset a held finger.
    if (layoutKey === key) return; layoutKey = key;
    resetPresses(p.root);
    const w = geometry.width, h = geometry.height, inner = w - 16, dense = h < 400;
    // 216 × 196 safe rectangle, less the 12-unit frame margin on each side.
    const supported = w >= 192 && h >= 172;
    p.body.getChildByName('TitlePlank')!.active = supported;
    for (const a of actions) a.handle.node.active = supported;
    spaceNotice.node.active = !supported; readableTitle.node.active = false;
    if (!supported) {
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
    available = h - contentTop - 60;
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
      const a = actions[i], width = actions.length === 1 ? Math.min(320, inner) : (inner - 8) / 2;
      const x = actions.length === 1 ? 0 : (i - 0.5) * (width + 8);
      layoutButton(a.handle.node, width); a.handle.node.setPosition(x, -h / 2 + 32, 0);
    }
    const stars = groups.ResultStars.node;
    if (m.kind !== 'lose' && dense && textWidth(scoreText, 20) <= inner - 100) {
      const row = getRow('summary', 48); stars.setScale(0.14, 0.14, 1); add(row, stars, -inner / 2 + 45, -4);
      add(row, scoreLabel.node, 50); scoreLabel.fontSize = 20; scoreLabel.lineHeight = 28;
      scoreLabel.node.getComponent(UITransform)!.setContentSize(inner - 100, 28); rows.push(row);
    } else {
      const row = getRow('stars', dense ? 44 : 116); stars.setScale(dense ? 0.14 : 0.32, dense ? 0.14 : 0.32, 1); add(row, stars, 0, dense ? -4 : -12); rows.push(row);
      scoreLabel.node.active = false;
      // Keep a long numeric score together on a compact page. The readable floor
      // is the same 16-unit body size; ordinary compact scores remain 20 units.
      const scoreSize = m.kind === 'lose' ? 16 : dense ? (available >= 55 && textWidth(scoreText, 20) <= (inner - 4) * 2 ? 20 : 16) : 24;
      labelRows(m.kind === 'lose' ? 'ResultMessage' : 'Score', scoreText, scoreSize);
    }
    if (m.kind === 'win') {
      labelRows('MovesInfo', (m.movesUsed !== null ? '用了 ' + m.movesUsed + ' 步 · ' : '') + '剩余 ' + (m.movesLeft ?? 0) + ' 步');
      labelRows('SavedText', '成绩已保存', 16, 'teal');
    } else if (m.kind === 'lose') {
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
    if (m.kind === 'win' && m.unlockHint) labelRows('ResultUnlockHint', m.unlockHint, 16, 'teal');
    if (m.chestHint && m.kind !== 'win') labelRows('ResultChestHint', m.kind === 'lose' ? '过关后可以打开宝箱' : '存好后就能打开宝箱', 16, 'brown2');
    const paired = rewards.length === 2 && inner >= 400 && m.rewards.every(r => textWidth(r.label, 16) <= rewardTextWidth((inner - 12) / 2));
    const cell = paired ? (inner - 12) / 2 : inner;
    for (let i = 0; i < rewards.length; i++) {
      const columnX = paired ? (i - 0.5) * (cell + 12) : 0;
      const r = m.rewards[i], g = rewards[i], claim = g.original.map(v => v.node).find(n => n.name === 'Claim-' + r.id);
      // Use the actual CLAMP label width, including its padding and icon lane.
      const label = r.label, long = textWidth(label, 16) > rewardTextWidth(cell);
      if (long) labelRows('ResultRewardLabel-' + i, label, 16, r.state === 'locked' ? 'grey' : 'brown2');
      const row = getRow(paired ? 'reward-pair' : 'reward-' + i, 48);
      const art = rewardIcons[i];
      for (const n of art) { fitArt(n, 44, 36); add(row, n, columnX - cell / 2 + 24); }
      if (claim) { layoutButton(claim, cell - rewardIconLane, long ? '领取奖励' : label); add(row, claim, columnX + rewardIconLane / 2); }
      else {
        let l = row.node.getChildByName('ResultRewardState-' + i)?.getComponent(Label); if (!l) l = p.text('', 0, 0, 16, r.state === 'locked' ? 'grey' : 'brown2', { width: cell - 64, name: 'ResultRewardState-' + i, parent: row.node });
        l.string = long ? (r.state === 'claimed' ? '已经领取' : '暂未解锁') : label; l.fontSize = 16; l.lineHeight = 22;
        l.node.getComponent(UITransform)!.setContentSize(cell - 64, 24); add(row, l.node, columnX + 30);
      }
      if (!paired || i === 0) rows.push(row);
    }
    pages = [[]]; let used = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]; let needed = row.height;
      if (row.keepWithNext) for (let j = i + 1; j < rows.length; j++) { needed += rows[j].height + 1; if (!rows[j].keepWithNext) break; }
      if (used && used + 1 + needed > available) { pages.push([]); used = 0; }
      pages[pages.length - 1].push(row); used += row.height + (used ? 1 : 0);
    }
    page = Math.min(page, pages.length - 1); showPage();
  });
}
function chestLine(p: PopupPanel, y: number, text: string) {
  const s = p.sprite('popup/chest_closed', -150, y, 144, undefined, 'half'); s.grayscale = true; p.tint.setBase(s, [255, 255, 255], 153);
  p.text(text, -60, y, 28, 'brown2', { align: 'left', width: 320, bold: false });
}
function rewardSlot(p: PopupPanel, r: ResultReward, x: number, y: number, legacy: ToolArtSource | null, wide = false) {
  if (r.iconKind === 'tool' && r.tool) toolArt(p, r.tool, x, y - 36, 120, legacy);
  else { const s = p.sprite(r.icon, x, y - 36, r.iconKind === 'seal' ? undefined : 150, r.iconKind === 'seal' ? 112 : undefined, r.iconKind === 'chest' ? 'half' : 'ui'); if (r.state === 'locked') s.grayscale = true; }
  const by = y + 112, bw = wide && r.label.length >= 6 ? 248 : 176;
  if (r.state === 'claimed') { p.sprite('popup/stamp_claimed', x + 40, y - 32, 112, 112).node.setRotationFromEuler(0, 0, 12); p.text(r.label, x, by, 24, 'brown2', { bold: false, width: bw }); }
  else if (r.state === 'ready' && r.claim) p.button('secondary', r.label, x, by, bw, 64, r.claim, { fontSize: r.label.length >= 6 ? 24 : 26, name: 'Claim-' + r.id });
  else p.text(r.label, x, by, 24, 'grey', { bold: false, width: bw });
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
