'use strict';
// Shared board / island double for the cloud-* tests: the real TypeScript sources on the board-ui harness
// (tools/board-ui/harness.cjs). The old prelude of test_tool_switch_ui.cjs evaluated the pre-board-ui board.
const path = require('node:path');
const { createHarness } = require('../board-ui/harness.cjs');
const { createBoard } = require('../board-ui/board-fixture.cjs');
module.exports = function loadHarness(options = {}) {
  const H = createHarness(options), cc = H.cc;
  const evaluate = (file, names) => { const m = H.load(path.isAbsolute(file) ? file : path.join(H.SCRIPTS, file)); return Object.fromEntries(names.map(n => [n, m[n]])); };
  const setup = (provider = 'mainline-v33', region = 0, w = 390, h = 844, extra = {}) => { const b = createBoard({ harness: H, provider, region, width: w, height: h, ...extra }); return { u: b.u, s: b.s, b, ready() { b.s.state = 'run.ready'; b.u.render(b.s); } }; };
  const tapNode = (n, id = 1) => H.tap(n, id);
  return { H, setup, tapNode, event: H.event, point: H.point, evaluate, root: H.SCRIPTS, cc, Node: cc.Node, UITransform: cc.UITransform, Graphics: cc.Graphics, Label: cc.Label, Sprite: cc.Sprite, Color: cc.Color, Vec3: cc.Vec3, flush: H.flush, warm: H.load('WarmButton') };
};
