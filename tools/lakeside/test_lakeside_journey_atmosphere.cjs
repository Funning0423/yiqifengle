// build05-next (lead 03:00): the island→lakeside journey's final stretch takes the lakeside board lighting (main light
// direction/colour/illuminance, ambient, clear colour, layered fog) with one smooth blend, so the landing frame matches the board.
// Real TS (board-ui harness) on the real route (lakesideJourney + route.timing, 60 Hz); wiring checked in the sources.
const J=require('../journey-integration/journey-scene.cjs'),{fs,assert,H,S,Core,routeLength,start}=J;
const path=require('path');
const A=H.load(S+'region/LakesideJourneyAtmosphere.ts'),LK=H.load(S+'region/LakesideCameraLayout.ts'),D=H.load(S+'region/LakesideSceneData.ts');
const j=LK.lakesideJourney(start),P=[...j.approach,...j.bridge.slice(1),...j.arrival],T=routeLength(P);
const route={bridgeStart:routeLength(j.approach),bridgeEnd:routeLength([...j.approach,...j.bridge.slice(1)])};
const W=d=>A.lakesideAtmosphereWeight(route,T,d);
// weight: 0 until mid-bridge, 1 from 1 m before the stop, monotone and smooth
const a=route.bridgeStart+(route.bridgeEnd-route.bridgeStart)*.5,b=T-1;
assert.equal(W(0),0);assert.equal(W(a-0.01),0);assert.equal(W(b),1);assert.equal(W(T),1);
// island day base (scene authored values are unknown here: use a neutral day + a night base; the blend must hit the board numbers exactly)
const P0=D.LAKESIDE_DIR_LIGHT_PARAMS;
for(const [label,base] of [['day',{illum:65000,color:[255,244,214],sky:[200,220,255],ground:[120,110,90],skyIllum:20000,clear:[51,51,51]}],['night',{illum:9000,color:[150,170,255],sky:[40,50,90],ground:[20,20,30],skyIllum:3000,clear:[51,51,51]}]]){
 const t=A.lakesideAtmosphereTarget(base),f1=A.lakesideAtmosphereAt(base,W(T),'layered',j.root[1]);
 assert.equal(f1.illum,base.illum*P0.sunIlluminanceScale);assert.equal(f1.skyIllum,base.illum*P0.ambientSkyIllumToSun,'board: skyIllum = base illum × ambientSkyIllumToSun');
 assert.deepEqual([...f1.color],D.lakesideCocosLightColor(P0.sunColorLinear));assert.deepEqual([...f1.sky],D.lakesideCocosLightColor(P0.ambientSkyColorLinear));assert.deepEqual([...f1.ground],D.lakesideCocosLightColor(P0.ambientGroundColorLinear));
 assert.deepEqual([...f1.clear],D.linearToSrgb8(P0.clearColorLinear),'day end clear = board init clear (dir: linearToSrgb8(clearColorLinear), not the old hemi #f2b98a)');assert.deepEqual([...f1.clear],[28,143,184]);
 assert.equal(f1.fog.type,3);assert.equal(f1.fog.range,D.LAKESIDE_LAYERED_FOG.fogRange);assert.equal(f1.fog.atten,D.LAKESIDE_LAYERED_FOG.fogAtten);
 const f0=A.lakesideAtmosphereAt(base,0,'layered');assert.equal(f0.illum,base.illum);assert.deepEqual([...f0.color],base.color);assert(f0.fog.range>=D.LAKESIDE_LAYERED_FOG.fogRange*999,'primed fog ≈ invisible');
 // time domain: the timed walk (journeyDistanceAt, route.timing) at 60 Hz -> per-frame steps (no pop)
 const tm=j.timing;let prev=null,maxStep={colour:0,illumPct:0,w:0},t0=null,t1=null,maxDwDt=0;
 for(let k=0;k<=tm.durationS*60;k++){const time=k/60,d=Core.journeyDistanceAt(T,tm,time),w=W(d),f=A.lakesideAtmosphereAt(base,w,'layered');
  if(w>0&&t0==null)t0=time;if(w>=1&&t1==null)t1=time;
  if(prev){maxStep.colour=Math.max(maxStep.colour,...[0,1,2].map(i=>Math.abs(f.color[i]-prev.color[i])),...[0,1,2].map(i=>Math.abs(f.sky[i]-prev.sky[i])),...[0,1,2].map(i=>Math.abs(f.ground[i]-prev.ground[i])),...[0,1,2].map(i=>Math.abs(f.clear[i]-prev.clear[i])));
   maxStep.illumPct=Math.max(maxStep.illumPct,Math.abs(f.illum-prev.illum)/base.illum*100);maxDwDt=Math.max(maxDwDt,(w-prev.weight)*60);assert(w>=prev.weight-1e-12,'monotone');}
  prev=f;}
 assert(t0!=null&&t1!=null&&t1-t0>=3,'blend lasts ≥ 3 s ('+(t1-t0).toFixed(2)+' s)');
 assert(maxStep.colour<=6,'no colour pop: max per-frame step '+maxStep.colour+' /255');
 assert(t1<=tm.durationS,'fully lit before she stops');
 console.log(label+': blend '+t0.toFixed(2)+'→'+t1.toFixed(2)+' s of '+tm.durationS+' s (d '+a.toFixed(1)+'→'+b.toFixed(1)+' m of '+T.toFixed(1)+' m); peak dw/dt '+maxDwDt.toFixed(3)+'/s; max per-frame step: colour '+maxStep.colour+'/255, sun illum '+maxStep.illumPct.toFixed(2)+'%');
}
console.log('lakeside root y (fog slab offset) '+j.root[1].toFixed(3)+' m');
// linear A/B and off follow ?lakefog like the board
const nb={illum:1,color:[1,1,1],sky:[1,1,1],ground:[1,1,1],skyIllum:1,clear:[1,1,1]};
assert.equal(A.lakesideAtmosphereAt(nb,1,'off').fog,null);const lf=A.lakesideAtmosphereAt(nb,1,'linear60');assert.equal(lf.fog.type,0);assert.equal(lf.fog.end,D.lakesideFogEnd(D.LAKESIDE_DIR_LIGHT_PARAMS));
// base-illum registry (board scales from the island base, not the blended value)
assert.equal(A.lakesideJourneyBaseIllum(),null);A.setLakesideJourneyBaseIllum(123);assert.equal(A.lakesideJourneyBaseIllum(),123);A.setLakesideJourneyBaseIllum(null);assert.equal(A.lakesideJourneyBaseIllum(),null);
// wiring
const rd=f=>fs.readFileSync(path.join(S,f),'utf8'),core=rd('world-r1/RegionJourneyCore.ts'),ad=rd('region/RegionJourneyAdapter.ts'),lt=rd('region/LakesideJourneyLighting.ts'),bg=rd('region/LakesideBoardBackground.ts');
assert(/progress\?\(distance:number\):void;/.test(core));
assert((core.match(/this\.leaseProgress\(\);/g)||[]).length===2,'observe + stop');
assert(/private leaseProgress\(\)\{const l=this\.lease;if\(!l\?\.progress\)return;try\{l\.progress\(this\.distance\);\}catch\{\}\}/.test(core),'a lighting error never breaks the walk');
assert(/show\(visible\)\{if\(dead\)return;rig\.active=visible;if\(visible\)\{atmosphere\.prime\(\);if\(water\)applyLakesideWaterUniforms\(water,lakesideDayNightMode\(\)\);\}\},progress\(d\)\{if\(!dead\)atmosphere\.apply\(lakesideAtmosphereWeight\(route,total,d\)\);\}/.test(ad));
assert(/const release=\(\)=>\{if\(dead\)return;dead=true;offWater\?\.\(\);offWater=null;water=null;atmosphere\.restore\(\);/.test(ad),'restored on dispose / 主页 (r4: water toggle listener dropped first)');
assert(/landing:L\.landing,timing:L\.timing/.test(ad),'17 s S-curve walk from 运镜bot layout');
assert(/Quat\.slerp\(q,s\.wrot,target,f\.weight\)/.test(lt)&&/Quat\.fromViewUp\(target,new Vec3\(-v\[0\],-v\[1\],-v\[2\]\)\.normalize\(\),Vec3\.UP\)/.test(lt),'sun direction slerps to sunForward (r2: LakesideJourneyLighting.ts)');
assert(/const bi=\(lakesideJourneyBaseIllum\(\)\?\?saved\.illum\/lakesideIslandLightScale\(saved\.mode\)\)\*lakesideIslandLightScale\(mode\)/.test(bg)&&/l\.illuminance=bi\*M\.sunIlluminanceScale/.test(bg)&&/amb\.skyIllum=bi\*M\.ambientSkyIllumToSun/.test(bg),'board: no double scale after the journey (r2: day base x mode scale)');
console.log('lakeside journey atmosphere OK');
