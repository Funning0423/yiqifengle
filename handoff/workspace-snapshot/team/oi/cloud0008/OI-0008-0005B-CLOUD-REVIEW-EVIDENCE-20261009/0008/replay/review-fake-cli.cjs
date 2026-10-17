#!/usr/bin/env node
'use strict';
// Cloud-only audit reviewer stub. Never invokes DevTools or kills a process.
const fs = require('fs'), path = require('path');
const [command, ...args] = process.argv.slice(2);
const option = (k) => args[args.indexOf(k) + 1];
if (!['islogin', 'auto', 'open', 'close'].includes(command)) throw new Error('Disallowed review CLI command: ' + command);
if (command === 'islogin') { console.log('{"login":true,"fake":true}'); process.exit(0); }
if (command === 'close') { console.log('fake close; no process killed'); process.exit(0); }
const project = option('--project'), port = option('--auto-port');
const pc = JSON.parse(fs.readFileSync(path.join(project, 'project.config.json'), 'utf8'));
const isTarget = !!pc.condition;
const log = path.join(process.env.QF_DEVTOOLS_LOG_DIR, 'review', 'WeappLog', 'review.log');
const err = '[app.json 或自定义编译条件错误] app.json 中未定义自定义编译中指定的启动页面';
const scenario = process.env.QF_REVIEW_SCENARIO;
if (scenario !== 'no-control-no-logs') {
  fs.mkdirSync(path.dirname(log), {recursive: true});
  if (scenario === 'missing-root' && isTarget) fs.appendFileSync(log, '[TARGET ERROR] ' + err + '\n');
  else if (scenario === 'rotation' && isTarget) fs.writeFileSync(log, '[TARGET ERROR AFTER TRUNCATE] ' + err + '\n');
  else if (!isTarget) fs.appendFileSync(log, (scenario === 'unrelated-control' ? '[UNRELATED OTHER PROJECT ERROR] ' : '[CONTROL ERROR] ') + err + '\n');
  else fs.appendFileSync(log, '[TARGET no error]\n');
}
fs.mkdirSync(process.env.QF_REVIEW_STATE, {recursive: true});
fs.writeFileSync(path.join(process.env.QF_REVIEW_STATE, port + '.json'), JSON.stringify({project}));
console.log('cloud review fake auto complete');
if (scenario === 'cli-nonzero' && isTarget) process.exit(7);
if (scenario === 'cli-lingers' && isTarget) {
  console.error('[app.json 或自定义编译条件错误] TARGET ERROR on still-running CLI');
  setTimeout(() => { console.log('fake CLI finally exits'); }, 21000);
}
