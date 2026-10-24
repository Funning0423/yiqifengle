'use strict';
const assert=require('node:assert/strict');
const {load}=require('./load.cjs');
const C=load('region/FreeOrbit.ts');
const places=['home','island','meadow','skycity','lakeside','board'];
for(const id of places){
 const L=C.ORBIT_LIMITS[id];
 assert.ok(L.pitchMaxDeg>L.pitchMinDeg,id+' pitch');
 assert.ok(L.distMax>L.distMin&&L.distMin>0.5,id+' dist');
 assert.ok(L.yawHalfDeg>0,id+' yaw');
}
assert.equal(C.ORBIT_LIMITS.board.yawHalfDeg,4);
assert.ok(C.ORBIT_LIMITS.home.keepInside,'home stays inside the room volume');
assert.equal(C.ORBIT_LIMITS.island.yawHalfDeg,Infinity);

const feet=[0,0,0];
const meadow=new C.FreeOrbit('meadow');
meadow.drag(0.5,0);
const spun=meadow.yaw;
meadow.release();
meadow.step(0.1);
assert.ok(meadow.yaw>spun+1,'inertia coasts after the finger lifts');
const mid=meadow.yaw;
for(let i=0;i<4;i++)meadow.step(0.1);
assert.ok(Math.abs(meadow.yaw-mid)>0.5,'the coast is visible');
for(let i=0;i<20;i++)meadow.step(0.1);
const settled=meadow.yaw;
meadow.step(0.1);
assert.ok(Math.abs(meadow.yaw-settled)<0.15,'damping kills the spin');
meadow.drag(8,0);
assert.ok(meadow.yaw>360,'yaw is not clamped to a circle');
meadow.release();

const pitch=new C.FreeOrbit('meadow');
pitch.drag(0,-5);
assert.equal(pitch.pitch,C.ORBIT_LIMITS.meadow.pitchMaxDeg);
pitch.drag(0,5);
assert.equal(pitch.pitch,C.orbitPitchFloor(C.ORBIT_LIMITS.meadow,pitch.dist),'meadow: drag stops on the distance-based pitch floor');
assert.equal(pitch.drag(1,0),true);
pitch.pause();
const frozen=pitch.yaw;
assert.equal(pitch.drag(1,0),false);
assert.equal(pitch.yaw,frozen);
assert.equal(pitch.shouldWrite(),false);

const zoom=new C.FreeOrbit('meadow');
assert.equal(zoom.pinch(8),false,'a screen point is not a pinch');
zoom.pinch(0.5);
assert.equal(zoom.dist,C.ORBIT_LIMITS.meadow.distMax);
zoom.pinch(3);
assert.ok(zoom.dist<C.ORBIT_LIMITS.meadow.distMax-1);
zoom.pinch(0.25);
assert.ok(zoom.dist>=C.ORBIT_LIMITS.meadow.distMin-1e-6);
zoom.pause();
assert.equal(zoom.pinch(2),false);

const board=new C.FreeOrbit('island');
board.drag(0.2,0);
const lock=board.yaw;
board.armBoard();
board.drag(2,0);
assert.ok(Math.abs(board.yaw-lock)<=C.ORBIT_LIMITS.board.yawHalfDeg+1e-6,'board yaw is a few degrees');
assert.ok(board.pitch<=C.ORBIT_LIMITS.board.pitchMaxDeg+1e-6);
assert.ok(board.dist<=C.ORBIT_LIMITS.board.distMax+1e-6&&board.dist>=C.ORBIT_LIMITS.board.distMin-1e-6);
board.disarm('island');
assert.ok(Math.abs(board.yaw-lock)<1e-6,'leaving the board restores her view');

const girl=[0,0,0];
const wall=new C.FreeOrbit('island');
wall.seed({position:[0,2,6],target:[0,1.15,0],fovVerticalDeg:42},girl);
const raw=wall.rawPose(girl);
const box={min:[raw.position[0]-0.25,raw.position[1]-0.25,raw.position[2]-0.25],max:[raw.position[0]+0.25,raw.position[1]+0.25,raw.position[2]+0.25]};
const solved=wall.solve(girl,[box],0);
assert.ok(C.boxGap(solved.position,box)>=C.ORBIT_FEEL.clearM-1e-6,'lens backs out of a wall');
const near=[solved.position[0]+(solved.target[0]-solved.position[0])*0.04,solved.position[1]+(solved.target[1]-solved.position[1])*0.04,solved.position[2]+(solved.target[2]-solved.position[2])*0.04];
assert.ok(C.boxGap(near,box)>=C.ORBIT_FEEL.clearM-1e-3,'near point stays clear');
const shell={min:[-80,-80,-80],max:[80,80,80]};
const open=wall.solve(girl,[shell],-5);
assert.ok(Math.abs(open.position[0]-raw.position[0])<0.05,'a sky shell is not a wall');
const buried=wall.solve(girl,[],10);
assert.ok(buried.position[1]>=10+C.ORBIT_FEEL.groundClearM-1e-6,'terrain keeps the lens above the ground');

const home=new C.FreeOrbit('home');
const seat=[0.4327,0,-4.2076];
home.drag(3,-0.2);
home.release();
const room=home.solve(seat,[],0);
const keep=C.ORBIT_LIMITS.home.keepInside;
assert.ok(room.position[0]>=keep.min[0]-0.05&&room.position[0]<=keep.max[0]+0.05);
assert.ok(room.position[1]>=keep.min[1]-0.05&&room.position[1]<=keep.max[1]+0.05);
assert.ok(room.position[2]>=keep.min[2]-0.05&&room.position[2]<=keep.max[2]+0.05,'home orbit stays in the room');

const back=new C.FreeOrbit('skycity');
back.drag(0.4,0.1);
back.pause();
assert.equal(back.mode,'paused');
const goal=back.rawPose([1,2,3]);
back.beginReturn({position:[goal.position[0]+4,goal.position[1]+2,goal.position[2]-3],target:[1,3,3],fovVerticalDeg:40});
assert.equal(back.mode,'returning');
assert.equal(back.drag(1,0),false,'a cinematic return ignores the finger');
for(let i=0;i<8;i++)back.step(0.1);
assert.equal(back.mode,'free');
assert.equal(back.shouldWrite(),true);
const done=back.solve([1,2,3],[],2);
assert.ok(Math.hypot(done.position[0]-goal.position[0],done.position[1]-goal.position[1],done.position[2]-goal.position[2])<0.05);

const fresh=new C.FreeOrbit('lakeside');
fresh.pause();
fresh.unlock();
assert.equal(fresh.drag(0.1,0),true,'an unused pause does not eat the next drag');
assert.equal(C.orbitColliderName('env_sky_dome'),true);
assert.equal(C.orbitColliderName('env_lighthouse_ext'),false);

// Execute the production stage's final orbit write with a Cocos ray-model double. Sky stairs are
// merged into meshes wider than the AABB cap; the girl's ground height alone cannot protect the lens.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const stagePath=path.join(__dirname,'../../creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts');
const source=ts.createSourceFile(stagePath,fs.readFileSync(stagePath,'utf8'),ts.ScriptTarget.Latest,true);
const stageClass=source.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='RegionNodeStage');
const methods=['writeOrbit','guardOrbitGround','viewDir','clampArm','lookAt','armOf','armAlong','outOfProxies'].map(name=>stageClass.members.find(n=>n.name?.getText(source)===name).getText(source));
class Ray{constructor(){this.o={set(x,y,z){Object.assign(this,{x,y,z});}};this.d={set(x,y,z){Object.assign(this,{x,y,z});}};}}
let rayCalls=0;
const geometry={Ray,ERaycastMode:{CLOSEST:1},intersect:{rayModel(ray,model,options){
 rayCalls++;
 assert.equal(ray.d.y,-1,'terrain is sampled downwards, even when the lens is already underground');
 assert.ok(ray.o.y>model.worldBounds.center.y+model.worldBounds.halfExtents.y);
 assert.equal(options.doubleSided,true);
 const height=model.height(ray.o.x,ray.o.z);
 return height===null?0:ray.o.y-height;
}}};
const compiled=ts.transpileModule(`class Stage{${methods.join('\n')}};module.exports=Stage;`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const sandbox={module:{exports:{}},geometry,MeshRenderer:class{},LENS_CLEAR_M:0.6,ORBIT_LIMITS:C.ORBIT_LIMITS,LENS_GUARD:{armMinM:3.5,armHardM:1.6,armMaxM:12}};/* r17: writeOrbit arm clamp */
vm.runInNewContext(compiled,sandbox,{filename:stagePath});
const Stage=sandbox.module.exports;
const render=(name,height,enabled=true,active=true)=>({enabled,node:{name,activeInHierarchy:active},model:{worldBounds:{center:{x:0,y:5,z:0},halfExtents:{x:50,y:15,z:50}},height}});
const meshNames=['env_sky_static_palette','env_sky_static_rock_strata','env_sky_ruins','env_sky_floor_seal','state_bridge_after','state_court_after'];
const glb=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/bundles/region_skycity/env_skycity.glb'));
const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
for(const name of meshNames)assert.ok(gltf.nodes.some(n=>n.name===name&&n.mesh!==undefined),'real sky terrain mesh: '+name);
const stage=new Stage();stage.region='skycity';stage.armSmooth={reset(){},step:a=>a};stage.lakesideOccluders=()=>null;/* p0drag7: arm smoothing / proxies covered by explore-arm-smooth + skycity-east */
let renderers=[];
stage.model=()=>({getComponentsInChildren:()=>renderers});
stage.occlude=p=>p;/* b17r7: lakeside-only occlusion, covered by lakeside-lens-occlusion */stage.orbitBoxes=[];stage.refreshOrbitBoxes=()=>{};stage.regionBounds=()=>[-50,-50,50,50];stage.girl=()=>[0,0,0];
let written;
stage.writePose=p=>{written=p;};
const skyOrbit=new C.FreeOrbit('skycity');skyOrbit.pitch=-6;skyOrbit.dist=22;
stage.orbit=skyOrbit;
for(const name of meshNames){
 renderers=[render(name,()=>12)];
 stage.writeOrbit(0);
 assert.ok(written.position[1]>=12+0.8-1e-9,name+': lens above merged terrain, not the girl ground plane');
 assert.equal(written.target[1],1.25,'keep looking at the subject');
}
// The near point crosses onto a higher tread while the lens itself is still on the lower one.
stage.clampArm=p=>p;/* r17: synthetic poses below sit 0.75 m from her look; the arm floor/ceiling is covered by explore-arm */
const stepPose={position:[0,0.5,0],target:[0,0,10],fovVerticalDeg:48};
stage.orbit={step(){},solve(){return stepPose;}};
renderers=[render('env_sky_static_palette',(_x,z)=>z>0.1?5:1)];
stage.writeOrbit(0);
assert.ok(written.position[1]>=5.8-1e-9,'near clip clears the next stair tread');
// Return from a cinematic begins below a high terrace; no finite climb-loop may leave it buried.
skyOrbit.beginReturn({position:[0,-20,0],target:[0,1.25,0],fovVerticalDeg:48});stage.orbit=skyOrbit;
renderers=[render('env_sky_ruins',()=>19)];
for(let i=0;i<8;i++){stage.writeOrbit(0.1);assert.ok(written.position[1]>=19.8-1e-9,'return frames stay above terrain');}
// Clouds, foliage, hidden state variants, and missed mesh triangles never become ground.
stage.orbit={step(){},solve(){return stepPose;}};
renderers=[render('env_sky_cloudsea',()=>19),render('env_sky_greattree_canopy',()=>19),render('state_court_after_flowers',()=>19),render('env_sky_ruins',()=>19,false),render('state_bridge_before',()=>19,true,false),render('env_sky_static_palette',()=>null)];
stage.writeOrbit(0);assert.equal(written,stepPose);
renderers=[render('env_sky_static_palette',()=>1)];
const clearPose={position:[0,30,0],target:[0,1,10],fovVerticalDeg:48};
assert.equal(stage.guardOrbitGround(clearPose),clearPose,'already clear pose is unchanged');
assert.equal(stage.guardOrbitGround({...stepPose,position:[100,0.5,100]}).position[1],0.5,'outside mesh footprint is unchanged');
const calls=rayCalls;stage.region='meadow';stage.writeOrbit(0);
assert.equal(written,stepPose);assert.equal(rayCalls,calls,'other regions do not raycast');
stage.region='skycity';stage.model=()=>null;stage.writeOrbit(0);assert.equal(written,stepPose);
console.log('free-orbit PASS');
