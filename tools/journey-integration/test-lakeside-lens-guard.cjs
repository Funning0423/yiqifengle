#!/usr/bin/env node
'use strict';
/* b17r13 lakeside + reward lens guard (运镜bot). Report: reports/lakeside-lens-guard.json. GEOMETRY + real TS lens code, NOT a render.
 * Real occluder triangles (lakeside GLB instances incl. ring trees, bushes, b16 boardwalk deck + railings, bridge + steps; island
 * props merge, palms, lighthouse). BEFORE = the r13b lens (LensPullIn on the b17r7 proxies, 5ae6e43b). AFTER = LensGuard on the
 * b17r13 proxies. Her feet at 1.4 m/s, 30 fps, snapped to the deck where she walks on it.
 * Routes: MAC = the r13b Mac walk (explore start → tap at the bridge head, lakeside-local (5.82,0.9,1.99), 57.6 m / 8-point path),
 *  CANOPY = walks passing ≤ 2.5 m from ring / mid trees, DECK = walks over the boardwalk and the bridge, + seeded random walks.
 * Lenses: FollowWalk followPose on all 7 portrait screens + MapExplore orbit raw poses (behind / sides, pitch 2/15°, 9 m).
 *  G1 (hard) her head or chest hidden (disc rule, ≥5/9 rays) — follow ≤ 0.2 % of frames, orbit ≤ 0.3 %.
 *  G2 (hard) near-lens fill (canopy / trunk / post / railing in front of the lens): ≥ 4 of a 3×3 view ray fan hit a real
 *     triangle within 2.5 m — follow and orbit ≤ 0.1 %.
 *  Orbit poses: world yaw 0/90/180/270 × (15°, 9 m) and (35°, 14 m: the high MapExplore lens of the Mac run), + (−8°, 6 m) low lens.
 *  G3 (hard) lens under the deck / floor: lens y < her feet + 0.9 m, or a real deck/bridge triangle straight above the lens within
 *     4 m while she is on the deck — 0 frames.
 *  G4 (hard) smoothness: the lens's EXTRA motion over the designed (raw) lens: speed ≤ 4.0 m/s, acceleration ≤ 12 m/s² (per frame).
 *  G5 (hard) reward close-up (island I1→I2, mainline-01→02, the held lens, every screen): near-lens fill 0 at the held pose and
 *     her head/chest hidden ≤ 5 % of her walk frames.
 * Gate = AFTER; BEFORE must fail at least one of G1–G5 (failing-before). */
const fs=require('node:fs'),J=require('./journey-scene.cjs'),LKS=require('./lakeside/lakeside-scene.cjs');
const W=J.H.load(J.S+'region/RegionWalkable.ts'),E=J.H.load(J.S+'region/ExploreCameraCore.ts'),FO=J.H.load(J.S+'region/FreeOrbit.ts'),
 OC=J.H.load(J.S+'region/LensOcclusion.ts'),PX=J.H.load(J.S+'region/LakesideLensOccluders.ts'),IX=J.H.load(J.S+'region/IslandLensOccluders.ts'),
 NP=J.H.load(J.S+'region/RegionNodeProgress.ts'),NW=J.H.load(J.S+'region/NodeWalker.ts');
const TREE=/^LK_(ring_)?(tree_|band_tree)|^LK_(shore_bush|seal_bush|ring_bush|bush_i)/,SOLID=/^LK_(house_|pavilion|chime_post|bridge_i$|bridge_steps|boardwalk_b16|shore_rock|ring_rock|rock_i|lantern_boat|clothesline|porch_steps|barrel|windchime)/,DECK=/^LK_(boardwalk_b16|bridge_i|bridge_steps)/;
const inst=LKS.instances(),key=n=>n.replace(/\.\d+$/,'');
function bvh(objs){const T=[];for(const o of objs)for(let k=0;k<o.tris.length;k+=9)T.push({o:o.name,t:o.tris.subarray(k,k+9)});return T;}
function grid(T,c=2){const g=new Map();for(let i=0;i<T.length;i++){const t=T[i].t;let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(let k=0;k<9;k+=3){x0=Math.min(x0,t[k]);x1=Math.max(x1,t[k]);z0=Math.min(z0,t[k+2]);z1=Math.max(z1,t[k+2]);}
 for(let gx=Math.floor(x0/c);gx<=Math.floor(x1/c);gx++)for(let gz=Math.floor(z0/c);gz<=Math.floor(z1/c);gz++){const k=gx+','+gz;if(!g.has(k))g.set(k,[]);g.get(k).push(i);}}return {g,c,T};}
const occ=bvh(inst.filter(i=>TREE.test(key(i.name))||SOLID.test(key(i.name)))),terr=bvh(inst.filter(i=>/^LK_terrain/.test(i.name))),deck=bvh(inst.filter(i=>DECK.test(key(i.name))));
let G=grid(occ);const GT=grid(terr),GD=grid(deck);
function mt(o,d,t){const e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)return -1;const inv=1/det,s=[o[0]-t[0],o[1]-t[1],o[2]-t[2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*inv;if(u<0||u>1)return -1;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)return -1;return (e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;}
function segHit(GR,a,b){const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(...d);if(L<1e-6)return null;const u=d.map(x=>x/L),seen=new Set(),n=Math.ceil(L/(GR.c/2))+1;
 for(let s=0;s<=n;s++){const x=a[0]+d[0]*s/n,z=a[2]+d[2]*s/n;for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){const k=(Math.floor(x/GR.c)+ox)+','+(Math.floor(z/GR.c)+oz),l=GR.g.get(k);if(!l)continue;for(const i of l){if(seen.has(i))continue;seen.add(i);const t=mt(a,u,GR.T[i].t);if(t>1e-4&&t<L-1e-4)return GR.T[i].o;}}}return null;}
function discHit(eye,p,r){const f=[p[0]-eye[0],p[1]-eye[1],p[2]-eye[2]],l=Math.hypot(...f),u=f.map(x=>x/l),a=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
 const cr=(x,y)=>[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],nz=v=>{const L=Math.hypot(...v);return v.map(x=>x/L);},e1=nz(cr(u,a)),e2=cr(u,e1);
 let n=0,by=null;const c=segHit(G,eye,p);if(c){n++;by=c;}if(!c&&false)return null;
 for(let k=0;k<8;k++){const th=k*Math.PI/4,q=[0,1,2].map(i=>p[i]+e1[i]*r*Math.cos(th)+e2[i]*r*Math.sin(th)),b=segHit(G,eye,q);if(b){n++;by=by||b;}if(n+(7-k)<5)return null;}
 return n>=5?by:null;}
function surfaceY(f){const o=[f[0],f[1]+1.4,f[2]];let best=f[1];for(const GR of [G,GT]){const k=Math.floor(f[0]/GR.c)+','+Math.floor(f[2]/GR.c),l=GR.g.get(k);if(!l)continue;for(const i of l){const t=mt(o,[0,-1,0],GR.T[i].t);if(t>0&&t<1.4+1e-6){const y=o[1]-t;if(y>best)best=y;}}}return best;}
function resample(p,step){const out=[];let acc=0;out.push(p[0]);for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],L=Math.hypot(b[0]-a[0],b[2]-a[2]);let t=step-acc;while(t<=L){const u=t/L;out.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u]);t+=step;}acc=(acc+L)%step;}return out;}
const toBoxes=rows=>rows.map(r=>({min:[r[0],r[1],r[2]],max:[r[3],r[4],r[5]]}));
const newBoxes=toBoxes(PX.LAKESIDE_LENS_OCCLUDERS),islandBoxes=toBoxes(IX.ISLAND_LENS_OCCLUDERS);
// BEFORE proxies = the b17r7 generator kinds (5ae6e43b): no ring trees, no boardwalk / steps, bushes only shore_bush
const OLDK=/^LK_(tree_|band_tree|shore_bush|house_|pavilion|chime_post|bridge_i$|shore_rock|rock_i|lantern_boat|clothesline|porch_steps|barrel)/;
const oldBoxes=(()=>{const cp=require('node:child_process'),src=cp.execSync('git show 5ae6e43b:creator-build-project/assets/scripts/region/LakesideLensOccluders.ts',{cwd:__dirname,encoding:'utf8'});const m=src.match(/=\[(.*)\];/s);return toBoxes(JSON.parse('['+m[1]+']'));})();
const SPEED=1.4,DT=1/30;
function feetPath(route){const P=resample(route,SPEED*DT);return P.map(q=>{const fl=W.walkFloorY('lakeside',q[0],q[2]),y0=fl===null?q[1]:fl;return [q[0],surfaceY([q[0],y0,q[2]]),q[2]];});}
const g=W.walkGrid('lakeside'),cells=[];for(let i=0;i<g.h.length;i++)if(!Number.isNaN(g.h[i]))cells.push(i);
const cellAt=i=>[g.x0+(i%g.W+.5)*g.c,g.h[i],g.z0+(((i/g.W)|0)+.5)*g.c];
const plen=p=>{let s=0;for(let i=1;i<p.length;i++)s+=Math.hypot(p[i][0]-p[i-1][0],p[i][2]-p[i-1][2]);return s;};
// MAC route: the start cell whose walkPath to the tap is closest to 57.6 m and 8 points, first leg along local −x (camera moved world +x, yaw 180)
const TAP=[5.821602335136868,0.9,1.9939710256717333];let mac=null,macErr=1e9;
for(let i=0;i<cells.length;i+=3){const a=cellAt(cells[i]);const p=W.walkPath('lakeside',a,TAP);if(!p||p.length<3)continue;const L=plen(p),d=[p[1][0]-p[0][0],p[1][2]-p[0][2]],dl=Math.hypot(...d)||1;
 const err=Math.abs(L-57.61)+3*Math.abs(p.length-8)+(d[0]/dl>-0.7?10:0);if(err<macErr){macErr=err;mac=p;}}
let seed=29;const rnd=()=>(seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff;
const treeC=inst.filter(i=>/^LK_(ring_tree|tree_mid)/.test(i.name)).map(i=>[(i.box[0][0]+i.box[1][0])/2,(i.box[0][2]+i.box[1][2])/2]);
const deckC=inst.filter(i=>DECK.test(key(i.name))).map(i=>[(i.box[0][0]+i.box[1][0])/2,i.box[1][1],(i.box[0][2]+i.box[1][2])/2]);
const near=(p,C,r)=>p.some(q=>C.some(c=>Math.hypot(q[0]-c[0],q[2]-c[c.length-1])<r));
const routes=[{id:'MAC',p:mac}];
// DECK: explicit walks along the b16 boardwalk (first → last plank) and over the bridge (one stair foot → the other)
{const cellNear=q=>{let b=null,bd=1e9;for(const i of cells){const c=cellAt(i),d=Math.hypot(c[0]-q[0],c[2]-q[2]);if(d<bd){bd=d;b=c;}}return b;};
 const bw=inst.filter(i=>/^LK_boardwalk_b16/.test(i.name)).sort((a,b)=>a.name<b.name?-1:1),st=inst.filter(i=>/^LK_bridge_steps/.test(i.name));
 const ctr=i=>[(i.box[0][0]+i.box[1][0])/2,i.box[1][1],(i.box[0][2]+i.box[1][2])/2];
 const pairs=[];if(bw.length>1)pairs.push([ctr(bw[0]),ctr(bw[bw.length-1])]);if(st.length>1)pairs.push([ctr(st[0]),ctr(st[1])]);
 for(const [a,b] of pairs){for(const [x,y] of [[a,b],[b,a]]){const p=W.walkPath('lakeside',cellNear(x),cellNear(y));if(p&&p.length>=2)routes.push({id:'DECK'+routes.filter(r=>/^DECK/.test(r.id)).length,p});}}}let nC=0,nD=0,nR=0;const NRAND=+(process.env.QF_LKG_RANDOM||1);
for(let tries=0;tries<3000&&(nC<3||nR<NRAND);tries++){const a=cellAt(cells[(rnd()*cells.length)|0]),b=cellAt(cells[(rnd()*cells.length)|0]);if(Math.hypot(a[0]-b[0],a[2]-b[2])<10)continue;const p=W.walkPath('lakeside',a,b);if(!p||p.length<3)continue;
 const P=feetPath(p),onDeck=P.filter((f,k)=>{const fl=W.walkFloorY('lakeside',f[0],f[2]);return fl!==null&&f[1]>fl+0.3;}).length;
  if(near(P,treeC.map(c=>[c[0],0,c[1]]),2.5)&&nC<3){routes.push({id:'CANOPY'+nC++,p});continue;}
 if(nR<NRAND){routes.push({id:'RAND'+nR++,p});}}
const lensSets=[];for(const s of E.SCREENS)lensSets.push({id:'follow '+s.join('x'),fam:'follow',mk:(f,h)=>E.followPose(f,h,s[0],s[1],0)});
// MapExplore orbit: the yaw is a WORLD yaw the player set (it does not turn with her heading; r13b Mac lens kept a fixed offset while she walked)
for(const [yo,pi,d] of [[0,15,9],[90,15,9],[180,15,9],[270,15,9],[0,35,14],[90,35,14],[180,35,14],[270,35,14],[0,-8,6],[180,-8,6]])lensSets.push({id:`orbit yaw${yo} p${pi} d${d}`,fam:'orbit',mk:(f,h)=>{const o=new FO.FreeOrbit('lakeside');o.yaw=yo;o.pitch=pi;o.dist=d;o.seeded=true;return o.rawPose(f);}});
const nrm=v=>{const l=Math.hypot(...v)||1e-9;return v.map(x=>x/l);},crs=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function fill(pose,GR,reach=2.5){const f=nrm(pose.target.map((x,k)=>x-pose.position[k])),r=nrm(crs(f,[0,1,0])),u=crs(r,f),tv=Math.tan(((pose.fovVerticalDeg||45)*Math.PI/180)/2)*0.6,th=tv*0.6;let n=0;
 for(const sx of [-1,0,1])for(const sy of [-1,0,1]){const d=nrm([0,1,2].map(i=>f[i]+r[i]*sx*th+u[i]*sy*tv));if(segHit(GR,pose.position,pose.position.map((x,i)=>x+d[i]*reach)))n++;}return n;}
function underDeck(pos,feet,onDeck){if(pos[1]<feet[1]+0.9)return true;if(!onDeck)return false;return !!segHit(GD,pos,[pos[0],pos[1]+4,pos[2]]);}
const res={routes:routes.map(r=>({id:r.id,points:r.p.length,lengthM:+plen(r.p).toFixed(2)})),macFitErr:+macErr.toFixed(2)};
const trace=[];
for(const mode of ['before','after']){const fam={};
 for(const L of lensSets)for(const R of routes){const P=feetPath(R.p);const guard=mode==='before'?new OC.LensPullIn():new OC.LensGuard(),boxes=mode==='before'?oldBoxes:newBoxes;let prev=null,prevRaw=null,pv=null;
  const F=fam[L.fam]=fam[L.fam]||{frames:0,hidden:0,fill:0,under:0,maxExtraMS:0,maxExtraAcc:0,maxAbsMS:0,byRoute:{}};const BR=F.byRoute[R.id]=F.byRoute[R.id]||{frames:0,hidden:0,fill:0,under:0};
  for(let i=0;i<P.length;i++){const f=P[i],n=P[Math.min(P.length-1,i+3)],q=P[Math.max(0,i-3)],h=Math.atan2(n[0]-q[0],n[2]-q[2]),raw=L.mk(f,h);
   const pose=guard.apply(raw,f,boxes,i?DT:0);const fl=W.walkFloorY('lakeside',f[0],f[2]),onDeck=fl!==null&&f[1]>fl+0.3;
   F.frames++;BR.frames++;const hid=discHit(pose.position,[f[0],f[1]+1.5,f[2]],.09)||discHit(pose.position,[f[0],f[1]+1.1,f[2]],.12);if(hid){F.hidden++;BR.hidden++;}
   if(fill(pose,G)>=4){F.fill++;BR.fill++;}if(underDeck(pose.position,f,onDeck)){F.under++;BR.under++;}
   if(prev){const ev=[0,1,2].map(k=>((pose.position[k]-prev.position[k])-(raw.position[k]-prevRaw.position[k]))/DT),sp=Math.hypot(...ev);F.maxExtraMS=Math.max(F.maxExtraMS,sp);
    F.maxAbsMS=Math.max(F.maxAbsMS,Math.hypot(...[0,1,2].map(k=>pose.position[k]-prev.position[k]))/DT);
    if(pv&&i>2){const acc=Math.hypot(...[0,1,2].map(k=>ev[k]-pv[k]))/DT;F.maxExtraAcc=Math.max(F.maxExtraAcc,acc);}pv=ev;}
   if(R.id==='MAC'&&L.id==='orbit yaw180 p35 d14'&&i%3===0)trace.push({mode,i,t:+(i*DT).toFixed(2),feet:f.map(x=>+x.toFixed(2)),raw:raw.position.map(x=>+x.toFixed(2)),lens:pose.position.map(x=>+x.toFixed(2)),target:pose.target.map(x=>+x.toFixed(2)),hidden:!!hid,fill:fill(pose,G),onDeck});
   prev=pose;prevRaw=raw;}}
 for(const F of Object.values(fam))for(const k of ['maxExtraMS','maxExtraAcc','maxAbsMS'])F[k]=+F[k].toFixed(2);
 const fo=fam.follow,ob=fam.orbit;
 const G1=fo.hidden<=0.002*fo.frames&&ob.hidden<=0.003*ob.frames,G2=fo.fill<=0.001*fo.frames&&ob.fill<=0.001*ob.frames,G3=fo.under+ob.under===0,G4=Math.max(fo.maxExtraMS,ob.maxExtraMS)<=4.0&&Math.max(fo.maxExtraAcc,ob.maxExtraAcc)<=12;
 // G5 reward close-up on the island: I1→I2; the lens is held at the blend-end pose for her walk (r13b Mac log: Main Camera static)
 G=grid(bvh(J.island.filter(o=>/^(env_island_props_merged|env_lighthouse_ext|env_lighthouse_door|env_prop_palm_|beach_palm_)/.test(o.name))));
 const sp=NP.walkPair('mainline-01','mainline-02'),path=NW.planWalk(sp.region,sp.from,sp.to).segments[0].path,RP=resample(path,SPEED*DT);const h0=0;/* playReward resets her with yawRad 0 and blends to followPose(girl, yaw()) (Mac: lens held at (-4.5,3.4,-1.3)) */
 const rew=[];for(const s of E.SCREENS){const raw=E.followPose(path[0],h0,s[0],s[1],0),pose=mode==='before'?raw:new OC.LensGuard().solveStatic(raw,path[0],islandBoxes);let hid=0;
  for(const f of RP)if(discHit(pose.position,[f[0],f[1]+1.5,f[2]],.09)||discHit(pose.position,[f[0],f[1]+1.1,f[2]],.12))hid++;
  rew.push({screen:s.join('x'),fill:fill(pose,G),hiddenShare:+(hid/RP.length).toFixed(3),lens:pose.position.map(x=>+x.toFixed(2))});}
 G=grid(occ);
 const G5=rew.every(r=>r.fill===0&&r.hiddenShare<=0.05);
 res[mode]={G1,G2,G3,G4,G5,follow:fo,orbit:ob,reward:rew};console.error(mode,JSON.stringify({G1,G2,G3,G4,G5,follow:{...fo,byRoute:undefined},orbit:{...ob,byRoute:undefined},reward:rew.map(r=>r.fill+'/'+r.hiddenShare).join(' '),macFollow:fo.byRoute.MAC,macOrbit:ob.byRoute.MAC,deckOrbit:ob.byRoute.DECK0,canopyOrbit:ob.byRoute.CANOPY0}));}
const ok=m=>m.G1&&m.G2&&m.G3&&m.G4&&m.G5;
const STAGE=fs.readFileSync(__dirname+'/../../creator-build-project/assets/scripts/world-r2/RegionNodeStage.ts','utf8');
const wiring={guard:/new LensGuard\(\)/.test(STAGE),orbit:/this\.occlude\(this\.guardOrbitGround\(this\.orbit\.solve/.test(STAGE),follow:/this\.occlude\(followPose\(/.test(STAGE),reward:/this\.occludeHeld\(followPose\(/.test(STAGE),island:/ISLAND_LENS_OCCLUDERS/.test(STAGE)};
const status=ok(res.after)&&!ok(res.before)&&Object.values(wiring).every(Boolean)?'PASS':'FAIL';
fs.mkdirSync(__dirname+'/reports',{recursive:true});fs.writeFileSync(__dirname+'/reports/lakeside-lens-guard.json',JSON.stringify({status,failingBefore:!ok(res.before),wiring,scope:'Geometry (real GLB triangles) + real TS lens code; NOT a render or device capture.',...res},null,1)+'\n');
if(process.env.QF_LKG_TRACE)fs.writeFileSync(process.env.QF_LKG_TRACE,JSON.stringify(trace));
console.log(JSON.stringify({status,failingBefore:!ok(res.before),before:{G1:res.before.G1,G2:res.before.G2,G3:res.before.G3,G4:res.before.G4,G5:res.before.G5},after:{G1:res.after.G1,G2:res.after.G2,G3:res.after.G3,G4:res.after.G4,G5:res.after.G5},wiring}));
process.exitCode=status==='PASS'?0:1;
