'use strict';
/* P0 r16 (运镜bot) — GGbot r15 web check (e3b881d8) lakeside FAIL points, reproduced on GEOMETRY (real GLB triangles incl. reed
 * cards, chime cells, buoy lanterns; NOT a render) with the real TS lens code (RegionNodeStage methods transpiled from source,
 * LensGuard, FreeOrbit). BEFORE = ebd316a7 behaviour (explore opens on the exit lens and nothing writes it until she walks; LensGuard
 * without reed proxies / deck raise / linear clutter). AFTER = HEAD.
 *  E1 ① entry: spots ≤ 3.5 m from ring / mid trees + the MAC start, entry lens = low exit lenses round her (8 yaws, 8°, 6.5 m) that
 *     are blocked or cluttered at t0. Standing: AFTER from the end of the entry glide (BEFORE from 0.8 s) for 2.5 s 0 frames with her head/chest hidden and
 *     0 near-lens fill (≥ 4/9 rays within 2.5 m); BEFORE fails.
 *  E2 ② boardwalk: walks along the b16 boardwalk both ways, orbit lens at 8° / 15° (after a pitch-down drag), 4 yaws + follow:
 *     hidden ≤ 1 %, fill ≤ 0.5 % of frames; the nearest real triangle in the view cone within 3 m reported.
 *  E3 ③ arch bridge: stair foot → stair foot both ways, side-on orbit lenses (bridge runs along x: yaw 0 / 180) at 8° / 15°:
 *     on the bridge the lens elevation over her chest ≥ deckElevDeg − 3° after 1.5 s on it, hidden ≤ 1 % of bridge frames.
 *  E4 ④ island palm: her beside a palm, orbit pitch 5° (pitch-down drag held, holdYaw on), yaws putting the palm between:
 *     after 1 s 0 frames with her hidden by a palm. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const J=require('./journey-scene.cjs'),LKS=require('./lakeside/lakeside-scene.cjs'),ts=require('../qf-env.cjs').typescript();
const H=J.H,S=J.S;const W=H.load(S+'region/RegionWalkable.ts'),FO=H.load(S+'region/FreeOrbit.ts'),E=H.load(S+'region/ExploreCameraCore.ts');
const ROOT=path.resolve(__dirname,'../..');
const AS=(()=>{try{return require('../board-ui/harness.cjs').createHarness().load(path.join(ROOT,'creator-build-project/assets/scripts/region/ArmSmoother.ts'));}catch{return null;}})();/* p0drag7 */
function loadAt(rev,rel){const src=cp.execFileSync('git',['show',rev+':creator-build-project/assets/scripts/'+rel],{cwd:ROOT,encoding:'utf8'});const d=fs.mkdtempSync('/tmp/qf-r16-');const f=path.join(d,path.basename(rel));fs.writeFileSync(f,src);return H.load(f);}
const NOW={OC:H.load(S+'region/LensOcclusion.ts'),LX:H.load(S+'region/LakesideLensOccluders.ts'),IX:H.load(S+'region/IslandLensOccluders.ts')};
const BASE='ebd316a7',OLD={OC:loadAt(BASE,'region/LensOcclusion.ts'),LX:loadAt(BASE,'region/LakesideLensOccluders.ts'),IX:NOW.IX};
// stage methods at a revision
function stageAt(rev){const src=rev?cp.execFileSync('git',['show',rev+':creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts'],{cwd:ROOT,encoding:'utf8'}):fs.readFileSync(S+'world-r2/RegionNodeStage.ts','utf8');
 const sf=ts.createSourceFile('s.ts',src,ts.ScriptTarget.ES2020,true),cls=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name&&n.name.text==='RegionNodeStage');
 const ms=cls.members.filter(m=>m.name&&['tickLens','writeOrbit','occlude','clampArm','lakesideOccluders','handOrbitBack','guardOrbitGround','deckElev','preSolveEntry','openExplore','viewDir','lookAt','armOf','armAlong','outOfProxies'].includes(m.name.getText(sf))).map(m=>m.getText(sf));
 const out=ts.transpileModule(`class Stage{${ms.join('\n')}};module.exports=Stage;`,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
 const M=rev?OLD:NOW;class Vec3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}static transformMat4(o,v){o.x=v.x;o.y=v.y;o.z=v.z;return o;}}
 const sb={module:{exports:{}},Vec3,SKYCITY_LENS_OCCLUDERS:[],ArmSmoother:AS?AS.ArmSmoother:class{clear(){}reset(){}step(a){return a;}},LensGuard:M.OC.LensGuard,LENS_GUARD:M.OC.LENS_GUARD,guardEval:M.OC.guardEval,proxiesToWorld:M.OC.proxiesToWorld,LAKESIDE_LENS_OCCLUDERS:M.LX.LAKESIDE_LENS_OCCLUDERS,LAKESIDE_DECK_ZONES:M.LX.LAKESIDE_DECK_ZONES||[],
  ISLAND_LENS_OCCLUDERS:M.IX.ISLAND_LENS_OCCLUDERS,ORBIT_LIMITS:FO.ORBIT_LIMITS,followPose:E.followPose,followLookUp:E.followLookUp,setExploreEnabled:()=>{},emitTransitCue:()=>{},
  geometry:{Ray:class{constructor(){this.o=new Vec3();this.d=new Vec3();}}},MeshRenderer:class{},Date,Math};
 vm.runInNewContext(out,sb);return sb.module.exports;}
const StageNow=stageAt(null),StageOld=stageAt(BASE);
function rig(Stage,region,herP,cam){const st=new Stage();let written=cam,her=herP.slice();
 Object.assign(st,{region,orbit:new FO.FreeOrbit(region),exploring:false,anim:null,holdPose:null,lens:'Board',groundWalking:false,camera:{},dragHome:null,lensPull:new (Stage===StageNow?NOW:OLD).OC.LensGuard(),armSmooth:AS?new AS.ArmSmoother():{clear(){},reset(){},step:a=>a},
  entry:null,deckZones:null,islandBoxes:null,occBoxes:null,occAt:0,occModel:null,orbitBoxes:[],zoom:1,focus:her,rebuildMarkers:()=>{},
  girl:()=>her,yaw:()=>0,viewport:()=>({w:390,h:844}),regionBounds:()=>undefined,refreshOrbitBoxes:()=>{},model:r=>r==='lakeside'?{worldMatrix:null}:null,
  readPose:()=>written,writePose:p=>{written=p;return p;}});
 return {st,cam:()=>written,set:p=>{her=p.slice();}};}
// real triangles
const key=n=>n.replace(/\.\d+$/,'');const OCCK=/^LK_((ring_)?(tree_|band_tree)|shore_bush|seal_bush|ring_bush|bush_i|house_|pavilion|chime_post|chime_cell|bridge_i$|bridge_steps|boardwalk_b16|shore_rock|ring_rock|rock_i|lantern_boat|clothesline|porch_steps|barrel|windchime|reed_card|west_reed|buoy_lantern)/;
const inst=LKS.instances();
function grid(objs,c=2){const T=[];for(const o of objs)for(let k=0;k<o.tris.length;k+=9)T.push({o:o.name,t:o.tris.subarray(k,k+9)});const g=new Map();
 for(let i=0;i<T.length;i++){const t=T[i].t;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let k=0;k<9;k+=3){x0=Math.min(x0,t[k]);x1=Math.max(x1,t[k]);z0=Math.min(z0,t[k+2]);z1=Math.max(z1,t[k+2]);}
  for(let gx=Math.floor(x0/c);gx<=Math.floor(x1/c);gx++)for(let gz=Math.floor(z0/c);gz<=Math.floor(z1/c);gz++){const k=gx+','+gz;if(!g.has(k))g.set(k,[]);g.get(k).push(i);}}return {g,c,T};}
function mt(o,d,t){const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)return -1;const inv=1/det,s=[o[0]-t[0],o[1]-t[1],o[2]-t[2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*inv;if(u<0||u>1)return -1;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)return -1;return (e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;}
function segHit(G,a,b){const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(...d);if(L<1e-6)return null;const u=d.map(x=>x/L),seen=new Set(),n=Math.ceil(L/(G.c/2))+1;
 for(let s=0;s<=n;s++){const x=a[0]+d[0]*s/n,z=a[2]+d[2]*s/n;for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){const l=G.g.get((Math.floor(x/G.c)+ox)+','+(Math.floor(z/G.c)+oz));if(!l)continue;for(const i of l){if(seen.has(i))continue;seen.add(i);const t=mt(a,u,G.T[i].t);if(t>1e-4&&t<L-1e-4)return G.T[i].o;}}}return null;}
const nrm=v=>{const l=Math.hypot(...v)||1e-9;return v.map(x=>x/l);},crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function disc(G,eye,p,r){const u=nrm(p.map((x,i)=>x-eye[i])),a=Math.abs(u[1])<.9?[0,1,0]:[1,0,0],e1=nrm(crs(u,a)),e2=crs(u,e1);let n=0,by=null;const c=segHit(G,eye,p);if(c){n++;by=c;}
 for(let k=0;k<8;k++){const th=k*Math.PI/4,q=[0,1,2].map(i=>p[i]+e1[i]*r*Math.cos(th)+e2[i]*r*Math.sin(th)),b=segHit(G,eye,q);if(b){n++;by=by||b;}if(n+(7-k)<5)return null;}return n>=5?by:null;}
function hidden(G,pose,f){return disc(G,pose.position,[f[0],f[1]+1.5,f[2]],.09)||disc(G,pose.position,[f[0],f[1]+1.1,f[2]],.12);}
function fill(G,pose,reach=2.5){const f=nrm(pose.target.map((x,k)=>x-pose.position[k])),r=nrm(crs(f,[0,1,0])),u=crs(r,f),tv=Math.tan(((pose.fovVerticalDeg||45)*Math.PI/180)/2)*0.6,th=tv*0.6;let n=0,by=null;
 for(const sx of [-1,0,1])for(const sy of [-1,0,1]){const d=nrm([0,1,2].map(i=>f[i]+r[i]*sx*th+u[i]*sy*tv)),h=segHit(G,pose.position,pose.position.map((x,i)=>x+d[i]*reach));if(h){n++;by=by||h;}}return {n,by};}
const elevOf=(pose,f)=>{const v=[0,1,2].map(i=>pose.position[i]-f[i]);return Math.atan2(v[1]-1.1,Math.hypot(v[0],v[2]))*180/Math.PI;};
const G=grid(inst.filter(i=>OCCK.test(key(i.name)))),GT=grid(inst.filter(i=>/^LK_terrain/.test(i.name)));
function surfaceY(f){const o=[f[0],f[1]+1.4,f[2]];let best=f[1];for(const GR of [G,GT]){const l=GR.g.get(Math.floor(f[0]/GR.c)+','+Math.floor(f[2]/GR.c));if(!l)continue;for(const i of l){if(!/terrain|boardwalk|bridge/.test(GR.T[i].o))continue;const t=mt(o,[0,-1,0],GR.T[i].t);if(t>0&&t<1.4+1e-6){const y=o[1]-t;if(y>best)best=y;}}}return best;}
const g=W.walkGrid('lakeside'),cells=[];for(let i=0;i<g.h.length;i++)if(!Number.isNaN(g.h[i]))cells.push(i);
const cellAt=i=>[g.x0+(i%g.W+.5)*g.c,g.h[i],g.z0+(((i/g.W)|0)+.5)*g.c];
const orbitRaw=(f,yaw,pitch,dist)=>{const o=new FO.FreeOrbit('lakeside');o.yaw=yaw;o.pitch=pitch;o.dist=dist;o.seeded=true;return o.rawPose(f);};
const lowRaw=(f,yaw,pitch,dist)=>{const look=[f[0],f[1]+1.15,f[2]],p=pitch*Math.PI/180,y=yaw*Math.PI/180;return {position:[look[0]-Math.sin(y)*Math.cos(p)*dist,look[1]+Math.sin(p)*dist,look[2]-Math.cos(y)*Math.cos(p)*dist],target:look,fovVerticalDeg:48};};
const DT=1/30,res={};let fails=0;const T0=Date.now();const SNAP={};/* QF_R16_RENDER=<dir>: before/after stills (software ray-cast, NOT engine) */
// E1 entry
{const trees=inst.filter(i=>/^LK_(ring_tree|tree_mid)/.test(i.name)).map(i=>[(i.box[0][0]+i.box[1][0])/2,(i.box[0][2]+i.box[1][2])/2,Math.max(i.box[1][0]-i.box[0][0],i.box[1][2]-i.box[0][2])/2]);
 // beside a tree (≤ 3.5 m from its centre) but not with her head up inside its crown (outside the crown radius + 0.3 m)
 const spots=[];for(const i of cells){const c=cellAt(i),d=t=>Math.hypot(c[0]-t[0],c[2]-t[1]);if(trees.some(t=>d(t)<3.5)&&trees.every(t=>d(t)>t[2]+0.3))spots.push(c);}
 const pick=[];for(let k=0;k<spots.length&&pick.length<14;k+=Math.max(1,Math.floor(spots.length/14)))pick.push(spots[k]);
 const out={before:{cases:0,hidAfter:0,fillAfter:0,firstHid:0},after:{cases:0,hidAfter:0,fillAfter:0,firstHid:0,maxGlideS:0,maxMS:0}};
 for(const sp of pick){const f=[sp[0],surfaceY(sp),sp[2]];
  for(let yaw=0;yaw<360;yaw+=45){const cam=lowRaw(f,yaw,8,6.5);if(!hidden(G,cam,f)&&fill(G,cam).n<4)continue;// only the blocked / cluttered exit lenses (the r15 symptom)
   for(const [mode,Stage] of [['before',StageOld],['after',StageNow]]){const R=rig(Stage,'lakeside',f,cam);R.st.openExplore('lakeside',true);const O=out[mode];O.cases++;let prev=null;
    const Tg=mode==='after'&&R.st.entry?R.st.entry.T:0.8;if(mode==='after')O.maxGlideS=Math.max(O.maxGlideS,+Tg.toFixed(2));
    for(let k=0;k<Math.round((Tg+2.5)/DT);k++){R.st.tickLens(DT);const p=R.cam(),t=k*DT;if(prev&&mode==='after')O.maxMS=Math.max(O.maxMS,+(Math.hypot(...[0,1,2].map(i=>p.position[i]-prev.position[i]))/DT).toFixed(2));prev=p;
     if(!SNAP['entry_'+mode]&&((mode==='before'&&k===30)||(mode==='after'&&Math.abs(t-Tg-0.5)<DT/2)))SNAP['entry_'+mode]={pose:p,f};
     if(t>=Tg){if(hidden(G,p,f))O.hidAfter++;if(fill(G,p).n>=4)O.fillAfter++;}else if(hidden(G,p,f))O.hidGlide=(O.hidGlide||0)+1;if(k===24&&hidden(G,p,f))O.firstHid++;}}}}
 out.pass=out.after.cases>0&&out.after.hidAfter===0&&out.after.fillAfter===0&&out.after.maxMS<=9&&(out.before.hidAfter+out.before.fillAfter)>0;res.E1_entry=out;if(!out.pass)fails++;}
// deck walks
const plen=p=>{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][2]-p[i-1][2]);return s;};
function resample(p,step){const out=[p[0]];let acc=0;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],L=Math.hypot(b[0]-a[0],b[2]-a[2]);let t=step-acc;while(t<=L){const u=t/L;out.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]);t+=step;}acc=(acc+L)%step;}return out;}
const cellNear=q=>{let b=null,bd=1e9;for(const i of cells){const c=cellAt(i),d=Math.hypot(c[0]-q[0],c[2]-q[2]);if(d<bd){bd=d;b=c;}}return b;};
const ctr=i=>[(i.box[0][0]+i.box[1][0])/2,i.box[1][1],(i.box[0][2]+i.box[1][2])/2];
const bw=inst.filter(i=>/^LK_boardwalk_b16/.test(i.name)).sort((a,b)=>a.name<b.name?-1:1),st=inst.filter(i=>/^LK_bridge_steps/.test(i.name));
const onBridge=f=>Math.abs(f[0])<=7.4&&Math.abs(f[2])<=1.7;
function walkCase(id,a,b,lenses,metric){const out={};for(const [mode,M] of [['before',OLD],['after',NOW]]){const O=out[mode]={frames:0,hidden:0,fill:0,bridgeFrames:0,bridgeLowElev:0,minBridgeElev:99,hiddenBy:{},fillBy:{}};
  const zones=(M.LX.LAKESIDE_DECK_ZONES||[]).map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]})),boxes=M.LX.LAKESIDE_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));
  const deckElev=f=>{for(const z of zones)if(f[0]>=z.min[0]-.4&&f[0]<=z.max[0]+.4&&f[2]>=z.min[2]-.4&&f[2]<=z.max[2]+.4&&f[1]>=z.min[1]-.5&&f[1]<=z.max[1]+.5)return M.OC.LENS_GUARD.deckElevDeg||0;return 0;};
  for(const [x,y] of [[a,b],[b,a]]){const p=W.walkPath('lakeside',cellNear(x),cellNear(y));if(!p)continue;const P=resample(p,1.4*DT).map(q=>{const fl=W.walkFloorY('lakeside',q[0],q[2]);return [q[0],surfaceY([q[0],fl===null?q[1]:fl,q[2]]),q[2]];});
   for(const L of lenses){const guard=new M.OC.LensGuard();let onB=0;
    for(let i=0;i<P.length;i++){const f=P[i],n=P[Math.min(P.length-1,i+3)],q=P[Math.max(0,i-3)],h=Math.atan2(n[0]-q[0],n[2]-q[2]),raw=L(f,h);
     const pose=guard.apply(raw,f,boxes,i?DT:0,undefined,undefined,true,deckElev(f));O.frames++;const hb=hidden(G,pose,f);if(hb){O.hidden++;O.hiddenBy[key(hb)]=(O.hiddenBy[key(hb)]||0)+1;}const fl=fill(G,pose);if(fl.n>=4){O.fill++;O.fillBy[key(fl.by)]=(O.fillBy[key(fl.by)]||0)+1;}
     if(id==='E2_boardwalk'&&L===lenses[0]&&i===(P.length>>1)&&!SNAP['post_'+mode])SNAP['post_'+mode]={pose,f};
     if(onBridge(f)&&f[1]>0.9){onB++;if(id==='E3_bridge'&&L===lenses[0]&&onB===60&&!SNAP['bridge_'+mode])SNAP['bridge_'+mode]={pose,f};O.bridgeFrames++;if(onB>45){const e=elevOf(pose,f);O.minBridgeElev=Math.min(O.minBridgeElev,+e.toFixed(1));if(e<25)O.bridgeLowElev++;}}else onB=0;}}}}
 out.pass=metric(out.after);res[id]=out;if(!out.pass)fails++;}
const low=[];for(const pi of [8,15])for(const yaw of [0,90,180,270])low.push((f)=>orbitRaw(f,yaw,pi,7));low.push((f,h)=>E.followPose(f,h,390,844,0));
walkCase('E2_boardwalk',ctr(bw[0]),ctr(bw[bw.length-1]),low,O=>O.hidden<=0.01*O.frames&&O.fill<=0.005*O.frames);
const side=[];for(const pi of [8,15])for(const yaw of [0,180])side.push((f)=>orbitRaw(f,yaw,pi,7));
walkCase('E3_bridge',ctr(st[0]),ctr(st[1]),side,O=>O.bridgeFrames>0&&O.bridgeLowElev===0&&O.hidden<=0.01*O.frames);
// E4 island palm after a pitch-down drag
{const IG=grid(J.island.filter(o=>/palm/.test(o.name)||/env_island_props_merged|env_lighthouse/.test(o.name)));const palms=J.props.filter(p=>/palm/.test(p.prefab)).map(p=>p.position);
 const out={before:{cases:0,hidAfter:0},after:{cases:0,hidAfter:0}};
 for(const pm of palms.slice(0,8)){for(const off of [[1.6,0],[-1.6,0],[0,1.6],[0,-1.6]]){const f=[pm[0]+off[0],pm[1]||0,pm[2]+off[1]];const yaw=Math.atan2(-off[0],-off[1])*180/Math.PI;// lens behind the palm
   const raw=orbitRaw(f,yaw,5,7),h0=hidden(IG,raw,f);if(!h0||!/palm/.test(h0))continue;
   for(const [mode,M] of [['before',OLD],['after',NOW]]){const guard=new M.OC.LensGuard(),boxes=M.IX.ISLAND_LENS_OCCLUDERS.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));out[mode].cases++;
    for(let k=0;k<60;k++){const p=guard.apply(raw,f,boxes,k?DT:0,undefined,undefined,true,0);const hb=k>=30&&hidden(IG,p,f);if(hb&&/palm/.test(hb))out[mode].hidAfter++;}}}}
 out.pass=out.after.cases>0&&out.after.hidAfter===0;res.E4_island_palm=out;if(!out.pass)fails++;}
if(process.env.QF_R16_RENDER){const OUT=process.env.QF_R16_RENDER;fs.mkdirSync(OUT,{recursive:true});
 const GA=grid(inst.filter(i=>!/^LK_(cloud|far_hills|wb_line|lilypad|scatter|grass_tuft|rope|shore_foam|flower|duck|dragonfly|lotus|float)/.test(i.name)));
 const near=(o,d,maxT=60)=>{let best=maxT,bn=null;const seen=new Set(),n=Math.ceil(maxT/(GA.c/2));for(let q=0;q<=n;q++){const t0=q*GA.c/2;if(t0>best+GA.c)break;const x=o[0]+d[0]*t0,z=o[2]+d[2]*t0;for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){const l=GA.g.get((Math.floor(x/GA.c)+ox)+','+(Math.floor(z/GA.c)+oz));if(!l)continue;for(const i of l){if(seen.has(i))continue;seen.add(i);const t=mt(o,d,GA.T[i].t);if(t>1e-3&&t<best){best=t;bn=GA.T[i].o;}}}}return bn?[best,bn]:null;};
 const col=n=>/reed/.test(n)?[205,180,120]:/tree|bush/.test(n)?[60,140,60]:/boardwalk|bridge|porch|steps/.test(n)?[170,120,70]:/house|pavilion/.test(n)?[200,190,175]:/terrain/.test(n)?[150,190,100]:/lake/.test(n)?[70,140,190]:/rock/.test(n)?[130,130,130]:/post|chime|cloth|buoy|lantern/.test(n)?[120,90,60]:[180,180,160];
 const Wd=120,Ht=260;const frame=(pose,f)=>{const img=Buffer.alloc(Wd*Ht*3),fw=nrm(pose.target.map((x,k)=>x-pose.position[k])),r=nrm(crs(fw,[0,1,0])),u=crs(r,fw),tv=Math.tan(((pose.fovVerticalDeg||48)*Math.PI/180)/2),th=tv*Wd/Ht;
  for(let y=0;y<Ht;y++)for(let x=0;x<Wd;x++){const sx=(x+.5)/Wd*2-1,sy=1-(y+.5)/Ht*2,d=nrm([0,1,2].map(i=>fw[i]+r[i]*sx*th+u[i]*sy*tv));let herT=1e9;
   {const oc=[pose.position[0]-f[0],0,pose.position[2]-f[2]],a=d[0]*d[0]+d[2]*d[2],b=2*(oc[0]*d[0]+oc[2]*d[2]),c=oc[0]*oc[0]+oc[2]*oc[2]-0.0625,D=b*b-4*a*c;if(D>0){const t=(-b-Math.sqrt(D))/(2*a),yy=pose.position[1]+d[1]*t;if(t>0&&yy>=f[1]&&yy<=f[1]+1.6)herT=t;}}
   const h=near(pose.position,d);let c;if(herT<1e9&&(!h||herT<h[0]))c=[245,215,40];else if(h){c=col(h[1]);const fog=Math.min(1,h[0]/80);c=c.map(v=>v*(1-fog*0.4)+200*fog*0.4);}else c=d[1]>0?[150,200,240]:[70,140,190];
   const o=(y*Wd+x)*3;img[o]=c[0];img[o+1]=c[1];img[o+2]=c[2];}return img;};
 for(const sc of ['entry','post','bridge']){const b=SNAP[sc+'_before'],a=SNAP[sc+'_after'];if(!b||!a)continue;const ib=frame(b.pose,b.f),ia=frame(a.pose,a.f),out=Buffer.alloc(Wd*2*Ht*3);
  for(let y=0;y<Ht;y++){ib.copy(out,(y*Wd*2)*3,y*Wd*3,(y+1)*Wd*3);ia.copy(out,(y*Wd*2+Wd)*3,y*Wd*3,(y+1)*Wd*3);}
  fs.writeFileSync(path.join(OUT,sc+'.ppm'),Buffer.concat([Buffer.from(`P6 ${Wd*2} ${Ht} 255\n`),out]));}
 res.renders=Object.keys(SNAP);}
res.elapsedS=+((Date.now()-T0)/1000).toFixed(1);res.status=fails?'FAIL':'PASS';
fs.mkdirSync(path.join(__dirname,'reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'reports/lakeside-entry-deck.json'),JSON.stringify(res,null,1)+'\n');
console.log(JSON.stringify(res,null,1));if(fails){console.error('lakeside-entry-deck: FAIL',fails);process.exit(1);}console.log('lakeside-entry-deck: ok');
