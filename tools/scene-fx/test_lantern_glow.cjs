'use strict';
/** R5 hand-lantern glow: parameters bound to the lantern height, night-only, effect text + loose ES5. Usage: node tools/scene-fx/test_lantern_glow.cjs */
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..', '..'), A = path.join(root, 'creator-build-project/assets'), S = path.join(A, 'scripts');
const ts = require('../qf-env.cjs').typescript(), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lglow-'));
fs.writeFileSync(path.join(tmp, 'c.js'), ts.transpileModule(fs.readFileSync(path.join(S, 'render/LanternGlowCore.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 } }).outputText);
const C = require(path.join(tmp, 'c.js'));
let fail = 0; function check(n, ok, info) { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (info === undefined ? '' : ' ' + JSON.stringify(info))); }
const L = C.LANTERN_GLOW, g16 = C.lanternGlowFor(0.16), g115 = C.lanternGlowFor(0.115);
check('ref-offset', g16.offset[1] === -0.148 && g16.offset[0] === 0, g16.offset);
check('ref-radius', Math.abs(g16.radius - 0.2) < 1e-9, g16.radius);
check('scales-with-height', Math.abs(g115.radius / g16.radius - 0.115 / 0.16) < 1e-9 && Math.abs(g115.offset[1] - (-0.148 * 0.115 / 0.16)) < 1e-9, g115);
check('explicit-core-offset', C.lanternGlowFor(0.12, [0, -0.11, 0]).offset[1] === -0.11);
check('colour', L.color.join() === '1,0.62,0.25');
check('night-only', C.lanternGlowIntensity(true) === 1 && C.lanternGlowIntensity(false) === 0);
let lo = 9, hi = 0; for (let t = 0; t < 30; t += 0.01) { const p = C.lanternGlowPulse(t); lo = Math.min(lo, p.radiusK, p.intensityK); hi = Math.max(hi, p.radiusK, p.intensityK); }
check('pulse-gentle', lo > 0.9 && hi < 1.1, [+lo.toFixed(3), +hi.toFixed(3)]);
const q = C.lanternGlowQuad(); check('quad-at-origin', q.positions.every(v => v === 0) && q.indices.length === 6);
const fx = fs.readFileSync(path.join(A, 'resources/world/lantern-glow.effect'), 'utf8');
const tv = /tint:\s*\{\s*value:\s*\[([^\]]+)\]/.exec(fx), tint = tv ? tv[1].split(',').map(Number) : [];
check('effect-default-colour', tint[0] === 1 && tint[1] === 0.62 && tint[2] === 0.25, tint);
check('effect-billboard-additive', /vp\.xy \+= a_texCoord \* r;/.test(fx) && /blendDst: one\b/.test(fx) && /depthWrite: false/.test(fx) && !/sampler2D|texture2D|texture\(/.test(fx));
check('effect-meta', fs.existsSync(path.join(A, 'resources/world/lantern-glow.effect.meta')));
const comp = fs.readFileSync(path.join(S, 'render/LanternGlow.ts'), 'utf8');
check('glow-is-child-of-core', /LANTERN_CORE_NODE='lantern\.core'/.test(comp) && /core\.addChild\(node\)/.test(comp) && !/Light\b|SphereLight|PointLight/.test(comp));
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''), BAN = /Array\.from|Object\.entries|padStart|\.\.\.[A-Za-z_(]|\?\?|\?\./;
check('loose-es5', !['render/LanternGlowCore.ts', 'render/LanternGlow.ts'].some(f => BAN.test(strip(fs.readFileSync(path.join(S, f), 'utf8')))));
console.log(fail ? 'FAIL lantern glow ' + fail : 'PASS lantern glow (height-bound size, night-only, billboard additive, child of lantern.core)');
process.exit(fail ? 1 : 0);
