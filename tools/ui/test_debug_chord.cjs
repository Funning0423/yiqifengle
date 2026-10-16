'use strict';
// Three-finger double-tap and Ctrl/Cmd+Shift+D. The gesture is pure so a web CDP injection
// (touches on document, often without a matching touchend) can be checked without Cocos.
const fs = require('node:fs'), assert = require('node:assert/strict');
const ts = require('../qf-env.cjs').typescript();
const src = fs.readFileSync('creator-build-project/assets/scripts/ui/DebugJumpPanel.ts', 'utf8');
const start = src.indexOf('const CHORD_MIN_MS');
const end = src.indexOf('export class DebugJumpPanel');
assert(start > 0 && end > start, 'chord helpers must sit above the panel class');
const js = ts.transpileModule(src.slice(start, end).replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
const api = new Function(js + '\nreturn { isDebugShortcut, considerDebugChord, debugDomTouch };')();
const { isDebugShortcut, considerDebugChord, debugDomTouch } = api;
const chord = () => ({ armed: false, chordAt: 0 });
const tap = (s, t, phase, fingers) => considerDebugChord(s, t, fingers, phase);

const one = chord();
assert.equal(tap(one, 1000, 'start', 3), false, 'a single three-finger chord does not open');
assert.equal(tap(one, 1100, 'end', 0), false);
assert.equal(tap(one, 1300, 'start', 3), true, 'lift then a second chord inside 700 ms toggles');

const held = chord();
assert.equal(tap(held, 2000, 'start', 3), false);
assert.equal(tap(held, 2050, 'start', 3), false, 'a second start 50 ms later is still the same press');
assert.equal(tap(held, 2120, 'start', 3), true, 'a second start >= 80 ms later counts even if the fingers never lifted');

const late = chord();
tap(late, 3000, 'start', 3); tap(late, 3200, 'end', 0);
assert.equal(tap(late, 4000, 'start', 3), false, 'a second chord after 700 ms starts a new pair');
assert.equal(tap(late, 4200, 'end', 0), false);
assert.equal(tap(late, 4400, 'start', 3), true);

const slid = chord();
tap(slid, 5000, 'start', 3);
assert.equal(considerDebugChord(slid, 5100, 0, 'cancel'), false);
assert.equal(tap(slid, 5300, 'start', 3), false, 'a cancelled chord does not pair');

assert.equal(isDebugShortcut({ ctrlKey: true, shiftKey: true, key: 'd' }), true);
assert.equal(isDebugShortcut({ metaKey: true, shiftKey: true, code: 'KeyD' }), true);
assert.equal(isDebugShortcut({ ctrlKey: true, shiftKey: true, keyCode: 68 }), true);
assert.equal(isDebugShortcut({ ctrlKey: true, shiftKey: true, key: 'd', repeat: true }), false);
assert.equal(isDebugShortcut({ ctrlKey: true, key: 'd' }), false);
assert.equal(isDebugShortcut({ shiftKey: true, key: 'D' }), false);

assert(/touchend/.test(src) && /TOUCH_END/.test(src), 'touch end is observed');
assert(/win\.addEventListener\('keydown'/.test(src) && /doc\.addEventListener\('keydown'/.test(src), 'shortcut listens on window and document');
assert(!/if \(sys\.isBrowser\) \{[\s\S]{0,240}return;/.test(src), 'browser touch handling must not skip the Cocos listener');
assert(/Date\.now\(\) - this\.lastDom < 50/.test(src), 'one gesture is not counted twice');
assert(/lastShortcut < 30/.test(src), 'window and document do not double-toggle the shortcut');
assert(/debugDomTouch\(this\.chord/.test(src), 'the panel feeds DOM touches through the same helper');
assert(/win\.addEventListener\('touchstart'/.test(src) || /target\.addEventListener\('touchstart'/.test(src), 'touchstart is observed on window as well as document');

// Chrome device emulation: one touchstart per finger, live list grows 1 → 2 → 3, often in the same millisecond.
function chromeChord(state, clock, t) {
  debugDomTouch(state, clock, t, 'start', 1);
  debugDomTouch(state, clock, t, 'start', 2);
  return debugDomTouch(state, clock, t, 'start', 3);
}
const dom = chord(), clock = { last: 0 };
assert.equal(chromeChord(dom, clock, 8000), false, 'the third finger of the first chord is not dropped by the 50 ms dedupe');
assert.equal(dom.armed, true, 'three live touches arm the chord');
debugDomTouch(dom, clock, 8100, 'end', 2);
debugDomTouch(dom, clock, 8100, 'end', 1);
debugDomTouch(dom, clock, 8100, 'end', 0);
assert.equal(chromeChord(dom, clock, 8300), true, 'lift, then a second three-finger chord inside 700 ms toggles');

const already = chord(), clock2 = { last: 0 };
assert.equal(debugDomTouch(already, clock2, 9000, 'start', 3), false, 'one event whose touches.length is already 3 does not toggle');
debugDomTouch(already, clock2, 9100, 'end', 0);
assert.equal(debugDomTouch(already, clock2, 9300, 'start', 3), true, 'a second already-complete chord toggles');

const stray = chord(), clock3 = { last: 0 };
debugDomTouch(stray, clock3, 10000, 'start', 3);
assert.equal(debugDomTouch(stray, clock3, 10010, 'start', 1), false);
assert.equal(stray.armed, true, 'a 1-finger start does not disarm an in-progress chord');
console.log(JSON.stringify({ status: 'PASS', checks: ['chord pair', 'held retap', 'late pair', 'cancel', 'shortcut', 'listeners', 'chrome touch sequence'] }));
