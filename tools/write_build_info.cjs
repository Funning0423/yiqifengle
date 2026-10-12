#!/usr/bin/env node
'use strict';
// Run right before the WeChat build (INTEGRATION §9): stamps creator-build-project/assets/scripts/BuildInfo.ts with the
// 7-character commit, `-dirty` when tracked files differ from HEAD. `--reset` restores the committed 'dev' placeholder.
// Never commit the stamped file.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '..'), FILE = path.join(ROOT, 'creator-build-project/assets/scripts/BuildInfo.ts');
const VERSION = 'v0.1';
function source(sha) { return `export const BUILD_VERSION='${VERSION}'; export const BUILD_SHA='${sha}';\n`; }
function describe() {
  const git = (...a) => cp.execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  const sha = git('rev-parse', '--short=7', 'HEAD').slice(0, 7);
  let dirty = false; try { cp.execFileSync('git', ['diff', '--quiet', 'HEAD', '--', '.', ':!creator-build-project/assets/scripts/BuildInfo.ts'], { cwd: ROOT }); } catch (e) { dirty = true; }
  return sha + (dirty ? '-dirty' : '');
}
if (require.main === module) {
  const sha = process.argv.includes('--reset') ? 'dev' : describe();
  if (!/^(dev|[0-9a-f]{7}(-dirty)?)$/.test(sha)) { console.error('unexpected describe output: ' + sha); process.exit(1); }
  fs.writeFileSync(FILE, source(sha)); console.log(JSON.stringify({ file: path.relative(ROOT, FILE), BUILD_VERSION: VERSION, BUILD_SHA: sha }));
}
module.exports = { source, VERSION };
