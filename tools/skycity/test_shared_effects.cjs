#!/usr/bin/env node
'use strict';
// shared_effects: one builtin-standard copy (priority 6 WeChat subpackage) + loader hook that loads it before any dependent bundle.
const fs=require('fs'),path=require('path'),assert=require('assert'),Module=require('module');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript'),P=path.resolve(__dirname,'../../creator-build-project/assets');
const dir=JSON.parse(fs.readFileSync(P+'/bundles/shared_effects.meta','utf8')).userData;
assert.deepStrictEqual([dir.isBundle,dir.bundleName,dir.priority,dir.compressionType.wechatgame,dir.isRemoteBundle.wechatgame],[true,'shared_effects',6,'subpackage',false]);
const bundles=fs.readdirSync(P+'/bundles').filter(f=>f.endsWith('.meta')&&f!=='shared_effects.meta').map(f=>JSON.parse(fs.readFileSync(P+'/bundles/'+f,'utf8')).userData).filter(u=>u.isBundle);
for(const u of bundles)assert(u.priority<6,u.bundleName+' must stay below shared_effects priority');
const res=JSON.parse(fs.readFileSync(P+'/resources.meta','utf8')).userData;assert(res.priority>6,'resources/main keep higher priority');
const mtl=JSON.parse(fs.readFileSync(P+'/bundles/shared_effects/mat_shared_builtin_standard.mtl','utf8'));assert.equal(mtl._effectAsset.__uuid__,'c8f66d17-351a-48da-a12c-0212d28575c4');
assert.deepStrictEqual(fs.readdirSync(P+'/bundles/shared_effects').sort(),['mat_shared_builtin_standard.mtl','mat_shared_builtin_standard.mtl.meta'],'shared bundle holds only the effect carrier');
// loader hook, real TS with a fake assetManager
const src=fs.readFileSync(P+'/scripts/SharedBundles.ts','utf8'),js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText;
const log=[],loaded=new Set();let fail=null;const am={getBundle:n=>loaded.has(n)?{name:n}:null,loadBundle(n,a,b){const cb=typeof a==='function'?a:b;log.push(n);setImmediate(()=>{if(fail===n)return cb(Error('x'),null);loaded.add(n);cb(null,{name:n});});}};
const m=new Module('SharedBundles');m.paths=module.paths;const req=m.require.bind(m);m.require=id=>id==='cc'?{assetManager:am}:req(id);m._compile(js,'SharedBundles.js');
assert(am.__qfSharedDeps);const L=m.exports;L.installSharedBundleDeps(am);assert.deepStrictEqual([...L.SHARED_DEPENDENTS].sort(),['board_art','region_island','region_meadow','region_skycity','static_seat_preview']);
(async()=>{const load=(n,o)=>new Promise((ok,ko)=>o?am.loadBundle(n,o,(e,b)=>e?ko(e):ok(b)):am.loadBundle(n,(e,b)=>e?ko(e):ok(b)));
 assert.equal((await load('audio_bgm_island')).name,'audio_bgm_island');assert.deepStrictEqual(log,['audio_bgm_island'],'non-dependent untouched');
 fail='shared_effects';await assert.rejects(load('region_skycity'));assert(!loaded.has('region_skycity'),'dependent never loads without the shared effect');fail=null;log.length=0;
 assert.equal((await load('region_skycity',{})).name,'region_skycity');assert.deepStrictEqual(log,['shared_effects','region_skycity']);
 log.length=0;await load('region_meadow');assert.deepStrictEqual(log,['region_meadow'],'shared loaded once');
 for(const f of ['WorldIntegrationBoot.ts','StaticSeatedPreviewBoot.ts'])assert(/^import '\.\/SharedBundles';/m.test(fs.readFileSync(P+'/scripts/'+f,'utf8')),f+' installs the hook first');
 console.log('PASS shared_effects bundle + loader hook');})().catch(e=>{console.error(e);process.exitCode=1;});
