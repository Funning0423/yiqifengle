#!/usr/bin/env node
'use strict';
/** manifest-files-exist gate (GGbot, 2026-10-29). Every path listed in the asset/text manifests must exist and be
 *  git-tracked. With --build-dir, every listed shipped asset (binary entry under assets/bundles/<b>/ or assets/resources/)
 *  must be present in that bundle of the build output: the bundle dir exists and its config.json lists the asset's uuid
 *  (compressed form, as the main asset or as uuid@sub). Catches dead entries like a manifest listing a .glb that is gone.
 *  Usage: node tools/build-guard/manifest-files-exist.cjs [--manifest FILE ...] [--build-dir DIR] [--root DIR]
 *  Default manifests: assets-MANIFEST-SHA256.json, text-MANIFEST-SHA256.json. Exit 0 = PASS, 1 = FAIL. */
const fs=require('fs'),path=require('path');
const {compressUuid,git,bundleDir}=require('./lib-gates.cjs');
const BIN=/\.(glb|gltf|bin|png|jpe?g|webp|gif|mp3|wav|ogg|m4a|aac|ttf|otf|astc|pkm|ktx)$/i;
function run(opts){
  const root=path.resolve(opts.root||path.resolve(__dirname,'../..'));
  const manifests=(opts.manifests&&opts.manifests.length?opts.manifests:['assets-MANIFEST-SHA256.json','text-MANIFEST-SHA256.json']);
  const tracked=new Set(git(root,['ls-files','-z']).split('\0').filter(Boolean));
  const res={entries:0,fail:[],checkedInBuild:0};
  const cfgCache=new Map();
  for(const m of manifests){const mp=path.resolve(root,m);
    if(!fs.existsSync(mp)){res.fail.push('MANIFEST_MISSING '+m);continue;}
    let list;try{list=JSON.parse(fs.readFileSync(mp,'utf8'));}catch(e){res.fail.push('MANIFEST_UNPARSEABLE '+m+': '+e.message);continue;}
    if(!Array.isArray(list)){res.fail.push('MANIFEST_NOT_ARRAY '+m);continue;}
    for(const e of list){res.entries++;const p=e&&e.path;
      if(typeof p!=='string'){res.fail.push(`BAD_ENTRY ${m} ${JSON.stringify(e)}`);continue;}
      if(!fs.existsSync(path.join(root,p)))res.fail.push(`MISSING_FILE ${m}: ${p}`);
      else if(!tracked.has(p))res.fail.push(`NOT_TRACKED ${m}: ${p}`);
      if(!opts.buildDir||!BIN.test(p))continue;
      const mm=p.match(/^creator-build-project\/assets\/(?:bundles\/([^/]+)|(resources))\//);if(!mm)continue;
      const bundle=mm[1]||'resources',metaPath=path.join(root,p+'.meta');if(!fs.existsSync(metaPath))continue;
      let uuid;try{uuid=JSON.parse(fs.readFileSync(metaPath,'utf8')).uuid;}catch(e){continue;}
      res.checkedInBuild++;
      const bd=bundleDir(path.resolve(opts.buildDir),bundle);if(!bd){res.fail.push(`BUNDLE_NOT_IN_BUILD ${bundle} (for ${p})`);continue;}
      if(!cfgCache.has(bd)){const cf=fs.readdirSync(bd).find(f=>/^config(\.[0-9a-f]+)?\.json$/.test(f));let ids=[];try{const c=JSON.parse(fs.readFileSync(path.join(bd,cf),'utf8'));ids=(c.uuids||[]).concat(Object.values(c.redirect||{}));}catch(e){}cfgCache.set(bd,new Set(ids.map(x=>String(x).split('@')[0])));}
      const ids=cfgCache.get(bd);if(!ids.has(compressUuid(uuid))&&!ids.has(uuid))res.fail.push(`NOT_IN_BUILD ${p} uuid=${uuid} bundle=${bundle}`);
    }}
  return res;
}
module.exports={run};
if(require.main===module){
  const a=process.argv,ms=[];let bd,root;for(let i=2;i<a.length;i++){if(a[i]==='--manifest')ms.push(a[++i]);else if(a[i]==='--build-dir')bd=a[++i];else if(a[i]==='--root')root=a[++i];}
  const r=run({manifests:ms,buildDir:bd,root});for(const l of r.fail)console.log('FAIL '+l);
  console.log(`${r.fail.length?'FAIL':'PASS'} manifest-files-exist entries=${r.entries} checkedInBuild=${r.checkedInBuild} fails=${r.fail.length}`);
  process.exit(r.fail.length?1:0);
}
