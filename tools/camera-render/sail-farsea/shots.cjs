#!/usr/bin/env node
'use strict';
/**
 * Writes the before/after far-sea shot list for bl_sail.py.
 * node shots.cjs OUT.json [OLD_TransportLeg.ts]   (old file: `git show bc81575f:creator-build-project/assets/scripts/region/TransportLeg.ts`)
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||require('../../qf-env.cjs').typescript());
const S=path.resolve(__dirname,'../../../creator-build-project/assets/scripts');
function loadFile(file,req){const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:req||(()=>{}),console},{filename:file});return m.exports;}
const layout=loadFile(path.join(S,'region/RegionJourneyLayout.ts')),landing=loadFile(path.join(S,'region/SailLanding.ts'));
const legOf=f=>loadFile(f,spec=>spec.includes('RegionJourneyLayout')?layout:spec.includes('SailLanding')?landing:{});
const after=legOf(path.join(S,'region/TransportLeg.ts'));
const before=process.argv[3]?legOf(process.argv[3]):null;
const route=after.sailRoute(),tl=after.sailBeats(route.length),sd=tl.beats.find(b=>b.id==='S-d');
const at=u=>sd.t0+(sd.t1-sd.t0)*u;
const shots=[];
function add(tag,leg,name,t,screen,night){const v=leg.sailVehicle(tl,route.samples,t),c=leg.sailCamera(tl,route.samples,t,screen);shots.push({name:tag+'_'+name,tag,t:+t.toFixed(3),w:screen.w,h:screen.h,night:!!night,cam:c,boat:{pos:v.pos,yaw:v.yaw,roll:v.roll}});}
const keys=[['u012_beam',0.12],['u020',0.20],['u026',0.26],['u030_k3in',0.30],['u036',0.36],['u040_K3still',0.40],['u042_k3out',0.42],['u049',0.49],['u056_K4',0.56]];
const P={w:390,h:844};
for(const [n,u] of keys){add('after',after,n,at(u),P,false);if(before)add('before',before,n,at(u),P,false);}
add('after',after,'K7night',at(0.40),P,true);if(before)add('before',before,'K7night',at(0.40),P,true);
for(const s of [{w:360,h:780},{w:768,h:1024}]){add('after',after,'u040_K3still_'+s.w+'x'+s.h,at(0.40),s,false);if(before)add('before',before,'u040_K3still_'+s.w+'x'+s.h,at(0.40),s,false);}
fs.writeFileSync(process.argv[2],JSON.stringify({meadowRoot:after.sailMeadowRoot(),waterY:after.SAIL_WATER_Y,shots},null,1));
console.log('shots',shots.length);
