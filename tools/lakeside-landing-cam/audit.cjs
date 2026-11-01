'use strict';
/* 运镜bot r5 lakeside-landing-cam: offline audit of the skycity → lakeside balloon shot (old vs new) against HANDOFF §4.
 * World = the journey world of tools/journey-integration/journey-scene.cjs (skycity placed by sOff/yaw; she departs at S6).
 * Lake placed by LakesideCameraLayout.lakesideJourney(S6). Geometry: lakeside instances (lakeside-scene.cjs), the FULL
 * skycity (region_skycity/env_skycity.glb, Draco: DRACO3D=<draco3d dir>), the balloon prefab GLB at the basket position.
 * Checks per frame: lens clearance ≥ 1.1 m (all geometry incl. balloon), girl not cropped (full 1.7253 m box) with ≥ 13 pt to
 * the safe area / capsule (boardSafeInsets), head + chest line of sight, balloon on screen, the SOUTH-BANK RULE (no visible
 * lake ground beyond lake-local z 42: first ray hit on lakeside geometry at z > 42, or a ray that reaches the lake ground plane
 * y 0.58 at z > 42 without hitting anything), lens |a| ≤ 3 m/s², view |α| ≤ 120°/s², start/end jumps.
 * Usage: node audit.cjs [--knobs '{"climbM":20}'] [--out file.json]   (QF_TYPESCRIPT_MODULE + DRACO3D set) */
const fs=require('fs'),path=require('path');
const Jn=require('../journey-integration/journey-scene.cjs'),LKS=require('../journey-integration/lakeside/lakeside-scene.cjs'),FL=require('../journey-integration/journey-framing-lib.cjs');
const {load:loadGlb}=require('../journey-integration/occlusion/lib-glb.cjs'),{decode}=require('../camera-frame-test/glb_geometry.cjs');
const {H,S,rotY,add,sub,yaw:SKY_YAW,sOff}=Jn;
const B=H.load(S+'region/LakesideBalloon.ts'),LC=H.load(S+'region/LakesideCameraLayout.ts'),BL=H.load(S+'ui/BoardLayout.ts'),Core=H.load(S+'world-r1/RegionJourneyCore.ts');
const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const KN=Object.assign({},B.LAKESIDE_BALLOON_LANDING,JSON.parse(arg('--knobs')||'{}'));
const SCREENS=[[390,844],[360,780],[768,1024]],GIRL_H=1.7253,GIRL_W=.3,UI_GAP=13,CLEAR=1.1,BANK_Z=42,LAKE_Y=.58;
const BLOCK_Z1=90,BLOCK_X0=-36,BLOCK_X1=33;
const S6=add(rotY(SKY_YAW,[0.2,0.032,-27.8]),sOff),S4=add(rotY(SKY_YAW,[0.2,3.308,-5.8]),sOff);
const LJ=LC.lakesideJourney(S6),toLocal=p=>rotY(-LJ.yawDeg,sub(p,LJ.root)),bank=LJ.arrival[LJ.arrival.length-1];
// ---- geometry ----
// SCENE_REF=<git ref>: audit against the scene GLBs of another branch/commit (env_skycity.glb + every region_lakeside model that
// differs), extracted with `git show` into /tmp; scripts/knobs stay this worktree's. Unset = this worktree's own GLBs.
const SCENE_REF=process.env.SCENE_REF||'';
function sceneFile(rel){if(!SCENE_REF)return Jn.ROOT+'/'+rel;const cp=require('child_process'),dir='/tmp/lkscene-'+SCENE_REF.replace(/[^\w.-]/g,'_'),out=dir+'/'+rel;
 if(!fs.existsSync(out)){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,cp.execFileSync('git',['-C',Jn.ROOT,'show',SCENE_REF+':'+rel],{maxBuffer:1<<28}));}return out;}
function lakeInstances(){if(!SCENE_REF)return LKS.instances();// whole lakeside scene from the ref: its transforms json + its GLBs (same filter as lakeside-scene.cjs)
 const base='creator-build-project/assets/bundles/region_lakeside/',T=JSON.parse(fs.readFileSync(sceneFile(base+'scene_r5h_slim_transforms.json'),'utf8'));
 const cache={};const glbT=name=>{if(!cache[name]){const nodes=loadGlb(sceneFile(base+'models/'+name)).filter(n=>n.tris&&n.tris.length);let n=0;for(const x of nodes)n+=x.tris.length;const t=new Float64Array(n);let o=0;for(const x of nodes){t.set(x.tris,o);o+=x.tris.length;}cache[name]=t;}return cache[name];};
 const qm=([x,y,z,w],[sx,sy,sz],[tx,ty,tz])=>[(1-2*(y*y+z*z))*sx,(2*(x*y+z*w))*sx,(2*(x*z-y*w))*sx,0,(2*(x*y-z*w))*sy,(1-2*(x*x+z*z))*sy,(2*(y*z+x*w))*sy,0,(2*(x*z+y*w))*sz,(2*(y*z-x*w))*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];
 const SKIP=['LK_board_frame.glb','LK_contact_shadow.glb','LK_ripple_ring.glb'];
 return T.instances.filter(i=>i&&typeof i.glb==='string'&&!SKIP.includes(i.glb)&&!/^LK_piece_/.test(i.glb)&&i.name!==i.glb.replace(/\.glb$/i,'')).map(i=>{const m=qm(i.rot_quat_xyzw,i.scale,i.pos),src=glbT(i.glb),t=new Float64Array(src.length);
  for(let k=0;k<src.length;k+=3){const x=src[k],y=src[k+1],z=src[k+2];t[k]=m[0]*x+m[4]*y+m[8]*z+m[12];t[k+1]=m[1]*x+m[5]*y+m[9]*z+m[13];t[k+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}return {name:i.name,glb:i.glb,group:i.group,tris:t};});}
async function geometry(){
 const lake=lakeInstances().map(i=>{const t=new Float64Array(i.tris.length);for(let k=0;k<t.length;k+=3){const w=LJ.toWorld([i.tris[k],i.tris[k+1],i.tris[k+2]]);t[k]=w[0];t[k+1]=w[1];t[k+2]=w[2];}return {tag:'lake',name:i.name,tris:t};});
 const g=await decode(sceneFile('creator-build-project/assets/bundles/region_skycity/env_skycity.glb'));if(!g)throw Error('draco3d not found: set DRACO3D');
 const sky=[];for(const name in g.meshes){if(/cloudsea|cumulus_far|cloud_small|Icosphere|_after/.test(name))continue;const tr=g.meshes[name],t=new Float64Array(tr.length*9);let o=0;
  for(const tri of tr)for(const v of tri){const w=add(rotY(SKY_YAW,v),sOff);t[o++]=w[0];t[o++]=w[1];t[o++]=w[2];}sky.push({tag:'sky',name,tris:t});}
 const bal=loadGlb(Jn.ROOT+'/creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb').filter(n=>n.tris&&n.tris.length&&!/flame/.test(n.name)).map(n=>({tag:'balloon',name:n.name,tris:Float64Array.from(n.tris)}));
 const stat=FL.buildBvh([...lake,...sky]),foot=new Map();// skycity floor footprint in the block (1 m cells): floor within y −1…2
 for(let x=BLOCK_X0;x<=BLOCK_X1;x++)for(let z=BANK_Z;z<=BLOCK_Z1;z++){const h=FL.cast(stat,LJ.toWorld([x+.5,6,z+.5]),[0,-1,0],10);if(h&&h.obj.tag==='sky'&&6-h.t>-1&&6-h.t<2)foot.set(x+','+z,6-h.t);}
 return {stat,bal,foot,lakeN:lake.length,skyN:sky.length};
}
const balAt=(G,p)=>FL.buildBvh(G.bal.map(o=>{const t=new Float64Array(o.tris.length);for(let k=0;k<t.length;k+=3){t[k]=o.tris[k]+p[0];t[k+1]=o.tris[k+1]+p[1];t[k+2]=o.tris[k+2]+p[2];}return {tag:'balloon',name:o.name,tris:t};}));
// point-triangle distance (Ericson)
function ptTri(p,t){const a=[t[0],t[1],t[2]],b=[t[3],t[4],t[5]],c=[t[6],t[7],t[8]],ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),dot=(x,y)=>x[0]*y[0]+x[1]*y[1]+x[2]*y[2];
 const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return Math.hypot(...ap);const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return Math.hypot(...bp);
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(ap[0]-v*ab[0],ap[1]-v*ab[1],ap[2]-v*ab[2]);}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return Math.hypot(...cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(ap[0]-w*ac[0],ap[1]-w*ac[1],ap[2]-w*ac[2]);}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6)),q=[b[0]+w*(c[0]-b[0]),b[1]+w*(c[1]-b[1]),b[2]+w*(c[2]-b[2])];return Math.hypot(...sub(p,q));}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return Math.hypot(ap[0]-ab[0]*v-ac[0]*w,ap[1]-ab[1]*v-ac[1]*w,ap[2]-ab[2]*v-ac[2]*w);}
function nearest(bvh,p,maxD=8){let best=maxD,who=null;if(!bvh.root)return {d:best,who};const st=[bvh.root];
 while(st.length){const n=st.pop();let dd=0;for(let c=0;c<3;c++){const e=Math.max(n.lo[c]-p[c],0,p[c]-n.hi[c]);dd+=e*e;}if(Math.sqrt(dd)>=best)continue;
  if(n.l){st.push(n.l,n.r);continue;}for(let k=n.s;k<n.e;k++){const i=bvh.idx[k],d=ptTri(p,bvh.tris[i]);if(d<best){best=d;who=bvh.tag[i].tag+':'+bvh.tag[i].name;}}}
 return {d:best,who};}
// ---- camera maths ----
const basis=pose=>FL.basis(pose);
function proj(pose,aspect,p){const {fw,r,up,th}=basis(pose),v=sub(p,pose.position),z=v[0]*fw[0]+v[1]*fw[1]+v[2]*fw[2];return [(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/(z*th*aspect),(v[0]*up[0]+v[1]*up[1]+v[2]*up[2])/(z*th),z];}
const toPt=(n,w,h)=>[(n[0]+1)/2*w,(1-n[1])/2*h];
function uiCheck(pose,feet,[w,h]){const ins=BL.boardSafeInsets(w,h),cap=ins.capsule,a=w/h;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,behind=false;
 for(const dx of[-GIRL_W,GIRL_W])for(const dz of[-GIRL_W,GIRL_W])for(const y of[0,GIRL_H]){const n=proj(pose,a,[feet[0]+dx,feet[1]+y,feet[2]+dz]);if(n[2]<=.05)behind=true;const q=toPt(n,w,h);x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
 const edge=Math.min(x0-ins.left,w-ins.right-x1,y0-ins.top,h-ins.bottom-y1);
 const capGap=cap?Math.max(cap.left-x1,x0-cap.right,cap.top-y1,y0-cap.bottom):1e9;
 return {edge:+edge.toFixed(1),capsule:+capGap.toFixed(1),gap:+Math.min(edge,capGap).toFixed(1),heightFrac:+((y1-y0)/h).toFixed(3),widthFrac:+((x1-x0)/w).toFixed(3),behind,box:[x0,y0,x1,y1].map(v=>+v.toFixed(1))};}
function los(G,bb,from,to){const d=sub(to,from),L=Math.hypot(...d),u=d.map(x=>x/L);const a=FL.cast(G.stat,from,u,L-.05),b=bb?FL.cast(bb,from,u,L-.05):null;const h=[a,b].filter(Boolean).sort((x,y)=>x.t-y.t)[0];return h?h.obj.tag+':'+h.obj.name:null;}
function balloonOnScreen(pose,aspect,p){const c=[p[0],p[1]+6.725,p[2]];let n=0,inn=0;for(let i=0;i<10;i++)for(let j=0;j<5;j++){const th=i/10*2*Math.PI,ph=(j/4-.5)*Math.PI,q=[c[0]+2.9*Math.cos(ph)*Math.cos(th),c[1]+3.6*Math.sin(ph),c[2]+2.9*Math.cos(ph)*Math.sin(th)],s=proj(pose,aspect,q);n++;if(s[2]>0&&Math.abs(s[0])<=1&&Math.abs(s[1])<=1)inn++;}
 const bk=proj(pose,aspect,[p[0],p[1]+.6,p[2]]);return {envelope:inn/n,basket:bk[2]>0&&Math.abs(bk[0])<=1&&Math.abs(bk[1])<=1};}
// south-bank rule: ray grid. Forbidden block (lake-local): z ∈ (42, 90], x ∈ [−36, 33], ground y < 3.
function southBank(G,bb,pose,aspect,cols=27,rows=58){const {fw,r,up,th}=basis(pose);let bad=0,skyBlock=0,maxZ=-1e9,sideVoid=0,gap=0,edge=0,lakeHit=0;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=((i+.5)/cols*2-1)*th*aspect,y=((j+.5)/rows*2-1)*th,d=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],l=Math.hypot(...d),u=d.map(v=>v/l);
  const a=FL.cast(G.stat,pose.position,u,800),b=bb?FL.cast(bb,pose.position,u,800):null,h=[a,b].filter(Boolean).sort((p,q)=>p.t-q.t)[0];
  if(h&&h.obj.tag==='balloon')continue;
  if(h){const p=add(pose.position,u.map(v=>v*h.t)),q=toLocal(p);if(h.obj.tag==='lake'){if(q[1]<3)maxZ=Math.max(maxZ,q[2]);if(q[2]>BANK_Z&&q[1]<3){bad++;lakeHit++;}}else if(q[2]>BANK_Z&&q[1]<3)skyBlock++;continue;}
  // no hit: where does it cross the lake ground plane?
  const o=toLocal(pose.position),dl=rotY(-LJ.yawDeg,u);if(dl[1]<-1e-6){const t=(LAKE_Y-o[1])/dl[1];if(t>0){const z=o[2]+dl[2]*t;maxZ=Math.max(maxZ,z);const x=o[0]+dl[0]*t;if(z>BANK_Z&&z<=BLOCK_Z1&&x>=BLOCK_X0&&x<=BLOCK_X1){const cx=Math.floor(x),cz=Math.floor(z);let f=0;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)if(G.foot.has((cx+i)+','+(cz+j)))f++;
   if(f>=3)gap++;/* a hole inside the skycity floor: 场景特效bot */else{bad++;edge++;}}else sideVoid++;}}}
 return {bad,lakeHit,edge,gap,skyBlock,maxZ:+maxZ.toFixed(2),sideVoid,n:cols*rows};}
function southBankDump(G,bb,pose,aspect,cols=27,rows=58){const {fw,r,up,th}=basis(pose);let bad=0,skyBlock=0,maxZ=-1e9,sideVoid=0,gap=0,edge=0,lakeHit=0;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=((i+.5)/cols*2-1)*th*aspect,y=((j+.5)/rows*2-1)*th,d=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],l=Math.hypot(...d),u=d.map(v=>v/l);
  const a=FL.cast(G.stat,pose.position,u,800),b=bb?FL.cast(bb,pose.position,u,800):null,h=[a,b].filter(Boolean).sort((p,q)=>p.t-q.t)[0];
  if(h&&h.obj.tag==='balloon')continue;
  if(h){const p=add(pose.position,u.map(v=>v*h.t)),q=toLocal(p);if(h.obj.tag==='lake'){if(q[1]<3)maxZ=Math.max(maxZ,q[2]);if(q[2]>BANK_Z&&q[1]<3){bad++;lakeHit++;}}else if(q[2]>BANK_Z&&q[1]<3)skyBlock++;continue;}
  // no hit: where does it cross the lake ground plane?
  const o=toLocal(pose.position),dl=rotY(-LJ.yawDeg,u);if(dl[1]<-1e-6){const t=(LAKE_Y-o[1])/dl[1];if(t>0){const z=o[2]+dl[2]*t;maxZ=Math.max(maxZ,z);const x=o[0]+dl[0]*t;if(z>BANK_Z&&z<=BLOCK_Z1&&x>=BLOCK_X0&&x<=BLOCK_X1){const cx=Math.floor(x),cz=Math.floor(z);let f=0;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)if(G.foot.has((cx+i)+','+(cz+j)))f++;
   if(f>=3)gap++;/* a hole inside the skycity floor: 场景特效bot */else{bad++;edge++;(globalThis.__EDGE=globalThis.__EDGE||[]).push([+x.toFixed(2),+z.toFixed(2),i,j,f]);}}else sideVoid++;}}}
 return {bad,lakeHit,edge,gap,skyBlock,maxZ:+maxZ.toFixed(2),sideVoid,n:cols*rows};}
// VOID RULE (v2.1, replaces the south-bank block rule): a ray of the frame grid counts ONLY when it shows a hole or an unfinished
// area, never when it shows real geometry (ground, apron, hills, trees, water, the balloon), wherever that geometry is:
//  · void:    it misses every mesh (lakeside + skycity + balloon, 800 m) while pointing more than 0.6° below the horizon
//             → the empty clear colour under the horizon (an unfinished edge / the empty south bank, or a gap seen from above);
//  · through: it crosses the skycity deck level (lake-local y 0.58) inside the floor INTERIOR (that 1 m cell and all 8
//             neighbours are skycity floor: top-down casts landing on skycity geometry within y −1…2) and its first hit lies
//             > 0.75 m below the deck → it fell through a hole in the floor. Rays that pass the rim are never "through":
//             whatever they hit beyond it is real ground (or, if nothing, they are void).
// Sky rays (no hit, at/above the horizon) and every first hit on a real surface do not count. No x/z box: works unchanged
// before and after the lakeside ground ring lands.
const VOID_DY=-Math.sin(.6*Math.PI/180),THROUGH_M=.75;
function voidRays(G,bb,pose,aspect,cols=27,rows=58){const {fw,r,up,th}=basis(pose),o=toLocal(pose.position);let vd=0,thr=0;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=((i+.5)/cols*2-1)*th*aspect,y=((j+.5)/rows*2-1)*th,d=[fw[0]+r[0]*x+up[0]*y,fw[1]+r[1]*x+up[1]*y,fw[2]+r[2]*x+up[2]*y],l=Math.hypot(...d),u=d.map(v=>v/l);
  const a=FL.cast(G.stat,pose.position,u,800),b=bb?FL.cast(bb,pose.position,u,800):null,h=[a,b].filter(Boolean).sort((p,q)=>p.t-q.t)[0];
  if(!h){if(u[1]<VOID_DY)vd++;continue;}
  if(h.obj.tag==='balloon')continue;const q=toLocal(add(pose.position,u.map(v=>v*h.t)));
  if(o[1]>LAKE_Y&&q[1]<LAKE_Y-THROUGH_M){const k=(LAKE_Y-o[1])/(q[1]-o[1]),cx=Math.floor(o[0]+(q[0]-o[0])*k),cz=Math.floor(o[2]+(q[2]-o[2])*k);let f=0;for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++)if(G.foot.has((cx+a)+','+(cz+c)))f++;if(f===9)thr++;}}
 return {bad:vd+thr,void:vd,through:thr,n:cols*rows};}
// ---- shots ----
const smooth5=x=>{const u=Math.max(0,Math.min(1,x));return u*u*u*(10+u*(-15+6*u));};
function startCamera(variant){// skycity follow (free-camera SPEC default: pitch 17°, 7.36 m, FOV 48) behind her, she faces S4→S6 (+variant°)
 const f=sub(S6,S4),h=Math.hypot(f[0],f[2]),y=Math.atan2(f[0]/h,f[2]/h)+variant*Math.PI/180,c=[S6[0],S6[1]+1.0,S6[2]],p=17*Math.PI/180,D=7.36;
 return {position:[c[0]-Math.sin(y)*Math.cos(p)*D,c[1]+Math.sin(p)*D,c[2]-Math.cos(y)*Math.cos(p)*D],target:c,fovVerticalDeg:48};}
function landingFor([w,h]){const L=LC.lakesideJourney(S6),land=LC.lakesideScreenLanding(L,LC.lakesideScreenFrame(w,h,BL.boardSafeInsets(w,h))),e=Core.arrivalPose(L.arrival,L.focus,land);return {position:e.position,target:e.target,fovVerticalDeg:land.arrivalFovDeg};}
function oldShot(){// e9dffc0 as shipped: old path + lens; the girl is NOT carried (stays at S6); after the ride the controller re-applies its stale start camera
 const K={climbM:14,descentM:12,durationS:22,easeInS:4,easeOutS:4,camBackM:8.5,camUpM:3.2,camSideM:1.4,lookUpM:1.1,fovDeg:48};
 const start=S6,dx=bank[0]-start[0],dz=bank[2]-start[2],h=Math.hypot(dx,dz)||1,ux=dx/h,uz=dz/h,descent=Math.min(K.descentM,h*.45),climbRun=Math.min(8,Math.max(2,h-descent-2));
 const climb=[start[0]+ux*climbRun,start[1]+K.climbM,start[2]+uz*climbRun],drop=[bank[0]-ux*descent,bank[1]+Math.min(2.4,K.climbM*.2),bank[2]-uz*descent],cruise=[drop[0],climb[1],drop[2]],pth=[start,climb,cruise,bank];
 const total=Core.routeLength(pth),timing=B.lakesideBalloonTiming(total,{...K});
 return {name:'old',timing,total,path:pth,vehicle:t=>Core.sampleRoute(pth,Core.journeyDistanceAt(total,timing,Math.max(0,Math.min(timing.durationS,t)))),girl:()=>S6,
  camera:(t)=>B.lakesideBalloonLens(Core.sampleRoute(pth,Core.journeyDistanceAt(total,timing,Math.max(0,Math.min(timing.durationS,t)))),bank,{...K})};}
function newShot(land,kn){kn=kn||KN;const walk=kn.walkLocal.map(p=>LJ.toWorld(p)),launch=LJ.toWorld(kn.launchLocal),R=B.lakesideBalloonRide(walk,launch,bank,land,kn);
 return {name:'new',R,F:R.flight,timing:{durationS:R.T},cut:R.cutT,total:Core.routeLength(R.path),path:R.path,vehicle:R.vehicle,girl:R.girl,cover:R.cover,camera:(t,from)=>R.camera(t,from)};}
const HULL=[];for(let i=0;i<16;i++){const a=i/16*2*Math.PI;for(const y of[.3,.8,1.5,2.8])HULL.push([Math.cos(a)*.95,y,Math.sin(a)*.95]);for(const ph of[-.7,-.35,0,.35,.7])HULL.push([Math.cos(a)*2.95*Math.cos(ph),6.73+3.6*Math.sin(ph),Math.sin(a)*2.95*Math.cos(ph)]);}HULL.push([0,10.4,0]);
function balloonClear(G,v){let m=1e9,who='';for(const q of HULL){const r=nearest(G.stat,[v[0]+q[0],v[1]+q[1],v[2]+q[2]]);if(r.d<m){m=r.d;who=r.who;}}return {d:m,who};}
function girlClear(G,g){let m=1e9;for(const dy of[.75,1.2,1.6])m=Math.min(m,nearest(G.stat,[g[0],g[1]+dy,g[2]]).d);return m;}
function dirOf(p){const f=sub(p.target,p.position),l=Math.hypot(...f);return f.map(x=>x/l);}
const ang=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])))*180/Math.PI;
function kinematics(shot,from){if(shot.cut!=null&&!shot.__part){const a=kinematics({...shot,__part:[0,shot.cut-1e-6]},from),b=kinematics({...shot,__part:[shot.cut+1e-6,shot.timing.durationS]},from);const w=a.linAccMax>=b.linAccMax?a:b,v=a.angAccMax>=b.angAccMax?a:b;return {linAccMax:w.linAccMax,linAt:w.linAt,angAccMax:v.angAccMax,angAt:v.angAt,angVelMax:Math.max(a.angVelMax,b.angVelMax),fovRateMax:Math.max(a.fovRateMax,b.fovRateMax),note:'split at the cut under black t='+shot.cut.toFixed(2)};}
 const T0=shot.__part?shot.__part[0]:0,T=shot.__part?shot.__part[1]:shot.timing.durationS,dt=1/60,P=[],D=[],F=[];for(let t=T0;t<=T+1e-9;t+=dt){const p=shot.camera(t,from);P.push(p.position);D.push(dirOf(p));F.push(p.fovVerticalDeg);}
 let aMax=0,aAt=0,alMax=0,alAt=0,wMax=0,fovRate=0;const W=[];for(let i=0;i+1<D.length;i++){const c=[D[i][1]*D[i+1][2]-D[i][2]*D[i+1][1],D[i][2]*D[i+1][0]-D[i][0]*D[i+1][2],D[i][0]*D[i+1][1]-D[i][1]*D[i+1][0]],s=Math.hypot(...c),th=Math.atan2(s,D[i][0]*D[i+1][0]+D[i][1]*D[i+1][1]+D[i][2]*D[i+1][2]);W.push(s>1e-12?c.map(x=>x/s*th/dt*180/Math.PI):[0,0,0]);}
 for(let i=1;i+1<P.length;i++){const a=Math.hypot(...[0,1,2].map(c=>(P[i+1][c]-2*P[i][c]+P[i-1][c])/(dt*dt)));if(a>aMax){aMax=a;aAt=T0+i*dt;}fovRate=Math.max(fovRate,Math.abs(F[i+1]-F[i])/dt);}
 for(let i=0;i+1<W.length;i++){const al=Math.hypot(...[0,1,2].map(c=>(W[i+1][c]-W[i][c])/dt));if(al>alMax){alMax=al;alAt=T0+i*dt;}wMax=Math.max(wMax,Math.hypot(...W[i]));}
 return {linAccMax:+aMax.toFixed(3),linAt:+aAt.toFixed(2),angAccMax:+alMax.toFixed(2),angAt:+alAt.toFixed(2),angVelMax:+wMax.toFixed(2),fovRateMax:+fovRate.toFixed(2)};}
function jump(a,b){return {posM:+Math.hypot(...sub(a.position,b.position)).toFixed(4),viewDeg:+ang(dirOf(a),dirOf(b)).toFixed(3),fovDeg:+Math.abs((a.fovVerticalDeg||48)-(b.fovVerticalDeg||48)).toFixed(3)};}
module.exports={voidRays,SCENE_REF,southBankDump,oldShot,newShot,geometry,balAt,nearest,uiCheck,southBank,balloonOnScreen,los,kinematics,startCamera,landingFor,S6,bank,toLocal,LJ,B,KN,SCREENS};
if(require.main===module)(async()=>{
 const G=await geometry(),out={sceneRef:SCENE_REF||'worktree',knobs:KN,S6,bankWorld:bank,bankLocal:toLocal(bank),screens:{}};const from=startCamera(0);console.log('startCam local',JSON.stringify(toLocal(from.position)),JSON.stringify(toLocal(from.target)));
 for(const scr of (process.argv.includes('--fast')?SCREENS.slice(0,1):SCREENS)){const key=scr.join('x'),land=landingFor(scr),aspect=scr[0]/scr[1],res={};
  for(const shot of [oldShot(),newShot(land)]){const T=shot.timing.durationS,rows=[],fast=process.argv.includes('--fast');
   const w={vFrames:0,vRays:0,v0:null,walkMax:0,walkFrames:0,walkLast:-1,clear:1e9,gap:1e9,env:1,bad:0,lakeHit:0,edge:0,gapF:0,skyBlock:0,los:0,height:1e9,balloon:1e9,balloonWho:'',girl:1e9,crop:0,frames:0};
   for(let t=0;t<=T+1e-9;t+=fast?1/2:1/10){const cov=shot.cover?shot.cover(t):0,pose=shot.camera(t,from),v=shot.vehicle(t),girl=shot.girl(t),bb=balAt(G,v);
    const bc=balloonClear(G,v),gc=girlClear(G,girl);w.balloon=Math.min(w.balloon,bc.d);if(bc.d<=w.balloon)w.balloonWho=bc.who;w.girl=Math.min(w.girl,gc);
    if(cov>=.999){rows.push({t:+t.toFixed(2),black:true,balloonClear:+bc.d.toFixed(2)});continue;}
    w.frames++;const cl=Math.min(nearest(G.stat,pose.position).d,nearest(bb,pose.position).d),ui=uiCheck(pose,girl,scr),sb=southBank(G,bb,pose,aspect,18,39),vr=voidRays(G,bb,pose,aspect),bo=balloonOnScreen(pose,aspect,v);
    const head=los(G,shot.name==='new'?bb:null,pose.position,[girl[0],girl[1]+1.55,girl[2]]),chest=los(G,shot.name==='new'?bb:null,pose.position,[girl[0],girl[1]+1.2,girl[2]]);
    rows.push({t:+t.toFixed(2),cover:+cov.toFixed(2),voidRays:vr.void,throughRays:vr.through,clear:+cl.toFixed(2),gap:ui.gap,h:ui.heightFrac,env:+bo.envelope.toFixed(2),basket:bo.basket,bad:sb.bad,lakeHit:sb.lakeHit,edge:sb.edge,floorGap:sb.gap,sky:sb.skyBlock,maxZ:sb.maxZ,head,chest,balloonClear:+bc.d.toFixed(2),girlClear:+gc.toFixed(2),g:toLocal(girl).map(x=>+x.toFixed(2))});
    if(t===0)w.v0=vr.bad;if(vr.bad){w.vFrames++;w.vRays+=vr.bad;}if(shot.cut!=null&&t<shot.cut){w.walkMax=Math.max(w.walkMax,vr.bad);if(vr.bad){w.walkFrames++;w.walkLast=t;}}
    w.clear=Math.min(w.clear,cl);w.gap=Math.min(w.gap,ui.gap);w.env=Math.min(w.env,bo.envelope);w.bad+=sb.bad>0?1:0;w.lakeHit+=sb.lakeHit>0?1:0;w.edge+=sb.edge>0?1:0;w.gapF+=sb.gap>0?1:0;w.skyBlock+=sb.skyBlock>0?1:0;w.los+=(head||chest)?1:0;w.height=Math.min(w.height,ui.heightFrac);}
   const endPose=shot.camera(T,from);
   res[shot.name]={voidRule:{raysAtT0:w.v0,framesWithAny:w.vFrames,raySum:w.vRays,walkFramesWithAny:w.walkFrames,walkMaxRays:w.walkMax,walkLastT:+w.walkLast.toFixed(2)},durationS:T,lengthM:+shot.total.toFixed(2),frames:w.frames,minClearM:+w.clear.toFixed(3),minUiGapPt:w.gap,minEnvelopeOnScreen:w.env,southBankBadFrames:w.bad,lakeGroundBeyond42Frames:w.lakeHit,offEdgeFrames:w.edge,skycityFloorGapFrames:w.gapF,skycityDeckInBlockFrames:w.skyBlock,
    occludedFrames:w.los,minGirlHeightFrac:w.height,minBalloonClearM:+w.balloon.toFixed(3),balloonNearest:w.balloonWho,minGirlBodyClearM:+w.girl.toFixed(3),kin:kinematics(shot,from),startJump:jump(from,shot.camera(0,from)),
    cutUnderBlack:shot.cut!=null?{t:+shot.cut.toFixed(2),...jump(shot.camera(shot.cut-1e-3,from),shot.camera(shot.cut+1e-3,from))}:null,
    endVsLanding:jump(endPose,land),afterRide:shot.name==='old'?jump(endPose,from):jump(endPose,endPose),rows};
  }
  // standing landing pose itself (with the balloon parked on the bank)
  const bb=balAt(G,bank),ui=uiCheck(land,bank,scr),sb={...southBank(G,bb,land,aspect),voidRule:voidRays(G,bb,land,aspect)};
  res.landing={pose:land,clearM:+Math.min(nearest(G.stat,land.position).d,nearest(bb,land.position).d).toFixed(3),ui,southBank:sb,head:los(G,bb,land.position,[bank[0],bank[1]+1.55,bank[2]]),chest:los(G,bb,land.position,[bank[0],bank[1]+1.2,bank[2]])};
  out.screens[key]=res;}
 // 360° check round the new boarding spot (her, standing) and round the moored basket (her, aboard): lens ring
 {const N=newShot(landingFor(SCREENS[0])),R=N.R,spot=R.walk[R.walk.length-1],lv=R.vehicle(0),bb=balAt(G,lv),ring={};
  for(const [name,c] of [['boardSpot',spot],['basket',lv]]){const r=[];for(const rad of[3,5,7])for(const up of[1,2.5,4])for(let az=0;az<360;az+=10){const a=az*Math.PI/180,p=[c[0]+Math.sin(a)*rad,c[1]+1.2+up,c[2]+Math.cos(a)*rad];
    const cl=Math.min(nearest(G.stat,p).d,nearest(bb,p).d),hd=los(G,bb,p,[c[0],c[1]+1.55,c[2]]),ch=los(G,bb,p,[c[0],c[1]+1.2,c[2]]);r.push({az,rad,up,cl:+cl.toFixed(2),ok:cl>=CLEAR&&!hd&&!ch,hd,ch});}
   const okAz=[...new Set(r.filter(x=>x.ok).map(x=>x.az))];ring[name]={samples:r.length,pass:r.filter(x=>x.ok).length,clearOk:r.filter(x=>x.cl>=CLEAR).length,losOk:r.filter(x=>!x.hd&&!x.ch).length,azimuthsWithAPass:okAz.length,azWithPass:okAz};}
  out.ring360=ring;console.log('ring360',JSON.stringify(Object.fromEntries(Object.entries(ring).map(([k,v])=>[k,{samples:v.samples,pass:v.pass,clearOk:v.clearOk,losOk:v.losOk,azimuthsWithAPass:v.azimuthsWithAPass}]))));}
 // start-camera robustness (390×844): other skycity follow headings
 out.startVariants={};const land0=landingFor(SCREENS[0]);for(const v of [0,90,-90,180]){const fr=startCamera(v),sh=newShot(land0);out.startVariants[v]={blendInS:KN.blendInS,kin:kinematics(sh,fr),startJump:jump(fr,sh.camera(0,fr))};}
 const o=arg('--out')||path.join(__dirname,'audit.json');fs.writeFileSync(o,JSON.stringify(out,null,1));
 for(const k in out.screens){const s=out.screens[k];for(const n of ['old','new']){const r=s[n];console.log(k,n,JSON.stringify({voidRule:r.voidRule,T:r.durationS,L:r.lengthM,frames:r.frames,clear:r.minClearM,gap:r.minUiGapPt,env:r.minEnvelopeOnScreen,bad:r.southBankBadFrames,lake:r.lakeGroundBeyond42Frames,edge:r.offEdgeFrames,floorGap:r.skycityFloorGapFrames,balloon:r.minBalloonClearM,balloonWho:r.balloonNearest,girlBody:r.minGirlBodyClearM,cut:r.cutUnderBlack,maxZ:r.maxVisibleLakeZ,occ:r.occludedFrames,h:r.minGirlHeightFrac,kin:r.kin,start:r.startJump,end:r.endVsLanding,after:r.afterRide}));}
  console.log(k,'landing',JSON.stringify({clear:s.landing.clearM,ui:s.landing.ui,sb:s.landing.southBank,head:s.landing.head,chest:s.landing.chest}));}
 console.log('startVariants',JSON.stringify(out.startVariants));
})().catch(e=>{console.error(e);process.exit(1);});
