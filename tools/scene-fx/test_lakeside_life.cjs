'use strict';
/** R5 lakeside life: wind chimes swing downwind, wind ripples in lakeside-water.effect, night-only fireflies drift downwind.
 * Pure-core checks + effect/hook text checks + loose ES5. Usage: node tools/scene-fx/test_lakeside_life.cjs */
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..', '..'), A = path.join(root, 'creator-build-project/assets'), S = path.join(A, 'scripts');
const ts = require('../qf-env.cjs').typescript(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lklife-'));
function load(rel, name) { fs.writeFileSync(path.join(tmp, name + '.js'), ts.transpileModule(fs.readFileSync(path.join(S, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 } }).outputText); return require(path.join(tmp, name + '.js')); }
const C = load('render/LakesideLifeCore.ts', 'LakesideLifeCore'), G = load('render/GlobalWind.ts', 'GlobalWind');
let fail = 0; function check(n, ok, info) { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (info === undefined ? '' : ' ' + JSON.stringify(info))); }
function rot(q, v) { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; }
// lake root yaw 180 (lakesideJourney / board): default world wind (0.944,-0.330) -> lake-local (-0.944, 0.330)
const W = G.GLOBAL_WIND_DEFAULT, loc = C.windToLocal(W.dirX, W.dirZ, 180);
check('wind-to-lake-local', Math.abs(loc[0] + 0.944) < 1e-3 && Math.abs(loc[1] - 0.330) < 1e-3, loc.map(v => +v.toFixed(3)));
let down = true, maxA = 0;
for (const d of [[1, 0], [0, 1], [-0.944, 0.33], [0.6, -0.8]]) for (let t = 0; t < 12; t += 0.05) { const s = C.chimeSwing(t, 3, d[0], d[1], 1), q = C.axisAngleQuat(s.axis, s.angle), tip = rot(q, [0, -0.85, 0]);
  maxA = Math.max(maxA, Math.abs(s.angle)); if (tip[0] * d[0] + tip[2] * d[1] < -1e-9) down = false; }
check('chime-leans-downwind', down, 'tip never upwind over 12 s, 4 wind dirs');
check('chime-amplitude', maxA < 0.21 && maxA > 0.12, +maxA.toFixed(3));
check('chime-still-at-0', Math.abs(C.chimeSwing(3.3, 1, 1, 0, 0).angle) < 1e-12);
const B = C.LAKESIDE_LIFE.fireflyBox; let inBox = true, drift = 0;
for (let i = 0; i < C.LAKESIDE_LIFE.fireflyCount; i++) { const a = C.fireflyAt(10, i, loc[0], loc[1]), b = C.fireflyAt(10.5, i, loc[0], loc[1]);
  for (let k = 0; k < 3; k++) if (a.pos[k] < B.min[k] - 1e-9 || a.pos[k] > B.max[k] + 1e-9) inBox = false;
  if (a.glow < 0 || a.glow > 1) inBox = false; drift += ((b.pos[0] - a.pos[0]) * loc[0] + (b.pos[2] - a.pos[2]) * loc[1]); }
check('fireflies-in-box-glow-0..1', inBox);
// mean downwind drift over many seeds/times
let mean = 0, n = 0; for (let i = 0; i < 14; i++) for (let t = 0; t < 60; t += 0.5) { const a = C.fireflyAt(t, i, loc[0], loc[1]), b = C.fireflyAt(t + 0.1, i, loc[0], loc[1]), dd = (b.pos[0] - a.pos[0]) * loc[0] + (b.pos[2] - a.pos[2]) * loc[1]; if (Math.abs(dd) < 0.2) { mean += dd / 0.1; n++; } }
check('fireflies-drift-downwind', mean / n > 0.1, +(mean / n).toFixed(3) + ' m/s');
check('fireflies-few', C.LAKESIDE_LIFE.fireflyCount <= 16 && C.fireflyMesh(1).indices.length / 3 === 8, C.LAKESIDE_LIFE.fireflyCount + ' x 8 tris');
const fx = fs.readFileSync(path.join(A, 'bundles/region_lakeside/water/lakeside-water.effect'), 'utf8');
const wp = /windParams:\s*\{\s*value:\s*\[([^\]]+)\]/.exec(fx), wv = wp ? wp[1].split(',').map(Number) : [];
check('effect-wind-default', wv[0] === W.dirX && wv[1] === W.dirZ && wv[2] === W.strength, wv);
check('effect-ubo', /vec4 lightParams;\s*vec4 windParams;\s*vec4 rippleParams;\s*\};/.test(fx) && /rippleParams\.x \* windParams\.z \* wf/.test(fx));
const bb = fs.readFileSync(path.join(S, 'region/LakesideBoardBackground.ts'), 'utf8');
check('hook-water', /setProperty\('windParams',new Vec4\(gw\.dirX,gw\.dirZ,gw\.strength,0\)\)/.test(bb));
check('hook-mount', /mountLakesideLife\(scenery\);/.test(bb) && /skip\(child\)\|\|isLakesideLifeNode\(child\)/.test(bb));
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''), BAN = /Array\.from|Object\.entries|padStart|\.\.\.[A-Za-z_(]|\?\?|\?\./;
const es5 = ['render/LakesideLifeCore.ts', 'region/LakesideLife.ts'].filter(f => BAN.test(strip(fs.readFileSync(path.join(S, f), 'utf8')).replace(/catch\(e\)\{try\{console\.warn[^\n]*/g, '')));
check('loose-es5', !es5.length, es5);
console.log(fail ? 'FAIL lakeside life ' + fail : 'PASS lakeside life (chimes downwind, ripples on GlobalWind, night fireflies)');
process.exit(fail ? 1 : 0);
