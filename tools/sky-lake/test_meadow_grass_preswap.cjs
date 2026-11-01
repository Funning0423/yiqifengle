'use strict';
// fg-grass-preswap: meadow grass meshes have no a_normal; the prefab's placeholder M_meadow_grass_wind is builtin-standard and
// reads a stale generic attribute → cyan/pink by draw order (场景设计部 tint_proof/REPRO.md). No meadow grass renderer may be
// active in the hierarchy with a non-wind material: every meadow mount must be inactive until the grass got the wind material.
// FAILS on 239b5113 (SailShot mounts the meadow active and never swaps the grass material).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.ts')?[path.join(d,e.name)]:[]);
const SWAP=/for\(const r of grass\)\{?for\(let i=0;i<r\.sharedMaterials\.length;i\+\+\)r\.setSharedMaterial\((material|wind),i\)/;
const sites={'region/SailPreload.ts':0,'region/RegionJourneyAdapter.ts':0,'region/MeadowBoardBackground.ts':0,'region/SailShot.ts':0};
const found=[];
for(const f of walk(S)){const rel=path.relative(S,f).split(path.sep).join('/'),s=fs.readFileSync(f,'utf8');
 if(/mountRegion\(REGIONS\.meadow|mountRegion\(def,prefab,rig\)|instantiate\(prefab\);model\.active=false;validateModel/.test(s))found.push(rel);}
for(const f of found)assert.ok(f in sites,'new meadow mount site without a preswap check: '+f);
const src=f=>fs.readFileSync(path.join(S,f),'utf8');
// warm rig: built under an inactive rig and only ever handed over to the journey (takeSailWarm), never shown itself
{const s=src('region/SailPreload.ts');assert.match(s,/const rig=new Node\('SailWarm-meadow'\);rig\.active=false;parent\.addChild\(rig\);\s*const model=mountRegion\(REGIONS\.meadow,prefab,rig\);/);assert.ok(!/rig\.active=true/.test(s),'warm rig shown');}
function order(f,inactive,show){const s=src(f),a=s.search(inactive),w=s.search(SWAP),v=s.search(show);
 assert.ok(a>=0,f+': meadow not mounted inactive');assert.ok(w>a,f+': grass wind material not swapped after mount');assert.ok(v>w,f+': meadow shown before the grass swap');}
order('region/RegionJourneyAdapter.ts',/rig=new Node\('RegionJourney-'\+to\);rig\.active=false;/,/rig\.active=true;shown=true;/);
order('region/MeadowBoardBackground.ts',/rig=new Node\('MeadowLiveScene'\);rig\.active=false;/,/rig\.active=true/);
order('region/SailShot.ts',/mountRegion\(REGIONS\.meadow,await loadRegionPrefab\(REGIONS\.meadow\),scene\);meadow\.active=false;/,/meadow\.active=true;/);
// the swap waits for the async effect load, so nothing can activate in between
for(const f of ['region/RegionJourneyAdapter.ts','region/MeadowBoardBackground.ts','region/SailShot.ts'])assert.match(src(f),/loadWindEffect\(\)/);
// preflight copy: inactive and destroyed
assert.match(src('region/MeadowBoardBackground.ts'),/model=instantiate\(prefab\);model\.active=false;validateModel\(model\);[\s\S]{0,200}finally\{clearTimeout\(timer\);model\?\.destroy\(\)/);
console.log('meadow-grass-preswap: PASS '+JSON.stringify({sites:found}));
