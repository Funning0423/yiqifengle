'use strict';
// b19 skycity face budget (产品总监 2026-10-25): every geometry RESIDENT in the sky-city scene together <= 90,000 triangles.
// Counted: every *.glb in bundles/region_skycity (env_skycity minus the two cloud nodes SkycityCloudsea replaces with the soft sea,
// env_sky_cloudsea_soft, sky_mooring_props). A new glb in the bundle must be listed here (counted or excluded with a reason), so it
// can never slip past the gate. Not counted: transport_balloon (transit vehicle, own bundle/budget), the girl (character bundle).
// On 8557f895 this FAILS (89,989 + 1,380 mooring = 91,369).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../../creator-build-project/assets/bundles/region_skycity');
const LIMIT=90000;
const COUNTED={
 'env_skycity.glb':{skipNodes:['env_sky_cloudsea','env_sky_cumulus_far'],why:'region prefab; the two cloud nodes are hidden and replaced by env_sky_cloudsea_soft (SkycityCloudsea)'},
 'env_sky_cloudsea_soft.glb':{skipNodes:[],why:'sibling prefab mounted with the city (RegionLoader)'},
 'sky_mooring_props.glb':{skipNodes:[],why:'landing deck + 5a mooring, mounted with the city (RegionLoader.mountSkyMooring)'},
};
const EXCLUDED={};
function tris(file,skip){const b=fs.readFileSync(path.join(dir,file)),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());let t=0;const per={};
 for(const n of j.nodes){if(n.mesh===undefined||skip.includes(n.name))continue;let k=0;for(const p of j.meshes[n.mesh].primitives)k+=j.accessors[p.indices].count/3;per[n.name]=(per[n.name]||0)+k;t+=k;}
 return {t,per};}
const glbs=fs.readdirSync(dir).filter(f=>f.endsWith('.glb')).sort();
for(const f of glbs)assert.ok(COUNTED[f]||EXCLUDED[f],'unlisted resident glb in region_skycity: '+f);
const rows=glbs.filter(f=>COUNTED[f]).map(f=>({glb:f,triangles:tris(f,COUNTED[f].skipNodes).t,why:COUNTED[f].why}));
const total=rows.reduce((s,r)=>s+r.triangles,0);
const report={status:total<=LIMIT?'PASS':'FAIL',total,limit:LIMIT,margin:LIMIT-total,counted:rows,excluded:EXCLUDED};
console.log(JSON.stringify(report));
assert.ok(total<=LIMIT,`skycity resident triangles ${total} > ${LIMIT}`);
