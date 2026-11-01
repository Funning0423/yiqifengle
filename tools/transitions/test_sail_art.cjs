#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const DIR=path.resolve(__dirname,'../../creator-build-project/assets/bundles/transport_sail');
function load(rel,sandboxRequire){
 const file=path.join(S,rel);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(js,{module:m,exports:m.exports,require:sandboxRequire,console},{filename:file});
 return m.exports;
}
const layout=load('region/RegionJourneyLayout.ts',()=>({}));
const landing=load('region/SailLanding.ts',()=>({}));
const leg=load('region/TransportLeg.ts',spec=>spec.includes('RegionJourneyLayout')?layout:spec.includes('SailLanding')?landing:{});
const shot=load('region/SailShot.ts',spec=>spec.includes('TransportLeg')?leg:{});
const route=leg.sailRoute(),tl=leg.sailBeats(route.length);
assert(tl.speed.v<=4.5,'cruise m/s '+tl.speed.v);
assert(tl.build05S<=30.5,'build05 '+tl.build05S);
assert(Math.abs(route.samples[0][1]-leg.SAIL_WATER_Y)<1e-6,'waterline');
assert(route.samples[0][0]-leg.SAIL_I6[0]>1.5,'berth beside the pier');
for(const k of [1,2,3,4,5,6,7]){
 const s=shot.sailShotTime(k);
 assert(s.t>=0&&s.t<=tl.build05S,'k'+k);
 const cam=leg.sailCamera(tl,route.samples,s.t,{w:390,h:844});
 const v=leg.sailVehicle(tl,route.samples,s.t);
 const d=Math.hypot(cam.position[0]-v.pos[0],cam.position[1]-v.pos[1],cam.position[2]-v.pos[2]);
 assert(d>=6&&d<20,'k'+k+' cam '+d);
 assert.equal(s.night,k===7);
}
const art=fs.readFileSync(path.join(S,'region/SailArt.ts'),'utf8');
assert(art.includes('sailboat')&&art.includes('sea_plane')&&art.includes('rm_reeds')&&art.includes('CullMode.NONE'));
assert(!fs.existsSync(path.join(DIR,'transport_sailboat.glb')));
assert(fs.existsSync(path.join(DIR,'sailboat.glb')));
assert(fs.existsSync(path.join(DIR,'textures/transit_palette_256.png')));
console.log(JSON.stringify({status:'PASS',v:+tl.speed.v.toFixed(3),build05S:+tl.build05S.toFixed(3),shots:7}));
