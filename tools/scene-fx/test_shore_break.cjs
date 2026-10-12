'use strict';
/** Shore wash: one flat sheet timed to amb_waves_loop (8.064 s), not a second ocean and not a second night sea.
 * CPU only. Usage: node tools/scene-fx/test_shore_break.cjs
 * Optional occlusion uses tools/camera-frame-test/glb_geometry.cjs (draco3d). */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const root = path.resolve(__dirname, '..', '..');
const scripts = path.join(root, 'creator-build-project/assets/scripts');
const ts = require('../qf-env.cjs').typescript();
const ASPECT = 586 / 1266;

function loadTs(rel, target) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shore-'));
  const js = ts.transpileModule(fs.readFileSync(path.join(scripts, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: target } }).outputText;
  const file = path.join(tmp, 'm.js'); fs.writeFileSync(file, js); return require(file);
}
function dist2(a, b) { const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2]; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
function verts(g) {
  const out = [];
  for (let i = 0; i < g.positions.length; i += 3) {
    const v = i / 3;
    out.push({ p: [g.positions[i], g.positions[i + 1], g.positions[i + 2]], a: g.colors[v * 4 + 3], rgb: [g.colors[v * 4], g.colors[v * 4 + 1], g.colors[v * 4 + 2]] });
  }
  return out;
}
function normals(g) {
  let pos = 0, neg = 0, deg = 0;
  for (let i = 0; i < g.indices.length; i += 3) {
    const ia = g.indices[i], ib = g.indices[i + 1], ic = g.indices[i + 2];
    const ax = g.positions[ia * 3], ay = g.positions[ia * 3 + 1], az = g.positions[ia * 3 + 2];
    const bx = g.positions[ib * 3], by = g.positions[ib * 3 + 1], bz = g.positions[ib * 3 + 2];
    const cx = g.positions[ic * 3], cy = g.positions[ic * 3 + 1], cz = g.positions[ic * 3 + 2];
    const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    if (nx * nx + ny * ny + nz * nz < 1e-12) { deg++; continue; }
    if (ny > 0) pos++; else neg++;
  }
  return { pos: pos, neg: neg, deg: deg };
}
function layersOf() {
  const text = fs.readFileSync(path.join(scripts, 'world-r1/FirstsliceFacts.ts'), 'utf8');
  const out = { exterior: [], interior: [], backdrop: [], door: [] };
  const re = /"name": "([^"]+)",\s*"layer": "([^"]+)"/g; let m;
  while ((m = re.exec(text))) if (out[m[2]]) out[m[2]].push(m[1]);
  return out;
}
(async () => {
  const checks = [], check = (name, ok, detail) => { checks.push({ name: name, ok: !!ok, detail: detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(28) + ' ' + JSON.stringify(detail)); };
  const C = loadTs('render/ShoreBreakCore.ts', ts.ScriptTarget.ES2020);
  const C5 = loadTs('render/ShoreBreakCore.ts', ts.ScriptTarget.ES5);
  const P = loadTs('world-r1/CameraPose.ts', ts.ScriptTarget.ES2020);
  const Reg = loadTs('world-r1/RegionCameraData.ts', ts.ScriptTarget.ES2020);
  const S = C.SHORE, hitA = S.swells[0].hit, hitB = S.swells[1].hit;

  let phaseDiff = 0;
  for (let i = 0; i < 40; i++) {
    const t = i * 0.2, a = C.shorePhase(t), b = C5.shorePhase(t);
    phaseDiff = Math.max(phaseDiff, Math.abs(a.strength - b.strength), Math.abs(a.travel - b.travel), Math.abs(a.line01.strength - b.line01.strength), Math.abs(a.line02.travel - b.line02.travel));
  }
  check('es5-phase', phaseDiff < 1e-9 && C.shoreBandGeometry(3).positions.length === C5.shoreBandGeometry(3).positions.length && C.farShoreGeometry().indices.length === C5.farShoreGeometry().indices.length, { phaseDiff: phaseDiff });

  const a = C.shorePhase(hitA), b = C.shorePhase(hitB), q = C.shorePhase(4.6), q2 = C.shorePhase(4.0);
  check('hit-a-on-sand', a.line01.strength > 0.99 && a.line01.travel > 0.99 && a.line02.strength < 0.02 && a.strength > 0.99, { a: a });
  check('hit-b-on-sand', b.line02.strength > 0.99 && b.line02.travel > 0.99 && b.line01.strength < 0.02, { b: b });
  check('quiet-between-swells', q.strength < 0.02 && q.line01.strength < 0.02 && q.line02.strength < 0.02 && q2.strength < 0.02, { q: q, q2: q2 });
  let period = 0;
  for (let i = 0; i < 20; i++) {
    const t = i * 0.37, p0 = C.shorePhase(t), p1 = C.shorePhase(t + S.loopS);
    period = Math.max(period, Math.abs(p0.strength - p1.strength), Math.abs(p0.travel - p1.travel), Math.abs(p0.line01.strength - p1.line01.strength), Math.abs(p0.line02.strength - p1.line02.strength));
  }
  const plus12 = C.shorePhase(hitA + 12);
  check('period-is-8.064', period < 1e-9, { period: period, loopS: S.loopS });
  check('not-the-12s-clip', plus12.line01.strength < 0.05 && plus12.line02.strength > 0.9, { atHitPlus12: plus12 });

  const early = C.shorePhase(hitA - S.swells[0].attack * 0.70);
  const waterE = C.bandAlpha(early.strength, early.travel, 0, S.shorePeak);
  const sandE = C.bandAlpha(early.strength, early.travel, 1, S.shorePeak);
  check('attack-starts-offshore', early.travel < 0.45 && early.travel > 0.05 && waterE > sandE * 8 && waterE > 0.02, { early: early, waterE: +waterE.toFixed(4), sandE: +sandE.toFixed(6) });
  const mid = C.shorePhase(hitA - S.swells[0].attack * 0.5);
  const m0 = C.bandAlpha(mid.strength, mid.travel, 0, S.shorePeak), m42 = C.bandAlpha(mid.strength, mid.travel, 0.42, S.shorePeak), m1 = C.bandAlpha(mid.strength, mid.travel, 1, S.shorePeak);
  check('wash-crosses-mid-beach', m42 > m0 && m42 > m1, { mid: mid, m0: +m0.toFixed(4), m42: +m42.toFixed(4), m1: +m1.toFixed(4) });
  const sandH = C.bandAlpha(1, 1, 1, S.shorePeak), waterH = C.bandAlpha(1, 1, 0, S.shorePeak);
  const release = C.shorePhase(hitA + 0.45);
  const sandR = C.bandAlpha(release.strength, release.travel, 1, S.shorePeak), waterR = C.bandAlpha(release.strength, release.travel, 0, S.shorePeak);
  check('crash-lands-on-sand', sandH > 0.7 && sandH > waterH * 20 && release.travel > 0.99 && sandR > waterR * 10 && sandR < sandH, { sandH: +sandH.toFixed(3), waterH: +waterH.toFixed(5), release: release, sandR: +sandR.toFixed(3) });

  const day = C.foamMultiply(0), night = C.foamMultiply(1), half = C.foamMultiply(0.5);
  check('night-is-multiply', day[0] === 1 && day[1] === 1 && day[2] === 1 && Math.abs(night[0] - 0.35) < 1e-12 && Math.abs(night[1] - 0.48) < 1e-12 && Math.abs(night[2] - 0.64) < 1e-12 && night[0] < 0.5 && night[1] < 0.5 && night[2] < 0.5 && Math.abs(half[0] - (1 + 0.5 * (0.35 - 1))) < 1e-12 && Math.abs(half[2] - (1 + 0.5 * (0.64 - 1))) < 1e-12, { day: day, night: night, half: half });

  const sunk = C.waveLinePose(0, 0), up = C.waveLinePose(1, 1), tiny = C.waveLinePose(0.02, 1), midLine = C.waveLinePose(1, 0);
  check('wave-line-follows-swell', Math.abs(sunk.y - S.sinkY) < 1e-9 && Math.abs(sunk.scale - S.sinkScale) < 1e-9 && Math.abs(up.y - S.riseY1) < 1e-9 && Math.abs(up.scale - S.riseScale) < 1e-9 && Math.abs(tiny.y - S.sinkY) < 1e-9 && Math.abs(midLine.y - S.riseY0) < 1e-9 && up.y > sunk.y && up.scale < sunk.scale, { sunk: sunk, up: up, tiny: tiny, midLine: midLine });

  check('playhead-locks-clock', Math.abs(C.stepShoreClock(1, 0.5, 6.3) - C.wrapLoop(6.3)) < 1e-12 && Math.abs(C.stepShoreClock(1, 0.5, null) - 1.5) < 1e-12 && Math.abs(C.stepShoreClock(0, 5, null) - 0.1) < 1e-12 && Math.abs(C.wrapLoop(-0.064) - (S.loopS - 0.064)) < 1e-9 && Math.abs(C.stepShoreClock(1, 0.2, NaN) - 1.2) < 1e-12, { wrap0: C.wrapLoop(0), wrapLoop: C.wrapLoop(S.loopS) });

  const homeL = C.washVisible(false, true, 1), isleL = C.washVisible(true, true, 1), noneL = C.washVisible(false, false, 1), quietL = C.washVisible(true, true, 0), doorL = C.washVisible(true, true, 0.5);
  check('home-far-only', homeL.shore === false && homeL.far === true && isleL.shore === true && isleL.far === true && doorL.shore === true && noneL.shore === false && noneL.far === false && quietL.shore === false && quietL.far === false, { homeL: homeL, isleL: isleL, noneL: noneL, quietL: quietL });

  const kept = C.keptShoreLips(), keptDeg = {};
  for (let i = 0; i < kept.length; i++) keptDeg[kept[i][0]] = 1;
  check('beach-kept-cliffs-dropped', keptDeg[-12] && keptDeg[-4] && keptDeg[4] && keptDeg[12] && keptDeg[20] && !keptDeg[-124] && !keptDeg[76] && !keptDeg[84] && kept.length < S.lip.length, { kept: kept.length, lip: S.lip.length });

  const bands = []; let shoreVerts = 0, shoreTris = 0, badHouse = 0, badY = 0, badRgb = 0, badIndex = 0, negN = 0, posN = 0;
  const H = S.house;
  for (let i = 0; i < S.bands.length; i++) {
    const g = C.shoreBandGeometry(i); bands.push(g); shoreVerts += g.positions.length / 3; shoreTris += g.indices.length / 3;
    const n = normals(g); posN += n.pos; negN += n.neg;
    if (g.colors.length !== g.positions.length / 3 * 4 || g.indices.length % 3) badIndex++;
    for (let k = 0; k < g.indices.length; k++) if (g.indices[k] < 0 || g.indices[k] >= g.positions.length / 3) badIndex++;
    const vs = verts(g);
    for (let v = 0; v < vs.length; v++) {
      const p = vs[v].p;
      if (!(p[1] > -0.9 && p[1] < 0.45) || !isFinite(p[0] + p[1] + p[2])) badY++;
      if (vs[v].a > 0.05 && p[0] >= H.minX && p[0] <= H.maxX && p[2] >= H.minZ && p[2] <= H.maxZ) badHouse++;
      if (Math.abs(vs[v].rgb[0] - S.foamRgb[0]) > 1e-6 || Math.abs(vs[v].rgb[1] - S.foamRgb[1]) > 1e-6 || Math.abs(vs[v].rgb[2] - S.foamRgb[2]) > 1e-6) badRgb++;
    }
  }
  const far = C.farShoreGeometry(); const fn = normals(far); posN += fn.pos; negN += fn.neg;
  const farVs = verts(far);
  for (let v = 0; v < farVs.length; v++) if (!(farVs[v].p[1] > -0.9 && farVs[v].p[1] < 0) || Math.abs(farVs[v].p[1] - S.waterY) > 1e-6) badY++;
  check('sheet-faces-up', negN === 0 && posN > 30 && badIndex === 0 && badY === 0 && badRgb === 0 && badHouse === 0 && shoreTris > 40 && shoreVerts < 4000, { posN: posN, negN: negN, shoreVerts: shoreVerts, shoreTris: shoreTris, farVerts: farVs.length, badHouse: badHouse, badY: badY, badRgb: badRgb, badIndex: badIndex });

  function near(list, p) { let best = 1e9; for (let i = 0; i < list.length; i++) best = Math.min(best, dist2(list[i].p, p)); return best; }
  const sandBand = verts(bands[3]), waterBand = verts(bands[0]);
  const sand4 = [0.56, 0.05 + S.sandLift, 8.03], sand12 = [-1.68, 0.102 + S.sandLift, 7.92];
  const cliff = [[-3.9, 0.331 + S.sandLift, -2.63], [7.03, 0.341 + S.sandLift, 1.75], [7.86, 0.35 + S.sandLift, 0.83]];
  let cliffNear = 0;
  for (let i = 0; i < cliff.length; i++) if (near(sandBand, cliff[i]) < 0.4 || near(waterBand, cliff[i]) < 0.4) cliffNear++;
  const far157 = [Math.sin(157 * Math.PI / 180) * 48, S.waterY, Math.cos(157 * Math.PI / 180) * 48];
  const far163 = [Math.sin(163 * Math.PI / 180) * 58, S.waterY, Math.cos(163 * Math.PI / 180) * 58];
  check('sand-and-horizon-placed', near(sandBand, sand4) < 0.05 && near(sandBand, sand12) < 0.05 && cliffNear === 0 && near(farVs, far157) < 1e-3 && near(farVs, far163) < 1e-3, { dSand4: +near(sandBand, sand4).toFixed(4), dSand12: +near(sandBand, sand12).toFixed(4), cliffNear: cliffNear, d157: +near(farVs, far157).toFixed(5), d163: +near(farVs, far163).toFixed(5) });

  const wf = fs.readFileSync(path.join(scripts, 'world-r1/WorldFlowComponent.ts'), 'utf8');
  const amb = fs.readFileSync(path.join(scripts, 'audio/AmbienceAudio.ts'), 'utf8');
  const wrap = fs.readFileSync(path.join(scripts, 'render/ShoreBreak.ts'), 'utf8');
  check('wired-into-world', (wf.match(/this\.shore\?\.dispose\(\)/g) || []).length === 3 && wf.includes('this.shore?.advance(dt)') && wf.includes('this.shore?.setView(this.exteriorVisible,this.backdropVisible,this.dayNightMode===\'night\')') && wf.includes('new ShoreBreak(director.getScene()!,model)') && /\[\s*\.35\s*,\s*\.48\s*,\s*\.64\s*\]/.test(wf), { disposes: (wf.match(/this\.shore\?\.dispose\(\)/g) || []).length });
  check('playhead-on-ambience', /static wavePlayhead\(/.test(amb) && amb.includes('wi.wavePlayhead = AmbienceAudio.wavePlayhead') && amb.includes('src.currentTime') && amb.includes('amb_waves_loop'));
  check('no-second-sea', !/env_sea_surface/.test(wrap) && !/env_window_blind/.test(wrap) && wrap.includes('TECH_ALPHA_BLEND = 3') && wrap.includes('USE_VERTEX_COLOR') && wrap.includes('foamMultiply') && !/setProperty\('mainColor'/.test(fs.readFileSync(path.join(scripts, 'render/ShoreBreakCore.ts'), 'utf8')));

  let codeBytes = 0;
  for (const f of ['render/ShoreBreak.ts', 'render/ShoreBreak.ts.meta', 'render/ShoreBreakCore.ts', 'render/ShoreBreakCore.ts.meta']) codeBytes += fs.statSync(path.join(scripts, f)).size;
  check('no-new-texture', codeBytes < 80000 && !fs.existsSync(path.join(scripts, 'render/shore_foam.png')), { codeBytes: codeBytes });

  const mp3 = path.join(root, 'creator-build-project/assets/resources/audio_amb/amb_waves_loop.mp3');
  let dur = null;
  try { dur = parseFloat(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], { encoding: 'utf8' })); } catch (e) { dur = null; }
  check('loop-matches-file', dur === null || Math.abs(dur - S.loopS) < 0.02, { probed: dur, loopS: S.loopS });

  const homePose = P.fromLookAt(Reg.homePoseEntry());
  const islandPose = P.fromLookAt(Reg.islandPoseEntry());
  const doorPose = P.fromLookAt({ position: [-0.4, 1.5, -1.2], target: [0.2, 0.9, 6], fovVerticalDeg: 70 });
  function onScreen(pose, p) {
    const ndc = P.projectPoint(pose, ASPECT, p);
    if (!(ndc.depth > 0.05 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1)) return null;
    return { x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2, depth: ndc.depth };
  }
  function cluster(pose, list, pred) {
    const hits = [];
    for (let i = 0; i < list.length; i++) if (!pred || pred(list[i])) { const s = onScreen(pose, list[i].p); if (s && list[i].a > 0.45) hits.push(s); }
    return hits;
  }
  const homeHits = cluster(homePose, farVs);
  const doorSand = cluster(doorPose, sandBand, function (v) { return v.p[2] > 5; });
  const doorWater = cluster(doorPose, waterBand, function (v) { return v.p[2] > 8; });
  const isleSand = cluster(islandPose, sandBand);
  const isleFar = cluster(islandPose, farVs);
  function mean(hits, k) { let s = 0; for (let i = 0; i < hits.length; i++) s += hits[i][k]; return hits.length ? s / hits.length : null; }
  function span(hits, k) { let lo = 1e9, hi = -1e9; for (let i = 0; i < hits.length; i++) { lo = Math.min(lo, hits[i][k]); hi = Math.max(hi, hits[i][k]); } return hits.length ? hi - lo : null; }
  check('window-horizon-on-screen', homeHits.length >= 4 && mean(homeHits, 'y') > 0.35 && mean(homeHits, 'y') < 0.65 && mean(homeHits, 'x') > 0.05 && mean(homeHits, 'x') < 0.75, { n: homeHits.length, x: mean(homeHits, 'x'), y: mean(homeHits, 'y'), sample: homeHits.slice(0, 4) });
  check('door-beach-on-screen', doorSand.length >= 2 && doorWater.length >= 1, { sand: doorSand.length, water: doorWater.length, sandY: mean(doorSand, 'y'), waterY: mean(doorWater, 'y'), sandSample: doorSand.slice(0, 3) });
  check('island-coast-on-screen', isleSand.length >= 8 && isleFar.length >= 2 && span(isleFar, 'y') < 0.25, { sand: isleSand.length, far: isleFar.length, farY: mean(isleFar, 'y'), farSpan: span(isleFar, 'y'), sandY: mean(isleSand, 'y') });

  let geo = null;
  try { geo = await require('../camera-frame-test/glb_geometry.cjs').decode(); } catch (e) { geo = null; check('occlusion', false, { error: String(e && e.message || e) }); }
  if (geo) {
    const { index } = require('../camera-frame-test/glb_geometry.cjs');
    const L = layersOf();
    const BASE = 'env_sky|env_sea|env_cloud|env_chimney_smoke|env_anim_seagull_fly|env_foam|fx_|env_moon|env_lighthouse_door$|env_window_blind_cards|.*glass|.*beam|.*glow';
    const doorway = { env_interior_shell: 1, env_interior_props_merged: 1, env_int_anim_window_breeze: 1, env_interior_glass: 1 };
    function idxFor(mode) {
      let extra = '';
      if (mode === 'home') extra = '|.*_v22$|' + L.exterior.join('|');
      if (mode === 'island') { const drop = []; for (let i = 0; i < L.interior.length; i++) if (!doorway[L.interior[i]]) drop.push(L.interior[i]); if (drop.length) extra = '|' + drop.join('|'); }
      return index(geo, { ignore: new RegExp('^(' + BASE + extra + ')') });
    }
    function clearOf(pose, idx, list, pred) {
      let on = 0, clear = 0; const blocked = {};
      for (let i = 0; i < list.length; i++) {
        if (pred && !pred(list[i])) continue;
        if (list[i].a < 0.45) continue;
        const s = onScreen(pose, list[i].p); if (!s) continue;
        on++;
        const who = idx.occluded(pose.position, list[i].p);
        if (!who) clear++; else blocked[who] = (blocked[who] || 0) + 1;
      }
      return { on: on, clear: clear, blocked: blocked };
    }
    const Ih = idxFor('home'), Id = idxFor('door'), Ii = idxFor('island');
    const h = clearOf(homePose, Ih, farVs);
    const dS = clearOf(doorPose, Id, sandBand, function (v) { return v.p[2] > 5; });
    const dW = clearOf(doorPose, Id, waterBand, function (v) { return v.p[2] > 8; });
    const iS = clearOf(islandPose, Ii, sandBand);
    check('window-horizon-unoccluded', h.clear >= 3, h);
    check('door-beach-unoccluded', dS.clear >= 2 && dW.clear >= 1, { sand: dS, water: dW });
    check('island-coast-unoccluded', iS.clear >= 6, iS);
  }

  const failed = checks.filter(function (c) { return !c.ok; });
  console.log(failed.length ? 'FAILED ' + failed.length + '/' + checks.length : 'ALL PASS shore-break (' + checks.length + ')');
  process.exitCode = failed.length ? 1 : 0;
})().catch(function (e) { console.error(e); process.exitCode = 1; });
