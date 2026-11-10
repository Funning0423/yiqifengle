'use strict';
// Opaque metadata is hashed, never parsed or copied into evidence.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const lib=require('./lib.cjs');
const BASE_COMMIT='690454cd05156a21227d4dc7e23396bd4f5b10d3';
const INFORMATION='creator-build-project/settings/v2/packages/information.json';
const POLICY='observed-opaque-metadata-exact-bytes/v2';
// Reviewed byte identities only; this does not classify their contents as harmless.
// Profiles source: native read-only audit bc-a6a88e57-d793-4eb0-8f92-e215dc3a0f75.
const OBSERVED_ADDITIONS=Object.freeze([
  {
    "path": "creator-build-project/settings/v2/packages/information.json",
    "size": 586,
    "sha256": "a38b4b0741e8f9187d2b886816fa76c4e6f2ba666025de2ed5d4b85c86e7a5fa"
  },
  {
    "path": "creator-build-project/profiles/v2/editor/packages.json",
    "size": 3,
    "sha256": "ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356"
  },
  {
    "path": "creator-build-project/profiles/v2/packages/builder.json",
    "size": 60,
    "sha256": "ba4c4cda04dba2bca4b668fbc9e44c5955fe74fee6eb0f9d061e31b23d765be5"
  },
  {
    "path": "creator-build-project/profiles/v2/packages/device.json",
    "size": 29,
    "sha256": "93af91e0b90038cedc84d08651f845e1c2e2ae460321c19f083c27a178e451f8"
  },
  {
    "path": "creator-build-project/profiles/v2/packages/engine.json",
    "size": 30,
    "sha256": "e3755683f34745346f06b4dd665d172252183004e1aa50f90ca579837c2f244f"
  },
  {
    "path": "creator-build-project/profiles/v2/packages/program.json",
    "size": 29,
    "sha256": "d914f9f19ffe02724337936d8c7907798c8666566902b78243eb1aa8da0baedd"
  },
  {
    "path": "creator-build-project/profiles/v2/packages/project.json",
    "size": 29,
    "sha256": "86e60258fc615fe023aef88ff8d66f6e8cf0c784fcef5c02d75b08a42b204241"
  },
  {
    "path": "creator-build-project/profiles/v2/packages/server.json",
    "size": 52,
    "sha256": "e02c85356446e696f75d83e70db83d2629eb6dd8e76d0e69ce1b457f5c3df3b9"
  }
].map(Object.freeze));
function checkManifest(m){
 assert(Array.isArray(m.entries),'Manifest entries missing');
 assert.equal(new Set(m.entries.map(e=>e.path)).size,m.entries.length,'Duplicate manifest path');
 for(const e of m.entries)assert(typeof e.path==='string'&&Number.isSafeInteger(e.size)&&e.size>=0&&/^[a-f0-9]{64}$/.test(e.sha256),'Invalid manifest entry');
 assert.deepEqual(m.entries.map(e=>e.path),m.entries.map(e=>e.path).sort(),'Manifest order changed');
 assert.equal(m.sha256,lib.sha(JSON.stringify(m.entries)),'Manifest fingerprint mismatch');
 assert.equal(m.files,m.entries.length);assert.equal(m.bytes,m.entries.reduce((n,e)=>n+e.size,0));
 return m;
}
function changes(before,after){
 checkManifest(before);checkManifest(after);
 const old=new Map(before.entries.map(e=>[e.path,e])),now=new Map(after.entries.map(e=>[e.path,e]));
 return {added:after.entries.filter(e=>!old.has(e.path)),removed:before.entries.filter(e=>!now.has(e.path)),changed:after.entries.filter(e=>old.has(e.path)&&JSON.stringify(e)!==JSON.stringify(old.get(e.path)))};
}
function assertPreparationDelta(before,after){
 const d=changes(before,after);
 assert.equal(d.removed.length,0,'Preparation removed original inputs');
 assert.equal(d.changed.length,0,'Preparation changed original inputs');
 for(const e of d.added){
  const known=OBSERVED_ADDITIONS.find(k=>k.path===e.path);
  assert(known,'Unclassified preparation additions require review; no receipt created');
  assert.equal(e.size,known.size,'Observed metadata size differs; review required: '+e.path);
  assert.equal(e.sha256,known.sha256,'Observed metadata bytes differ; review required: '+e.path);
 }
 // No claim that information is harmless: it becomes an explicit frozen input.
 return d;
}
function assertBaseline(root,input,getBlob,listPaths){
 checkManifest(input);
 const read=getBlob||((rel)=>cp.execFileSync('git',['cat-file','blob',BASE_COMMIT+':'+rel],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:128*1024*1024}));
 const excluded=new Set(['library','temp','build','node_modules','.git']);
 const baselinePaths=(listPaths?listPaths():cp.execFileSync('git',['ls-tree','-r','-z','--name-only',BASE_COMMIT,'--','creator-build-project',lib.CONFIG_REL],{cwd:root,stdio:['ignore','pipe','pipe'],encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean)).filter(p=>p===lib.CONFIG_REL||(p.startsWith('creator-build-project/')&&!excluded.has(p.split('/')[1]))).sort();
 assert.deepEqual(input.entries.map(e=>e.path),baselinePaths,'Baseline input path set differs (missing or additional files)');
 assert(!input.entries.some(e=>OBSERVED_ADDITIONS.some(k=>k.path===e.path)),'Preparation requires a fresh copy without pre-existing observed metadata');
 for(const e of input.entries){let b;try{b=read(e.path);}catch{throw Error('Input is not available in fixed baseline: '+e.path);}
  assert.equal(b.length,e.size,'Baseline size mismatch: '+e.path);assert.equal(lib.sha(b),e.sha256,'Baseline bytes mismatch: '+e.path);}
 return {baseCommit:BASE_COMMIT,matchedFiles:input.files};
}
function engineIdentity(executable){
 const macos=path.dirname(path.resolve(executable)),contents=path.dirname(macos),bundle=path.dirname(contents);
 assert(path.basename(macos)==='MacOS'&&path.basename(contents)==='Contents'&&bundle.endsWith('.app'),
  'Verified macOS .app/Contents/MacOS executable required; other install layouts need separate review');
 lib.safePath(bundle,path.relative(bundle,executable));
 assert(fs.lstatSync(executable).isFile(),'Creator must be a regular executable');
 for(const rel of ['Contents/Info.plist','Contents/Resources']){const file=lib.inside(bundle,rel);assert(fs.existsSync(file),'Incomplete verified app bundle: '+rel);}
 const realContents=fs.realpathSync(contents),entries=[];
 function digest(file){const hash=require('node:crypto').createHash('sha256'),fd=fs.openSync(file,'r'),buf=Buffer.alloc(1024*1024);let bytes=0;
  try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0){hash.update(buf.subarray(0,n));bytes+=n;}}finally{fs.closeSync(fd);}return {size:bytes,sha256:hash.digest('hex')};}
 function visit(rel){const file=path.join(contents,rel),st=fs.lstatSync(file);
  if(st.isSymbolicLink()){const target=fs.readlinkSync(file),resolved=fs.realpathSync(file);assert(resolved===realContents||resolved.startsWith(realContents+path.sep),'Engine bundle link escapes installation: '+rel);
   entries.push({path:rel,type:'symlink',size:Buffer.byteLength(target),sha256:lib.sha(Buffer.from(target))});return;}
  if(st.isDirectory()){for(const name of fs.readdirSync(file).sort())visit(path.join(rel,name));return;}
  assert(st.isFile(),'Unsupported engine installation entry: '+rel);const d=digest(file);assert.equal(d.size,st.size,'Engine file changed while hashing');entries.push({path:rel,...d});
 }
 visit('');entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const exe=entries.find(e=>e.path===path.relative(contents,executable));assert(exe,'Executable not in installation inventory');
 return {kind:'macos-app-contents/v1',sha256:lib.sha(JSON.stringify(entries)),files:entries.length,bytes:entries.reduce((n,e)=>n+e.size,0),executableSha256:exe.sha256};
}
function assertStable(before,after,label){checkManifest(before);checkManifest(after);assert.equal(after.sha256,before.sha256,label+' changed after freeze');}
function loadPrepared(root,runId,input,tooling,engine){
 assert(/^[a-zA-Z0-9_-]+$/.test(runId||''),'A preparation run ID is required');
 const dir=lib.inside(root,path.join('output/cloud-web-build',runId));
 const read=(name)=>lib.json(lib.inside(dir,name));
 const receipt=read('preparation.json'),report=read('build-report.json');
 assert.equal(receipt.schema,'qifengle-prepared-input/v1');assert.equal(receipt.policy,POLICY);assert.equal(receipt.baseCommit,BASE_COMMIT);assert.equal(receipt.runId,runId);
 assert.equal(report.status,'PREPARATION_FROZEN');lib.assertCreatorExit(report.process);
 assert.equal(receipt.creatorExitCode,36);assert.equal(report.runId,runId);assert.equal(report.mode,'PREPARATION_ONLY');
 assert.equal(report.engineBuild,'PREPARATION_PROCESS_SUCCESS_36');
 const before=checkManifest(read('source-manifest.json')),after=checkManifest(read('source-manifest-after.json')),preparedTools=checkManifest(read('tooling-manifest.json'));
 const afterTools=checkManifest(read('tooling-manifest-after.json'));
 assertStable(preparedTools,afterTools,'Preparation tooling');
 assert.equal(report.sourceSha256,before.sha256);assert.equal(report.toolingSha256,preparedTools.sha256);
 assert.deepEqual(report.engineExecutable,receipt.engineExecutable);
 assertBaseline(root,before);assertPreparationDelta(before,after);
 assert.equal(receipt.originalSourceSha256,before.sha256);assert.equal(receipt.frozenSourceSha256,after.sha256);assert.equal(receipt.toolingSha256,preparedTools.sha256);
 assert.deepEqual(receipt.engineExecutable,engine,'Creator executable differs from preparation');
 assertStable(after,input,'Prepared source');assertStable(preparedTools,tooling,'Prepared tooling');
 return {runId,receiptSha256:lib.sha(fs.readFileSync(lib.inside(dir,'preparation.json'))),baseCommit:BASE_COMMIT,originalSourceSha256:before.sha256,frozenSourceSha256:after.sha256,policy:POLICY};
}
module.exports={BASE_COMMIT,INFORMATION,POLICY,OBSERVED_ADDITIONS,checkManifest,changes,assertPreparationDelta,assertBaseline,engineIdentity,assertStable,loadPrepared};
