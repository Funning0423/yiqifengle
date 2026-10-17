#!/usr/bin/env node
'use strict';
/**
 * FAKE WeChat DevTools CLI for Linux dry-runs of wechat_first_open_audit.cjs. NOT DevTools. Supports: islogin, auto, open, close, quit.
 * `auto` starts fake-automator-server/server.cjs (speaks the real miniprogram-automator websocket protocol) for the project.
 * QF_FAKE_SCENARIO: clean (default: config-driven) | game-error | late-error | exception | no-log-forward | connect-fail
 */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const state = process.env.QF_FAKE_STATE_DIR || path.join(os.tmpdir(), 'qf-fake-devtools');
fs.mkdirSync(state, {recursive: true});
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const key = (p) => Buffer.from(path.resolve(p)).toString('hex').slice(-40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const cmd = args[0];
  console.log('- initialize');
  if (cmd === 'islogin') { console.log(JSON.stringify({login: true})); return; }
  if (cmd === 'auto' || cmd === 'open') {
    const project = opt('--project');
    if (!project || !fs.existsSync(path.join(project, 'project.config.json'))) { console.error('✖ project.config.json not found'); process.exit(1); }
    if (process.env.QF_FAKE_SCENARIO === 'connect-fail') { console.error('✖ fake: IDE failed to start automation'); process.exit(1); }
    const port = cmd === 'auto' ? opt('--auto-port') : '0';
    const ready = path.join(state, key(project) + '.ready');
    try { fs.unlinkSync(ready); } catch {}
    const out = fs.openSync(path.join(state, key(project) + '.server.log'), 'a');
    const child = cp.spawn(process.execPath, [path.join(__dirname, 'fake-automator-server', 'server.cjs'), project, port, ready], {detached: true, stdio: ['ignore', out, out], env: process.env});
    fs.writeFileSync(path.join(state, key(project) + '.pid'), String(child.pid));
    child.unref();
    console.log('✔ IDE server has started, listening on http://127.0.0.1:0 (fake)');
    for (let i = 0; i < 100 && !fs.existsSync(ready); i++) await sleep(100);
    if (!fs.existsSync(ready)) { console.error('✖ fake server did not start'); process.exit(1); }
    console.log('- preparing'); console.log(cmd === 'auto' ? '✔ auto' : '✔ open');
    return;
  }
  if (cmd === 'close' || cmd === 'quit') {
    const pids = fs.readdirSync(state).filter((f) => f.endsWith('.pid') && (cmd === 'quit' || f === key(opt('--project') || '') + '.pid'));
    for (const f of pids) { try { process.kill(Number(fs.readFileSync(path.join(state, f), 'utf8'))); } catch {} fs.unlinkSync(path.join(state, f)); }
    console.log(`✔ ${cmd} (fake, ${pids.length} window(s))`);
    return;
  }
  console.error('fake cli: unsupported ' + cmd); process.exit(1);
})();
