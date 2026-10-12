import { Color, Graphics, Node, UIOpacity, isValid } from 'cc';
import { GameAudio } from '../audio/GameAudio';
import { PopupPanel, PopupStack, uiNode } from './PopupKit';
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
  const rewardsH = m.kind === 'win' && m.rewards.length ? 200 : 0, nextH = m.kind === 'win' && !m.next ? -120 : 0;
  const ph = m.kind === 'win' ? 808 + rewardsH + nextH : m.kind === 'lose' ? (m.chestHint ? 920 : 808) - (m.replay ? 0 : 120) : m.kind === 'unsaved' ? (m.chestHint ? 880 : 768) : 680;
  const p = stack.open({ name: 'ResultPanel', height: ph, title: TITLES[m.kind][0], titleArt: TITLES[m.kind][1] });
  const starNodes = stars(p, 184, m.kind === 'lose' ? 0 : m.stars ?? 0);
  let y = 336;
  if (m.kind === 'lose') p.text('步数用完了，换个顺序试试？', 0, y, 28, 'brown', { bold: false });
  else p.text(m.score + ' 分', 0, y, 64, 'brown', { name: 'Score' });
  y = 416;
  if (m.kind === 'win') {
    const line = (m.movesUsed !== null ? '用了 ' + m.movesUsed + ' 步 · ' : '') + '剩余 ' + (m.movesLeft ?? 0) + ' 步';
    p.sprite('board/icon_moves', -150, y, undefined, 48); p.text(line, -118, y, 28, 'brown', { align: 'left', width: 400, bold: false });
    p.well(0, 472, 196, 48, [224, 238, 232], 24); p.text('成绩已保存', 0, 472, 28, 'teal', { bold: false });
    y = 600;
    if (m.rewards.length) {
      const n = m.rewards.length, step = n === 1 ? 0 : n === 2 ? 220 : 200;
      for (let i = 0; i < n; i++) rewardSlot(p, m.rewards[i], (i - (n - 1) / 2) * step, y, legacy);
      y += rewardsH;
    }
    if (m.next) { p.button('primary', '下一关', 0, y - 24, 480, 104, m.next, { fontSize: 36, name: 'Next' }); p.button('secondary', '回小岛', 0, y + 96, 320, 88, m.home, { icon: 'popup/icon_home', fontSize: 30, name: 'Home', sound: 'back' }); }
    else p.button('primary', '回小岛', 0, y - 24, 480, 104, m.home, { icon: 'popup/icon_home', fontSize: 36, name: 'Home', sound: 'back' });
  } else if (m.kind === 'lose') {
    const goals = m.goalsLeft.slice(0, 2);
    for (let i = 0; i < goals.length; i++) { const cx = goals.length === 1 ? 0 : -112 + i * 224; p.sprite(goals[i].art, cx - 32, 440, 96, 96); p.text('×' + goals[i].count, cx + 24, 440, 40, 'brown', { align: 'left', width: 120 }); }
    let by = 688;
    if (m.chestHint) chestLine(p, 568, '过关后可以打开'); else by = 576;
    if (m.replay) p.button('primary', '再试一次', 0, by, 480, 104, m.replay, { icon: 'popup/icon_play', fontSize: 36, name: 'Replay' });
    p.button(m.replay ? 'secondary' : 'primary', '回小岛', 0, m.replay ? by + 120 : by, m.replay ? 320 : 480, m.replay ? 88 : 104, m.home, { icon: 'popup/icon_home', fontSize: 30, name: 'Home', sound: 'back' });
  } else if (m.kind === 'unsaved') {
    const n = uiNode('Warn', p.body, 36, 36), wp = p.at(-198, 424); n.setPosition(wp[0], wp[1], 0);
    p.tint.shape(n.addComponent(Graphics), (g, _n, a) => { g.fillColor = new Color(232, 150, 70, Math.round(255 * a)); g.circle(0, 0, 18); g.fill(); });
    p.text('!', -198, 424, 26, 'white');
    p.text('成绩还没存进旅程册', -170, 424, 28, 'brown', { align: 'left', width: 400, bold: false });
    let by = 656; if (m.chestHint) chestLine(p, 536, '存好后就能打开'); else by = 544;
    p.button('primary', '重试保存', 0, by, 480, 104, () => m.retrySave?.(), { fontSize: 36, name: 'RetrySave' });
    p.button('secondary', '返回海岛', 0, by + 120, 320, 88, m.home, { icon: 'popup/icon_home', fontSize: 30, name: 'Home', sound: 'back' });
  } else {
    p.sprite('r2/icon_lock', -228, 424, undefined, 36); p.text('记录暂时不能写入，这局只看不存', -200, 424, 28, 'brown2', { align: 'left', width: 460, bold: false });
    p.button('primary', '返回海岛', 0, 552, 440, 104, m.home, { icon: 'popup/icon_home', fontSize: 36, name: 'Home', sound: 'back' });
  }
  dropStars(p, starNodes);
  return p;
}
function chestLine(p: PopupPanel, y: number, text: string) {
  const s = p.sprite('popup/chest_closed', -150, y, 144, undefined, 'half'); s.grayscale = true; p.tint.setBase(s, [255, 255, 255], 153);
  p.text(text, -60, y, 28, 'brown2', { align: 'left', width: 320, bold: false });
}
function rewardSlot(p: PopupPanel, r: ResultReward, x: number, y: number, legacy: ToolArtSource | null) {
  if (r.iconKind === 'tool' && r.tool) toolArt(p, r.tool, x, y - 20, 120, legacy);
  else { const s = p.sprite(r.icon, x, y - 20, r.iconKind === 'seal' ? undefined : 150, r.iconKind === 'seal' ? 112 : undefined, r.iconKind === 'chest' ? 'half' : 'ui'); if (r.state === 'locked') s.grayscale = true; }
  if (r.state === 'claimed') { p.sprite('popup/stamp_claimed', x + 40, y - 40, 112, 112).node.setRotationFromEuler(0, 0, 12); p.text(r.label, x, y + 76, 24, 'brown2', { bold: false, width: 200 }); }
  else if (r.state === 'ready' && r.claim) p.button('secondary', r.label, x, y + 76, 176, 64, r.claim, { fontSize: 26, name: 'Claim-' + r.id });
  else p.text(r.label, x, y + 76, 24, 'grey', { bold: false, width: 200 });
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
