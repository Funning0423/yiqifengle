'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ENGINE = '3.8.8';
const SCENE_UUID = '260c2ebc-0660-4be6-8c4b-7885436222ea';
const SCENE_URL = 'db://assets/scenes/WorldR5Integration.scene';
const CONFIG_REL = 'tools/cloud-web/world-r5-build-options.json';
const GENERATED_PROJECT_DIRS = new Set(['library','temp','local','profiles','build','node_modules','.git']);
const REQUIRED_BUNDLES = ['internal','resources','main','audio_bgm_island','board_art','region_island','region_meadow','region_skycity','region_lakeside','shared_effects','transport_sail'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };

function inside(root, relative) {
  assert.equal(typeof relative, 'string');
  assert(!relative.includes('\0'), 'NUL path rejected');
  const file = path.resolve(root, relative);
  assert(file.startsWith(path.resolve(root) + path.sep), 'Path escapes artifact/source root: ' + relative);
  return file;
}
function inventory(root, roots = ['.']) {
  const entries = [];
  function visit(rel) {
    const file = path.resolve(root, rel), st = fs.lstatSync(file);
    assert(!st.isSymbolicLink(), 'Symlink not admitted to reproducible input/output: ' + rel);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) visit(path.join(rel, name));
    } else if (st.isFile()) {
      entries.push({path:rel.replaceAll(path.sep, '/').replace(/^\.\//, ''), size:st.size, sha256:sha(fs.readFileSync(file))});
    } else throw Error('Unsupported file type: ' + rel);
  }
  roots.forEach(visit);
  entries.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return {sha256:sha(JSON.stringify(entries)), files:entries.length, bytes:entries.reduce((n,e) => n + e.size, 0), entries};
}
function sourceIdentity(root) {
  const pkg = json(inside(root, 'creator-build-project/package.json'));
  assert.equal(pkg.creator?.version, ENGINE, 'Source must stay pinned to Creator 3.8.8');
  const sceneFile = inside(root, SCENE_URL.replace('db://', 'creator-build-project/'));
  assert.equal(json(sceneFile + '.meta').uuid, SCENE_UUID, 'Current scene meta UUID changed');
  const scene = json(sceneFile);
  assert(scene.some(x => x.__type__ === 'cc.Scene' && x._id === SCENE_UUID), 'Current serialized scene ID missing');
  assert(scene.some(x => x.__type__ === 'cc.SceneAsset' && x._name === 'WorldR5Integration'), 'Wrong scene asset');
  const config = json(inside(root, CONFIG_REL));
  assert.equal(config.platform, 'web-desktop');
  assert.equal(config.startScene, SCENE_UUID);
  assert.deepEqual(config.scenes, [{url:SCENE_URL, uuid:SCENE_UUID}]);
  assert.equal(config.md5Cache, false, 'This validator requires deterministic non-MD5 file names');
  assert.equal(config.mainBundleIsRemote, false);
  assert.equal(config.debug, true, 'Current-scene diagnostics require a debug acceptance build');
  // Include templates, extensions, package locks, and future source directories,
  // not merely assets/settings. Exclude only known generated/local state.
  const project=inside(root,'creator-build-project');
  const roots=fs.readdirSync(project).filter(name=>!GENERATED_PROJECT_DIRS.has(name)).map(name=>'creator-build-project/'+name);
  assert(roots.includes('creator-build-project/settings'),'Missing project settings');
  const fingerprint = inventory(root, roots.concat(CONFIG_REL));
  const expectedBundles=new Set(REQUIRED_BUNDLES);
  for(const entry of fingerprint.entries.filter(e=>e.path.startsWith('creator-build-project/assets/')&&e.path.endsWith('.meta'))){
    const meta=json(inside(root,entry.path));
    if(meta.importer==='directory'&&meta.userData?.isBundle){
      const name=meta.userData.bundleName || path.basename(entry.path,'.meta');
      assert(/^[\w-]+$/.test(name),'Invalid source bundle name'); expectedBundles.add(name);
    }
  }
  return {engine:ENGINE, sceneUuid:SCENE_UUID, sceneUrl:SCENE_URL, expectedBundles:[...expectedBundles].sort(), ...fingerprint};
}
function requireFile(root, rel) {
  const file = inside(root, rel);
  assert(fs.existsSync(file) && fs.statSync(file).isFile() && fs.statSync(file).size > 0, 'Missing/empty artifact file: ' + rel);
  const realRoot=fs.realpathSync(root),realFile=fs.realpathSync(file);
  assert(realFile.startsWith(realRoot+path.sep),'File resolves outside artifact/source root: '+rel);
  let cursor=file;
  while(cursor!==path.resolve(root)){assert(!fs.lstatSync(cursor).isSymbolicLink(),'Symlink not admitted: '+rel);cursor=path.dirname(cursor);}
  return file;
}
function localReference(ref) {
  if (ref.startsWith('project://')) ref = ref.slice('project://'.length);
  assert(!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(ref), 'Remote/external entry dependency not allowed: ' + ref);
  assert(!ref.startsWith('/'), 'Root-relative entry dependency not portable: ' + ref);
  const decoded = decodeURIComponent(ref.split(/[?#]/)[0]);
  assert(!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(decoded), 'Remote/external entry dependency not allowed: ' + ref);
  assert(!decoded.startsWith('/'), 'Root-relative entry dependency not portable: ' + ref);
  assert(!/[\\\0]/.test(decoded), 'Backslash/NUL entry dependency rejected: ' + ref);
  return decoded;
}
function assertCreatorExit(result) {
  assert(result.code===36&&!result.signal,'Creator did not return documented success code 36: '+JSON.stringify(result));
}
function verifyArtifact(root, {expectedBundles=REQUIRED_BUNDLES}={}) {
  const index = fs.readFileSync(requireFile(root, 'index.html'), 'utf8');
  requireFile(root, 'application.js');
  const settings = json(requireFile(root, 'src/settings.json'));
  assert.equal(settings.CocosEngine, ENGINE, 'Wrong Cocos engine in produced settings');
  assert.equal(settings.engine?.platform, 'web-desktop', 'A mini-game package is not a Web build');
  assert.equal(settings.launch?.launchScene, SCENE_URL, 'Wrong launch scene (old Firstslice smoke is not accepted)');
  assert.equal(settings.engine?.debug, true);
  assert.equal(settings.assets?.server || '', '', 'Remote asset server is outside this self-contained acceptance contract');
  assert.deepEqual(settings.assets?.remoteBundles || [], [], 'Remote bundles are not admitted');
  assert.deepEqual(settings.assets?.subpackages || [], [], 'Mini-game subpackages are not Web bundles');
  const refs = [...index.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  assert(refs.some(r => /\.js(?:[?#]|$)/.test(r)), 'Web entry contains no external JS bootstrap');
  refs.forEach(ref => requireFile(root, localReference(ref)));
  // Creator 3.8.8 calls module.import(pack) inside cocos-js/cc.js. SystemJS
  // resolves pack relative to that module, not the artifact or settings root.
  const importMap = json(requireFile(root, 'src/import-map.json'));
  assert.equal(typeof importMap.imports?.cc, 'string', 'Missing cc import-map entry');
  const engineModule = path.posix.join('src', localReference(importMap.imports.cc));
  assert.equal(engineModule, 'cocos-js/cc.js', 'Unexpected Creator 3.8.8 engine module mapping');
  requireFile(root, engineModule);
  for (const ref of settings.scripting?.scriptPackages || []) {
    const relative = localReference(ref);
    requireFile(root, ref.startsWith('project://') ? relative : path.posix.join(path.posix.dirname(engineModule), relative));
  }
  if (settings.rendering?.effectSettingsPath) requireFile(root, localReference(settings.rendering.effectSettingsPath));
  const declared=settings.assets?.projectBundles || [];
  for(const name of new Set([...REQUIRED_BUNDLES,...expectedBundles])) assert(declared.includes(name),'Required current-scene bundle not declared: '+name);
  const bundles = [...new Set(declared)];
  let importFiles=0;
  for (const bundle of bundles) {
    assert(/^[\w-]+$/.test(bundle), 'Invalid bundle name');
    const config = json(requireFile(root, `assets/${bundle}/config.json`));
    assert.equal(config.name, bundle);
    assert.equal(config.debug,true,'Only debug bundle config is admitted by this acceptance validator');
    assert.deepEqual(config.versions?.import || [],[],'Versioned imports are outside md5Cache=false contract');
    assert.deepEqual(config.versions?.native || [],[],'Versioned natives are outside md5Cache=false contract');
    for (const dep of config.deps || []) assert(bundles.includes(dep), 'Missing bundle dependency: ' + dep);
    // Official 3.8.8 Web downloader loads config.json and index.js together.
    requireFile(root, `assets/${bundle}/index.js`);
    const uuids=config.uuids || [],packed=new Set(),redirected=new Set(),extensions=new Map();
    for(const [ext,ids]of Object.entries(config.extensionMap || {})){
      assert(/^\.[a-z0-9]+$/i.test(ext),'Invalid import extension');
      for(const id of ids)extensions.set(id,ext);
    }
    const checkImport=(id,forcedExtension)=>{
      assert(typeof id==='string'&&/^[a-zA-Z0-9@_-]+$/.test(id),'Unsafe/unsupported import identifier');
      let extension=forcedExtension || extensions.get(id) || '.json';
      const base=`assets/${bundle}/${config.importBase || 'import'}/${id.slice(0,2)}/${id}`;
      // 3.8.8 downloadCCONB requests .bin first, then .cconb as its documented code fallback.
      if(extension==='.cconb'&&fs.existsSync(inside(root,base+'.bin')))extension='.bin';
      requireFile(root,base+extension);importFiles++;
    };
    for(const [id,ids]of Object.entries(config.packs || {})){
      for(const asset of ids){assert(uuids.includes(asset),'Packed asset absent from UUID list');packed.add(asset);}
      checkImport(id,extensions.get(ids[0])==='.cconb'?'.bin':'.json');
    }
    const redirect=config.redirect || [];assert.equal(redirect.length%2,0,'Malformed redirect list');
    for(let i=0;i<redirect.length;i+=2){
      assert(uuids.includes(redirect[i]),'Redirected asset absent from UUID list');
      const target=config.deps?.[Number(redirect[i+1])];assert(bundles.includes(target),'Missing redirect target bundle');redirected.add(redirect[i]);
    }
    for(const id of uuids)if(!packed.has(id)&&!redirected.has(id))checkImport(id);
    if (bundle === 'main') {
      assert.equal(config.scenes?.[SCENE_URL], SCENE_UUID, 'Current scene absent from main bundle');
      assert(uuids.includes(SCENE_UUID)&&!redirected.has(SCENE_UUID),'Current scene must be present in main bundle imports');
    }
  }
  assert(fs.existsSync(inside(root, 'cocos-js')), 'Missing official Web engine output');
  const manifest = inventory(root);
  assert(manifest.entries.some(e => e.path.startsWith('cocos-js/') && /\.js$/.test(e.path)), 'No Web engine JS files');
  return {status:'ARTIFACT_STRUCTURE_VERIFIED', engine:ENGINE, platform:'web-desktop', sceneUuid:SCENE_UUID,
    sceneUrl:SCENE_URL, bundles, importFiles, ...manifest,
    limits:['Static bundle/entry checks do not prove all runtime fetches succeed.', 'No engine execution, visual quality, interaction, or device acceptance is implied.']};
}

module.exports = {ENGINE, SCENE_UUID, SCENE_URL, CONFIG_REL, REQUIRED_BUNDLES, sha, json, write, inside, inventory, sourceIdentity, assertCreatorExit, verifyArtifact};
