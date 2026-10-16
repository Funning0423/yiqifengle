#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const lib=require('./lib.cjs'),{args}=require('./build.cjs'),{assertStartup,runStartupSmoke}=require('./smoke.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cocos-pipeline-contract-')),root=path.join(temp,'artifact');
const checks=[];
function test(name,fn){fn();checks.push(name);}
function put(name,content){const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof content==='string'?content:JSON.stringify(content));}
function fixture(){
  put('index.html','<html><script src="index.js"></script></html>'); put('index.js','/* synthetic validator fixture; NOT A GAME */');
  put('application.js','/* synthetic validator fixture; NOT A GAME */'); put('cocos-js/cc.js','/* synthetic fixture */');
  put('src/chunks/bundle.js','/* synthetic fixture */');
  put('src/import-map.json',{imports:{cc:'./../cocos-js/cc.js'}});
  const bundles=lib.REQUIRED_BUNDLES.concat('static_seat_preview');
  put('src/settings.json',{CocosEngine:lib.ENGINE,engine:{platform:'web-desktop',debug:true},assets:{projectBundles:bundles,subpackages:[],remoteBundles:[]},launch:{launchScene:lib.SCENE_URL},scripting:{scriptPackages:['../src/chunks/bundle.js']}});
  for(const name of bundles){put(`assets/${name}/config.json`,{name,debug:true,scenes:name==='main'?{[lib.SCENE_URL]:lib.SCENE_UUID}:{},uuids:name==='main'?[lib.SCENE_UUID]:[],packs:{},deps:[]});put(`assets/${name}/index.js`,'/* synthetic bundle entry */');}
  put(`assets/main/import/26/${lib.SCENE_UUID}.json`,{synthetic:true});
}
function updateSettings(change){const s=lib.json(path.join(root,'src/settings.json'));change(s);put('src/settings.json',s);}
(async()=>{try{
 fixture();
 test('synthetic artifact shape passes static validation only',()=>assert.equal(lib.verifyArtifact(root).status,'ARTIFACT_STRUCTURE_VERIFIED'));
 test('script package resolves relative to actual cc module',()=>{updateSettings(s=>s.scripting.scriptPackages=['../src/chunks/bundle.js']);lib.verifyArtifact(root);fixture();});
 for(const ref of ['../../outside.js','https://outside.example/bundle.js','%2foutside.js','%2f%2foutside.example/bundle.js','https%3a//outside.example/bundle.js','..%5coutside.js','%00bundle.js'])test('unsafe script package rejected: '+ref,()=>{updateSettings(s=>s.scripting.scriptPackages=[ref]);assert.throws(()=>lib.verifyArtifact(root),/escapes|external|Root-relative|Backslash\/NUL/);fixture();});
 test('missing resolved script package rejected',()=>{const f=path.join(root,'src/chunks/bundle.js');fs.renameSync(f,f+'.backup');assert.throws(()=>lib.verifyArtifact(root),/Missing\/empty/);fs.renameSync(f+'.backup',f);});
 test('unexpected cc import mapping rejected',()=>{put('src/import-map.json',{imports:{cc:'../other/cc.js'}});assert.throws(()=>lib.verifyArtifact(root),/Unexpected Creator/);fixture();});
 test('wrong engine rejected',()=>{updateSettings(s=>s.CocosEngine='4.0.0');assert.throws(()=>lib.verifyArtifact(root),/Wrong Cocos engine/);fixture();});
 test('wechat package rejected',()=>{updateSettings(s=>s.engine.platform='wechatgame');assert.throws(()=>lib.verifyArtifact(root),/mini-game package/);fixture();});
 test('old scene rejected',()=>{updateSettings(s=>s.launch.launchScene='db://assets/scenes/FirstsliceImport.scene');assert.throws(()=>lib.verifyArtifact(root),/Wrong launch scene/);fixture();});
 test('missing bundle rejected',()=>{fs.renameSync(path.join(root,'assets/resources/config.json'),path.join(root,'assets/resources/backup.json'));assert.throws(()=>lib.verifyArtifact(root),/Missing\/empty/);fs.renameSync(path.join(root,'assets/resources/backup.json'),path.join(root,'assets/resources/config.json'));});
 test('omitted region declaration rejected even if other structure is valid',()=>{updateSettings(s=>s.assets.projectBundles=s.assets.projectBundles.filter(x=>x!=='region_meadow'));assert.throws(()=>lib.verifyArtifact(root),/Required current-scene bundle/);fixture();});
 test('source-declared extra bundle required',()=>assert.throws(()=>lib.verifyArtifact(root,{expectedBundles:['new_source_bundle']}),/Required current-scene bundle/));
 test('missing imported pack rejected',()=>{const c=lib.json(path.join(root,'assets/region_meadow/config.json'));c.uuids=['synthetic-asset'];c.packs={'ab-pack':['synthetic-asset']};put('assets/region_meadow/config.json',c);assert.throws(()=>lib.verifyArtifact(root),/ab-pack.json/);fixture();});
 test('missing CCONB import rejected',()=>{const c=lib.json(path.join(root,'assets/region_meadow/config.json'));c.uuids=['ab-mesh'];c.extensionMap={'.cconb':['ab-mesh']};put('assets/region_meadow/config.json',c);assert.throws(()=>lib.verifyArtifact(root),/ab-mesh.cconb/);fixture();});
 test('CCONB .bin path accepted per official 3.8.8 downloader',()=>{const c=lib.json(path.join(root,'assets/region_meadow/config.json'));c.uuids=['ab-mesh'];c.extensionMap={'.cconb':['ab-mesh']};put('assets/region_meadow/config.json',c);put('assets/region_meadow/import/ab/ab-mesh.bin','synthetic binary fixture');lib.verifyArtifact(root);fixture();});
 test('CCONB pack requires .bin based on its first member',()=>{const c=lib.json(path.join(root,'assets/region_meadow/config.json'));c.uuids=['ab-mesh'];c.extensionMap={'.cconb':['ab-mesh']};c.packs={'ab-ccon-pack':['ab-mesh']};put('assets/region_meadow/config.json',c);assert.throws(()=>lib.verifyArtifact(root),/ab-ccon-pack.bin/);put('assets/region_meadow/import/ab/ab-ccon-pack.bin','synthetic binary pack');lib.verifyArtifact(root);fixture();});
 test('missing scene bytes rejected',()=>{const f=path.join(root,`assets/main/import/26/${lib.SCENE_UUID}.json`);fs.renameSync(f,f+'.backup');assert.throws(()=>lib.verifyArtifact(root),/Missing\/empty/);fs.renameSync(f+'.backup',f);});
 test('remote bundle rejected',()=>{updateSettings(s=>s.assets.remoteBundles=['resources']);assert.throws(()=>lib.verifyArtifact(root),/Remote bundles/);fixture();});
 test('external bootstrap rejected',()=>{put('index.html','<script src="https://third.example/app.js"></script>');assert.throws(()=>lib.verifyArtifact(root),/external entry/);fixture();});
 test('path traversal rejected',()=>{put('index.html','<script src="../outside.js"></script>');assert.throws(()=>lib.verifyArtifact(root),/escapes/);fixture();});
 test('changed output bytes change identity',()=>{const before=lib.verifyArtifact(root).sha256;put('cocos-js/cc.js','/* changed synthetic fixture */');assert.notEqual(lib.verifyArtifact(root).sha256,before);fixture();});
 test('inventory deterministic',()=>assert.deepEqual(lib.inventory(root),lib.inventory(root)));
 test('symlinked bootstrap rejected before use',()=>{const f=path.join(root,'index.js'),target=path.join(temp,'outside.js');fs.renameSync(f,f+'.backup');fs.writeFileSync(target,'synthetic outside file');fs.symlinkSync(target,f);assert.throws(()=>lib.verifyArtifact(root),/outside artifact\/source root/);fs.unlinkSync(f);fs.renameSync(f+'.backup',f);});
 const sourceFixture=path.join(temp,'source-fixture');
 function sourcePut(rel,data){lib.write(path.join(sourceFixture,rel),data);}
 sourcePut('creator-build-project/package.json',{creator:{version:lib.ENGINE}});
 sourcePut('creator-build-project/settings/test.json',{synthetic:true});
 sourcePut('creator-build-project/assets/scenes/WorldR5Integration.scene',[{__type__:'cc.SceneAsset',_name:'WorldR5Integration'},{__type__:'cc.Scene',_id:lib.SCENE_UUID}]);
 sourcePut('creator-build-project/assets/scenes/WorldR5Integration.scene.meta',{uuid:lib.SCENE_UUID});
 sourcePut(lib.CONFIG_REL,lib.json(path.join(__dirname,'world-r5-build-options.json')));
 sourcePut('creator-build-project/build-templates/web-desktop/index.ejs',{synthetic:'template-one'});
 test('template changes alter source fingerprint',()=>{const before=lib.sourceIdentity(sourceFixture).sha256;sourcePut('creator-build-project/build-templates/web-desktop/index.ejs',{synthetic:'template-two'});assert.notEqual(lib.sourceIdentity(sourceFixture).sha256,before);});
 test('new extension files alter source fingerprint',()=>{const before=lib.sourceIdentity(sourceFixture).sha256;sourcePut('creator-build-project/extensions/synthetic/package.json',{synthetic:true});assert.notEqual(lib.sourceIdentity(sourceFixture).sha256,before);});
 test('generated cache does not contaminate source fingerprint',()=>{const before=lib.sourceIdentity(sourceFixture).sha256;sourcePut('creator-build-project/library/synthetic.json',{synthetic:true});assert.equal(lib.sourceIdentity(sourceFixture).sha256,before);});
 test('build cannot launch implicitly',()=>{assert.throws(()=>args([]),/Choose/);assert.throws(()=>args(['--execute','--plan']),/Choose/);assert.throws(()=>args(['--execute','--unsafe']),/Unknown/);});
 test('official Creator success code 36 accepted',()=>lib.assertCreatorExit({code:36,signal:null}));
 for(const code of [0,32,34,null])test('Creator exit '+code+' rejected',()=>assert.throws(()=>lib.assertCreatorExit({code,signal:null}),/success code 36/));
 test('terminated Creator rejected',()=>assert.throws(()=>lib.assertCreatorExit({code:36,signal:'SIGTERM'}),/success code 36/));
 test('creator path with spaces remains one argument',()=>assert.equal(args(['--execute','--creator','C:/Program Files/Cocos/Creator.exe']).creator,'C:/Program Files/Cocos/Creator.exe'));
 const startup={loading:{phase:'ready',gate:{phase:'ready'},error:''},world:{state:'home',characterReady:true},candidate:{staticHomeInstantiated:false,meshNames:['synthetic']},motion:{availableClips:['synthetic'],clip:'synthetic'},layout:{managedBoards:0},engineVersion:lib.ENGINE,renderers:{active:1,missingMaterials:0},canvas:{width:1,height:1},webglContext:true};
 test('startup assertion logic accepts synthetic complete record only',()=>assertStartup(startup));
 for(const [name,change]of [['WebGL missing',s=>s.webglContext=false],['no dynamic character',s=>s.candidate.staticHomeInstantiated=true],['gate not ready',s=>s.loading.gate.phase='loading'],['missing materials',s=>s.renderers.missingMaterials=1],['board leakage',s=>s.layout.managedBoards=1]])test('startup rejects '+name,()=>{const s=structuredClone(startup);change(s);assert.throws(()=>assertStartup(s));});
 const sourceRoot=path.resolve(__dirname,'../..'),provenanceFile=path.join(temp,'provenance.json');
 lib.write(provenanceFile,{creatorExitCode:36,engine:lib.ENGINE,sceneUuid:lib.SCENE_UUID,sceneUrl:lib.SCENE_URL,sourceSha256:lib.sourceIdentity(sourceRoot).sha256,artifactSha256:lib.verifyArtifact(root).sha256});
 const options={url:'https://example.invalid/',artifactDir:root,provenanceFile,sourceRoot,evidenceDir:path.join(temp,'blocked-evidence')};
 const page={url:()=> 'about:blank',context:()=>({storageState:async()=>({cookies:[],origins:[]})}),on(){},off(){},evaluate:async()=>({webgl:false,version:null}),goto:async()=>{throw Error('Must not navigate');},request:{get:async()=>{throw Error('Must not fetch');}}};
 const blocked=await runStartupSmoke(page,options);
 assert.equal(blocked.status,'BLOCKED_WEBGL');assert.equal(blocked.visualAcceptance,'NOT_REVIEWED');
 assert.equal(lib.json(path.join(options.evidenceDir,'runtime-report.json')).status,'BLOCKED_WEBGL');
 checks.push('mock adapter fails closed before navigation/fetch when WebGL is unavailable');
 await assert.rejects(()=>runStartupSmoke({...page,url:()=> 'https://user.example/'},options),/fresh owned disposable/);
 checks.push('existing user tab rejected');
 await assert.rejects(()=>runStartupSmoke({...page,context:()=>({storageState:async()=>({cookies:[{name:'user'}],origins:[]})})},options),/prior user\/session/);
 checks.push('context with user state rejected');
 const report={status:'PASS',testKind:'NODE_CONTRACT_TESTS_ONLY',count:checks.length,checks,engineBuild:'NOT_RUN',browser:'NOT_RUN',visualAcceptance:'NOT_RUN'};
 console.log(JSON.stringify(report,null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
