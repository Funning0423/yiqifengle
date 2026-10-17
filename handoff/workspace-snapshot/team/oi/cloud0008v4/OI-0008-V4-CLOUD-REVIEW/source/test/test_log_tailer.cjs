'use strict';
// 0008 v3/v4 unit tests for LogTailer (WeappLog capture) + spawnCli (own CLI child) + verifyManifest. No DevTools, temp dirs only.
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');
const {LogTailer, spawnCli, verifyManifest} = require('../tools/wechat_first_open_audit.cjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qf0008v3-tail-'));
let n = 0, pass = 0; const results = [];
async function t(name, fn) { n++; try { await fn(); pass++; results.push({name, ok: true}); console.log('PASS ' + name); } catch (e) { results.push({name, ok: false, error: e.message}); console.log('FAIL ' + name + '\n  ' + e.stack.split('\n').slice(0, 4).join('\n  ')); } }
const mk = (name) => { const root = path.join(tmp, name), d = path.join(root, 'u', 'WeappLog', 'logs'); fs.mkdirSync(d, {recursive: true}); return {root, d}; };
const T = (root, o = {}) => new LogTailer(root, {pollMs: 20, maxBytes: o.maxBytes || 1 << 30});
const has = (tl, s) => tl.lines.some((l) => l.line.includes(s));

(async () => {
  await t('appended lines after baseline are read; old content is not', async () => {
    const {root, d} = mk('append'); fs.writeFileSync(path.join(d, 'a.log'), 'OLD ERROR line\n');
    const tl = T(root); tl.start(); fs.appendFileSync(path.join(d, 'a.log'), 'NEW line\n'); await tl.stop(50);
    assert.ok(has(tl, 'NEW line')); assert.ok(!has(tl, 'OLD ERROR')); assert.deepStrictEqual(tl.incomplete, []);
  });
  await t('root that IS a WeappLog dir is scanned (review: root-is-WeappLog → files=0 in v1/v2)', async () => {
    const {d} = mk('direct'); const tl = T(path.dirname(d)); tl.start(); fs.writeFileSync(path.join(d, 'b.log'), 'X\n'); await tl.stop(50); assert.ok(has(tl, 'X'));
  });
  await t('root absent at start, created during the run → new files read from byte 0, rootSeen', async () => {
    const root = path.join(tmp, 'late'); const tl = T(root); tl.start(); assert.strictEqual(tl.rootExistedAtStart, false);
    const d = path.join(root, 'WeappLog'); fs.mkdirSync(d, {recursive: true}); fs.writeFileSync(path.join(d, 'c.log'), 'LATE\n'); await tl.stop(50);
    assert.ok(tl.rootSeen && has(tl, 'LATE')); assert.deepStrictEqual(tl.incomplete, []);
  });
  await t('truncation → incomplete + post-truncation content read', async () => {
    const {root, d} = mk('trunc'); const f = path.join(d, 't.log'); fs.writeFileSync(f, 'a'.repeat(5000) + '\n');
    const tl = T(root); tl.start(); await sleep(60); fs.writeFileSync(f, 'AFTER\n'); await tl.stop(50);
    assert.ok(has(tl, 'AFTER')); assert.ok(tl.incomplete.some((x) => /truncated/.test(x)));
  });
  await t('in-place rewrite that ends LARGER than the old offset (review: "增长超过旧 size") → detected via prefix', async () => {
    const {root, d} = mk('rewrite'); const f = path.join(d, 'r.log'); fs.writeFileSync(f, 'old-1\n');
    const tl = T(root); tl.start(); await sleep(60); fs.writeFileSync(f, 'NEW-HEAD ' + 'z'.repeat(100) + '\nNEW ERROR\n'); await tl.stop(50);
    assert.ok(has(tl, 'NEW ERROR') && has(tl, 'NEW-HEAD')); assert.ok(tl.incomplete.some((x) => /rewritten/.test(x)));
  });
  await t('rotation by rename is followed by inode; the new file at the old path is read from 0', async () => {
    const {root, d} = mk('rotate'); const f = path.join(d, 'x.log'); fs.writeFileSync(f, 'start\n');
    const tl = T(root); tl.start(); fs.appendFileSync(f, 'BEFORE-ROTATE\n'); await sleep(60);
    fs.renameSync(f, path.join(d, 'x.1.log')); fs.appendFileSync(path.join(d, 'x.1.log'), 'TAIL-OF-OLD\n'); fs.writeFileSync(f, 'IN-NEW\n'); await tl.stop(50);
    for (const s of ['BEFORE-ROTATE', 'TAIL-OF-OLD', 'IN-NEW']) assert.ok(has(tl, s), s);
    assert.ok(tl.events.some((e) => e.event === 'renamed'));
  });
  await t('> 8 MiB appended in one go is read completely (review: over-8MiB-append missed)', async () => {
    const {root, d} = mk('big'); const f = path.join(d, 'big.log'); fs.writeFileSync(f, '');
    const tl = T(root); tl.start(); fs.appendFileSync(f, ('y'.repeat(8191) + '\n').repeat(1200) + 'END ERROR\n'); await tl.stop(50);
    assert.ok(has(tl, 'END ERROR')); assert.ok(tl.bytes > 9e6); assert.deepStrictEqual(tl.incomplete, []);
  });
  await t('byte budget exhausted → incomplete (never silent)', async () => {
    const {root, d} = mk('budget'); const tl = T(root, {maxBytes: 2048}); tl.start(); fs.writeFileSync(path.join(d, 'q.log'), 'w'.repeat(10000) + '\nLAST\n'); await tl.stop(50);
    assert.ok(tl.incomplete.some((x) => /budget/.test(x))); assert.ok(!has(tl, 'LAST'));
  });
  await t('UTF-8 character and a line split across two writes are reassembled', async () => {
    const {root, d} = mk('utf8'); const f = path.join(d, 'u.log'); fs.writeFileSync(f, '');
    const tl = T(root); tl.start(); const b = Buffer.from('[app.json 或自定义编译条件错误] 启动页面\n'); fs.appendFileSync(f, b.subarray(0, 14)); await sleep(60); fs.appendFileSync(f, b.subarray(14)); await tl.stop(50);
    assert.ok(has(tl, '[app.json 或自定义编译条件错误] 启动页面'));
  });
  await t('historic file moved in during the run is read (its lines then need an own marker to count — see audit attribution)', async () => {
    const {root, d} = mk('hist'); const src = path.join(tmp, 'historic.log'); fs.writeFileSync(src, '[2001-01-01] [app.json 或自定义编译条件错误] historical\n');
    const tl = T(root); tl.start(); fs.renameSync(src, path.join(d, 'historic.log')); await tl.stop(50); assert.ok(has(tl, 'historical'));
  });
  await t('long line (> 4000 chars) matched on full text, stored truncated, counted', async () => {
    const {root, d} = mk('long'); const tl = T(root); tl.start(); fs.writeFileSync(path.join(d, 'l.log'), 'p'.repeat(5000) + ' TAILMARK\n'); await tl.stop(50);
    const l = tl.lines.find((x) => x.line.includes('TAILMARK')); assert.ok(l && l.stored.length === 4000); assert.ok(tl.events.some((e) => e.event === 'long-lines'));
  });
  await t('spawnCli: output after the first chunk and after a long time is kept; exit code recorded; terminate() stops only that child', async () => {
    const script = path.join(tmp, 'resident.cjs'); fs.writeFileSync(script, "#!/usr/bin/env node\nprocess.stdout.write('part');setTimeout(()=>console.log('-joined'),100);setTimeout(()=>console.error('LATE LINE'),400);setTimeout(()=>{},60000);");
    fs.chmodSync(script, 0o755);
    const h = spawnCli(script, ['auto', '--project', tmp], {timeoutMs: 120000, label: 'auto'}); await sleep(700);
    assert.ok(!h.exited); await h.terminate(); await h.closed;
    assert.ok(h.lines.some((l) => l.line === 'part-joined')); assert.ok(h.lines.some((l) => l.line === 'LATE LINE')); assert.strictEqual(h.terminated, true); assert.strictEqual(h.ok(), false);
  });
  await t('spawnCli refuses `quit` (global quit removed)', async () => { assert.throws(() => spawnCli('/bin/true', ['quit'], {timeoutMs: 1000}), /refusing CLI subcommand quit/); });
  await t('spawnCli non-zero exit → ok() false', async () => { const s = path.join(tmp, 'seven.cjs'); fs.writeFileSync(s, '#!/usr/bin/env node\nprocess.exit(7)'); fs.chmodSync(s, 0o755); const h = spawnCli(s, ['close'], {timeoutMs: 5000}); await h.closed; assert.strictEqual(h.code, 7); assert.strictEqual(h.ok(), false); });
  await t('verifyManifest detects a file appended after hashing and an unlisted new file', async () => {
    const d = path.join(tmp, 'man'); fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'run.log'), 'a\n');
    const crypto = require('crypto'); fs.writeFileSync(path.join(d, 'SHA256SUMS.txt'), crypto.createHash('sha256').update('a\n').digest('hex') + '  run.log\n');
    assert.strictEqual(verifyManifest(d).ok, true); fs.appendFileSync(path.join(d, 'run.log'), 'late\n'); fs.writeFileSync(path.join(d, 'new.txt'), '');
    const r = verifyManifest(d); assert.deepStrictEqual(r.mismatched, ['run.log']); assert.deepStrictEqual(r.unlisted, ['new.txt']);
  });
  // ---- 0008-v4 (review E): consistency checks beyond the first 4 KiB ----
  const rewriteSame = (f, at, str) => { const fd = fs.openSync(f, 'r+'); fs.writeSync(fd, Buffer.from(str), 0, Buffer.byteLength(str), at); fs.closeSync(fd); };
  await t('v4 E1 (Oi boundary): same inode, same size, same first 4096 B, SUFFIX rewritten → incomplete', async () => {
    const {root, d} = mk('v4-suffix'); const f = path.join(d, 's.log'); fs.writeFileSync(f, 'P'.repeat(4096) + '\nclean tail line\n');
    const tl = T(root); tl.start(); await sleep(60); const ino = fs.statSync(f).ino; const size = fs.statSync(f).size;
    rewriteSame(f, size - 'clean tail line\n'.length, 'TypeError: HIDD\n'); assert.strictEqual(fs.statSync(f).ino, ino); assert.strictEqual(fs.statSync(f).size, size);
    await tl.stop(50); assert.ok(tl.incomplete.some((x) => /rewritten|changed after being read/.test(x)), JSON.stringify(tl.incomplete));
  });
  await t('v4 E2: rewrite in the MIDDLE of an already-read region (outside first and last 4 KiB) → caught by final full re-hash', async () => {
    const {root, d} = mk('v4-middle'); const f = path.join(d, 'm.log'); fs.writeFileSync(f, ''); const tl = T(root); tl.start();
    fs.appendFileSync(f, ('line ' + 'm'.repeat(90) + '\n').repeat(400)); await sleep(80);
    rewriteSame(f, 20000, 'XXXX'); await tl.stop(50);
    assert.ok(tl.incomplete.some((x) => /final check: .* changed after being read/.test(x)), JSON.stringify(tl.incomplete));
  });
  await t('v4 E3: rewrite of the pre-existing (baseline) region is also caught at stop', async () => {
    const {root, d} = mk('v4-baseline'); const f = path.join(d, 'b.log'); fs.writeFileSync(f, ('old ' + 'o'.repeat(60) + '\n').repeat(500));
    const tl = T(root); tl.start(); await sleep(40); rewriteSame(f, 15000, 'ZZ'); await tl.stop(50);
    assert.ok(tl.incomplete.some((x) => /changed after being read/.test(x)), JSON.stringify(tl.incomplete));
  });
  await t('v4 E4: invalid UTF-8 is a protocol violation → incomplete (line still scanned)', async () => {
    const {root, d} = mk('v4-utf8'); const f = path.join(d, 'u.log'); fs.writeFileSync(f, ''); const tl = T(root); tl.start();
    fs.appendFileSync(f, Buffer.concat([Buffer.from('bad \xff byte TypeError: x\n', 'latin1')])); await tl.stop(50);
    assert.ok(tl.incomplete.some((x) => /invalid UTF-8/.test(x))); assert.ok(has(tl, 'TypeError: x'));
  });
  await t('v4 E5: pure append (incl. split multi-byte UTF-8 across writes) stays complete; final-rehash event ok', async () => {
    const {root, d} = mk('v4-clean'); const f = path.join(d, 'c.log'); fs.writeFileSync(f, 'pre\n'); const tl = T(root); tl.start();
    const b = Buffer.from('中文行\n'); fs.appendFileSync(f, b.subarray(0, 2)); await sleep(50); fs.appendFileSync(f, b.subarray(2)); await tl.stop(50);
    assert.deepStrictEqual(tl.incomplete, []); assert.ok(has(tl, '中文行')); assert.ok(tl.events.some((e) => e.event === 'final-rehash' && e.ok));
  });
  console.log(`\n${pass}/${n} passed`);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({passed: pass, total: n, results}, null, 2));
  process.exit(pass === n ? 0 : 1);
})();
