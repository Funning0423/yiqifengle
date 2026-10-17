'use strict';
/**
 * FAKE DevTools automation endpoint for dry-runs. Speaks the JSON-over-websocket protocol used by miniprogram-automator 0.12.1
 * (Tool.getInfo, App.enableLog, App.callFunction, App.captureScreenshot, App.exit, Tool.close; events App.logAdded, App.exceptionThrown).
 * Runs the project's game.js in a node vm with a fake `wx` + console.
 * MODEL (hypothesis under test, not DevTools truth): if project.private.config.json or project.config.json lacks
 * condition.game.current === -1, the fake "IDE" prints the R6 custom-condition error BEFORE game.js runs and before automation logging
 * is enabled — i.e. only visible in the WeappLog file (worst case for the detector).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const [project, portStr, readyFile] = process.argv.slice(2);
const automatorDir = process.env.QF_MINIPROGRAM_AUTOMATOR_MODULE;
const WebSocket = require(require.resolve('ws', {paths: [automatorDir || process.cwd(), __dirname]}));
const scenario = process.env.QF_FAKE_SCENARIO || 'clean';
const logRoot = process.env.QF_DEVTOOLS_LOG_DIR;
const logFile = logRoot && !process.env.QF_FAKE_NO_WEAPPLOG ? path.join(logRoot, 'fakehash0008', 'WeappLog', 'logs', 'fake-devtools.log') : null;
const wlog = (line) => { if (!logFile) return; fs.mkdirSync(path.dirname(logFile), {recursive: true}); fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`); };

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const pc = readJson(path.join(project, 'project.config.json')) || {};
const pv = readJson(path.join(project, 'project.private.config.json'));
const effective = pv && pv.condition ? pv.condition : pc.condition;
const conditionOk = !!(effective && effective.game && effective.game.current === -1);

let sock = null, logEnabled = false;
const send = (o) => { if (sock && sock.readyState === 1) sock.send(JSON.stringify(o)); };
const mkConsole = (level) => (...a) => {
  wlog(`[console.${level}] ${a.map(String).join(' ')}`);
  if (logEnabled && scenario !== 'no-log-forward') send({method: 'App.logAdded', params: {type: level, args: a.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x)))}});
};
const fakeConsole = {log: mkConsole('log'), info: mkConsole('info'), warn: mkConsole('warn'), error: mkConsole('error'), debug: mkConsole('debug')};
const errorHandlers = [];
const sandbox = {console: fakeConsole, setTimeout, clearTimeout, Promise, Date, JSON, Math,
  wx: {onError: (f) => errorHandlers.push(f), onUnhandledRejection: () => {}, getSystemInfoSync: () => ({platform: 'devtools', SDKVersion: '3.17.3'})},
  __FAKE_SCENARIO__: scenario};
const ctx = vm.createContext(sandbox);

wlog(`fake IDE open project ${project} (scenario=${scenario}, conditionOk=${conditionOk})`);
if (!conditionOk) fakeConsole.error('[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面\n(env: fake,mg,0.0.0; lib: 3.17.3)');
try { vm.runInContext(fs.readFileSync(path.join(project, 'game.js'), 'utf8'), ctx, {filename: 'game.js'}); }
catch (e) { fakeConsole.error('game.js threw: ' + e.message); }
if (scenario === 'exception') setTimeout(() => { const err = {message: 'FakeError: thrown in game loop', stack: 'at fakeLoop (game.js:1)'}; errorHandlers.forEach((f) => f(err)); send({method: 'App.exceptionThrown', params: err}); }, 1500);

const wss = new WebSocket.Server({host: '127.0.0.1', port: Number(portStr)}, () => fs.writeFileSync(readyFile, 'ok'));
wss.on('connection', (ws) => {
  sock = ws;
  ws.on('message', async (raw) => {
    const {id, method, params} = JSON.parse(String(raw));
    const reply = (result) => ws.send(JSON.stringify({id, result}));
    const fail = (message) => ws.send(JSON.stringify({id, error: {message}}));
    try {
      if (method === 'Tool.getInfo') return reply({SDKVersion: '3.17.3'});
      if (method === 'App.enableLog') { logEnabled = true; return reply({}); }
      if (method === 'App.callFunction') {
        const fn = vm.runInContext('(' + params.functionDeclaration + ')', ctx);
        return reply({result: await fn(...(params.args || []))});
      }
      if (method === 'App.captureScreenshot') return reply({data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='});
      if (method === 'App.exit' || method === 'Tool.close') { reply({}); if (method === 'Tool.close') setTimeout(() => process.exit(0), 100); return; }
      return fail('fake: unsupported ' + method);
    } catch (e) { return fail(e.message); }
  });
});
setTimeout(() => process.exit(0), 10 * 60 * 1000).unref();
