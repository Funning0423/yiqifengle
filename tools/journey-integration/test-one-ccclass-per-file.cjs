'use strict';
// Engine-load-only hazards the Node suite can't otherwise see:
//  - Cocos Error 3615: a script may declare at most one Component (@ccclass) -> boot crash (_sealed TypeError).
//  - Duplicate @ccclass names across scripts -> Cocos class-name collision.
// Warning only: @ccclass name != file basename.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../../creator-build-project/assets');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) files.push(p); } })(root);
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const errors = [], warnings = [], names = new Map();
for (const f of files) {
  const rel = path.relative(root, f), src = strip(fs.readFileSync(f, 'utf8'));
  const decos = [...src.matchAll(/@ccclass\s*\(\s*(?:['"`]([^'"`]+)['"`])?/g)].map(m => m[1] || '');
  if (decos.length > 1) errors.push(`${rel}: ${decos.length} @ccclass decorators (${decos.join(', ')}) — Cocos allows one component per script`);
  for (const n of decos) { if (!n) continue; if (!names.has(n)) names.set(n, []); names.get(n).push(rel);
    if (n !== path.basename(f, '.ts')) warnings.push(`${rel}: @ccclass('${n}') != file name`); }
}
for (const [n, l] of names) if (l.length > 1) errors.push(`duplicate @ccclass name '${n}': ${l.join(', ')}`);
if (warnings.length) console.log('WARN (name != basename):\n  ' + warnings.join('\n  '));
if (errors.length) { console.error('FAIL one-ccclass-per-file:\n  ' + errors.join('\n  ')); process.exit(1); }
console.log(`PASS one-ccclass-per-file: ${files.length} scripts, ${names.size} ccclass names, ${warnings.length} warnings`);
