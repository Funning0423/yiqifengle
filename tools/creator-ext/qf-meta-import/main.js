'use strict';
/* qf-meta-import: Creator 3.8.8 project extension, runs once on load, no UI. It never writes a .meta: it only asks asset-db
 * to refresh the new assets (Creator imports them and writes their .meta), then reads the files back and verifies them.
 * APIs (@cocos/creator-types@3.8.8, same as qf-meadow-encode/README.md): asset-db 'query-ready', 'refresh-asset'(url),
 * 'query-uuid'(url); Editor.Project.path; Editor.App.quit(). */
const fs = require('fs'), path = require('path');
const { R4_METAS, dbUrl, verify } = require('./list');
const MARKER = path.join(__dirname, '.qf-meta-import.done'), TAG = '[qf-meta-import]';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const req = (...a) => Editor.Message.request('asset-db', ...a);
async function run() {
  const project = Editor.Project.path, logPath = path.join(project, 'meta-import-ext.log.json');
  const log = { tool: 'qf-meta-import 1.0.0', project, t: { load: new Date().toISOString() }, steps: [], errors: [], status: 'RUNNING' };
  const t0 = Date.now(), mark = s => { log.steps.push({ s, ms: Date.now() - t0 }); console.log(TAG, s); };
  const write = () => fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  try {
    if (fs.existsSync(MARKER)) { console.log(TAG, 'marker present, not running again:', MARKER); return; }
    mark('LOADED'); write();
    let ready = false;
    for (let i = 0; i < 1800 && !ready; i++) { try { ready = !!(await req('query-ready')); } catch (e) { } if (!ready) await sleep(1000); }
    if (!ready) throw new Error('asset-db not ready after 30 min');
    mark('ASSET_DB_READY');
    // folder first, then files (the folder meta must exist before its children import)
    for (const [p] of R4_METAS) { const url = dbUrl(p); try { await req('refresh-asset', url); } catch (e) { log.errors.push('REFRESH ' + url + ' ' + e); } }
    mark('REFRESHED');
    const found = {};
    for (const [p] of R4_METAS) { try { found[p] = JSON.parse(fs.readFileSync(path.join(project, p), 'utf8')); } catch (e) { found[p] = null; } }
    log.found = found;
    for (const b of verify(found)) log.errors.push(b);
    log.status = log.errors.length ? 'DONE_WITH_ERRORS' : 'DONE';
  } catch (e) { log.errors.push(String(e && e.stack || e)); log.status = 'FAILED'; }
  log.t.end = new Date().toISOString(); log.ms = Date.now() - t0;
  try { write(); } catch (e) { console.error(TAG, 'log write failed', e); }
  try { fs.writeFileSync(MARKER, log.t.end + ' ' + log.status + '\n'); } catch (e) { console.error(TAG, 'marker write failed', e); }
  console.log(TAG, log.status, 'log:', logPath);
  if (log.status !== 'FAILED' && process.env.QF_META_IMPORT_NO_QUIT !== '1') { await sleep(5000); try { Editor.App.quit(); } catch (e) { console.error(TAG, 'quit failed; close Creator by PID', e); } }
}
exports.methods = {};
exports.load = function () { run().catch(e => console.error(TAG, e)); };
exports.unload = function () {};
