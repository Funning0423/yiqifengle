import { Color, Graphics, Label, Mask, Node, ScrollView, Sprite, SpriteFrame, UIOpacity, UITransform, isValid } from 'cc';
import { GameAudio } from '../audio/GameAudio';
import { BUILD_SHA, BUILD_VERSION } from '../BuildInfo';
import { ResultChest3D } from '../ResultChest3D';
import { TOOL_NAMES } from '../world-r2/ManagedTools';
import { BoardArt, HERO_KEYS, TOOL_KEYS, toolDisplaySize } from './BoardArt';
import { CONTENT_BOTTOM, CONTENT_TOP, PopupPanel, PopupStack, makeLabel, measure, pressable, uiNode } from './PopupKit';
import { markToolSeen, musicOn, reducedMotion, setMusicOn, setReducedMotion, setVibrateEnabled, vibrate, vibrateEnabled } from './UiPrefs';
/** Panels shared by the board and the island (INTEGRATION §3 / r2 / r3): settings, about, licence text, bag, first-get
 *  tool intro and the reward claim ("获得"). Layout numbers are the 750-design px of c-popups/src/compose*.py. */
export interface ToolArtSource { frame(kind: string): SpriteFrame | null }
export function buildLabel(): string { return BUILD_VERSION + ' · 构建 ' + BUILD_SHA; }
export const LICENSES: ReadonlyArray<readonly [string, string, string]> = [
  ['霞鹜文楷 LXGW WenKai', 'SIL OFL 1.1', 'licenses/lxgw-wenkai-ofl'],
  ['Fredoka', 'SIL OFL 1.1', 'licenses/fredoka-ofl'],
  ['Babel 辅助代码', 'MIT', 'licenses/babel-helpers-mit'],
];
/** Seen-tool ids written to qfl.ui.seenTools (art names, INTEGRATION §7 example). */
export const SEEN_ID: Record<string, string> = { bomb: 'starlight', windBell: 'windbell', tideBottle: 'tidebottle' };
export const INTRO_TEXT: Record<string, readonly [string, string]> = {
  bomb: ['轻点任意一格，', '星光会清掉它和四周一圈（3×3）。'],
  windBell: ['轻点一格，', '风铃声沿着这一行和这一列吹开。'],
  tideBottle: ['轻点一格，', '潮水漫过以它为中心的 5×5。'],
};
const TITLE_ART: Record<string, string> = { bomb: 'r2/title_starlight' };
function dayNight(): { mode: string; toggle: () => any } | null {
  const g = (globalThis as any).__worldDayNight; if (!g || typeof g.snapshot !== 'function') return null;
  try { return { mode: g.snapshot()?.mode === 'night' ? 'night' : 'day', toggle: () => g.toggle() }; } catch (e) { return null; }
}
function iconRow(p: PopupPanel, icon: string, label: string, y: number, ih = 56) {
  p.sprite(icon, -340 + 72 + ih / 2, y, undefined, ih); p.text(label, -340 + 72 + ih + 18, y, 32, 'brown', { align: 'left', width: 260 });
}
export function toolArt(p: PopupPanel, kind: string, x: number, y: number, w: number, legacy?: ToolArtSource | null, parent?: Node): Sprite | null {
  const key = TOOL_KEYS[kind];
  if (key && BoardArt.shared().frame(key)) { const box = toolDisplaySize(kind, w); return p.sprite(key, x, y, box.width, box.height, 'ui', parent); }
  const f = legacy?.frame(kind); if (!f) return null;
  const pos = p.at(x, y), n = uiNode('ToolArt-' + kind, parent || p.body, w * 0.78, w * 0.78); n.setPosition(pos[0], pos[1], 0);
  const s = n.addComponent(Sprite); s.sizeMode = Sprite.SizeMode.CUSTOM; s.spriteFrame = f; p.tint.sprite(s, 'ui'); return s;
}
// ---------------- settings ----------------
/** System-panels SPEC §2: one control type (switch) — 音乐 · 音效 · 震动 ┆ 夜色 · 减少动态 ┆ 关于. Whole row is the hit area. */
export const SETTINGS_ROWS = ['MusicToggle', 'SfxToggle', 'VibrateToggle', 'NightToggle', 'ReducedMotion'] as const;
export function openSettings(stack: PopupStack, opts: { onClose?: () => void; onAbout?: () => void } = {}): PopupPanel {
  const RH = 112, y0 = 150, gap = 30, ph = 900;
  const p = stack.open({ name: 'SettingsPanel', height: ph, title: '设置', titleArt: 'popup/title_2', closable: true, onClose: opts.onClose });
  const ys = [y0, y0 + RH, y0 + RH * 2, y0 + RH * 3 + gap, y0 + RH * 4 + gap];
  const row = (i: number, icon: string, label: string, on: boolean, change: (on: boolean) => void, name: string, enabled = true) => {
    const hit = uiNode('Row-' + name, p.body, 600, RH), hp = p.at(0, ys[i]); hit.setPosition(hp[0], hp[1], 0);
    iconRow(p, icon, label, ys[i]);
    const t = p.toggle(236, ys[i], 56, on, change, name);
    if (!enabled) { const op = t.node.addComponent(UIOpacity); op.opacity = 115; t.node.on(Node.EventType.TOUCH_START, (e: any) => { if (e) e.propagationStopped = true; }, null, true); return t; }
    pressable(hit, hit, () => { const v = !t.value(); t.set(v, true); change(v); }, { sound: 'button' });
    return t;
  };
  row(0, 'popup/icon_music', '音乐', musicOn(GameAudio.instance), on => setMusicOn(GameAudio.instance, on), 'MusicToggle');
  row(1, 'popup/icon_sfx', '音效', !(GameAudio.instance?.isSfxMuted() ?? false), on => { GameAudio.instance?.setSfxMuted(!on); }, 'SfxToggle');
  row(2, 'popup/icon_vibrate', '震动', vibrateEnabled(), on => { setVibrateEnabled(on); if (on) vibrate('light'); }, 'VibrateToggle');
  const div = uiNode('Divider', p.body, 540, 4), dp = p.at(0, ys[2] + RH / 2 + gap / 2); div.setPosition(dp[0], dp[1], 0);
  p.tint.shape(div.addComponent(Graphics), (g, night, al) => { const k = 1 - 0.4 * night; g.strokeColor = new Color(Math.round(217 * k), Math.round(191 * k), Math.round(140 * k), Math.round(255 * al)); g.lineWidth = 3; for (let x = -270; x < 270; x += 24) { g.moveTo(x, 0); g.lineTo(x + 12, 0); } g.stroke(); });
  const dn = dayNight();
  row(3, 'popup/icon_moon', '夜色', dn?.mode === 'night', on => { const now = dayNight(); if (!now) return; if ((now.mode === 'night') !== on) { try { now.toggle(); } catch (e) { console.warn('[SETTINGS] day/night', String(e)); } } }, 'NightToggle', !!dn);
  row(4, 'popup/icon_motion', '减少动态', reducedMotion(), on => setReducedMotion(on), 'ReducedMotion');
  const y = ys[4] + RH / 2 + 56;
  const about = uiNode('AboutRow', p.body, 560, 92); const ap = p.at(0, y); about.setPosition(ap[0], ap[1], 0);
  const version = p.text('关于《咦，起风了》 · ' + BUILD_VERSION + ' ›', 0, y, 26, 'brown2', { bold: false, width: 560, name: 'BuildLabel' });
  pressable(about, version.node, () => (opts.onAbout || (() => openAbout(stack)))(), { sound: 'button' });
  return p;
}
// ---------------- about + licences ----------------
export function openAbout(stack: PopupStack): PopupPanel {
  const RH = 72, ph = 104 + 128 + 32 + LICENSES.length * RH + 32 + 40 + 72;
  const p = stack.open({ name: 'AboutPanel', height: ph, title: '关于', titleArt: 'r3/title_about', closable: true });
  if (BoardArt.shared().frame('r3/about_gamename')) p.sprite('r3/about_gamename', 0, 144); else p.text('咦，起风了', 0, 144, 56, 'brown');
  p.text(buildLabel(), 0, 204, 26, 'brown2', { bold: false, name: 'BuildLabel' });
  let y = 264; p.well(0, y + LICENSES.length * RH / 2, 528, LICENSES.length * RH);
  for (let i = 0; i < LICENSES.length; i++) {
    const cy = y + RH * i + RH / 2; p.text(LICENSES[i][0], -232, cy, 28, 'brown', { align: 'left', width: 320 }); p.text(LICENSES[i][1], 232, cy, 24, 'brown2', { align: 'right', width: 200, bold: false });
  }
  y += LICENSES.length * RH + 32;
  const link = p.text('查看许可全文 ›', 0, y + 20, 24, 'teal', { bold: false, name: 'LicenseLink' }); link.node.getComponent(UITransform)!.setContentSize(320, 64);
  pressable(link.node, link.node, () => openLicenses(stack), { sound: 'button' });
  return p;
}
export function openLicenses(stack: PopupStack): PopupPanel {
  const ph = 1040, p = stack.open({ name: 'LicensePanel', height: ph, title: '许可全文', closable: true });
  const w = 560, h = ph - CONTENT_TOP - CONTENT_BOTTOM, view = uiNode('LicenseView', p.body, w, h); const vp = p.at(0, CONTENT_TOP + h / 2); view.setPosition(vp[0], vp[1], 0);
  view.addComponent(Mask);
  const content = uiNode('LicenseContent', view, w, h); content.getComponent(UITransform)!.setAnchorPoint(0.5, 1); content.setPosition(0, h / 2, 0);
  const sv = view.addComponent(ScrollView); sv.content = content; sv.horizontal = false; sv.vertical = true; sv.inertia = true; sv.elastic = true; sv.brake = 0.6;
  const art = BoardArt.shared(); let cursor = 0;
  const add = (text: string, size: number, role: 'brown' | 'brown2') => {
    const lines = Math.max(1, Math.ceil(measure(text, size) / (w - 16)) + (text.split('\n').length - 1)), hh = Math.ceil(lines * size * 1.4) + 8;
    const l = makeLabel(content, text, 0, -cursor - hh / 2, size, { width: w - 8, height: hh, bold: false, lines: Math.max(2, lines) });
    l.overflow = Label.Overflow.RESIZE_HEIGHT; l.horizontalAlign = Label.HorizontalAlign.LEFT; p.tint.label(l, role); cursor += hh + 8;
  };
  const load = (i: number) => {
    if (i >= LICENSES.length || !isValid(content, true)) { content.getComponent(UITransform)!.setContentSize(w, Math.max(h, cursor)); return; }
    void art.text(LICENSES[i][2]).then(text => {
      if (!isValid(content, true)) return;
      add(LICENSES[i][0] + ' · ' + LICENSES[i][1], 28, 'brown');
      const paragraphs = (text || '（许可文本暂时无法读取）').replace(/\r/g, '').split(/\n\s*\n/);
      for (let k = 0; k < paragraphs.length; k++) { const t = paragraphs[k].replace(/\n(?!\s)/g, ' ').trim(); if (t) add(t, 20, 'brown2'); }
      cursor += 24; load(i + 1);
    });
  };
  load(0);
  return p;
}
// ---------------- bag ----------------
const BAG_TOOLS: ReadonlyArray<string> = ['windBell', 'tideBottle', 'tideNet', 'sunSeed', 'starShears'];
export function openBag(stack: PopupStack, journey: any, where: 'island' | 'level', legacy: ToolArtSource | null, openChest?: (level: number) => void): PopupPanel {
  const inv = journey?.inventory || {}, tools = inv.tools || {}, charms: any[] = Array.isArray(inv.charms) ? inv.charms : [];
  const chests: any[] = where === 'level' && openChest ? (journey?.chests || []).filter((c: any) => c.earned && !c.opened) : [];
  const pages = Math.max(1, Math.ceil(chests.length / 2)), chestRows = Math.min(2, chests.length);
  const chestBlock = chestRows ? 48 + chestRows * 96 + (chestRows - 1) * 16 + (pages > 1 ? 64 : 0) : 0;
  const ph = CONTENT_TOP + 400 + (chestBlock ? chestBlock + 48 : 64) + 192 + CONTENT_BOTTOM;
  const p = stack.open({ name: 'BagPanel', height: ph, title: '旅人的行囊', titleArt: 'r2/title_bag', closable: true });
  const CW = 160, CH = 192, G = 16; let y = CONTENT_TOP;
  const rows = [BAG_TOOLS.slice(0, 3), BAG_TOOLS.slice(3)];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r], sx = -(row.length * CW + (row.length - 1) * G) / 2;
    for (let i = 0; i < row.length; i++) {
      const kind = row[i], n = Number(tools[kind]) || 0, zero = n <= 0, cx = sx + i * (CW + G) + CW / 2;
      p.well(cx, y + CH / 2, CW, CH, zero ? [232, 226, 212] : [236, 224, 196]);
      const art = toolArt(p, kind, cx, y + 80, 136, legacy);
      if (art && zero) { art.grayscale = true; p.tint.setBase(art, [255, 255, 255], 128); }
      p.text(TOOL_NAMES[kind] || kind, cx, y + CH - 32, 26, zero ? 'grey' : 'brown');
      const tag = '×' + n, tw = Math.round(measure(tag, 22) + 24);
      p.well(cx + CW / 2 - 8 - tw / 2, y + 8 + 16, tw, 32, zero ? [238, 234, 224] : [250, 245, 232], 16);
      p.text(tag, cx + CW / 2 - 8 - tw / 2, y + 24, 22, zero ? 'grey' : 'brown');
    }
    y += CH + G;
  }
  y -= G;
  if (chestBlock) {
    y += 48; let page = 0; const rowsNode = uiNode('ChestRows', p.body, 600, chestBlock);
    const paint = () => {
      const old = rowsNode.children.slice(); for (let i = 0; i < old.length; i++) old[i].destroy();
      const list = chests.slice(page * 2, page * 2 + 2);
      for (let i = 0; i < list.length; i++) {
        const c = list[i], ry = y + i * 112;
        p.well(0, ry + 48, 528, 96, undefined, 24, rowsNode);
        p.sprite('popup/chest_closed', -264 + 72, ry + 48, 88, undefined, 'half', rowsNode);
        p.text(String(c.level + 1).padStart(2, '0') + ' ' + (c.name || ('第' + (c.level + 1) + '关')), -264 + 136, ry + 48, 26, 'brown', { align: 'left', width: 260, parent: rowsNode });
        const b = p.button('primary', '打开', 264 - 24 - 72, ry + 48, 144, 64, () => { p.close(() => openChest!(c.level)); }, { fontSize: 26, name: 'OpenChest-' + c.level });
        b.node.setParent(rowsNode);
      }
      if (pages > 1) {
        const py = y + chestRows * 112 + 16;
        p.text((page + 1) + ' / ' + pages, 0, py, 24, 'brown2', { parent: rowsNode, bold: false });
        if (page > 0) p.button('secondary', '‹', -120, py, 88, 56, () => { page--; paint(); }, { fontSize: 30, name: 'PrevPage' }).node.setParent(rowsNode);
        if (page + 1 < pages) p.button('secondary', '›', 120, py, 88, 56, () => { page++; paint(); }, { fontSize: 30, name: 'NextPage' }).node.setParent(rowsNode);
      }
    };
    paint(); y += chestBlock - 48 + 48;
  } else y += 64;
  if (charms.length) {
    p.sprite('r2/icon_charm', 0, y + 60, undefined, 112);
    p.text('装扮 ' + charms.length + ' 件', 0, y + 172, 26, 'brown2', { bold: false });
  } else {
    const bow = p.sprite('r2/icon_charm', 0, y + 60, undefined, 112); p.tint.setBase(bow, [255, 255, 255], 128);
    p.text('还没有装扮', 0, y + 172, 26, 'brown2', { bold: false });
  }
  return p;
}
// ---------------- first-get tool intro ----------------
export function openToolIntro(stack: PopupStack, kind: string, done?: () => void): PopupPanel | null {
  const lines = INTRO_TEXT[kind]; if (!lines) return null;
  const ph = 792, finish = () => { markToolSeen(SEEN_ID[kind] || kind); };
  const p = stack.open({ name: 'ToolIntroPanel', height: ph, title: TOOL_NAMES[kind] || kind, titleArt: TITLE_ART[kind] || null, dy: -16, onClose: finish });
  const hy = 96 + 176;
  const rays = p.sprite('popup/fx_rays', 0, hy - 24, 440, 440, 'half'); spin(p, rays.node, 12);
  if (BoardArt.shared().frame(HERO_KEYS[kind])) p.sprite(HERO_KEYS[kind], 0, hy, 360, 360); else toolArt(p, kind, 0, hy, 300, null);
  p.text(lines[0], 0, 512, 30, 'brown', { bold: false }); p.text(lines[1], 0, 560, 30, 'brown', { bold: false, width: 620 });
  p.button('primary', '知道了', 0, 668, 400, 104, () => p.close(done), { fontSize: 38, name: 'GotIt' });
  return p;
}
/** Slow rotation driven from the panel update (fx_rays: one turn per 12 s; reduced motion keeps it still). */
export function spin(p: PopupPanel, n: Node, secondsPerTurn: number) {
  if (reducedMotion()) return;
  const update = p.update.bind(p); let a = 0;
  p.update = (dt: number) => { update(dt); if (!isValid(n, true)) return; a = (a + Math.max(0, Math.min(dt, 0.1)) * 360 / secondsPerTurn) % 360; n.setRotationFromEuler(0, 0, -a); };
}
// ---------------- reward claim ("获得") ----------------
export interface RewardItem { kind: string; count: number; label: string; art?: string | null; seal?: string | null }
export function openReward(stack: PopupStack, items: RewardItem[], legacy: ToolArtSource | null, opts: { chest?: boolean; description?: string; done?: () => void } = {}): PopupPanel {
  const hasChest = opts.chest !== false, n = Math.min(3, items.length);
  const ph = hasChest ? 748 : 652, heroY = hasChest ? 258 : 252, heroSize = n === 1 ? 276 : n === 2 ? 220 : 182, p = stack.open({ name: 'RewardPanel', height: ph, title: '获得', titleArt: 'popup/title_3', dy: 30, onClose: opts.done });
  const mouthY = heroY, chestY = 308, size = 276;
  const rays = p.sprite('popup/fx_rays', 0, mouthY, hasChest ? 460 : 420, hasChest ? 460 : 420, 'half'); const raysOp = rays.node.addComponent(UIOpacity); raysOp.opacity = 0; spin(p, rays.node, 12);
  const shadow = uiNode('ChestShadow', p.body, 300, 60); const sp = p.at(0, chestY + 110); shadow.setPosition(sp[0], sp[1], 0);
  p.tint.shape(shadow.addComponent(Graphics), (g, _n, a) => { for (let i = 0; i < 4; i++) { g.fillColor = new Color(60, 40, 20, Math.round((40 - i * 9) * a)); g.ellipse(0, 0, 150 - i * 18, 26 - i * 4); g.fill(); } });
  shadow.active = hasChest;
  let chest: ResultChest3D | null = null; const fallback = opts.chest === false ? null : (() => { const s = p.sprite('popup/chest_closed', 0, chestY + 30, 300, undefined, 'half'); return s; })();
  if (opts.chest !== false) {
    chest = new ResultChest3D(p.body, size); const cp = p.at(0, chestY); chest.node.setPosition(cp[0], cp[1], 0); p.tint.sprite(chest.sprite, 'half');
    chest.node.active = false;
    void chest.load().then(ok => { if (!ok || !chest || !isValid(chest.node, true)) return; chest.node.active = true; if (fallback && isValid(fallback.node, true)) fallback.node.active = false; chest.open(!reducedMotion()); });
  }
  const xs = n === 1 ? [0] : n === 2 ? [-140, 140] : [-204, 0, 204], ys = n === 3 ? [heroY + 16, heroY - 16, heroY + 16] : [heroY, heroY];
  const itemNodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    const it = items[i], holder = uiNode('Gain-' + it.kind, p.body, heroSize, heroSize); itemNodes.push(holder);
    if (it.seal) p.sprite(it.seal, 0, 0, undefined, heroSize, 'half', holder).node.setPosition(0, 0, 0);
    else { const s = toolArt(p, it.kind, 0, 0, heroSize, legacy, holder); s?.node.setPosition(0, 0, 0); }
    if (!it.seal && it.count > 0) { const b = uiNode('Count', holder, 48, 48); b.setPosition(heroSize * .34, -heroSize * .34, 0); badge(p, b, '×' + it.count); }
    holder.active = false; (holder as any).__to = p.at(xs[i], ys[i % ys.length]);
  }
  const t1 = items.map(it => it.label).join('  ·  ');
  p.text(t1, 0, hasChest ? 492 : 426, 32, 'brown', { width: 620, name: 'GainList' });
  p.text(opts.description || '海风吹开了宝箱，收进行囊吧。', 0, hasChest ? 551 : 485, 28, 'brown2', { bold: false, width: 620 });
  p.button('primary', '收下', 0, ph - 98, 420, 104, () => p.close(), { fontSize: 38, name: 'Accept' });
  const update = p.update.bind(p); let t = 0; const from = p.at(0, mouthY);
  p.update = (dt: number) => {
    update(dt); t += Math.max(0, Math.min(dt, 0.1)); if (chest) chest.update(dt);
    const quick = reducedMotion(), raysK = quick ? 1 : Math.max(0, Math.min(1, (t - 0.35) / 0.3)); if (isValid(raysOp, true)) raysOp.opacity = Math.round(255 * raysK);
    for (let i = 0; i < itemNodes.length; i++) {
      const h = itemNodes[i]; if (!isValid(h, true)) continue; const k = quick ? 1 : Math.max(0, Math.min(1, (t - 0.5 - i * 0.08) / 0.4)), e = 1 - Math.pow(1 - k, 3), to = (h as any).__to;
      h.active = k > 0; h.setPosition(from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, 0); h.setScale(0.6 + 0.4 * e, 0.6 + 0.4 * e, 1);
    }
  };
  const destroy = p.destroy.bind(p); p.destroy = () => { chest?.dispose(); chest = null; destroy(); };
  return p;
}
/** Cream count badge with a dark brown number (INTEGRATION §2 #14). */
export function badge(p: PopupPanel, n: Node, text: string) {
  const r = 22; p.tint.shape(n.addComponent(Graphics), (g, night, a) => {
    g.fillColor = new Color(60, 40, 20, Math.round(70 * a)); g.circle(1, -4, r); g.fill();
    const k = 1 - 0.38 * night; g.fillColor = new Color(Math.round(248 * k), Math.round(242 * k), Math.round(226 * k), Math.round(255 * a)); g.circle(0, 0, r); g.fill();
    g.lineWidth = 3; g.strokeColor = new Color(149, 103, 55, Math.round(255 * a)); g.circle(0, 0, r); g.stroke();
  });
  const l = makeLabel(n, text, 0, 0, 22, { width: 48 }); p.tint.label(l, 'brown');
}
// ---------------- version update (system-panels SPEC §3) ----------------
/** One focus: 「重启更新」; 「稍后」 is a thin text line. No ×, the shade does not close it. */
export const PINWHEEL = { r: 54, glowR: 88, glowBlur: 23, hubR: 7.7, revPerS: 0.5 } as const;
export function openUpdate(stack: PopupStack, apply: () => void, later: () => void): PopupPanel {
  const ph = 640, p = stack.open({ name: 'UpdatePanel', height: ph, title: '', closable: false });
  p.plank.active = false;
  const mill = uiNode('Pinwheel', p.body, 200, 200), mp = p.at(0, 150); mill.setPosition(mp[0], mp[1], 0);
  // SPEC §3 (pt × 750/390): blades R28 → 54 px, glow #FFDC8C α59% R46 blur 12 → 88 / 23 px, hub Ø8 #FFF0CB → r 7.7 px.
  // Graphics has no MSAA here, so edges are feathered: each blade is filled, then stroked 1.6 px at half alpha (≈ 1 px AA ramp).
  const BL: number[][] = [[0xE8, 0x80, 0x34], [0x37, 0x7F, 0x6C], [0xF2, 0xB5, 0x44], [0xC9, 0x77, 0x3A]], R = PINWHEEL.r;
  p.tint.shape(mill.addComponent(Graphics), (g, night, a) => {
    const k = 1 - 0.35 * night;
    for (let i = 0; i < 8; i++) { const u = i / 7, rr = PINWHEEL.glowR - PINWHEEL.glowBlur * (1 - u); g.fillColor = new Color(0xFF, 0xDC, 0x8C, Math.round(255 * 0.59 * a / 8)); g.circle(0, 0, rr); g.fill(); }
    for (let i = 0; i < 4; i++) {
      const c = BL[i], q = i * Math.PI / 2, col = (al: number) => new Color(Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k), Math.round(255 * al * a));
      const path = () => { g.moveTo(0, 0); g.lineTo(Math.cos(q) * R, Math.sin(q) * R); g.lineTo(Math.cos(q + 0.9) * R * 0.62, Math.sin(q + 0.9) * R * 0.62); g.close(); };
      g.fillColor = col(1); path(); g.fill(); g.lineWidth = 1.6; g.strokeColor = col(0.5); path(); g.stroke();
    }
    g.fillColor = new Color(0xFF, 0xF0, 0xCB, Math.round(255 * a)); g.circle(0, 0, PINWHEEL.hubR); g.fill();
    g.lineWidth = 1.4; g.strokeColor = new Color(0xFF, 0xF0, 0xCB, Math.round(128 * a)); g.circle(0, 0, PINWHEEL.hubR + 0.4); g.stroke();
  });
  p.text('新版本已准备好', 0, 286, 42, 'brown', { name: 'UpdateTitle' });
  p.text('重启后即可体验新版本。', 0, 362, 30, 'brown2', { bold: false, name: 'UpdateLine' });
  p.button('primary', '重启更新', 0, 470, 460, 108, () => p.close(apply), { fontSize: 36, name: 'ApplyUpdate' });
  const l = p.text('稍后', 0, 572, 28, 'brown2', { bold: false, name: 'UpdateLater' }); l.node.getComponent(UITransform)!.setContentSize(250, 92);
  pressable(l.node, l.node, () => p.close(later), { sound: 'back' });
  const update = p.update.bind(p); let t = 0;
  p.update = (dt: number) => { update(dt); t += Math.max(0, Math.min(dt, 0.1)); if (isValid(mill, true) && !reducedMotion()) mill.angle = -360 * PINWHEEL.revPerS * t; };
  return p;
}
