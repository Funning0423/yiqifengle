import { Color, Graphics, Label, Node, UIOpacity, UITransform, isValid } from 'cc';
import { GameAudio } from '../audio/GameAudio';
import { PopupPanel, PopupStack, popupScale, uiNode, measure, type ArtButtonHandle, type ButtonOptions } from './PopupKit';
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
  next?: (() => void) | null; replay?: (() => void) | null; retrySave?: (() => void) | null; home: () => void;
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
function restoreResultNodes(saved: ResultPose[]) {
  for (const v of saved) { const n = v.node; if (n.name !== 'Face') n.setPosition(v.x, v.y, 0); n.setScale(v.sx, v.sy, 1); n.getComponent(UITransform)?.setContentSize(v.width, v.height);
    const l = n.getComponent(Label); if (l && v.font !== undefined) { l.fontSize = v.font; l.lineHeight = v.line!; l.enableWrapText = v.wrap!; l.overflow = v.overflow!; }
  }
}
function fitResultButton(node: Node, width: number, height: number, font?: number) {
  node.getComponent(UITransform)!.setContentSize(width, height);
  const face = node.getChildByName('Face')!; face.getComponent(UITransform)!.setContentSize(width, height);
  const plate = face.getChildByName('Plate')!; plate.getComponent(UITransform)!.setContentSize(width / plate.scale.x, height / plate.scale.y);
  const label = face.getChildByName('Label')?.getComponent(Label);
  if (label) { if (font) { label.fontSize = font; label.lineHeight = Math.round(font * 1.4); } label.node.getComponent(UITransform)!.setContentSize(width - 40, label.lineHeight); }
}
/** Result-specific responsive reflow. Buttons retain the kit's pointer/modal guards.
 * The title protrusion participates in viewport fitting; touch minima are physical
 * UI pixels and include the smallest 0.92 opening scale. No other popup is resized. */
function configureResultLayout(p: PopupPanel, originalHeight: number, m: ResultModel, groups: Record<string, ResultSection>, actions: ResultAction[], rewards: ResultSection[]) {
  const safe = 12, titleOverhang = 52.5; let landscape = false, short = false, portraitY: number[] = [];
  const actionPositions = (s: number) => {
    const hit = 44 / (s * 0.92), gap = 8 / (s * 0.92), ys: number[] = [];
    let prev = m.kind === 'win' && rewards.length ? 712 : -Infinity, prevH = Math.max(88, hit);
    for (const a of actions) { const h = Math.max(a.height, hit), y = Math.max(a.y, prev + (prevH + h) / 2 + gap); ys.push(y); prev = y; prevH = h; }
    return ys;
  };
  p.setLayoutStrategy((width, height) => {
    landscape = width > height;
    let s: number, w: number, h: number;
    if (landscape) {
      // Wider columns use available width instead of shrinking a tall single column.
      s = Math.min(0.62, Math.max(0.5, (height - safe * 2) / (516 + titleOverhang)));
      w = Math.min(1000, (width - safe * 2) / s); h = Math.min(516, (height - safe * 2) / s - titleOverhang);
      // The long layout must fit claim→Next even at the 0.92 opening scale.
      // Growing 44px hit boxes after layout cannot be allowed to overlap here.
      const openingScale = s * 0.92, minimumHit = 44 / openingScale;
      const claimToNext = (Math.max(88, minimumHit) + Math.max(104, minimumHit)) / 2 + 8 / openingScale;
      short = h < 218 + 180 + claimToNext;
    } else {
      s = Math.min(popupScale(width, height), (width - safe * 2) / 680); w = 680; h = originalHeight;
      for (let i = 0; i < 12; i++) { portraitY = actionPositions(s); h = originalHeight + (portraitY[portraitY.length - 1] - actions[actions.length - 1].y); s = Math.min(s, (height - safe * 2) / (h + titleOverhang)); }
      portraitY = actionPositions(s); h = originalHeight + (portraitY[portraitY.length - 1] - actions[actions.length - 1].y); short = false;
    }
    const lower = -height / 2 + safe + h * s / 2, upper = height / 2 - safe - (h / 2 + titleOverhang) * s;
    return { width: w, height: h, scale: s, offsetY: Math.max(lower, Math.min(upper, 0)) };
  }, geometry => {
    for (const g of Object.values(groups)) { restoreResultNodes(g.original); const pos = p.at(g.x, g.y); g.node.setPosition(pos[0], pos[1], 0); }
    for (const a of actions) restoreResultNodes(a.original);
    const place = (name: string, x: number, y: number, scale = 1) => { const g = groups[name]; if (!g) return; const pos = p.at(x, y); g.node.setPosition(pos[0], pos[1], 0); g.node.setScale(scale, scale, 1); };
    const labelSize = (name: string, size: number, width: number) => { const n = p.body.getChildByName(name) || Object.values(groups).map(g => g.node.getChildByName(name)).find(Boolean); const l = n?.getComponent(Label); if (l) { l.fontSize = Math.min(size, (width - 8) / Math.max(1, measure(l.string, 1))); l.lineHeight = Math.round(l.fontSize * 1.4); n!.getComponent(UITransform)!.setContentSize(width, l.lineHeight); } };
    if (!landscape) {
      for (let i = 0; i < actions.length; i++) { const pos = p.at(0, portraitY[i]); actions[i].handle.node.setPosition(pos[0], pos[1], 0); }
    } else {
      const w = geometry.width, h = geometry.height, left = -w / 4, right = w / 4, lane = w / 2 - 32;
      place('ResultStars', left, short ? 112 : 154, short ? 0.45 : 0.7);
      place('ResultScore', m.kind === 'lose' ? right : left, m.kind === 'lose' ? 112 : short ? 174 : 272);
      labelSize('Score', short ? 40 : 64, lane); labelSize('ResultMessage', short ? 24 : 28, lane);
      labelSize('MovesInfo', 28, Math.min(400, lane / 2 + 118));
      place('ResultDetails', left, short ? 224 : 350);
      if (short && groups.ResultDetails) {
        const g = groups.ResultDetails.node;
        labelSize('MovesInfo', 24, lane - 40); labelSize('SavedText', 24, lane);
        for (const name of ['SavedText', 'SavedWell']) { const n = g.getChildByName(name); if (n) n.setPosition(n.position.x, -28, 0); }
        const well = g.getChildByName('SavedWell'); well?.setScale(0.8, 0.75, 1);
        const moves = g.getChildByName('MovesInfo')!; moves.setPosition(-lane / 2 + 40, 0, 0);
        const icon = g.getChildByName('MovesSymbol')!; icon.setPosition(-lane / 2 + 16, 0, 0); icon.setScale(0.5, 0.5, 1);
      }
      place('ResultGoals', left, short ? 178 : 326, short ? 0.65 : 0.9);
      place('ResultChest', left, short ? 244 : 430);
      if (groups.ResultChest) for (const n of groups.ResultChest.node.children) {
        if (n.getComponent(Label)) { n.setPosition(-lane / 2 + (short ? 64 : 84), 0, 0); n.getComponent(UITransform)!.setContentSize(lane - (short ? 80 : 100), 40); }
        else { n.setPosition(-lane / 2 + 24, 0, 0); n.setScale(short ? 0.33 : 0.6, short ? 0.33 : 0.6, 1); }
      }
      place('ResultNotice', right, short ? 132 : 160, Math.min(short ? 0.8 : 1, lane / 510));
      for (let i = 0; i < rewards.length; i++) {
        const g = rewards[i], n = rewards.length, cell = (lane - (n - 1) * 16) / n, x = right + (i - (n - 1) / 2) * (cell + 16);
        place(g.node.name, x, short ? 136 : 154);
        for (const child of g.node.children) {
          if (child.name.startsWith('Claim-')) { child.setPosition(0, -64, 0); const text = child.getChildByName('Face')?.getChildByName('Label')?.getComponent(Label)?.string || ''; fitResultButton(child, Math.min(248, cell), 64, Math.min(28, (cell - 40) / Math.max(1, text.length))); }
          else if (child.getComponent(Label)) { child.setPosition(0, -64, 0); child.getComponent(UITransform)!.setContentSize(cell, 40); }
          else child.setScale(child.scale.x * (short ? 0.6 : 0.8), child.scale.y * (short ? 0.6 : 0.8), 1);
        }
      }
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i], x = short ? (actions.length === 1 ? 0 : (i - 0.5) * w / 2) : right;
        const y = short ? h - 60 : actions.length === 1 ? h - 70 : h - 180 + i * 120, pos = p.at(x, y);
        a.handle.node.setPosition(pos[0], pos[1], 0); fitResultButton(a.handle.node, Math.min(a.width, lane), short ? 96 : a.height);
      }
    }
    // Compact decoration may shrink; explanatory words must not inherit that scale.
    for (const name of ['ResultChest', 'ResultNotice']) {
      const group = groups[name]; if (!group) continue;
      for (const n of group.node.children) { const label = n.getComponent(Label); if (!label) continue;
        let scale = 1; for (let a: Node | null = n; a; a = a.parent) scale *= a.scale.y;
        label.fontSize = Math.max(label.fontSize, 12 / Math.abs(scale)); label.lineHeight = Math.round(label.fontSize * 1.4);
        const ui = n.getComponent(UITransform)!, lines = Math.max(1, Math.ceil(measure(label.string, label.fontSize) / Math.max(1, ui.width)));
        label.enableWrapText = lines > 1; label.overflow = lines > 1 ? Label.Overflow.CLAMP : Label.Overflow.NONE;
        ui.setContentSize(ui.width, label.lineHeight * lines);
      }
    }
    // Only hit nodes grow: the original art is not globally scaled down to make room.
    const buttons = actions.map(a => a.handle.node).concat(rewards.reduce((all, g) => all.concat(g.node.children.filter(n => n.name.startsWith('Claim-'))), [] as Node[]));
    for (const n of buttons) { let sx = 1, sy = 1; for (let a: Node | null = n; a; a = a.parent) { sx *= a.scale.x; sy *= a.scale.y; }
      const ui = n.getComponent(UITransform)!; ui.setContentSize(Math.max(ui.width, 44 / Math.abs(sx)), Math.max(ui.height, 44 / Math.abs(sy)));
      const face = n.getChildByName('Face')!, label = face.getChildByName('Label')?.getComponent(Label);
      if (label) { const width = face.getComponent(UITransform)!.width, available = label.horizontalAlign === Label.HorizontalAlign.LEFT ? width / 2 - label.node.position.x - 12 : width - 24;
        label.fontSize = Math.min(Math.max(label.fontSize, 12 / Math.abs(sy)), Math.max(1, available) / Math.max(1, measure(label.string, 1))); label.lineHeight = Math.round(label.fontSize * 1.4);
        label.node.getComponent(UITransform)!.setContentSize(Math.max(1, available), label.lineHeight); }
    }
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
