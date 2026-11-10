#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const lib=require('./lib.cjs'),f=require('./freeze.cjs'),{args}=require('./build.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'qifengle-freeze-contract-')),checks=[];
function test(name,fn){fn();checks.push(name);}
function entry(path,text){return {path,size:Buffer.byteLength(text),sha256:lib.sha(Buffer.from(text))};}
function manifest(entries){entries=[...entries].sort((a,b)=>a.path<b.path?-1:1);return {entries,files:entries.length,bytes:entries.reduce((n,e)=>n+e.size,0),sha256:lib.sha(JSON.stringify(entries))};}
const base=manifest([entry('creator-build-project/assets/source.ts','original')]);
// Deliberately not JSON; successful freezing proves no metadata JSON parse occurs.
const opaque=f.OBSERVED_ADDITIONS.find(e=>e.path===f.INFORMATION),after=manifest([...base.entries,opaque]);
try{
 test('explicit preparation mode supported',()=>assert(args(['--prepare']).prepare));
 test('multiple action modes rejected',()=>assert.throws(()=>args(['--prepare','--execute'])));
 test('known opaque addition freezes without parsing',()=>assert.equal(f.assertPreparationDelta(base,after).added.length,1));
 for(const e of f.OBSERVED_ADDITIONS){test('exact observed metadata entry accepted: '+e.path,()=>f.assertPreparationDelta(base,manifest([...base.entries,e])));test('changed observed hash rejected: '+e.path,()=>assert.throws(()=>f.assertPreparationDelta(base,manifest([...base.entries,{...e,sha256:'0'.repeat(64)}]))));test('changed observed size rejected: '+e.path,()=>assert.throws(()=>f.assertPreparationDelta(base,manifest([...base.entries,{...e,size:e.size+1}]))));}
 test('no input changes can freeze',()=>f.assertPreparationDelta(base,base));
 for(const p of ['creator-build-project/profiles/v2/editor.json','creator-build-project/local/user.json','creator-build-project/settings/unknown.json','creator-build-project/assets/new.ts'])test('unknown addition rejected: '+p,()=>assert.throws(()=>f.assertPreparationDelta(base,manifest([...base.entries,entry(p,'synthetic')]))));
 test('changed existing input rejected',()=>assert.throws(()=>f.assertPreparationDelta(base,manifest([entry(base.entries[0].path,'changed')]))));
 test('removed original input rejected',()=>assert.throws(()=>f.assertPreparationDelta(base,manifest([]))));
 test('forged manifest hash rejected',()=>assert.throws(()=>f.checkManifest({...base,sha256:'0'.repeat(64)})));
 test('duplicate entries rejected',()=>assert.throws(()=>f.checkManifest(manifest([...base.entries,...base.entries]))));
 test('baseline exact bytes accepted',()=>f.assertBaseline(root,base,()=>Buffer.from('original'),()=>base.entries.map(e=>e.path)));
 test('baseline missing path rejected',()=>assert.throws(()=>f.assertBaseline(root,manifest([]),()=>Buffer.from('original'),()=>base.entries.map(e=>e.path))));
 test('baseline differing bytes rejected',()=>assert.throws(()=>f.assertBaseline(root,base,()=>Buffer.from('modified'),()=>base.entries.map(e=>e.path))));
 test('pre-existing information rejected',()=>assert.throws(()=>f.assertBaseline(root,after,()=>Buffer.from('original'),()=>after.entries.map(e=>e.path))));
 test('stable frozen input accepted',()=>f.assertStable(after,after,'Source'));
 test('changed information fails formal equality',()=>assert.throws(()=>f.assertStable(after,manifest([...base.entries,entry(f.INFORMATION,'changed')]),'Source')));
 test('deleted information fails formal equality',()=>assert.throws(()=>f.assertStable(after,base,'Source')));
 test('new file fails formal equality',()=>assert.throws(()=>f.assertStable(after,manifest([...after.entries,entry('creator-build-project/settings/new.json','new')]),'Source')));
 test('changed tooling fails equality',()=>assert.throws(()=>f.assertStable(base,after,'Tooling')));
 test('missing prepared run blocked',()=>assert.throws(()=>f.loadPrepared(root,'missing',after,base,{})));
 test('path traversal preparation rejected',()=>assert.throws(()=>f.loadPrepared(root,'../old',after,base,{})));
 const proj='creator-build-project';
 lib.write(path.join(root,proj,'package.json'),{creator:{version:lib.ENGINE}});
 lib.write(path.join(root,proj,'settings/test.json'),{});
 lib.write(path.join(root,proj,'assets/scenes/WorldR5Integration.scene'),[{__type__:'cc.SceneAsset',_name:'WorldR5Integration'},{__type__:'cc.Scene',_id:lib.SCENE_UUID}]);
 lib.write(path.join(root,proj,'assets/scenes/WorldR5Integration.scene.meta'),{uuid:lib.SCENE_UUID});
 lib.write(path.join(root,lib.CONFIG_REL),lib.json(path.join(__dirname,'world-r5-build-options.json')));
 for(const folder of ['local','profiles'])test(folder+' is now included in source fingerprint',()=>{const before=lib.sourceIdentity(root);lib.write(path.join(root,proj,folder,'synthetic.json'),{});assert.notEqual(lib.sourceIdentity(root).sha256,before.sha256);});
 test('opaque information is hashed without JSON parsing',()=>{const file=path.join(root,f.INFORMATION);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'invalid-json-synthetic');const e=lib.sourceIdentity(root).entries.find(e=>e.path===f.INFORMATION);assert.equal(e.sha256,lib.sha(Buffer.from('invalid-json-synthetic')));});
 test('symlinked input rejected',()=>{const file=path.join(root,proj,'settings/link');fs.symlinkSync(path.join(root,proj,'package.json'),file);assert.throws(()=>lib.sourceIdentity(root),/Symlink/);fs.unlinkSync(file);});
 test('scene meta symlink rejected before JSON content read',()=>{const p=path.join(root,proj,'assets/scenes/WorldR5Integration.scene.meta'),backup=p+'.saved',outside=path.join(root,'opaque-meta-target');fs.renameSync(p,backup);fs.writeFileSync(outside,'SYNTHETIC_DO_NOT_DISCLOSE invalid JSON');fs.symlinkSync(outside,p);assert.throws(()=>lib.sourceIdentity(root),e=>/Symlink/.test(e.message)&&!e.message.includes('SYNTHETIC_DO_NOT_DISCLOSE'));fs.unlinkSync(p);fs.renameSync(backup,p);});
 test('project-root symlink rejected before source parsing',()=>{const p=path.join(root,proj),target=path.join(root,'saved-project');fs.renameSync(p,target);fs.symlinkSync(target,p);assert.throws(()=>lib.sourceIdentity(root),/Symlink/);fs.unlinkSync(p);fs.renameSync(target,p);});
 test('tools ancestor symlink rejected',()=>{const p=path.join(root,'tools'),target=path.join(root,'saved-tools');fs.renameSync(p,target);fs.symlinkSync(target,p);assert.throws(()=>lib.inventory(root,['tools/cloud-web']),/Symlink/);fs.unlinkSync(p);fs.renameSync(target,p);});
 const app=path.join(root,'Synthetic.app'),exe=path.join(app,'Contents/MacOS/Creator');
 fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,'binary fixture');fs.mkdirSync(path.join(app,'Contents/Resources'));fs.writeFileSync(path.join(app,'Contents/Info.plist'),'fixture');fs.writeFileSync(path.join(app,'Contents/Resources/app.asar'),'resources fixture');
 test('engine bundle hashes resources and executable',()=>{const a=f.engineIdentity(exe);fs.appendFileSync(path.join(app,'Contents/Resources/app.asar'),' changed');assert.notEqual(f.engineIdentity(exe).sha256,a.sha256);});
 test('internal engine symlink identity is supported',()=>{fs.symlinkSync('app.asar',path.join(app,'Contents/Resources/internal'));f.engineIdentity(exe);});
 test('external engine symlink rejected',()=>{const p=path.join(app,'Contents/Resources/external');fs.symlinkSync(path.join(root,'tools'),p);assert.throws(()=>f.engineIdentity(exe),/escapes installation/);fs.unlinkSync(p);});
 test('unreviewed non-app engine layout rejected',()=>assert.throws(()=>f.engineIdentity(path.join(root,'other.exe')),/separate review/));
 console.log(JSON.stringify({status:'PASS',kind:'SYNTHETIC_NODE_CONTRACT_ONLY',count:checks.length,checks,nativeCreator:'NOT_RUN',browser:'NOT_RUN'},null,2));
}finally{fs.rmSync(root,{recursive:true,force:true});}
