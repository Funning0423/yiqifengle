// Standalone driver for Cocos Creator 3.8.8's own effect compiler (shdc-lib.js, extracted unmodified from the
// editor's app.asar: modules/engine-extensions/extensions/engine-extends/static/effect-compiler/).
// offline-mappings.js is bundled from engine/editor/exports/offline-mappings.ts of the same 3.8.8 install.
// Usage: node compile.js <engineRoot> <file.effect> [outJson]
const fs = require('fs'), ps = require('path');
const shdc = require('./index.js');
function make (engineRoot) {
  const chunkDir = ps.join(engineRoot, 'editor/assets/chunks');
  let localDir = '';
  shdc.options.throwOnError = false; shdc.options.throwOnWarning = false; shdc.options.noSource = false; shdc.options.skipParserTest = false;
  shdc.options.chunkSearchFn = (names) => {
    for (const n of names) for (const d of [localDir, chunkDir]) {
      if (!d) continue; const f = ps.resolve(d, n + '.chunk');
      if (fs.existsSync(f)) return { name: n, content: fs.readFileSync(f, 'utf8') };
    }
    return { name: undefined, content: undefined };
  };
  for (const f of fs.readdirSync(chunkDir)) if (f.endsWith('.chunk')) shdc.addChunk(ps.basename(f, '.chunk'), fs.readFileSync(ps.join(chunkDir, f), 'utf8'));
  return (file) => {
    localDir = ps.dirname(ps.resolve(file));
    const logs = []; const saved = [console.log, console.warn, console.error];
    const cap = (...a) => logs.push(a.map(String).join(' '));
    console.log = cap; console.warn = cap; console.error = cap;
    let effect = null, thrown = null;
    try { effect = shdc.buildEffect(ps.basename(file, '.effect'), fs.readFileSync(file, 'utf8')); }
    catch (e) { thrown = String(e && e.stack || e); }
    finally { [console.log, console.warn, console.error] = saved; }
    const errors = logs.filter(l => /\bError\b|EFX\d/.test(l) && !/Warning/.test(l));
    const warnings = logs.filter(l => /Warning/.test(l));
    if (thrown) errors.push(thrown);
    if (!effect || !effect.techniques) errors.push('buildEffect returned no techniques');
    return { effect, errors, warnings, logs };
  };
}
module.exports = { make };
if (require.main === module) {
  const [, , root, file, out] = process.argv; const r = make(root)(file);
  console.log(JSON.stringify({ errors: r.errors, warnings: r.warnings, shaders: r.effect && r.effect.shaders && r.effect.shaders.map(s => ({ name: s.name, defines: s.defines.map(d => d.name + ':' + d.type + (d.range ? JSON.stringify(d.range) : '')), blocks: s.blocks.map(b => b.name + '(' + b.members.map(m => m.name).join(',') + ')'), attrs: s.attributes.map(a => a.name + (a.isInstanced ? '*inst' : '') + '[' + a.defines.join('&') + ']'), glsl1: !!s.glsl1, glsl3: !!s.glsl3, glsl4: !!s.glsl4 })) }, null, 1));
  if (out && r.effect) fs.writeFileSync(out, JSON.stringify(r.effect, null, 1));
  process.exit(r.errors.length ? 1 : 0);
}
