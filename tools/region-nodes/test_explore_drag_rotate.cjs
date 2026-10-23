'use strict';
/* P0 drag-rotate (运镜bot). Real input path → real lens code, per region (island, meadow, skycity, lakeside):
 *   touch events → ExploreInput (global `input` TOUCH_*; on the island the IslandLighthouseTouch feed, GGbot 410e1bd5)
 *   → sink → RegionNodeStage.onGesture → aimOrbit → FreeOrbit.drag → RegionNodeStage.tickLens (the per-frame writer)
 *   → occlude (LensGuard on lakeside / island) → writePose (the camera).
 * RegionNodeStage methods are the real source (transpiled out of the class, as test_free_orbit does); scene lookups are stubbed.
 * D1 a 120 pt right drag turns the written camera yaw by ≈ yawPerScreen × 120/390 (±20 %), in every region and state.
 * D2 it STAYS: after release and 3 s of per-frame ticks the camera yaw is within 4° of the yaw right after the coast settles
 *    (no controller pulls it back: LensGuard swing, the follow lens, a return-to-authored).
 * States: S1 MapExplore idle after leaving the board (handOrbitBack/disarm), S2 she walks (ground tap → groundWalking),
 *         S3 FollowWalk (node walk) not yet engaged, S4 drag while the orbit is still easing back ('returning').
 * Lakeside / island her positions sit next to trees / the lighthouse so LensGuard is active. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const {createHarness}=require('../board-ui/harness.cjs');const H=createHarness();const ts=require('../qf-env.cjs').typescript();
Object.assign(H.cc.Input.EventType,{TOUCH_MOVE:'touch-move',TOUCH_END:'touch-end',TOUCH_CANCEL:'touch-cancel'});
const S=p=>path.join(H.SCRIPTS,p);
const FO=H.load(S('region/FreeOrbit.ts')),EI=H.load(S('world-r2/ExploreInput.ts')),Gate=H.load(S('region/ExploreGate.ts')),
 OC=H.load(S('region/LensOcclusion.ts')),LX=H.load(S('region/LakesideLensOccluders.ts')),IX=H.load(S('region/IslandLensOccluders.ts')),E=H.load(S('region/ExploreCameraCore.ts'));
const {IslandHomeInteraction}=H.load(S('world-r2/IslandHomeInteraction.ts'));
const src=fs.readFileSync(S('world-r2/RegionNodeStage.ts'),'utf8'),sf=ts.createSourceFile('s.ts',src,ts.ScriptTarget.ES2020,true);
const cls=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name&&n.name.text==='RegionNodeStage');
const want=['onGesture','aimOrbit','tickLens','writeOrbit','occlude','lakesideOccluders','handOrbitBack','viewDir','guardOrbitGround'];
const methods=want.map(n=>{const m=cls.members.find(x=>x.name&&x.name.getText(sf)===n);assert.ok(m,'RegionNodeStage.'+n);return m.getText(sf);});
const out=ts.transpileModule(`class Stage{${methods.join('\n')}};module.exports=Stage;`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}static transformMat4(o,v){o.x=v.x;o.y=v.y;o.z=v.z;return o;}}
const sb={module:{exports:{}},Vec3,LensGuard:OC.LensGuard,proxiesToWorld:OC.proxiesToWorld,LAKESIDE_LENS_OCCLUDERS:LX.LAKESIDE_LENS_OCCLUDERS,ISLAND_LENS_OCCLUDERS:IX.ISLAND_LENS_OCCLUDERS,
 followPose:E.followPose,followLookUp:E.followLookUp,geometry:{Ray:class{constructor(){this.o=new Vec3();this.d=new Vec3();}},intersect:{rayModel:()=>0}},MeshRenderer:class{},LENS_CLEAR_M:0.6,Date,Math};
vm.runInNewContext(out,sb);const Stage=sb.module.exports;
const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
const wrap=a=>((a+540)%360)-180;
// her stand points: island next to the lighthouse / palm; lakeside next to a ring tree (lakeside model = identity world here)
const tree=LX.LAKESIDE_LENS_OCCLUDERS.find(r=>r[4]-r[1]>2.5);
const HER={island:[-2.1,0,5.3],meadow:[0,0,0],skycity:[0,0,0],lakeside:[tree[3]+1.2,tree[1],(tree[2]+tree[5])/2]};
function rig(region,state){
 const st=new Stage();let written=null;const orbit=new FO.FreeOrbit(region);
 Object.assign(st,{region,orbit,exploring:true,anim:null,holdPose:null,lens:state==='S3'?'FollowWalk':'MapExplore',groundWalking:state==='S2',camera:{},dragHome:null,
  lensPull:new OC.LensGuard(),islandBoxes:null,occBoxes:null,occAt:0,occModel:null,orbitBoxes:[]});
 let her=HER[region].slice();st.girl=()=>her;st.yaw=()=>0;st.viewport=()=>({w:390,h:844});st.regionBounds=()=>undefined;st.refreshOrbitBoxes=()=>{};
 st.model=r=>r==='lakeside'?{worldMatrix:null}:null;st.readPose=()=>written||E.followPose(her,0,390,844,0);
 st.writePose=p=>{written=p;return p;};
 // seed: the board lens she left (S1/S2/S4) or the follow lens (S3)
 const seed=E.followPose(her,0,390,844,0);written=seed;
 if(state!=='S3'){orbit.seed(seed,her);orbit.armBoard();if(state==='S4'){orbit.drag(0.02,0);orbit.release();}st.handOrbitBack(region);}
 return {st,orbit,cam:()=>written,walk:(dx)=>{her=[her[0]+dx,her[1],her[2]];}};
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
const DT=1/30,rows=[];let fails=0;
for(const region of ['island','meadow','skycity','lakeside'])for(const state of ['S1','S2','S3','S4']){
 Gate.setExploreEnabled(true);const R=rig(region,state),I=inputFor(region,R.st);
 for(let k=0;k<20;k++){R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);}
 const y0=yawOf(R.cam());
 I.start(150,400);for(let k=1;k<=12;k++){I.move(150+k*10,400);R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);}I.end(270,400);
 const y1=yawOf(R.cam());for(let k=0;k<30;k++){R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);}const ySettled=yawOf(R.cam());
 for(let k=0;k<90;k++){R.st.tickLens(DT);if(state==='S2')R.walk(1.2*DT);}const y2=yawOf(R.cam());
 const turn=Math.abs(wrap(ySettled-y0)),expect=128*120/390/* ORBIT_FEEL.yawPerScreen=128 */,drift=Math.abs(wrap(y2-ySettled));
 const D1=turn>=expect*0.8,D2=drift<=4;if(!D1||!D2)fails++;
 rows.push({region,state,turnDeg:+turn.toFixed(1),expectDeg:+expect.toFixed(1),driftAfter3sDeg:+drift.toFixed(1),D1,D2,orbitMode:R.orbit.mode});
 Gate.setExploreEnabled(false);}
console.table(rows);
fs.mkdirSync(path.join(__dirname,'../journey-integration/reports'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../journey-integration/reports/explore-drag-rotate.json'),JSON.stringify({status:fails?'FAIL':'PASS',rows},null,1)+'\n');
if(fails){console.error('explore-drag-rotate: FAIL',fails);process.exit(1);}console.log('explore-drag-rotate: ok');
