// v3.3 load fix A: every lakeside GLB is imported with meshCompress encode:true (meshopt), so the engine must ship the meshopt
// decoder. Mac 21c187d: module culled -> 52x "ek.decodeVertexBuffer is not a function" and the lake never loads.
// Size choice (README): meshopt module ~+8.6 KB (Mac measured) vs encode off ~+47 KB (quantize+zlib) / ~+91 KB (zlib only) / ~+765 KB (raw).
const fs=require('fs'),path=require('path'),assert=require('assert');
const P=path.resolve(__dirname,'../../creator-build-project'),M=path.join(P,'assets/bundles/region_lakeside/models');
const eng=JSON.parse(fs.readFileSync(P+'/settings/v2/packages/engine.json','utf8')).modules.configs.defaultConfig;
const metas=fs.readdirSync(M).filter(f=>f.endsWith('.glb.meta'));assert(metas.length>=40,'lakeside GLB metas present');
const encoded=metas.filter(f=>JSON.parse(fs.readFileSync(path.join(M,f),'utf8')).userData.meshCompress?.encode===true);
if(encoded.length){assert.equal(eng.cache.meshopt._value,true,'meshopt module enabled');assert(eng.includeModules.includes('meshopt'),'meshopt in includeModules');}
// every OTHER compressed GLB in the project must not depend on meshopt silently (they are compress-only today)
const all=[];(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(f.endsWith('.glb.meta'))all.push(p);}})(path.join(P,'assets'));
for(const p of all){const mc=JSON.parse(fs.readFileSync(p,'utf8')).userData.meshCompress;if(mc&&mc.enable&&mc.encode)assert(eng.cache.meshopt._value&&eng.includeModules.includes('meshopt'),'encode needs meshopt: '+path.relative(P,p));}
console.log('lakeside meshopt OK ('+encoded.length+'/'+metas.length+' encoded GLBs, module on)');
