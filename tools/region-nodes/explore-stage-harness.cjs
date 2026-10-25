'use strict';
/* Shared by the explore lens tests (运镜bot): real ExploreInput + real RegionNodeStage lens methods (transpiled out of the class)
 * + real FreeOrbit / LensGuard; scene lookups stubbed. rig(region,state,stand,opts): opts.boxes = renderer AABBs (refreshOrbitBoxes),
 * opts.seed = the lens explore opens on (default: the follow lens), opts.open = go through openExplore. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const {createHarness}=require('../board-ui/harness.cjs');const H=createHarness();const ts=require('../qf-env.cjs').typescript();
Object.assign(H.cc.Input.EventType,{TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel'});
const S=p=>path.join(H.SCRIPTS,p);
const FO=H.load(S('region/FreeOrbit.ts')),EI=H.load(S('world-r2/ExploreInput.ts')),Gate=H.load(S('region/ExploreGate.ts')),
 OC=H.load(S('region/LensOcclusion.ts')),LX=H.load(S('region/LakesideLensOccluders.ts')),IX=H.load(S('region/IslandLensOccluders.ts')),E=H.load(S('region/ExploreCameraCore.ts'));
const {IslandHomeInteraction}=H.load(S('world-r2/IslandHomeInteraction.ts'));
const src=fs.readFileSync(S('world-r2/RegionNodeStage.ts'),'utf8'),sf=ts.createSourceFile('s.ts',src,ts.ScriptTarget.ES2020,true);
const cls=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name&&n.name.text==='RegionNodeStage');
const want=['traceOcc','onGesture','clampArm','regionBounds','toWorld','aimOrbit','tickLens','writeOrbit','occlude','lakesideOccluders','skycityOccluders','handOrbitBack','viewDir','guardOrbitGround','deckElev','preSolveEntry','openExplore','syncExplore','takeSyncView','releaseSyncCams','standOnWalk','standOnWalkOrThrow','standAt','qaTeleport','walkMatrix','showWorld','restoreBoard','lookAt','armOf','armAlong','outOfProxies','update','traceFrame','clampPitch','skycityOccluders','qaAimAt','qaOrbit','attach'];
const OPTIONAL=new Set(['traceOcc','qaAimAt','qaOrbit','attach','clampArm','takeSyncView','releaseSyncCams','standOnWalk','standOnWalkOrThrow','standAt','qaTeleport','lookAt','armOf','armAlong','outOfProxies','clampPitch','skycityOccluders']);/* p0drag5: absent before its fix *//* absent before the r17 fix: the failing-before run */
const methods=want.map(n=>{const m=cls.members.find(x=>x.name&&x.name.getText(sf)===n);if(!m&&OPTIONAL.has(n))return '';assert.ok(m,'RegionNodeStage.'+n);return m.getText(sf);});
const out=ts.transpileModule(`class Stage{${methods.join('\n')}};module.exports=Stage;`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}static transformMat4(o,v,m){const t=m&&m.m12!==undefined?[m.m12,m.m13,m.m14]:[0,0,0];o.x=v.x+t[0];o.y=v.y+t[1];o.z=v.z+t[2];return o;}}
const BG=H.load(S('region/BgCamGate.ts'));
const RW=H.load(S('region/RegionWalkable.ts')),RN=H.load(S('region/RegionNodes.ts'));
class Mat4{constructor(){this.m12=0;this.m13=0;this.m14=0;this.m00=1;this.m01=0;this.m02=0;this.m04=0;this.m05=1;this.m06=0;this.m08=0;this.m09=0;this.m10=1;}/* translation-only model stub (identity rotation) */clone(){const o=new Mat4();o.m12=this.m12;o.m13=this.m13;o.m14=this.m14;return o;}static invert(o,a){o.m12=-(a.m12||0);o.m13=-(a.m13||0);o.m14=-(a.m14||0);return o;}}
const AS=(()=>{try{return H.load(S('region/ArmSmoother.ts'));}catch{return {ArmSmoother:class{clear(){}reset(){}step(t){return t;}}};}})(),SKO=process.env.QF_SKO_OLD?require('./fixtures_p0drag11_oldsky.cjs'):(()=>{try{return H.load(S('region/SkycityLensOccluders.ts')).SKYCITY_LENS_OCCLUDERS;}catch{return [];}})();
const LE=H.load(S('region/LakesideExplore.ts')),CT=H.load(S('region/CamTrace.ts'));
const sb={module:{exports:{}},stageGraph:LE.stageGraph,EXIT_EXPLORE_REGIONS:LE.EXIT_EXPLORE_REGIONS,exploreArm:LE.exploreArm,exploreWanted:LE.exploreWanted,
 director:{getScene:()=>sb.__scene||null},...(()=>{try{const LA=H.load(S('region/LensAvoid.ts'));return {AVOID:LA.AVOID,LENS_PITCH_MAX_DEG:LA.LENS_PITCH_MAX_DEG,lensLevel:LA.lensLevel,nearSphere:LA.nearSphere,herOcclusion:LA.herOcclusion,toFrame:LA.toFrame};}catch{return {};}})(),ArmSmoother:AS.ArmSmoother,...(()=>{try{return H.load(S('region/LensSmooth.ts'));}catch{return {};}})(),ISLAND_PROPS:(()=>{try{return H.load(S('world-r2/IslandPropsLayout.ts')).ISLAND_PROPS;}catch{return undefined;}})(),qaSkipTarget:()=>sb.__qa??null,qaHooksEnabled:()=>sb.__qa!=null,qaYawFacing:(g,p)=>Math.atan2(g[0]-p[0],g[2]-p[2])*180/Math.PI,camTraceStart:()=>{},SKYCITY_LENS_OCCLUDERS:SKO,bgCamHold:BG.bgCamHold,bgCamRelease:BG.bgCamRelease,bgCamHeld:BG.bgCamHeld,bgCamWanted:BG.bgCamWanted,findDeep:(n,name)=>n&&n.find?n.find(name):null,Camera:class{},Vec3,LensGuard:OC.LensGuard,LENS_GUARD:OC.LENS_GUARD,guardEval:OC.guardEval,ORBIT_LIMITS:FO.ORBIT_LIMITS,LAKESIDE_DECK_ZONES:LX.LAKESIDE_DECK_ZONES,
 setExploreEnabled:v=>Gate.setExploreEnabled(v),emitTransitCue:()=>{},proxiesToWorld:OC.proxiesToWorld,LAKESIDE_LENS_OCCLUDERS:LX.LAKESIDE_LENS_OCCLUDERS,ISLAND_LENS_OCCLUDERS:IX.ISLAND_LENS_OCCLUDERS,
 followPose:E.followPose,followLookUp:E.followLookUp,geometry:{Ray:class{constructor(){this.o=new Vec3();this.d=new Vec3();}},intersect:{rayModel:()=>0}},MeshRenderer:class{},LENS_CLEAR_M:0.6,Date,Math,Mat4,REGION_NODES:RN.REGION_NODES,nearestWalkable:RW.nearestWalkable};
/* ?camTrace=1 (CamTrace.ts) publishes its sub-path hook on the host globalThis; the vm context sees the same one */
Object.defineProperty(sb,'__qfCamTraceSub',{get:()=>globalThis.__qfCamTraceSub});Object.defineProperty(sb,'__qfCamTrace',{get:()=>globalThis.__qfCamTrace});
vm.runInNewContext(out,sb);const Stage=sb.module.exports;const setQa=v=>{sb.__qa=v;};
const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
const wrap=a=>((a+540)%360)-180;
// her stand points: island next to the lighthouse / palm; lakeside next to a ring tree (lakeside model = identity world here)
const tree=LX.LAKESIDE_LENS_OCCLUDERS.find(r=>r[4]-r[1]>2.5);
// lakeside deck: the most raised walk floor near the middle (bridge / boardwalk, floor 2.98 m, 2.4 m over the ground beside it)
const DECK_STAND=[-3,2.98,-1.5];
const HER={island:[-2.1,0,5.3],meadow:[0,0,0],skycity:[0,0,0],lakeside:[tree[3]+1.2,tree[1],(tree[2]+tree[5])/2]};
function rig(region,state,stand,opts={}){
 const st=new Stage();let written=null;const orbit=new FO.FreeOrbit(region);
 Object.assign(st,{region,orbit,exploring:true,anim:null,holdPose:null,lens:state==='S3'?'FollowWalk':'MapExplore',groundWalking:state==='S2',camera:{},dragHome:null,
  lensPull:new OC.LensGuard(),armSmooth:new AS.ArmSmoother(),avoid:{sw:0,e:0,tsw:0,te:0,clear:0,wait:0},lensSmooth:(()=>{try{return new (H.load(S('region/LensSmooth.ts')).OffsetSmoother)();}catch{return {step:(a,b,c)=>[a,b,c],clear(){}};}})(),entry:null,deckZones:null,rebuildMarkers:()=>{},islandBoxes:null,occBoxes:null,occAt:0,occModel:null,orbitBoxes:[]});
 let her=(stand||HER[region]).slice();st.girl=()=>her;st.yaw=()=>0;st.viewport=()=>({w:VW[0],h:VW[1]});st.refreshOrbitBoxes=()=>{st.orbitBoxes=(opts.boxes||[]).map(b=>({min:b.min.slice(),max:b.max.slice()}));};
 st.model=r=>r==='lakeside'?{worldMatrix:null}:opts.modelAt?{worldMatrix:{m12:opts.modelAt[0],m13:opts.modelAt[1],m14:opts.modelAt[2]},getComponentsInChildren:()=>[]}:null;st.readPose=()=>written||E.followPose(her,0,390,844,0);
 st.writePose=p=>{written=p;return p;};
 // seed: the board lens she left (S1/S2/S4) or the follow lens (S3)
 const seed=opts.seed?opts.seed(her):E.followPose(her,0,390,844,0);written=seed;
 if(opts.open){st.exploring=false;st.lens='Board';st.openExplore(region,true);if(state==='S3')st.lens='FollowWalk';if(state==='S2')st.groundWalking=true;}
 else if(state!=='S3'){orbit.seed(seed,her);orbit.armBoard();if(state==='S4'){orbit.drag(0.02,0);orbit.release();}st.handOrbitBack(region);}
 return {st,orbit,her:()=>her,cam:()=>written,walk:(dx)=>{her=[her[0]+dx,her[1],her[2]];}};
}
// real input path: ExploreInput on the global input (meadow / skycity / lakeside) or via IslandLighthouseTouch's feed (island)
function inputFor(region,st){
 const owner=new H.cc.Node('IsolatedWorldComposition'),ex=owner.addComponent(EI.ExploreInput);ex.onEnable?.();ex.sink=(g,x,y)=>st.onGesture(g,x,y);
 let all=[];const ev=(id,x,y)=>({getID:()=>id,getUILocation:o=>{if(o){o.x=x;o.y=y;return o;}return {x,y};},getLocation:o=>{if(o){o.x=x;o.y=y;return o;}return {x,y};},getAllTouches:()=>all.map(i=>({getID:()=>i})),getTouches:()=>all.map(i=>({getID:()=>i,getUILocation:()=>({x,y})}))});
 if(region!=='island'){const I=H.cc.input;return {start:(x,y)=>{all=[1];I.emit('touch-start',ev(1,x,y));},move:(x,y)=>I.emit('touch-move',ev(1,x,y)),end:(x,y)=>{all=[];I.emit('touch-end',ev(1,x,y));}};}
 const canvas=new H.cc.Node('WorldNavigationCanvas');const ih=new IslandHomeInteraction(canvas,{canUse:()=>true,hit:()=>false,returnHome:()=>{},explore:()=>ex});ih.sync(390,844,true);
 const root=canvas.getChildByName('IslandLighthouseTouch');
 return {start:(x,y)=>{all=[1];root.emit('touch-start',ev(1,x,y));},move:(x,y)=>root.emit('touch-move',ev(1,x,y)),end:(x,y)=>{all=[];root.emit('touch-end',ev(1,x,y));}};
}
const VW=[390,844];
module.exports={setQa,sb,AS,SKO,BG,RW,RN,setScene:s=>{sb.__scene=s;},CT,H,FO,E,OC,LX,IX,Gate,Stage,rig,inputFor,yawOf,wrap,VW,HER,DECK_STAND,S};
