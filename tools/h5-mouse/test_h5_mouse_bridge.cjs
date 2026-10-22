// P2-1 (report 20261023T0324): H5 mouse clicks must reach TOUCH_* handlers; WeChat untouched; no double fire.
'use strict';
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = path.resolve(__dirname, '../..');
const F = path.join(ROOT, 'creator-build-project/assets/scripts/input/WebMouseTouchBridge.ts');
const ts = require(process.env.QF_TYPESCRIPT_MODULE || '/tmp/ts5/node_modules/typescript');
let fail = 0, pass = 0;
const ok = (c, m, d) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (d === undefined ? '' : ' ' + JSON.stringify(d))); c ? pass++ : fail++; };
const src = fs.readFileSync(F, 'utf8');
const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
const m = new Module(F); m.filename = F; m.paths = [];
m.require = id => { if (id === 'cc/env') return { EDITOR: true }; if (id === 'cc') return { sys: {} }; throw Error('unexpected ' + id); };
m._compile(code, F);
const { installMouseTouchBridge, MOUSE_TOUCH_ID } = m.exports;

class Target { constructor() { this.l = {}; } addEventListener(t, f) { (this.l[t] = this.l[t] || []).push(f); } removeEventListener(t, f) { this.l[t] = (this.l[t] || []).filter(x => x !== f); }
  dispatchEvent(e) { (this.l[e.type] || []).slice().forEach(f => f(e)); return true; } }
function world(over = {}) {
  let t = 0; const win = new Target(), canvas = new Target(), got = [];
  win.Touch = function (o) { Object.assign(this, o); };
  win.TouchEvent = function (type, o) { this.type = type; Object.assign(this, o); };
  // the "engine": canvas touch listeners turn DOM touches into TOUCH_* (what cc does in pal/input/web/touch-input)
  for (const ty of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) canvas.addEventListener(ty, e => got.push(ty + ':' + e.changedTouches[0].identifier));
  const env = Object.assign({ win, canvas, engineMouse: false, engineTouch: true, now: () => t }, over);
  const h = installMouseTouchBridge(env);
  const mouse = (type, x, extra = {}) => { const e = Object.assign({ type, button: 0, clientX: x, clientY: 5, pageX: x, pageY: 5, cancelable: true, prevented: false, preventDefault() { this.prevented = true; } }, extra); (type === 'mousedown' ? canvas : win).dispatchEvent(e); return e; };
  const touch = (type, id = 1) => { const e = { type, isTrusted: true, changedTouches: [{ identifier: id }] }; win.dispatchEvent(e); canvas.dispatchEvent(e); };
  return { h, got, mouse, touch, tick: ms => { t += ms; } };
}

{ const w = world(); ok(w.h.active && w.h.reason === 'mouse-to-touch', 'web, engine without mouse: bridge active', w.h.reason);
  const d = w.mouse('mousedown', 10); w.mouse('mousemove', 12); w.mouse('mouseup', 12);
  ok(JSON.stringify(w.got) === JSON.stringify([`touchstart:${MOUSE_TOUCH_ID}`, `touchmove:${MOUSE_TOUCH_ID}`, `touchend:${MOUSE_TOUCH_ID}`]), 'mouse click → one touchstart/move/end', w.got);
  ok(d.prevented, 'mousedown default prevented (no text selection/focus steal)');
  w.got.length = 0; w.mouse('mousemove', 20); w.mouse('mouseup', 20); ok(w.got.length === 0, 'hover move / stray up without down: nothing');
  w.got.length = 0; w.mouse('mousedown', 10, { button: 2 }); w.mouse('mouseup', 10, { button: 2 }); ok(w.got.length === 0, 'right button ignored');
}
{ const w = world(); w.touch('touchstart'); w.touch('touchend'); w.tick(5); w.mouse('mousedown', 10); w.mouse('mouseup', 10);
  ok(JSON.stringify(w.got) === JSON.stringify(['touchstart:1', 'touchend:1']), 'real tap + compat mouse events: fires once', w.got);
  w.tick(2000); w.got.length = 0; w.mouse('mousedown', 10); w.mouse('mouseup', 10); ok(w.got.length === 2, 'mouse works again after compat window', w.got);
  w.got.length = 0; w.mouse('mousedown', 10, { sourceCapabilities: { firesTouchEvents: true } }); ok(w.got.length === 0, 'firesTouchEvents mouse ignored');
}
{ const w = world({ wx: { onTouchStart() {} } }); ok(!w.h.active && w.h.reason === 'wx', 'WeChat: bridge never installs'); w.mouse('mousedown', 1); w.mouse('mouseup', 1); ok(w.got.length === 0, 'WeChat: no synthetic events'); }
{ const w = world({ engineMouse: true }); ok(!w.h.active && w.h.reason === 'engine-mouse', 'engine already maps mouse→touch: inactive (no double fire)'); }
{ const w = world(); w.h.dispose(); w.mouse('mousedown', 1); w.mouse('mouseup', 1); ok(w.got.length === 0 && !w.h.active, 'dispose removes listeners'); }
ok(/sys\.Feature\.EVENT_MOUSE/.test(src) && /sys\.Feature\.INPUT_TOUCH/.test(src), 'auto-install gates on engine EVENT_MOUSE / INPUT_TOUCH');
console.log(`h5-mouse-bridge: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
