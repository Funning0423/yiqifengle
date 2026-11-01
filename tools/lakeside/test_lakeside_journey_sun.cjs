// r4 journey fix 2 (GGbot): the journey's lakeside sun = the board's sun IN THE LAKE'S FRAME. The journey mounts the r5h3 scene turned by
// lakesideJourney().yawDeg (180°) while the board rig is not turned; the journey used the unturned sunForward, so its light was mirrored
// against the lake at the landing swap. Both now read lakesideSunForward (LakesideSunDirection.ts), the journey with its lake's yaw.
// Real LakesideJourneyLighting with a fake cc that records the slerp target view vector; the blend from the island light stays a slerp by w.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/');
class Color{constructor(r=0,g=0,b=0,a=255){if(typeof r==='string'){const h=r.replace('#','');this.r=parseInt(h.slice(0,2),16);this.g=parseInt(h.slice(2,4),16);this.b=parseInt(h.slice(4,6),16);this.a=255;}else Object.assign(this,{r,g,b,a});}clone(){return new Color(this.r,this.g,this.b,this.a);}}
class Vec3{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}}Vec3.UP=new Vec3(0,1,0);
const slerps=[];
class Quat{constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});this.view=null;}clone(){const q=new Quat(this.x,this.y,this.z,this.w);q.view=this.view;return q;}
 static fromViewUp(o,v){o.view=[v.x,v.y,v.z];return o;}static slerp(o,a,b,t){slerps.push({from:a.clone(),view:b.view,t});o.view=b.view;o.t=t;return o;}}
class DirectionalLight{}
const islandRot=Object.assign(new Quat(.3,.1,.2,.93),{view:['island']});
const light=Object.assign(new DirectionalLight(),{illuminance:60000,color:new Color(255,244,214),node:{rotation:islandRot.clone(),worldRotation:islandRot.clone(),setRotation(q){this.rotation=q.clone();this.worldRotation=q.clone();},setWorldRotation(q){this.worldRotation=q.clone();}}});
const globals={ambient:{skyLightingColor:new Color(200,220,255),groundLightingColor:new Color(120,110,90),skyIllum:20000},fog:{enabled:false,type:0,fogColor:new Color(200,200,200),fogStart:0,fogEnd:300,fogTop:4,fogRange:10,fogAtten:5}};
const scene={globals,getChildByName:n=>n==='Main Light'?{getComponent:()=>light}:null,getComponentInChildren:()=>light};
const cc={Color,Vec3,Quat,DirectionalLight,Camera:class{},director:{getScene:()=>scene},isValid:o=>!!o};
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:1,target:7}}).outputText;
 const req=spec=>spec==='cc'?cc:spec==='cc/env'?{DEBUG:false}:load(path.resolve(path.dirname(file),spec)+'.ts');
 vm.runInThisContext('(function(exports,require,module){'+out+'\n})')(m.exports,req,m);return m.exports;}
const D=load(S+'region/LakesideSceneData.ts'),SD=load(S+'region/LakesideSunDirection.ts'),Lt=load(S+'region/LakesideJourneyLighting.ts'),LK=load(S+'region/LakesideCameraLayout.ts');
globalThis.__worldDayNight={snapshot:()=>({mode:'day'})};
const rotY=(deg,p)=>{const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const close=(a,b,eps=1e-9,m='')=>{for(let i=0;i<3;i++)assert(Math.abs(a[i]-b[i])<=eps,m+' ['+a+'] vs ['+b+']');};
const run=(n,f)=>{f();console.log('PASS',n);};
const L=LK.lakesideJourney([0,0,0]),P=D.LAKESIDE_DIR_LIGHT_PARAMS;
run('one source: board = lakesideSunForward(0) = authored sunForward; journey lake yaw is 180°',()=>{
 close(SD.lakesideSunForward(SD.LAKESIDE_BOARD_YAW_DEG),[...P.sunForward],0,'board');assert.equal(L.yawDeg,180);
 close(SD.lakesideSunForward(180),[-P.sunForward[0],P.sunForward[1],-P.sunForward[2]],1e-12,'180° turn');});
for(const yaw of [L.yawDeg,90,0])run('journey sun at w=1 equals the board sun in the lake frame (yaw '+yaw+')',()=>{
 slerps.length=0;light.node.setRotation(islandRot);const a=Lt.lakesideJourneyAtmosphere({clearColor:new Color(51,51,51)},()=>0,()=>yaw);a.prime();a.apply(1);
 const s=slerps[slerps.length-1];assert.equal(s.t,1);const world=s.view.map(v=>-v)/* fromViewUp(-forward): light forward = -view */;
 close(rotY(-yaw,world),nrm(SD.lakesideSunForward(SD.LAKESIDE_BOARD_YAW_DEG)),1e-9,'lake-local journey sun vs board');
 if(yaw===180){const old=[...P.sunForward];assert(Math.hypot(...rotY(-yaw,old).map((v,i)=>v-P.sunForward[i]))>1,'old unturned direction was mirrored in the lake frame');}
 a.restore();assert.deepEqual(light.node.rotation.view,['island'],'restore puts the island light back');});
run('blend from the island light stays smooth: slerp(captured island rotation → lakeside target, w) every frame, w monotone',()=>{
 slerps.length=0;light.node.setRotation(islandRot);const a=Lt.lakesideJourneyAtmosphere({clearColor:new Color(51,51,51)},()=>0,()=>L.yawDeg);a.prime();
 const ws=[];for(let k=0;k<=60;k++){const w=k/60;ws.push(w);a.apply(w);}
 const used=slerps.slice(-61);assert.deepEqual(used.map(s=>s.t),ws);for(const s of used){assert.deepEqual(s.from.view,['island'],'always from the captured island rotation (no jump)');close(s.view,used[0].view,0,'one fixed target');}a.restore();});
run('wiring: board and journey read lakesideSunForward; adapter passes the lake yaw; nobody reads sunForward raw for the light',()=>{
 const rd=f=>fs.readFileSync(S+f,'utf8'),bg=rd('region/LakesideBoardBackground.ts'),lt=rd('region/LakesideJourneyLighting.ts'),ad=rd('region/RegionJourneyAdapter.ts');
 assert.match(bg,/f=lakesideSunForward\(LAKESIDE_BOARD_YAW_DEG\)/);assert.match(bg,/l\.node\.lookAt\(new Vec3\(w\.x\+f\[0\],w\.y\+f\[1\],w\.z\+f\[2\]\)\)/);
 assert.match(lt,/const v=lakesideSunForward\(lakeYaw\(\)\);Quat\.fromViewUp\(target,new Vec3\(-v\[0\],-v\[1\],-v\[2\]\)\.normalize\(\),Vec3\.UP\)/);assert.doesNotMatch(lt,/sunForward;/);
 assert.match(ad,/lakesideJourneyAtmosphere\(camera,\(\)=>waterY,\(\)=>lakeYaw\)/);assert.match(ad,/model\.setRotationFromEuler\(0,L\.yawDeg,0\)/);assert.match(ad,/lakeYaw=L\.yawDeg/);});
console.log('lakeside journey sun OK');
