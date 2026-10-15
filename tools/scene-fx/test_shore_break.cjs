'use strict';
/** Shore swell: the authored sea lifts on amb_waves_loop (8.064 s); white water is only the beach lip
 * once that crest is on the sand. Not a second ocean and not a second night sea.
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
  let seaDiff = 0;
  for (let i = 0; i < 12; i++) {
    const t = i * 0.67, x = Math.sin(i) * 12, z = Math.cos(i) * 14;
    seaDiff = Math.max(seaDiff, Math.abs(C.seaHeight(x, z, t) - C5.seaHeight(x, z, t)), Math.abs(C.seaUvShift(t).u - C5.seaUvShift(t).u), Math.abs(C.shoreRadius(x, z) - C5.shoreRadius(x, z)));
  }
  check('es5-phase', phaseDiff < 1e-9 && seaDiff < 1e-9 && C.shoreWashGeometry(1, hitA).positions.length === C5.shoreWashGeometry(1, hitA).positions.length && C.farShoreGeometry().indices.length === C5.farShoreGeometry().indices.length, { phaseDiff: phaseDiff, seaDiff: seaDiff });

  const a = C.shorePhase(hitA), b = C.shorePhase(hitB), q = C.shorePhase(4.6), q2 = C.shorePhase(4.0);
  check('hit-a-on-sand', a.line01.strength > 0.99 && a.line01.travel > 0.99 && a.foamU > 0.99 && a.foamA > 0.99 && a.line02.strength < 0.02 && a.line02.foamA < 0.02, { a: a });
  check('hit-b-on-sand', b.line02.strength > 0.99 && b.line02.travel > 0.99 && b.foamU > 0.99 && b.foamA > 0.99 && b.line01.strength < 0.02 && b.line01.foamA < 0.02, { b: b });
  check('quiet-between-swells', q.strength < 0.02 && q.foamA < 0.02 && q.foamU < 0.02 && q.line01.foamA < 0.02 && q.line02.foamA < 0.02 && q2.foamA < 0.02, { q: q, q2: q2 });
  let period = 0;
  for (let i = 0; i < 20; i++) {
    const t = i * 0.37, p0 = C.shorePhase(t), p1 = C.shorePhase(t + S.loopS);
    period = Math.max(period, Math.abs(p0.strength - p1.strength), Math.abs(p0.travel - p1.travel), Math.abs(p0.foamU - p1.foamU), Math.abs(p0.foamA - p1.foamA), Math.abs(C.seaHeight(3, 12, t) - C.seaHeight(3, 12, t + S.loopS)), Math.abs(C.seaUvShift(t).v - C.seaUvShift(t + S.loopS).v));
  }
  const plus12 = C.shorePhase(hitA + 12);
  check('period-is-8.064', period < 1e-8, { period: period, loopS: S.loopS });
  check('not-the-12s-clip', plus12.line01.strength < 0.05 && plus12.line01.foamA < 0.05 && plus12.line02.strength > 0.9 && plus12.line02.foamA > 0.9, { atHitPlus12: plus12 });

  const early = C.shorePhase(hitA - S.swells[0].attack * 0.70);
  check('attack-starts-offshore', early.travel < 0.45 && early.travel > 0.05 && early.foamA === 0 && early.foamU === 0 && C.farWashAlpha(early.foamA) === 0, { early: early });
  const lead = 0.22;
  const approaching = C.shorePhase(hitA - lead), approachingB = C.shorePhase(hitB - lead);
  const offNow = (1 - approaching.travel) * S.fetch, offB = (1 - approachingB.travel) * S.fetch;
  check('foam-meets-the-crest', approaching.foamA === 0 && approaching.foamU === 0 && offNow > 1 && approachingB.foamA === 0 && offB > 1 && a.foamA > 0.99 && a.travel > 0.99 && b.foamA > 0.99 && b.travel > 0.99 && (1 - a.travel) * S.fetch < 0.01 && Math.abs(C.seaSheetLift(hitA, a) - C.seaHeight(S.sheetX, S.sheetZ, hitA, a)) < 1e-12 && Math.abs(C.seaSheetLift(hitB, b) - C5.seaSheetLift(hitB, b)) < 1e-9, { offNow: +offNow.toFixed(2), offB: +offB.toFixed(2), reach: S.foamReach });
  const release = C.shorePhase(hitA + 0.55);
  const later = C.shorePhase(hitA + 1.25);
  const done = C.shorePhase(hitA + S.swells[0].release);
  check('foam-recedes-after-hit', a.foamU > release.foamU && release.foamU > later.foamU && release.foamA > later.foamA && later.foamA > done.foamA && done.foamA < 0.02 && release.travel > 0.99 && release.foamU < 0.95 && release.foamU > 0.4, { release: release, later: later, done: done });

  const day = C.foamMultiply(0), night = C.foamMultiply(1), half = C.foamMultiply(0.5);
  check('night-is-multiply', day[0] === 1 && day[1] === 1 && day[2] === 1 && Math.abs(night[0] - 0.35) < 1e-12 && Math.abs(night[1] - 0.48) < 1e-12 && Math.abs(night[2] - 0.64) < 1e-12 && Math.abs(half[0] - (1 + 0.5 * (0.35 - 1))) < 1e-9 && Math.abs(half[1] - (1 + 0.5 * (0.48 - 1))) < 1e-9 && Math.abs(half[2] - (1 + 0.5 * (0.64 - 1))) < 1e-9, { day: day, night: night, half: half });

  const sunk = C.waveLinePose(), up = C.waveLinePose(), tiny = C.waveLinePose();
  check('wave-line-stays-under-sea', Math.abs(sunk.y - S.sinkY) < 1e-9 && Math.abs(sunk.scale - 1) < 1e-9 && sunk.y === up.y && sunk.y === tiny.y && sunk.y < S.seaBaseY - 0.2, { sunk: sunk, seaBaseY: S.seaBaseY });

  check('playhead-locks-clock', Math.abs(C.stepShoreClock(1, 0.5, 6.3) - C.wrapLoop(6.3)) < 1e-12 && Math.abs(C.stepShoreClock(1, 0.05, null) - 1.05) < 1e-12 && Math.abs(C.stepShoreClock(1, 0.5, null) - 1.1) < 1e-12 && Math.abs(C.stepShoreClock(0, 5, null) - 0.1) < 1e-12 && Math.abs(C.wrapLoop(-0.064) - (S.loopS - 0.064)) < 1e-6 && Math.abs(C.stepShoreClock(1, 0.2, NaN) - 1.1) < 1e-12 && C.wrapLoop(S.loopS) === 0, { integratedHalfSecond: C.stepShoreClock(1, 0.5, null), nanPlayhead: C.stepShoreClock(1, 0.2, NaN) });
  let heard = null, same = 0, time = 6.3, locked = 0;
  for (let i = 0; i < 6; i++) {
    const f = C.followShorePlayhead(6.3, heard, same, 0.016);
    heard = f.heard; same = f.sameFor; time = C.stepShoreClock(time, 0.016, f.playhead);
    if (f.playhead !== null) locked++;
  }
  const still = Math.abs(time - C.wrapLoop(6.3)) < 1e-6;
  for (let i = 0; i < 20; i++) {
    const f = C.followShorePlayhead(6.3, heard, same, 0.016);
    heard = f.heard; same = f.sameFor; time = C.stepShoreClock(time, 0.016, f.playhead);
  }
  const released = Math.abs(time - C.wrapLoop(6.3)) > 0.05;
  const snap = C.followShorePlayhead(1, heard, same, 0.016);
  const paused = C.followShorePlayhead(null, 1, 5, 0.016);
  const es5 = C5.followShorePlayhead(6.3, null, 0, 0.016);
  const es6 = C.followShorePlayhead(6.3, null, 0, 0.016);
  check('playhead-stall-falls-back', locked === 6 && still && released && snap.playhead !== null && Math.abs(snap.playhead - C.wrapLoop(1)) < 1e-9 && paused.playhead === null && paused.sameFor === 0 && Math.abs(es5.playhead - es6.playhead) < 1e-12 && Math.abs(S.foamReach - 0.15) < 1e-12 && Math.abs(S.shorePeak - 0.82) < 1e-12 && C.SHORE_PLAYHEAD_STALL_S === 0.2, { locked: locked, still: still, released: released, after: time, foamReach: S.foamReach, shorePeak: S.shorePeak });

  const hitPhase = C.shorePhase(hitA);
  let shoreSum = 0, offSum = 0, lipN = 0, radiusErr = 0;
  for (let i = 0; i < S.lip.length; i++) {
    const seg = S.lip[i], x = seg[1], z = seg[2], r = Math.hypot(x, z);
    if (!(r > 1)) continue;
    radiusErr = Math.max(radiusErr, Math.abs(C.shoreRadius(x, z) - r));
    const ox = x / r, oz = z / r;
    shoreSum += C.seaHeight(x, z, hitA, hitPhase);
    offSum += C.seaHeight(x + ox * S.fetch, z + oz * S.fetch, hitA, hitPhase);
    lipN++;
  }
  const earlyT = hitA - S.swells[0].attack * 0.7, earlyPhase = C.shorePhase(earlyT);
  const crestOff = (1 - earlyPhase.travel) * S.fetch;
  let crestSum = 0, shoreEarly = 0;
  for (let i = 0; i < S.lip.length; i++) {
    const seg = S.lip[i], x = seg[1], z = seg[2], r = Math.hypot(x, z);
    if (!(r > 1)) continue;
    const ox = x / r, oz = z / r;
    crestSum += C.seaHeight(x + ox * crestOff, z + oz * crestOff, earlyT, earlyPhase);
    shoreEarly += C.seaHeight(x, z, earlyT, earlyPhase);
  }
  check('crest-lands-with-the-beat', lipN > 20 && radiusErr < 0.6 && shoreSum / lipN > offSum / lipN + 0.06 && crestSum / lipN > shoreEarly / lipN + 0.02, { lipN: lipN, radiusErr: +radiusErr.toFixed(3), shore: +(shoreSum / lipN).toFixed(3), offshore: +(offSum / lipN).toFixed(3), earlyCrest: +(crestSum / lipN).toFixed(3), earlyShore: +(shoreEarly / lipN).toFixed(3), crestOff: +crestOff.toFixed(2) });
  let quietMax = 0;
  const quietPhase = C.shorePhase(4.6);
  for (let i = 0; i < S.lip.length; i++) quietMax = Math.max(quietMax, Math.abs(C.seaHeight(S.lip[i][1], S.lip[i][2], 4.6, quietPhase)), Math.abs(C.seaHeight(S.lip[i][1] * 3, S.lip[i][2] * 3, 4.6, quietPhase)));
  const uvA = C.seaUvShift(hitA), uvB = C.seaUvShift(hitB), uv0 = C.seaUvShift(0);
  // v is two cycles per loop, so the two hits (half a loop apart) share v. u is one cycle, so it has flipped.
  check('sea-keeps-moving-between-beats', quietPhase.foamA === 0 && quietMax > 0.01 && quietMax < S.ripple + S.heave + 0.02 && Math.abs(uvA.u - uvB.u) > 0.05 && Math.abs(uv0.u) < 1e-9 && Math.abs(uvA.u) < S.uvDrift + 1e-9, { quietMax: +quietMax.toFixed(3), uvA: uvA, uvB: uvB });

  // Daytime blue is COLOR_0 RGB on env_sea_surface (wavelet texture is nearly white). A rebuilt mesh that
  // drops it leaves a_color at 0, and builtin-standard multiplies the sea to black. The sea mesh is not rebuilt.
  const rgbSea = [0.3045, 0.7404, 0.8833, 0.3633, 0.8028, 0.898, 0.4673, 0.9134, 0.924];
  const albedo = C.seaAlbedoColors(rgbSea, 3, 4), albedo5 = C5.seaAlbedoColors(rgbSea, 3, 4);
  let cdiff = 0;
  if (albedo && albedo5 && albedo.length === albedo5.length) for (let i = 0; i < albedo.length; i++) cdiff = Math.max(cdiff, Math.abs(albedo[i] - albedo5[i]));
  const bytes = C.seaAlbedoColors([77, 189, 225], 1, 1);
  check('vertex-color-is-the-blue', !!albedo && albedo.length === 12 && Math.abs(albedo[0] - 0.3045) < 1e-6 && albedo[3] === 1 && albedo[7] === 1 && albedo[11] === 1 && Math.abs(albedo[8] - 0.4673) < 1e-6 && cdiff < 1e-9 && !!bytes && Math.abs(bytes[0] - 77 / 255) < 1e-6 && bytes[3] === 1 && C.seaAlbedoColors(rgbSea, 4, 4) === null && C.seaAlbedoColors(null, 1, 4) === null, { a: albedo && albedo[3], cdiff: cdiff });

  const homeL = C.washVisible(false, true, 1), isleL = C.washVisible(true, true, 1), noneL = C.washVisible(false, false, 1), quietL = C.washVisible(true, true, 0), doorL = C.washVisible(true, true, 0.5);
  check('home-far-only', homeL.shore === false && homeL.far === true && isleL.shore === true && isleL.far === true && doorL.shore === true && noneL.shore === false && noneL.far === false && quietL.shore === false && quietL.far === false, { homeL: homeL, isleL: isleL, noneL: noneL, quietL: quietL });

  const kept = C.keptShoreLips(), keptDeg = {};
  for (let i = 0; i < kept.length; i++) keptDeg[kept[i][0]] = 1;
  check('beach-kept-cliffs-dropped', keptDeg[-12] && keptDeg[-4] && keptDeg[4] && keptDeg[12] && keptDeg[20] && !keptDeg[-124] && !keptDeg[76] && !keptDeg[84] && kept.length < S.lip.length, { kept: kept.length, lip: S.lip.length });

  const sheetY = S.seaBaseY + S.foamLift;
  const geos = [C.shoreWashGeometry(0, hitA), C.shoreWashGeometry(1, hitA)];
  let shoreVerts = 0, shoreTris = 0, badHouse = 0, badY = 0, badRgb = 0, badIndex = 0, negN = 0, posN = 0, wide = 0;
  const H = S.house;
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i]; shoreVerts += g.positions.length / 3; shoreTris += g.indices.length / 3;
    const n = normals(g); posN += n.pos; negN += n.neg;
    if (g.colors.length !== g.positions.length / 3 * 4 || g.indices.length % 3) badIndex++;
    for (let k = 0; k < g.indices.length; k++) if (g.indices[k] < 0 || g.indices[k] >= g.positions.length / 3) badIndex++;
    const vs = verts(g);
    for (let v = 0; v < vs.length; v++) {
      const p = vs[v].p;
      if (!(p[1] > -1.2 && p[1] < 0.5) || !isFinite(p[0] + p[1] + p[2])) badY++;
      if (vs[v].a > 0.05 && p[0] >= H.minX && p[0] <= H.maxX && p[2] >= H.minZ && p[2] <= H.maxZ) badHouse++;
      if (Math.abs(vs[v].rgb[0] - S.foamRgb[0]) > 1e-6 || Math.abs(vs[v].rgb[1] - S.foamRgb[1]) > 1e-6 || Math.abs(vs[v].rgb[2] - S.foamRgb[2]) > 1e-6) badRgb++;
    }
  }
  const far = C.farShoreGeometry(); const fn = normals(far); posN += fn.pos; negN += fn.neg;
  const farVs = verts(far);
  for (let v = 0; v < farVs.length; v++) if (!(farVs[v].p[1] > -1.2 && farVs[v].p[1] < 0) || Math.abs(farVs[v].p[1] - sheetY) > 1e-6) badY++;
  check('sheet-faces-up', negN === 0 && posN > 30 && badIndex === 0 && badY === 0 && badRgb === 0 && badHouse === 0 && shoreTris > 40 && shoreVerts < 4000 && geos[0].positions.length === geos[1].positions.length, { posN: posN, negN: negN, shoreVerts: shoreVerts, shoreTris: shoreTris, farVerts: farVs.length, badHouse: badHouse, badY: badY, badRgb: badRgb, badIndex: badIndex });

  function near(list, p) { let best = 1e9; for (let i = 0; i < list.length; i++) best = Math.min(best, dist2(list[i].p, p)); return best; }
  const waterBand = verts(geos[0]), sandBand = verts(geos[1]);
  const waterLift = C.seaSheetLift(hitA, hitPhase);
  const water4 = [1.14, S.seaBaseY + waterLift + S.foamLift, 16.36];
  const waterM4 = [-1.1, S.seaBaseY + waterLift + S.foamLift, 15.76];
  const sand4 = [0.56, 0.05 + S.sandLift, 8.03], sand12 = [-1.68, 0.102 + S.sandLift, 7.92];
  const cliff = [[-3.9, 0.331 + S.sandLift, -2.63], [7.03, 0.341 + S.sandLift, 1.75], [7.86, 0.35 + S.sandLift, 0.83]];
  let cliffNear = 0;
  for (let i = 0; i < cliff.length; i++) if (near(sandBand, cliff[i]) < 0.4 || near(waterBand, cliff[i]) < 0.4) cliffNear++;
  for (let v = 0; v < sandBand.length; v++) if (sandBand[v].a > 0.45 && sandBand[v].p[2] > 8 && Math.hypot(sandBand[v].p[0], sandBand[v].p[2]) > 18) wide++;
  const far157 = [Math.sin(157 * Math.PI / 180) * 48, sheetY, Math.cos(157 * Math.PI / 180) * 48];
  const far163 = [Math.sin(163 * Math.PI / 180) * 58, sheetY, Math.cos(163 * Math.PI / 180) * 58];
  check('sand-and-horizon-placed', near(sandBand, sand4) < 0.05 && near(sandBand, sand12) < 0.05 && near(waterBand, water4) < 0.05 && near(waterBand, waterM4) < 0.05 && cliffNear === 0 && wide === 0 && near(farVs, far157) < 1e-3 && near(farVs, far163) < 1e-3, { dSand4: +near(sandBand, sand4).toFixed(4), dSand12: +near(sandBand, sand12).toFixed(4), dWater4: +near(waterBand, water4).toFixed(4), dWaterM4: +near(waterBand, waterM4).toFixed(4), cliffNear: cliffNear, wide: wide, d157: +near(farVs, far157).toFixed(5), d163: +near(farVs, far163).toFixed(5) });

  const wf = fs.readFileSync(path.join(scripts, 'world-r1/WorldFlowComponent.ts'), 'utf8');
  const amb = fs.readFileSync(path.join(scripts, 'audio/AmbienceAudio.ts'), 'utf8');
  const wrap = fs.readFileSync(path.join(scripts, 'render/ShoreBreak.ts'), 'utf8');
  check('wired-into-world', (wf.match(/this\.shore\?\.dispose\(\)/g) || []).length === 3 && wf.includes('this.shore?.advance(dt)') && wf.includes('this.shore?.setView(this.exteriorVisible,this.backdropVisible,this.dayNightMode===\'night\')') && wf.includes('new ShoreBreak(director.getScene()!,model)') && /\[\s*\.35\s*,\s*\.48\s*,\s*\.64\s*\]/.test(wf), { disposes: (wf.match(/this\.shore\?\.dispose\(\)/g) || []).length });
  check('playhead-on-ambience', /static wavePlayhead\(/.test(amb) && amb.includes('wi.wavePlayhead = AmbienceAudio.wavePlayhead') && amb.includes('src.currentTime') && amb.includes('amb_waves_loop'));
  const coreSrc = fs.readFileSync(path.join(scripts, 'render/ShoreBreakCore.ts'), 'utf8');
  const mainSets = wrap.match(/setProperty\('mainColor'/g) || [];
  // Two foam mainColor writes (init alpha 0, then place). The sea material is never written.
  // The imported mesh stays. Rebuilding it (RGBA color stream included) still drew the device sea black.
  const swaps = wrap.includes('mr.mesh = dynamic') || wrap.includes('seaAlbedoColors') || wrap.includes('ATTR_COLOR') || wrap.includes('displaceSea') || wrap.includes('readAttribute');
  check('same-sea', wrap.includes("findNamed(model, 'env_sea_surface')") && wrap.includes('seaSheetLift') && wrap.includes('stepShoreClock') && wrap.includes('this.playhead()') && wrap.includes('followShorePlayhead') && wrap.includes('foamMultiply') && wrap.includes('tilingOffset') && wrap.includes('setPosition') && wrap.includes('this.exterior && phase.foamA') && !swaps && mainSets.length === 2 && !/env_window_blind/.test(wrap) && !/new Node\('env_sea/.test(wrap) && !/fx_sea/.test(wrap) && !/setProperty\('mainColor'/.test(coreSrc) && !/length < count \* 4/.test(coreSrc) && coreSrc.includes('seaAlbedoColors') && coreSrc.includes('seaSheetLift') && coreSrc.includes('foamReach') && coreSrc.includes('SHORE_PLAYHEAD_STALL_S') && wrap.includes('SHORE.sinkY') === false && wrap.includes('waveLinePose'), { mainColorSets: mainSets.length, swaps: swaps });

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
