'use strict';
/** New ManagedMobileBoardUI on the board-ui harness, driven by a managed binding double (same shape as ManagedBoardSession). */
const { createHarness } = require('./harness.cjs');

function snapshot(provider = 'mainline-v33', region = 0) {
  return {
    provider, state: 'run.ready', readOnly: false, stages: [],
    journey: { inventory: { tools: { windBell: 2, tideBottle: 2, tideNet: 1, sunSeed: 1, starShears: 1 } }, regionRewards: [{ region, claimed: true }], chests: [], mementos: [] },
    active: { stageId: 'test', attemptId: 'test-1', level: region * 4, name: 'test', board: Array.from({ length: 49 }, (_, i) => ({ id: i, type: i % 6 })), moss: [], roots: [], moves: 20, bombs: 2, score: 0, status: 'playing', actions: [], goals: { type0: 20 }, goalOrder: ['type0'], tool: { kind: ['tideAnchor', 'sunSeed', 'prismShift'][region], charges: 1 }, scene: {} },
    capabilities: { oceanEvents: false },
  };
}

function createBoard(options = {}) {
  const H = options.harness || createHarness(options.harnessOptions);
  const provider = options.provider || 'mainline-v33', region = options.region || 0;
  H.setViewport(options.width || 390, options.height || 844);
  const { managedTools } = H.load('world-r2/ManagedTools');
  const { ManagedMobileBoardUI } = H.load('ManagedMobileBoardUI');
  const s = options.snapshot || snapshot(provider, region), u = new ManagedMobileBoardUI(), owner = new H.cc.Node('owner');
  u.node = owner; owner.components.push(u); H.cc._scene.addChild(owner);
  const log = { commands: [], tools: [], submits: [], restarts: 0, hints: 0, hidden: 0 };
  let view = null;
  const binding = {
    controller: { snapshot: () => s },
    tools: () => managedTools(s),
    useTool(kind, i) { log.tools.push([kind, i]); if (kind === 'bomb') s.active.bombs--; else if (provider === 'mainline-v33') s.journey.inventory.tools[kind]--; else s.active.tool.charges--; s.state = 'run.resolving'; view.render(s); return { ok: true }; },
    submit(a) { log.submits.push(a); return { ok: true }; },
    afterPaint() {},
    bind(_c, v) {
      view = v; v.render(s);
      return {
        command(name, ...args) {
          log.commands.push([name, ...args]);
          if (options.command) { const r = options.command(name, args, s, v); if (r) return r; }
          if (name === 'previewAction') return { ok: true, token: 't' };
          if (name === 'pause') { s.state = 'run.paused'; v.render(s); }
          if (name === 'resume') { s.state = 'run.ready'; v.render(s); }
          return { ok: true };
        },
        hide() { log.hidden++; s.state = 'run.paused'; v.cancelAnimations(); v.render(s); }, show() {}, dispose() {},
      };
    },
    restart() { log.restarts++; return { ok: true }; },
    hint() { log.hints++; return options.hintCells === null ? null : { cells: options.hintCells || [0, 1] }; },
  };
  u.initializeManaged({}, binding);
  const render = () => u.render(s);
  const step = (seconds, dt = 1 / 30) => { for (let t = 0; t < seconds - 1e-9; t += dt) u.update(dt); };
  return { H, u, s, log, render, step, binding, snapshot: s, find: name => u.root.find(name), view: () => view };
}
module.exports = { createBoard, snapshot };
