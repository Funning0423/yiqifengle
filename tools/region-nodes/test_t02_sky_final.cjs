'use strict';
/* T-02 (Grok Bot approved Oct 25) — the last skycity shot before the lakeside set-off (ISSUES T-02: mostly empty sky, she tiny,
 * no continue unless tapped).
 * F1 the baked S6 pose (SKY_FINALE_POSE_LOCAL) is what skyFinaleShot derives from the skycity lens boxes;
 * F2 on all 7 portrait screens: her whole body inside the safe margins, her ≥ 20 % of the frame height, ≥ 8 % of the star-ring
 *    samples on screen (old finaleLook reported for comparison);
 * F3 real mesh (env_skycity.glb triangles, clouds/birds excluded, great tree INCLUDED): lens ≥ 1.1 m from every triangle, her head
 *    and chest rays unblocked, ≥ 1 on-screen ring sample visible; mesh fill (non-sky share of a 18×38 ray grid) before → after;
 * F4 approach from her walk lens: orbits round her the clear way (skyFinaleApproach / skyFinaleApproachPose), eased, view yaw ≤ 90°/s and ≤ 200°/s², lens never in a
 *    box, face/chest hidden ≤ 0.5 s, no jump (≤ 0.5 m per 60 Hz frame);
 * F5 auto-continue: holdS, armed after the reward claim, disarmed by drag/pinch/tap and by the WindWipe cover; wipe hooks used;
 *    no black screen of ours. */
const fs=require('node:fs'),path=require('node:path');
const X=require('./explore-stage-harness.cjs');
const F=X.H.load(X.S('region/SkyFinaleShot.ts')),C=X.H.load(X.S('region/ExploreCameraCore.ts')),NW=X.H.load(X.S('region/NodeWalker.ts'));
const LS=X.H.load(X.S('region/LensSmooth.ts')),LA=X.H.load(X.S('region/LensAvoid.ts'));
const ROOT=path.resolve(__dirname,'../..');
const B=X.SKO.map(b=>({min:[b[0],b[1],b[2]],max:[b[3],b[4],b[5]]}));
const segs=NW.planWalk('skycity','S4','S6').segments,last=segs[segs.length-1].path,pa=last[last.length-2],feet=last[last.length-1],face=Math.atan2(feet[0]-pa[0],feet[2]-pa[2]);
const res={};let all=true;const ok=(k,v,d)=>{res[k]={ok:!!v,...d};all=all&&!!v;};
const NEW=F.SKY_FINALE_POSE_LOCAL,OLD=C.finaleLook(feet,[-0.238,20,-24.327]);
// F2
const frame=p=>C.SCREENS.map(([W,H])=>({screen:W+'x'+H,herPct:+(F.herShare(p.position,p.target,p.fovVerticalDeg,W,H,feet)*100).toFixed(1),ringPct:+(F.ringShare(p.position,p.target,p.fovVerticalDeg,W,H,F.STAR_RING_LOCAL)*100).toFixed(1),herMargin:+LS.herMargin(p.position,p.target,p.fovVerticalDeg,feet,[[W,H]]).toFixed(2)}));
{const a=frame(NEW),b=frame(OLD);ok('F2',a.every(s=>s.herMargin>=0&&s.herPct>=20&&s.ringPct>=8),{after:a,before:b});}
// F3 real mesh
(async()=>{
 const draco=require('/tmp/draco3d/node_modules/draco3d/draco3d.js'),decMod=await draco.createDecoderModule({});
 const raw=fs.readFileSync(path.join(ROOT,'creator-build-project/assets/bundles/region_skycity/env_skycity.glb')),jl=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jl).toString());
 const binOff=20+jl+8,bin=raw.subarray(binOff,binOff+raw.readUInt32LE(20+jl));const parent={};doc.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i;}));
 const mul=(A,Bm)=>{const M=new Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)M[c*4+r]+=A[k*4+r]*Bm[c*4+k];return M;};
 const trs=n=>{if(n.matrix)return n.matrix.slice();const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],t=n.translation||[0,0,0];return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];};
 const glob=i=>{let M=trs(doc.nodes[i]);for(let k=parent[i];k!==undefined;k=parent[k])M=mul(trs(doc.nodes[k]),M);return M;};
 const xf=(M,v)=>[M[0]*v[0]+M[4]*v[1]+M[8]*v[2]+M[12],M[1]*v[0]+M[5]*v[1]+M[9]*v[2]+M[13],M[2]*v[0]+M[6]*v[1]+M[10]*v[2]+M[14]];
 const T=[];const names=[];
 for(let i=0;i<doc.nodes.length;i++){const node=doc.nodes[i];if(node.mesh===undefined||/cloud|cumulus|birds/.test(node.name||''))continue;const M=glob(i);
  for(const pr of doc.meshes[node.mesh].primitives){const ext=pr.extensions&&pr.extensions.KHR_draco_mesh_compression;if(!ext)continue;
   const bv=doc.bufferViews[ext.bufferView],data=bin.subarray(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength);const d=new decMod.Decoder(),buf=new decMod.DecoderBuffer();buf.Init(new Int8Array(data.buffer,data.byteOffset,data.byteLength),data.byteLength);
   const mesh=new decMod.Mesh();if(!d.DecodeBufferToMesh(buf,mesh).ok())continue;const attr=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),nv=mesh.num_points(),nf=mesh.num_faces(),pos=new decMod.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,attr,pos);
   const P=[];for(let v=0;v<nv;v++)P[v]=xf(M,[pos.GetValue(v*3),pos.GetValue(v*3+1),pos.GetValue(v*3+2)]);const face3=new decMod.DracoInt32Array();
   for(let f=0;f<nf;f++){d.GetFaceFromMesh(mesh,f,face3);const a=P[face3.GetValue(0)],b=P[face3.GetValue(1)],c=P[face3.GetValue(2)];const cx=(a[0]+b[0]+c[0])/3,cy=(a[1]+b[1]+c[1])/3,cz=(a[2]+b[2]+c[2])/3;
    T.push({far:/islets_far/.test(node.name||''),a,b,c,cx,cy,cz,r:Math.max(Math.hypot(a[0]-cx,a[1]-cy,a[2]-cz),Math.hypot(b[0]-cx,b[1]-cy,b[2]-cz),Math.hypot(c[0]-cx,c[1]-cy,c[2]-cz)),n:names.length});}
   names.push(node.name);[pos,face3,mesh,buf,d].forEach(o=>decMod.destroy(o));}}
 const sub=(p,q)=>[p[0]-q[0],p[1]-q[1],p[2]-q[2]],dot=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2],cr=(p,q)=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
 function dPT(p,a,b,c){const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return Math.hypot(...ap);const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return Math.hypot(...bp);
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(a[0]+ab[0]*v-p[0],a[1]+ab[1]*v-p[1],a[2]+ab[2]*v-p[2]);}const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return Math.hypot(...cp);
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(a[0]+ac[0]*w-p[0],a[1]+ac[1]*w-p[1],a[2]+ac[2]*w-p[2]);}const va=d3*d6-d5*d4;
  if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return Math.hypot(b[0]+(c[0]-b[0])*w-p[0],b[1]+(c[1]-b[1])*w-p[1],b[2]+(c[2]-b[2])*w-p[2]);}const den=1/(va+vb+vc),v=vb*den,w=vc*den;return Math.hypot(a[0]+ab[0]*v+ac[0]*w-p[0],a[1]+ab[1]*v+ac[1]*w-p[1],a[2]+ab[2]*v+ac[2]*w-p[2]);}
 function ray(o,u,maxT,skipFar=false,skipRx=null){let best=maxT,hit=-1;for(const t of T){if(skipFar&&t.far)continue;if(skipRx&&skipRx.test(names[t.n]))continue;const w=[t.cx-o[0],t.cy-o[1],t.cz-o[2]],s=dot(w,u);if(s<-t.r||s-t.r>best)continue;const q=dot(w,w)-s*s;if(q>t.r*t.r)continue;
  const e1=sub(t.b,t.a),e2=sub(t.c,t.a),p=cr(u,e2),det=dot(e1,p);if(Math.abs(det)<1e-9)continue;const inv=1/det,tv=sub(o,t.a),uu=dot(tv,p)*inv;if(uu<0||uu>1)continue;const qv=cr(tv,e1),vv=dot(u,qv)*inv;if(vv<0||uu+vv>1)continue;const d=dot(e2,qv)*inv;if(d>0.05&&d<best){best=d;hit=t.n;}}return {t:best,name:hit>=0?names[hit]:''};}
 const blocked=(o,q,skip=null)=>{const d=sub(q,o),L=Math.hypot(...d),r=ray(o,d.map(v=>v/L),L-0.35,false,skip);return r.name;};
 const RING_SELF=/starring|state_ring/;
 const minClear=p=>{let m=Infinity,nm='';for(const t of T){if(Math.hypot(p[0]-t.cx,p[1]-t.cy,p[2]-t.cz)-t.r>m)continue;const d=dPT(p,t.a,t.b,t.c);if(d<m){m=d;nm=names[t.n];}}return {m,nm};};
 const fill=(pose,W,H,nx=18,ny=38)=>{const f=sub(pose.target,pose.position),fl=Math.hypot(...f);for(let i=0;i<3;i++)f[i]/=fl;let r=[f[2],0,-f[0]];const rl=Math.hypot(r[0],r[2]);r=[r[0]/rl,0,r[2]/rl];const u=cr(r,f);
  const tv=Math.tan(pose.fovVerticalDeg*Math.PI/360),th=tv*W/H;let n=0;for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){const sx=((ix+.5)/nx*2-1)*th,sy=((iy+.5)/ny*2-1)*tv;const d=[f[0]+r[0]*sx+u[0]*sy,f[1]+r[1]*sx+u[1]*sy,f[2]+r[2]*sx+u[2]*sy],l=Math.hypot(...d);if(ray(pose.position,d.map(v=>v/l),400,true).name)n++;}return n/(nx*ny);};
// F1 (bake check): skyFinaleShot with the lens boxes AND the real-mesh checks (clearance, her head/chest + ring seen) = the baked pose
 {const t0=Date.now(),sh=F.skyFinaleShot(feet,face,F.STAR_RING_LOCAL,B,{clearAt:p=>minClear(p).m,seen:(a,q)=>!blocked(a,q,q[1]>10?RING_SELF:null)}),d=sh?Math.max(...[0,1,2].map(i=>Math.abs(sh.position[i]-NEW.position[i])),...[0,1,2].map(i=>Math.abs(sh.target[i]-NEW.target[i]))):Infinity;
  ok('F1',d<=0.01,{maxDiffM:+d.toFixed(4),derived:sh&&{position:sh.position.map(v=>+v.toFixed(3)),target:sh.target.map(v=>+v.toFixed(3))},feet:feet.map(v=>+v.toFixed(2)),faceDeg:+(face*180/Math.PI).toFixed(1),yawFromFaceDeg:sh&&sh.yawDeg,lookUpDeg:sh&&sh.lookUpDeg,armM:sh&&+sh.armM.toFixed(2),searchMs:Date.now()-t0});}
 const head=[feet[0],feet[1]+1.45,feet[2]],chest=[feet[0],feet[1]+1.05,feet[2]];
 const vis=F.STAR_RING_LOCAL.filter(q=>{const s=F.ndc(NEW.position,NEW.target,NEW.fovVerticalDeg,320,568,q);return s&&Math.abs(s[0])<=1&&Math.abs(s[1])<=1;});
 const ringSeen=vis.filter(q=>!blocked(NEW.position,q,RING_SELF)).length,cl=minClear(NEW.position);
 const fa=fill(NEW,390,844),fb=fill(OLD,390,844);
 ok('F3',cl.m>=1.1&&!blocked(NEW.position,head)&&!blocked(NEW.position,chest)&&ringSeen>=1,{meshClearM:+cl.m.toFixed(2),nearest:cl.nm,headBlockedBy:blocked(NEW.position,head),chestBlockedBy:blocked(NEW.position,chest),ringSamplesOnScreen:vis.length,ringSamplesSeen:ringSeen,
  meshFillPct_390x844:{before:+(fb*100).toFixed(1),after:+(fa*100).toFixed(1)},oldMeshClearM:+minClear(OLD.position).m.toFixed(2)});
 // F4 approach from the walk lens
 {const from=C.followPose(feet,face,390,844,8),ap=F.skyFinaleApproach(from,NEW,feet,B),Ts=ap.T,dt=1/60;let prevY=null,prevV=0,pk=0,pkA=0,ins=0,run=[0,0],mx=[0,0],jump=0,prevP=null,minC=Infinity,startC=Infinity;const vy=[];
  const yawOf=p=>Math.atan2(p.target[0]-p.position[0],p.target[2]-p.position[2])*180/Math.PI;
  for(let k=0;k<=Math.ceil(Ts/dt)+30;k++){const p=F.skyFinaleApproachPose(from,NEW,feet,Math.min(Ts,k*dt),Ts,ap.dir),y=yawOf(p);
   if(prevY!==null){let d=y-prevY;while(d>180)d-=360;while(d<-180)d+=360;const v=Math.abs(d)/dt;vy.push(v);pk=Math.max(pk,v);pkA=Math.max(pkA,Math.abs(v-prevV)/dt);prevV=v;}prevY=y;
   if(B.some(b=>p.position.every((v,i)=>v>b.min[i]&&v<b.max[i])))ins++;if(prevP)jump=Math.max(jump,Math.hypot(...sub(p.position,prevP)));prevP=p.position;
   const o=LA.herOcclusion(p.position,feet,B);[o.face,o.chest].forEach((h,j)=>{run[j]=h?run[j]+dt:0;mx[j]=Math.max(mx[j],run[j]);});
   if(k%3===0){const m=minClear(p.position);if(k===0)startC=m.m;if(process.env.DBG)console.error(k*dt,m.m.toFixed(2),m.nm);minC=Math.min(minC,m.m);}}
  ok('F4',pk<=90&&pkA<=200&&ins===0&&minC>=Math.min(1.1,startC)-0.01&&mx[0]<=0.5&&mx[1]<=0.5&&jump<=0.5,{approachS:+Ts.toFixed(2),wayRound:ap.dir,yawPeakDegS:+pk.toFixed(1),yawAccPeakDegS2:+pkA.toFixed(0),lensInBoxFrames:ins,faceS:+mx[0].toFixed(2),chestS:+mx[1].toFixed(2),maxStepM:+jump.toFixed(3),minMeshClearM:+minC.toFixed(2),walkLensStartClearM:+startC.toFixed(2)});}
 // F5 auto-continue + WindWipe hand-off (source contract; the stage methods are Cocos-bound)
 {const st=fs.readFileSync(X.S('world-r2/RegionNodeStage.ts'),'utf8'),co=fs.readFileSync(X.S('world-r2/WorldNativeComposition.ts'),'utf8');
  const pf=(st.match(/async playFinale\([\s\S]*?\n \}/)||[''])[0];
  const checks={holdS:F.SKY_FINALE.holdS===5.5&&F.SKY_FINALE.approachS===1.4,countdownAfterEaseIn:/await this\.blendPath\(ap\.T/.test(pf)&&/await stage\.playFinale\([\s\S]{0,400}armFinaleContinue/.test(co),armedAfterReward:/mainlineReward\('claimRegion',index\);if\(\(r as any\)\?\.ok!==false\)try\{stage\.armFinaleContinue\?\.\(\(\)=>\{void this\.enterMainline\(\);\}\)/.test(co),
   inputDisarms:/if\(this\.finaleArm&&\(gesture==='drag'\|\|gesture==='pinch'\|\|gesture==='tap'\)\)this\.disarmFinale\(\)/.test(st),
   wipeHooks:/onWipeCovered\(\(\)=>this\.disarmFinale\(\)\),addWipeBeforeReveal\(\(\)=>!this\.anim\),onWipeRevealed\(/.test(st),
   noBlackOfOurs:!/fadeCover|screenCover\(/.test(st.slice(st.indexOf('async playFinale'),st.indexOf('private wipeHooks'))),bakedPoseUsed:/skyFinalePose\(\)/.test(st),orbitApproach:/blendPath\(ap\.T,t=>skyFinaleApproachPose\(from,shot,g,t,ap\.T,ap\.dir\)\)/.test(st)};
  ok('F5',Object.values(checks).every(Boolean),{holdS:F.SKY_FINALE.holdS,...checks});}
 console.log(JSON.stringify({test:'t02_sky_final',ok:all,...res},null,1));process.exit(all?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
