'use strict';
/** r5 S3 global wind: grass (meadow-grass-wind.effect), sailboat pennant and sails share GlobalWind.ts direction + strength.
 * Defaults keep today's look. CPU emulation of the grass vertex shader on the shipped env_meadow.glb grass. Loose ES5.
 * Usage: node tools/scene-fx/test_global_wind.cjs */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const root = path.resolve(__dirname, '..', '..'), A = path.join(root, 'creator-build-project/assets'), scripts = path.join(A, 'scripts');
const ts = require('../qf-env.cjs').typescript();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'globalwind-'));
fs.writeFileSync(path.join(tmp, 'GlobalWind.js'), ts.transpileModule(fs.readFileSync(path.join(scripts, 'render/GlobalWind.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 } }).outputText);
const G = require(path.join(tmp, 'GlobalWind.js'));
const { createHarness } = require('../board-ui/harness.cjs'); const L = createHarness().load('region/TransportLeg.ts');
const checks = [];
function check(name, ok, info) { checks.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(30) + (info === undefined ? '' : ' ' + JSON.stringify(info))); }
const D = Math.PI / 180, r4 = function (v) { return Math.round(v * 1e4) / 1e4; };
const wrap = function (a) { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };

// ---- effect
const fxPath = path.join(A, 'bundles/region_meadow/meadow-grass-wind.effect'), fx = fs.readFileSync(fxPath, 'utf8');
const def = /windDir:\s*\{\s*value:\s*\[([^\]]+)\]/.exec(fx), dv = def ? def[1].split(',').map(Number) : [];
const W0 = G.GLOBAL_WIND_DEFAULT;
check('effect-default-uniform', dv.length === 4 && dv[0] === W0.dirX && dv[1] === W0.dirZ && dv[2] === W0.strength && dv[3] === 0, dv);
check('effect-block', /uniform MeadowWind \{ vec4 windParams; vec4 windDir; \};/.test(fx) && !/transpose\s*\(/.test(fx.replace(/\/\/[^\n]*/g, '')), 'one UBO, ES2-safe (no transpose())');
check('effect-old-axis-constant', fx.indexOf('vec2(0.944, -0.330)') > 0 && fx.indexOf(String(G.GRASS_PHASE_K)) > 0, { k: G.GRASS_PHASE_K });
let glsl = 'skipped (no glslangValidator)';
try { cp.execFileSync('glslangValidator', ['--version'], { stdio: 'ignore' }); glsl = null; } catch (e) { /* not installed */ }
if (glsl === null) {
  const progs = {}; fx.replace(/CCProgram\s+([\w-]+)\s+%\{([\s\S]*?)\}%/g, function (m, n, b) { progs[n] = b; return m; });
  const STUB = { 'builtin/uniforms/cc-global': 'uniform CCGlobal{highp vec4 cc_time;};uniform CCCamera{highp mat4 cc_matView;highp mat4 cc_matProj;highp mat4 cc_matViewProj;};',
    'builtin/uniforms/cc-local': 'uniform CCLocal{highp mat4 cc_matWorld;};' };
  const bad = [];
  for (const pair of [['meadow-grass-vs', 'vert'], ['meadow-grass-fs', 'frag']]) {
    const body = progs[pair[0]].replace(/#include\s*<([^>]+)>/g, function (m, k) { return STUB[k]; }), f = path.join(tmp, 't.' + pair[1]);
    fs.writeFileSync(f, '#version 300 es\n' + body + (pair[1] === 'vert' ? '\nvoid main(){gl_Position=vert();}\n' : '\nout vec4 oc;\nvoid main(){oc=frag();}\n'));
    try { cp.execFileSync('glslangValidator', [f], { encoding: 'utf8' }); } catch (e) { bad.push(pair[0] + ': ' + String(e.stdout || e.message).slice(0, 300)); }
  }
  glsl = bad.length ? bad : 'ok (vs + fs)'; check('effect-glsl', !bad.length, glsl);
} else check('effect-glsl', true, glsl);

// ---- grass: CPU copy of the vertex shader on the shipped meadow grass
function glb(file) { const b = fs.readFileSync(file), n = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + n).toString()), bin = 20 + n + 8; return { b, j, bin }; }
function acc(g, i) { const a = g.j.accessors[i], v = g.j.bufferViews[a.bufferView], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const sz = { 5126: 4, 5123: 2, 5121: 1 }[a.componentType], st = v.byteStride || nc * sz, off = g.bin + (v.byteOffset || 0) + (a.byteOffset || 0), out = [];
  for (let k = 0; k < a.count; k++) { const e = []; for (let c = 0; c < nc; c++) { const o = off + k * st + c * sz;
    e.push(a.componentType === 5126 ? g.b.readFloatLE(o) : a.componentType === 5123 ? g.b.readUInt16LE(o) / (a.normalized ? 65535 : 1) : g.b.readUInt8(o) / (a.normalized ? 255 : 1)); } out.push(e); }
  return out; }
const M = glb(path.join(A, 'bundles/region_meadow/env_meadow.glb')), verts = [];
M.j.meshes.forEach(function (m) { if (!/grass/.test(m.name)) return; const p = m.primitives[0], P = acc(M, p.attributes.POSITION), U = acc(M, p.attributes.TEXCOORD_1), C = acc(M, p.attributes.COLOR_0);
  for (let k = 0; k < P.length; k += 7) verts.push({ p: P[k], u: U[k], a: C[k][3] }); });
const OM = 2 * Math.PI / 4;
function oldVs(v, t) { const r = v.u[0], d = v.a * 1.5 * r * r * (0.36 * Math.sin(v.u[1] - OM * t) - 0.26 * Math.sin(OM * t)); return [0.944 * d, -0.3 * d * r, -0.330 * d]; }
/** yaw: mesh -> world rotation (Cocos euler Y), returns the WORLD offset of the vertex. */
function newVs(v, t, wu, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw);
  // cc_matWorld columns: col0 = (c,0,-s), col2 = (s,0,c); l = (dot(col0,w), dot(col2,w))
  let lx = c * wu[0] - s * wu[1], lz = s * wu[0] + c * wu[1]; const ll = Math.max(Math.hypot(lx, lz), 1e-4), wl = Math.hypot(wu[0], wu[1]); lx = lx / ll * wl; lz = lz / ll * wl;
  const ph = v.u[1] + G.GRASS_PHASE_K * (v.p[0] * (lx - 0.944) + v.p[2] * (lz + 0.330)), r = v.u[0];
  const d = wu[2] * v.a * 1.5 * r * r * (0.36 * Math.sin(ph - OM * t) - 0.26 * Math.sin(OM * t)), o = [lx * d, -0.3 * d * r, lz * d];
  return [c * o[0] + s * o[2], o[1], -s * o[0] + c * o[2]]; }
G.resetGlobalWind();
let md = 0; for (let t = 0; t < 4; t += 0.37) verts.forEach(function (v) { const a = oldVs(v, t), b = newVs(v, t, G.grassWindUniform(), 0); for (let i = 0; i < 3; i++) md = Math.max(md, Math.abs(a[i] - b[i])); });
check('grass-default-identical', md < 1e-6, { verts: verts.length, maxDiffM: md });
/** Phase slope along a world direction (regression over blade roots) for mesh yaw + uniform. */
function phaseSlope(wu, yaw, dir) { const c = Math.cos(yaw), s = Math.sin(yaw); let lx = c * wu[0] - s * wu[1], lz = s * wu[0] + c * wu[1]; const ll = Math.hypot(lx, lz); lx /= ll; lz /= ll;
  const pts = verts.filter(function (v) { return v.u[0] < 0.05; }).map(function (v) { const wx = c * v.p[0] + s * v.p[2], wz = -s * v.p[0] + c * v.p[2];
    return [wx * dir[0] + wz * dir[1], v.u[1] + G.GRASS_PHASE_K * (v.p[0] * (lx - 0.944) + v.p[2] * (lz + 0.330))]; });
  let mx = 0, my = 0; pts.forEach(function (q) { mx += q[0]; my += q[1]; }); mx /= pts.length; my /= pts.length; let cv = 0, vx = 0; pts.forEach(function (q) { cv += (q[0] - mx) * (q[1] - my); vx += (q[0] - mx) * (q[0] - mx); }); return cv / vx; }
/** Main axis of the world-space sway (unit xz) from the displacement covariance. */
function swayAxis(wu, yaw) { let xx = 0, xz = 0, zz = 0; for (let t = 0; t < 4; t += 0.5) verts.forEach(function (v) { const o = newVs(v, t, wu, yaw); xx += o[0] * o[0]; xz += o[0] * o[2]; zz += o[2] * o[2]; });
  const ang = 0.5 * Math.atan2(2 * xz, xx - zz); return [Math.cos(ang), Math.sin(ang), xx + zz]; }
const grassRows = []; let grassOk = true;
[0, 109.3, 200, -45].forEach(function (az) { [0, Math.PI, 0.7].forEach(function (yaw) {
  const w = G.setGlobalWindAzimuth(az, 1), wu = G.grassWindUniform(), dir = [w.dirX, w.dirZ], k = phaseSlope(wu, yaw, dir), ax = swayAxis(wu, yaw), dot = Math.abs(ax[0] * dir[0] + ax[1] * dir[1]);
  if (!(Math.abs(k - G.GRASS_PHASE_K) < 0.02 && dot > 0.999)) grassOk = false; grassRows.push([az, r4(yaw), r4(k), r4(dot)]); }); });
check('grass-follows-world-wind', grassOk, 'az, meshYaw, gust phase slope along wind (rad/m), |sway axis . wind| : ' + JSON.stringify(grassRows));
G.resetGlobalWind();
const e0 = swayAxis(G.grassWindUniform(), 0)[2]; G.setGlobalWindStrength(0); const e1 = swayAxis(G.grassWindUniform(), 0)[2]; G.setGlobalWindStrength(2); const e2 = swayAxis(G.grassWindUniform(), 0)[2];
check('grass-strength', e1 === 0 && Math.abs(e2 / e0 - 4) < 1e-3, { energy1: r4(e0), energy0: e1, energy2x: r4(e2 / e0) });
G.resetGlobalWind();
function oldSlopeWorld(yaw, dir) { const c = Math.cos(yaw), s = Math.sin(yaw), pts = verts.filter(function (v) { return v.u[0] < 0.05; }).map(function (v) { return [(c * v.p[0] + s * v.p[2]) * dir[0] + (-s * v.p[0] + c * v.p[2]) * dir[1], v.u[1]]; });
  let mx = 0, my = 0; pts.forEach(function (q) { mx += q[0]; my += q[1]; }); mx /= pts.length; my /= pts.length; let cv = 0, vx = 0; pts.forEach(function (q) { cv += (q[0] - mx) * (q[1] - my); vx += (q[0] - mx) * (q[0] - mx); }); return cv / vx; }
const wd = [W0.dirX, W0.dirZ], kOldJ = oldSlopeWorld(Math.PI, wd), kNewJ = phaseSlope(G.grassWindUniform(), Math.PI, wd), kBoard = oldSlopeWorld(0, wd);
check('journey-grass-now-downwind', kBoard > 0.2 && kOldJ < -0.2 && kNewJ > 0.2, { boardOld: r4(kBoard), journeyOld: r4(kOldJ), journeyNew: r4(kNewJ), note: 'meadow yaw 180 in the sail journey: gusts used to run against the sail/smoke wind' });

// ---- sailboat: pennant + sails
const route = L.sailRoute(), sp = L.sailSpeed(route.length), v = sp.v;
const yaws = []; for (let i = 1; i < route.samples.length; i++) { const a = route.samples[i - 1], b = route.samples[i]; yaws.push(Math.atan2(b[0] - a[0], b[2] - a[2])); }
const app0 = G.apparentWindLocal(0, v), cruise = G.pennantYawTarget(app0) / D;
check('pennant-cruise-unchanged', Math.abs(cruise) < 0.5, { cruiseMps: r4(v), pennantDeltaDeg: r4(cruise) });
let maxDev = 0; yaws.forEach(function (y) { maxDev = Math.max(maxDev, Math.abs(G.pennantYawTarget(G.apparentWindLocal(y, v)) / D)); });
check('pennant-route-cruise', maxDev < 3, { maxDeltaDegAlongRoute: r4(maxDev) });
let sideOk = true; yaws.forEach(function (y) { [0, v * 0.5, v].forEach(function (s) { if (G.sailSide(G.apparentWindLocal(y, s), 1) !== 1) sideOk = false; }); });
check('sail-default-authored-side', sideOk, 'default wind: sails stay on the authored +x side at every route heading and speed');
// aligned at rest for any direction: pennant world azimuth = wind; sails leeward (+x local * side points downwind)
let aligned = true; const rows = [];
[0, 45, 109.3, 160, 250, 300].forEach(function (az) { G.setGlobalWindAzimuth(az, 1); [0, 0.6, -2].forEach(function (yaw) {
  const app = G.apparentWindLocal(yaw, 0), py = G.pennantYawTarget(app), flagAz = wrap((yaw + py) / D + G.PENNANT_AUTHORED_DEG), side = G.sailSide(app, 1);
  const lee = [side * Math.cos(yaw), -side * Math.sin(yaw)], w = G.getGlobalWind(), dl = lee[0] * w.dirX + lee[1] * w.dirZ, grass = G.grassWindUniform();
  const ok = Math.abs(wrap(flagAz - az)) < 1e-6 && (dl > -0.15) && Math.abs(Math.atan2(grass[0], grass[1]) / D - wrap(az)) < 1e-6; if (!ok) aligned = false;
  rows.push([az, yaw, r4(flagAz), side, r4(dl)]); }); });
check('three-aligned-at-rest', aligned, 'az, boatYaw, pennantAz, sailSide, lee.wind: ' + JSON.stringify(rows.slice(0, 6)) + '...');
G.resetGlobalWind();
let flips = 0, prev = 1; for (let a = -8; a <= 8; a += 0.5) { const s = G.sailSide([Math.sin(a * D), Math.cos(a * D)], prev); if (s !== prev) flips++; prev = s; }
check('sail-side-hysteresis', flips === 0 && G.sailSide([-1, 0], 1) === -1 && G.sailSide([1, 0], -1) === 1, { flipsInside8deg: flips });
G.setGlobalWindStrength(0); const still = G.apparentWindLocal(0, 0);
check('pennant-still-holds', G.pennantYawTarget(still) === null && Math.abs(G.easeAngle(0.1, 3.1, 1 / 60, 3) - 0.1) < 0.2 && Math.abs(G.easeAngle(3.1, -3.1, 10, 3) + 3.1) < 1e-3, 'no wind + no motion keeps the last pose; easing takes the short way');
G.resetGlobalWind();

// ---- API
const r0 = G.globalWindRevision(), n = G.setGlobalWind(3, 4, 0.5), r1 = G.globalWindRevision(), z = G.setGlobalWind(0, 0), r2 = G.globalWindRevision();
G.setGlobalWind(0.6, 0.8, 0.5); const r3 = G.globalWindRevision(); const bad = G.setGlobalWind(NaN, 1, -2);
check('api-set-normalise', r4(n.dirX) === 0.6 && r4(n.dirZ) === 0.8 && n.strength === 0.5 && z.dirX === n.dirX && r1 === r0 + 1 && r2 === r1 && r3 === r2 && bad.strength === 0 && bad.dirX === 0 && bad.dirZ === 1, { r0, r1, r2, r3 });
const def0 = G.resetGlobalWind(); def0.dirX = 9; const again = G.getGlobalWind();
check('api-reset-copy', again.dirX === 0.944 && again.dirZ === -0.330 && again.strength === 1 && r4(G.globalWindAzimuthDeg()) === r4(Math.atan2(0.944, -0.330) / D), { azDeg: r4(G.globalWindAzimuthDeg()) });

// ---- hooks + loose ES5
const mb = fs.readFileSync(path.join(scripts, 'region/MeadowBoardBackground.ts'), 'utf8'), sa = fs.readFileSync(path.join(scripts, 'region/SailArt.ts'), 'utf8');
check('hook-grass', /from '\.\.\/render\/GlobalWind'/.test(mb) && /setProperty\('windDir',new Vec4\(w\[0\],w\[1\],w\[2\],0\)\)/.test(mb));
check('hook-sail', /apparentWindLocal\(v\.yaw,v\.speed\)/.test(sa) && /boom\.setRotationFromEuler\(0,25\*\(1-open\)\*side,0\)/.test(sa) && /sailRoot\.setScale\(side,/.test(sa) && /jib\.setScale\(side,/.test(sa) && /findNode\(boat,'pennant'\)/.test(sa));
const strip = function (t) { return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); }, BAN = /Array\.from|Object\.entries|padStart|\.\.\.[A-Za-z_(]/;
const added = sa.split('\n').filter(function (l) { return /pennant|apparentWind|sailSide|side\)/.test(l); }).concat(mb.split('\n').filter(function (l) { return /windDir|GlobalWind/.test(l); }));
const es5 = []; if (BAN.test(strip(fs.readFileSync(path.join(scripts, 'render/GlobalWind.ts'), 'utf8')))) es5.push('GlobalWind.ts'); added.forEach(function (l) { if (BAN.test(strip(l))) es5.push(l.trim().slice(0, 60)); });
check('loose-es5', !es5.length, es5.length ? es5 : 'GlobalWind.ts + ' + added.length + ' hook lines');

const failed = checks.filter(function (c) { return !c.ok; });
console.log(failed.length ? 'FAILED ' + failed.length + '/' + checks.length : 'ALL PASS global-wind (' + checks.length + ')');
process.exitCode = failed.length ? 1 : 0;
