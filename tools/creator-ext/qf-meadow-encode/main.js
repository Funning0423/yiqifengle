'use strict';
/* qf-meadow-encode: Creator 3.8.8 project extension, runs once on load, no UI.
 * APIs (all from @cocos/creator-types@3.8.8, see README):
 *   Editor.Message.request('asset-db','query-ready'|'query-uuid'|'query-asset-meta'|'save-asset-meta'|'reimport-asset')
 *   Editor.Project.path, Editor.App.quit() */
const fs = require('fs'), path = require('path');
const { transformMeta, EXPECTED_UUID } = require('./transform');
const DB_URL = 'db://assets/bundles/region_meadow/env_meadow.glb';
const META_REL = 'assets/bundles/region_meadow/env_meadow.glb.meta';
const MARKER = path.join(__dirname, '.qf-meadow-encode.done');
const TAG = '[qf-meadow-encode]';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const req = (...a) => Editor.Message.request('asset-db', ...a);

async function run() {
  const project = Editor.Project.path, logPath = path.join(project, 'meadow-encode-ext.log.json');
  const log = { tool: 'qf-meadow-encode 1.0.0', project, dbUrl: DB_URL, t: { load: new Date().toISOString() }, steps: [], errors: [], status: 'RUNNING' };
  const t0 = Date.now(), mark = s => { log.steps.push({ s, ms: Date.now() - t0 }); console.log(TAG, s); };
  const write = () => fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  try {
    if (fs.existsSync(MARKER)) { console.log(TAG, 'marker present, not running again:', MARKER); return; }
    mark('LOADED'); write();
    // 1) wait for asset-db (30 min cap; this only waits, it never skips work)
    let ready = false;
    for (let i = 0; i < 1800 && !ready; i++) { try { ready = !!(await req('query-ready')); } catch (e) { /* asset-db not up yet */ } if (!ready) await sleep(1000); }
    if (!ready) throw new Error('asset-db not ready after 30 min');
    mark('ASSET_DB_READY');
    // 2) resolve uuid and read meta
    const uuid = await req('query-uuid', DB_URL);
    if (uuid !== EXPECTED_UUID) throw new Error(`query-uuid returned ${uuid}, expected ${EXPECTED_UUID}`);
    log.uuid = uuid;
    const before = await req('query-asset-meta', uuid);
    log.before = before; log.beforeFile = readFileSafe(path.join(project, META_REL));
    log.before0e588 = !!(before && before.subMetas && before.subMetas['0e588']);
    // 3) only encode=true, then save + reimport (Creator regenerates the .meta)
    const { meta, changed } = transformMeta(before);
    mark(changed ? 'SAVE_META encode=true' : 'ENCODE_ALREADY_TRUE');
    if (changed) { const info = await req('save-asset-meta', uuid, JSON.stringify(meta)); log.saveResult = info ? { uuid: info.uuid, url: info.url } : null; }
    await req('reimport-asset', uuid);
    mark('REIMPORTED');
    const after = await req('query-asset-meta', uuid);
    log.after = after; log.afterFile = readFileSafe(path.join(project, META_REL));
    const mc = after && after.userData && after.userData.meshCompress;
    if (!mc || mc.enable !== true || mc.compress !== true || mc.encode !== true || mc.quantize !== false) log.errors.push('AFTER_MESHCOMPRESS_UNEXPECTED ' + JSON.stringify(mc));
    if (after && after.subMetas && after.subMetas['0e588']) log.errors.push('SUBMETA_0E588_REMAINS (not removed by hand; report to GGbot)');
    log.status = log.errors.length ? 'DONE_WITH_ERRORS' : 'DONE';
  } catch (e) {
    log.errors.push(String(e && e.stack || e)); log.status = 'FAILED';
  }
  log.t.end = new Date().toISOString(); log.ms = Date.now() - t0;
  try { write(); } catch (e) { console.error(TAG, 'log write failed', e); }
  try { fs.writeFileSync(MARKER, log.t.end + ' ' + log.status + '\n'); } catch (e) { console.error(TAG, 'marker write failed', e); }
  console.log(TAG, log.status === 'DONE' ? 'DONE' : log.status, 'log:', logPath);
  if (log.status !== 'FAILED' && process.env.QF_MEADOW_EXT_NO_QUIT !== '1') { await sleep(5000); try { Editor.App.quit(); } catch (e) { console.error(TAG, 'quit failed; close Creator by PID', e); } }
}
function readFileSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }

exports.methods = {};
exports.load = function () { run().catch(e => console.error(TAG, e)); };
exports.unload = function () {};
