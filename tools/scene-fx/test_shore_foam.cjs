'use strict';
/** r5 S3 shore wash (island + lakeside): one dedicated shore ribbon drawn by resources/world/shore-foam.effect.
 * Rolling wave lines, a swash lip that runs up and slides back, wet sand behind it; no depth texture; day / night; loose ES5.
 * CPU only (glslangValidator is used for a syntax pass when it is installed). Usage: node tools/scene-fx/test_shore_foam.cjs */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const root = path.resolve(__dirname, '..', '..'), A = path.join(root, 'creator-build-project/assets'), scripts = path.join(A, 'scripts');
const ts = require('../qf-env.cjs').typescript();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shorefoam-'));
for (const f of ['ShoreBreakCore', 'ShoreFoamCore']) fs.writeFileSync(path.join(tmp, f + '.js'), ts.transpileModule(fs.readFileSync(path.join(scripts, 'render', f + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 } }).outputText);
const B = require(path.join(tmp, 'ShoreBreakCore.js')), F = require(path.join(tmp, 'ShoreFoamCore.js')), S = B.SHORE;
const checks = [];
function check(name, ok, info) { checks.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name.padEnd(30) + (info === undefined ? '' : ' ' + JSON.stringify(info))); }

// ---- effect
const fxPath = path.join(A, 'resources/world/shore-foam.effect'), fx = fs.readFileSync(fxPath, 'utf8'), meta = JSON.parse(fs.readFileSync(fxPath + '.meta', 'utf8'));
check('effect-states', /depthTest: true, depthWrite: false/.test(fx) && /blendSrc: one\b/.test(fx) && /blendDst: one_minus_src_alpha/.test(fx) && /cullMode: none/.test(fx) && meta.importer === 'effect' && /^[0-9a-f-]{36}$/.test(meta.uuid));
check('effect-no-depth-texture', !/sampler2D|texture\s*\(|cc_depth|DepthMap|depthTex/i.test(fx.replace(/\/\/[^\n]*/g, '')));
check('effect-pipeline', fx.includes('#include <legacy/local-batch>') && fx.includes('CCGetWorldMatrix(matWorld)') && fx.includes('CC_APPLY_FOG(o, v_worldPos)') && fx.includes('CCFragOutput(o)') && fx.includes('o.rgb *= o.a') && /#if USE_CC_TIME/.test(fx) && /#if USE_LIT/.test(fx));
check('effect-lit-capped', /min\(albedo \* \(lit \* NL[^;]*albedo\)/.test(fx), 'lit colour never above its albedo');
let glsl = 'skipped (no glslangValidator)';
try { cp.execFileSync('glslangValidator', ['--version'], { stdio: 'ignore' }); glsl = null; } catch (e) { /* not installed */ }
if (glsl === null) {
  const progs = {}; fx.replace(/CCProgram\s+([\w-]+)\s+%\{([\s\S]*?)\}%/g, function (m, n, b) { progs[n] = b; return m; });
  const STUB = { 'builtin/uniforms/cc-global': 'uniform CCGlobal{highp vec4 cc_time;};uniform CCCamera{highp mat4 cc_matView;highp mat4 cc_matProj;highp vec4 cc_cameraPos;mediump vec4 cc_mainLitDir;mediump vec4 cc_mainLitColor;mediump vec4 cc_ambientSky;};',
    'legacy/local-batch': 'uniform CCLocal{highp mat4 cc_matWorld;};void CCGetWorldMatrix(out mat4 m){m=cc_matWorld;}', 'legacy/fog-vs': 'out float v_fog;\n#define CC_TRANSFER_FOG(p) v_fog=1.0',
    'legacy/fog-fs': 'in float v_fog;\n#define CC_APPLY_FOG(c,p) c.rgb*=v_fog', 'legacy/output-standard': 'vec4 CCFragOutput(vec4 c){return c;}' };
  const bad = [];
  for (const [name, stage] of [['shore-foam-vs', 'vert'], ['shore-foam-fs', 'frag']]) for (const d of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
    const body = progs[name].replace(/#include\s*<([^>]+)>/g, function (m, k) { return STUB[k]; });
    const f = path.join(tmp, 't.' + stage);
    fs.writeFileSync(f, '#version 300 es\n#define USE_CC_TIME ' + d[0] + '\n#define USE_LIT ' + d[1] + '\n' + body + (stage === 'vert' ? '\nvoid main(){gl_Position=vert();}\n' : '\nout vec4 oc;\nvoid main(){oc=frag();}\n'));
    try { cp.execFileSync('glslangValidator', [f], { encoding: 'utf8' }); } catch (e) { bad.push(name + ' ' + d.join('') + ': ' + String(e.stdout || e.message).slice(0, 300)); }
  }
  glsl = bad.length ? bad : 'ok (4 define combos x 2 stages)';
  check('effect-glsl', !bad.length, glsl);
} else check('effect-glsl', true, glsl);

// ---- island ribbon
const g = F.islandShoreRibbon(), nv = g.positions.length / 3, R = F.FOAM_ROWS.length;
let maxIdx = 0, down = 0; for (let i = 0; i < g.indices.length; i++) maxIdx = Math.max(maxIdx, g.indices[i]);
for (let i = 0; i < g.indices.length; i += 3) { const P = g.positions, a = g.indices[i] * 3, b = g.indices[i + 1] * 3, c = g.indices[i + 2] * 3;
  const ny = (P[b + 2] - P[a + 2]) * (P[c] - P[a]) - (P[b] - P[a]) * (P[c + 2] - P[a + 2]); if (ny < -1e-9) down++; }
check('island-ribbon-mesh', nv > 0 && nv % R === 0 && maxIdx < nv && nv < 65535 && g.uvs.length === nv * 2 && g.colors.length === nv * 4 && down === 0, { verts: nv, tris: g.indices.length / 3, rows: R, down });
const kept = B.keptShoreLips(), y0 = S.seaBaseY + S.foamLift; let match = 0, house = 0, liftOk = true;
for (let v = 0; v < nv; v++) { const x = g.positions[v * 3], z = g.positions[v * 3 + 2], vv = g.uvs[v * 2 + 1], h = S.house;
  if (x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ && g.colors[v * 4 + 3] > 0.01) house++;
  if (vv === 0.5 && Math.abs(g.colors[v * 4] - 1) > 1e-9) liftOk = false; if (vv === 1 && g.colors[v * 4] !== 0) liftOk = false; if (vv === 0 && g.colors[v * 4] !== 1) liftOk = false;
  if (vv === 0.5) for (const s of kept) { const w = F.ISLAND_WATERLINE.filter(function (r) { return r[0] === s[0]; })[0] || [s[0], 0];
    const wx = s[1] + (s[3] - s[1]) * w[1], wz = s[2] + (s[4] - s[2]) * w[1]; if (Math.hypot(wx - x, wz - z) < 1e-6 && Math.abs(g.positions[v * 3 + 1] - y0) < 1e-9) { match++; break; } }
  if (vv === 1) { let best = 1e9; for (const s of kept) { const dl = Math.abs((s[4] - s[2]) * (x - s[1]) - (s[3] - s[1]) * (z - s[2])) / Math.hypot(s[3] - s[1], s[4] - s[2]); if (dl < best) best = dl; }
    if (best < 1e-6 && g.positions[v * 3 + 1] >= y0 - 1e-9) match++; } }
const inlandMax = (function () { let m = 0; for (let v = 0; v < nv; v += R) { const a = v + 1, c = v + R - 1; m = Math.max(m, Math.hypot(g.positions[c * 3] - g.positions[a * 3], g.positions[c * 3 + 2] - g.positions[a * 3 + 2])); } return m; })();
const inRibbons = B.ribbons(kept).reduce(function (n, r) { return n + (r.length >= 2 ? r.length : 0); }, 0);
check('island-waterline-baked', F.ISLAND_WATERLINE.length === S.lip.length && F.ISLAND_WATERLINE.every(function (r, i) { return r.length === 7 && r[0] === S.lip[i][0] && r[1] >= 0 && r[1] < 1 && (r[2] < F.ISLAND_ROCK.minClear || r.slice(3).every(function (h) { return h === h; })); }), { rows: F.ISLAND_WATERLINE.length });
// beach rows follow the baked beach heights (never under the sand they were sampled on)
check('island-ribbon-on-the-sand', (function () { let bad = 0, n = 0; for (let v = 0; v < nv; v += R) { const sg = null; for (let r = 2; r < R; r++) { const y = g.positions[(v + r) * 3 + 1]; if (y < y0 - 1e-9) bad++; n++; } } return bad === 0; })(), {});
check('island-ribbon-on-the-lip', match === inRibbons * 2 && house === 0 && liftOk && inlandMax <= F.ISLAND_RIBBON.inland + 1e-6, { waterlineAndInlandOnLipLines: match, expected: inRibbons * 2, inHouse: house, inlandMaxM: +inlandMax.toFixed(3) });
check('island-no-swash-on-rock', (function () {
  // every kept lip line baked as rock: the inland row is invisible and at most ISLAND_ROCK.inland past the waterline, flat at the sea
  let rows = 0, bad = 0; const groups = B.ribbons(kept); let v0 = 0;
  for (const segs of groups) { if (segs.length < 2) continue; for (const sg of segs) { const w = F.ISLAND_WATERLINE.filter(function (r) { return r[0] === sg[0]; })[0];
    if (!(w[2] >= F.ISLAND_ROCK.minClear)) { rows++; const a = v0 + 1, c = v0 + R - 1; const d = Math.hypot(g.positions[c * 3] - g.positions[a * 3], g.positions[c * 3 + 2] - g.positions[a * 3 + 2]);
      const nb = [-1, 1].some(function (o2) { const q = segs[segs.indexOf(sg) + o2]; return q && F.ISLAND_WATERLINE.filter(function (r) { return r[0] === q[0]; })[0][2] >= F.ISLAND_ROCK.minClear; });
      if (g.colors[c * 4 + 3] !== 0 || (!nb && (d > F.ISLAND_ROCK.inland + 1e-6 || Math.abs(g.positions[c * 3 + 1] - y0) > 1e-9)) || g.colors[a * 4 + 3] > F.ISLAND_ROCK.edgeA + 1e-9) bad++; }
    v0 += R; } }
  return rows >= 20 && bad === 0; })(), { rockRows: F.ISLAND_WATERLINE.filter(function (r) { return !(r[2] >= F.ISLAND_ROCK.minClear); }).length, beachRows: F.ISLAND_WATERLINE.filter(function (r) { return r[2] >= F.ISLAND_ROCK.minClear; }).map(function (r) { return r[0]; }) });
check('island-ribbon-offshore', (function () { let ok = true; for (let v = 0; v < nv; v += R) { const o = Math.hypot(g.positions[v * 3], g.positions[v * 3 + 2]), w = Math.hypot(g.positions[(v + 1) * 3], g.positions[(v + 1) * 3 + 2]); if (o < w + 1.5) ok = false; } return ok; })(), 'v = 0 lies >= 1.5 m further out than the real waterline (v = 0.5)');

// ---- swash timing (island): the old lip's beat, continuous, lines wrap with the loop
const fps = 60, L = S.loopS; let maxStep = { front: 0, foamA: 0, wet: 0 }, prev = null, hitFront = [];
for (let i = 0; i <= Math.round(2 * L * fps); i++) { const t = i / fps, s = F.islandSwash(t);
  if (prev) for (const k of ['front', 'foamA', 'wet']) maxStep[k] = Math.max(maxStep[k], Math.abs(s[k] - prev[k])); prev = s; }
for (const sw of S.swells) hitFront.push(+F.islandSwash(sw.hit).front.toFixed(3));
check('island-swash-continuous', maxStep.front < 0.06 && maxStep.foamA < 0.06 && maxStep.wet < 0.06, maxStep);
const peak = S.swells.map(function (sw) { return +F.islandSwash(sw.hit + F.ISLAND_SWASH.up).front.toFixed(3); });
check('island-swash-on-the-hits', hitFront.every(function (f) { return f === 0; }) && peak.every(function (f) { return f > 0.99; }) && F.islandSwash(S.swells[0].hit - 0.05).foamA === 0 && F.islandSwash(S.swells[0].hit - 0.05).wet <= 0.3, { frontAtHit: hitFront, frontAtRunUpEnd: peak, wetBeforeHit: +F.islandSwash(S.swells[0].hit - 0.05).wet.toFixed(3) });
const P = F.ISLAND_FOAM, lineWrap = Math.abs(((P.lineParams[1] * L) % 1 + 1) % 1) < 1e-9 || Math.abs(((P.lineParams[1] * L) % 1) - 1) < 1e-9;
let wrapJump = 0; for (let k = 0; k <= 40; k++) { const u = k * 1.7, v = k / 40;
  const a = F.sampleShoreFoam(P, F.islandSwash(L - 1e-6), u, v, 10, 1), b = F.sampleShoreFoam(P, F.islandSwash(0), u, v, 10, 1); wrapJump = Math.max(wrapJump, Math.abs(a[3] - b[3])); }
check('island-loop-wrap-seamless', lineWrap && wrapJump < 0.02, { linesPerLoop: P.lineParams[1] * L, wrapJump });

// ---- per-pixel flicker + caps (both sites, day and night)
// flicker = a sample whose alpha changes direction often (>|0.04|); a lip edge or a line passing a sample is 2 reversals each
function sweep(Pp, swashAt, seconds, light) {
  let maxA = 0, maxRgb = 0, maxDa = 0, prevA = null; const N = 24, M = 60, dir = [], rev = [], last = [];
  for (let f = 0; f <= seconds * fps; f++) { const s = swashAt(f / fps), cur = [];
    for (let i = 0; i < N; i++) for (let j = 0; j <= M; j++) { const c = F.sampleShoreFoam(Pp, s, i * 2.3, j / M, 8 + i, 1, light); cur.push(c[3]); maxA = Math.max(maxA, c[3]); if (c[3] > 0.02) maxRgb = Math.max(maxRgb, c[0], c[1], c[2]); }
    if (prevA) for (let k = 0; k < cur.length; k++) { maxDa = Math.max(maxDa, Math.abs(cur[k] - prevA[k]));
      if (last[k] === undefined) last[k] = cur[k]; const d = cur[k] - last[k];
      if (Math.abs(d) > 0.04) { const sg = d > 0 ? 1 : -1; if (dir[k] && dir[k] !== sg) rev[k] = (rev[k] || 0) + 1; dir[k] = sg; last[k] = cur[k]; } }
    prevA = cur; }
  let maxRev = 0; for (let k = 0; k < rev.length; k++) if (rev[k] > maxRev) maxRev = rev[k];
  return { maxA: +maxA.toFixed(3), maxRgb: +maxRgb.toFixed(3), maxDaPerFrame: +maxDa.toFixed(3), reversalsPerSecond: +(maxRev / seconds).toFixed(2) };
}
const isleDay = sweep(Object.assign({}, P, { tint: F.islandFoamTint(0) }), F.islandSwash, L), isleNight = sweep(Object.assign({}, P, { tint: F.islandFoamTint(1) }), F.islandSwash, L);
const lakeDay = sweep(F.LAKE_FOAM, function (t) { return F.lakeSwash(t + 1000); }, F.LAKE_FOAM.cycle[0], [3, 3, 3]), lakeNight = sweep(F.LAKE_FOAM, function (t) { return F.lakeSwash(t + 1000); }, F.LAKE_FOAM.cycle[0], [0.25, 0.3, 0.45]);
const cap = function (Q) { return Q.foamColor[3] + Q.wetColor[3] * (1 - Q.foamColor[3]) + 1e-3; };
check('no-white-blocks', isleDay.maxA <= cap(P) && lakeDay.maxA <= cap(F.LAKE_FOAM) && isleDay.maxRgb <= 1 && lakeDay.maxRgb <= 1, { isleDay, lakeDay, capIsle: +cap(P).toFixed(3), capLake: +cap(F.LAKE_FOAM).toFixed(3) });
check('night-darker', isleNight.maxRgb <= 0.65 && lakeNight.maxRgb <= 0.46, { isleNight: isleNight.maxRgb, lakeNight: lakeNight.maxRgb });
check('no-flicker', isleDay.reversalsPerSecond <= 3 && lakeDay.reversalsPerSecond <= 3 && isleNight.reversalsPerSecond <= 3, { isle: isleDay, lake: lakeDay, note: 'reversals/s of one sample: lines + lip passing; flicker would be ~30/s' });
let lakeStep = 0, lp = null; for (let i = 0; i <= 3 * 7 * fps; i++) { const s = F.lakeSwash(5000 + i / fps); if (lp) lakeStep = Math.max(lakeStep, Math.abs(s.front - lp.front), Math.abs(s.foamA - lp.foamA), Math.abs(s.wet - lp.wet)); lp = s; }
check('lake-swash-continuous', lakeStep < 0.05, { lakeStep });
// night tint is the old lip's multiply
const nt = F.islandFoamTint(1); check('island-night-multiply', nt[0] === S.night[0] && nt[1] === S.night[1] && nt[2] === S.night[2]);

// ---- lakeside ribbon GLB
const glbPath = path.join(A, 'bundles/region_lakeside/models/LK_shore_foam.glb'), buf = fs.readFileSync(glbPath), jl = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + jl).toString('utf8')), bin = buf.slice(28 + jl);
const pr = J.meshes[0].primitives[0], acc = function (i) { const a = J.accessors[i], v = J.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], C = a.componentType === 5126 ? Float32Array : a.componentType === 5123 ? Uint16Array : Uint8Array;
  return new C(bin.buffer.slice(bin.byteOffset + (v.byteOffset || 0), bin.byteOffset + (v.byteOffset || 0) + a.count * n * C.BYTES_PER_ELEMENT)); };
const LP = acc(pr.attributes.POSITION), LT = acc(pr.attributes.TEXCOORD_0), LC = acc(pr.attributes.COLOR_0), LI = acc(pr.indices), lnv = LP.length / 3;
const vs = {}; for (let i = 0; i < lnv; i++) vs[LT[i * 2 + 1].toFixed(2)] = 1;
let lmax = 0, inLake = true, yOk = true; for (let i = 0; i < LI.length; i++) lmax = Math.max(lmax, LI[i]);
for (let i = 0; i < lnv; i++) { const x = LP[i * 3], y = LP[i * 3 + 1], z = LP[i * 3 + 2]; if (x < -50 || x > 50 || z < -53 || z > 37) inLake = false; if (!(y >= 0.029)) yOk = false; if (LC[i * 4] !== 0) yOk = false; }
const lmeta = JSON.parse(fs.readFileSync(glbPath + '.meta', 'utf8')), tc = Object.keys(lmeta.subMetas).map(function (k) { return lmeta.subMetas[k]; }).filter(function (m) { return /\.mesh$/.test(m.name); })[0].userData.triangleCount;
check('lake-ribbon-glb', J.nodes[0].name === 'LK_shore_foam' && J.materials[0].name === 'M_LK_palette' && J.meshes.length === 1 && lmax < lnv && lnv < 65535 && tc === LI.length / 3
  && Object.keys(vs).sort().join(',') === F.LAKE_FOAM_ROWS.map(function (v) { return v.toFixed(2); }).sort().join(',') && inLake && yOk, { verts: lnv, tris: LI.length / 3, bytes: buf.length, rows: Object.keys(vs).length });
const tool = fs.readFileSync(path.join(__dirname, 'lakeside_shore_ribbon.cjs'), 'utf8');
check('lake-rows-in-sync', tool.includes('const ROWS=[' + F.LAKE_FOAM_ROWS.join(',') + ']'));

// ---- wiring
const sb = fs.readFileSync(path.join(scripts, 'render/ShoreBreak.ts'), 'utf8'), sf = fs.readFileSync(path.join(scripts, 'render/ShoreFoam.ts'), 'utf8');
const bg = fs.readFileSync(path.join(scripts, 'region/LakesideBoardBackground.ts'), 'utf8'), ls = fs.readFileSync(path.join(scripts, 'region/LakesideShoreFoam.ts'), 'utf8');
check('island-wired', sb.includes('this.foam = new ShoreFoam(scene)') && sb.includes('this.foam.update(foamOn, islandSwash(this.time), islandFoamTint(this.nightShown), seaSheetLift(this.time, phase))') && sb.includes('&& !foamOn') && sb.includes('this.foam.dispose()')
  && sf.includes("SHORE_FOAM_EFFECT = 'world/shore-foam'") && sf.includes('USE_CC_TIME: false, USE_LIT: false'));
check('lake-wired', bg.includes('if(i.glb===LAKESIDE_SHORE_GLB)shore.push(node)') && bg.includes('await mountLakesideShore(shore,take)') && bg.includes('isLakesideShoreMaterial(src))continue') && bg.includes('applyLakesideShoreMode(mode)')
  && ls.includes("LAKESIDE_SHORE_GLB = 'LK_shore_foam.glb'") && ls.includes('USE_CC_TIME: true, USE_LIT: true') && ls.includes('off(nodes)'));
// loose ES5 on the shipped files
let es5 = []; for (const f of ['render/ShoreFoamCore.ts', 'render/ShoreFoam.ts', 'region/LakesideShoreFoam.ts']) { const t = fs.readFileSync(path.join(scripts, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''); if (/Array\.from|Object\.entries|padStart|\.\.\.[A-Za-z_(]/.test(t)) es5.push(f); }
check('loose-es5', !es5.length, es5);

const failed = checks.filter(function (c) { return !c.ok; });
console.log(failed.length ? 'FAILED ' + failed.length + '/' + checks.length : 'ALL PASS shore-foam (' + checks.length + ')');
process.exitCode = failed.length ? 1 : 0;
