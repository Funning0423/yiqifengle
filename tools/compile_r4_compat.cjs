'use strict';
// Standards-preserving syntax prepass; no business-rule edits or generated-code string patches.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const base = path.resolve(__dirname, '..');
const modules = require('./qf-env.cjs').babelNodeModules();
const babel = require(path.join(modules, '@babel/core'));
const plugins = ['plugin-transform-spread', 'plugin-transform-for-of', 'plugin-transform-destructuring'];
const source = path.join(base, 'inputs/R4-portable');
const output = path.join(base, 'creator-build-project/assets/scripts/r4-compat');
const hashes = {};
for (const folder of ['runtime', 'adapter']) {
  fs.mkdirSync(path.join(output, folder), {recursive: true});
  for (const name of fs.readdirSync(path.join(source, folder))) {
    const relative = folder + '/' + name, bytes = fs.readFileSync(path.join(source, relative));
    const emitted = name.endsWith('.js') ? babel.transformSync(bytes.toString(), {
      filename: name, babelrc: false, configFile: false, sourceType: 'script',
      plugins: plugins.map(name => [require(path.join(modules, '@babel/' + name)), {loose: false}])
    }).code + '\n' : bytes;
    fs.writeFileSync(path.join(output, relative), emitted);
    const sha = value => crypto.createHash('sha256').update(value).digest('hex');
    hashes[relative] = {sourceSha256: sha(bytes), generatedSha256: sha(emitted)};
  }
}
fs.copyFileSync(path.join(source, 'package.json'), path.join(output, 'package.json'));
fs.writeFileSync(path.join(base, 'evidence/r4-compat-compiler.json'), JSON.stringify({
  reason: 'Cocos loose iterable spread emitted concat(Set), recursively reintroducing the Set into publicCopy',
  babel: babel.version, plugins: plugins.map(name => ({name, version: require(path.join(modules, '@babel/' + name + '/package.json')).version})),
  sourcePreserved: true, commonJSRelativeDependenciesPreserved: true, hashes
}, null, 2));
// Disposable regression tree uses the exact shipped behavior tests against generated output.
const testRoot = path.join(base, 'output/r4-compat-tests'); fs.mkdirSync(testRoot, {recursive: true});
for (const folder of ['runtime', 'adapter']) fs.cpSync(path.join(output, folder), path.join(testRoot, folder), {recursive: true});
fs.cpSync(path.join(source, 'test'), path.join(testRoot, 'test'), {recursive: true});
console.log('R4 compatibility output generated with Babel ' + babel.version);
