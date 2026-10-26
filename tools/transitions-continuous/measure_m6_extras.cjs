'use strict';
// NOT_ENGINE M6 extras (运镜bot): RegionNodeStage.frame() meadow QA shot (follow 'walk/look base' + finale base) and M6→B1 start blend,
// her face/chest occlusion vs meadow obstacle triangles (windmill_static, fences, trees, bells, river), lens clearance, her share.
const ROOT=process.argv[2];process.chdir(ROOT);
const R=require(ROOT+'/tools/journey-integration/route/route-legs.cjs'),J=R.J,{add,sub,rotY}=J;
const G=require(ROOT+'/tools/meadow-walk/lib/meadow-geo.cjs');
const N=J.H.load(J.S+'region/RegionNodes.ts').REGION_NODES,EC=J.H.load(J.S+'region/ExploreCameraCore.ts'),BC=J.H.load(J.S+'region/BasketCloseShot.ts');
const M6L=process.argv[3]?JSON.parse(process.argv[3]):N.meadow.nodes.find(n=>n.key==='M6').at,M5L=N.meadow.nodes.find(n=>n.key==='M5').at,M4L=N.meadow.nodes.find(n=>n.key==='M4').at;
const W=p=>add(rotY(180,p),J.mOff),L=p=>rotY(-180,sub(p,J.mOff));
const tris=[];for(const n of G.obs){const t=n.tris;for(let o=0;o<t.length;o+=9)tris.push([n.name,t.slice(o,o+9)]);}
function segHit(a,b){const d=sub(b,a);let hit=null;for(const [nm,t] of tris){const v0=[t[0],t[1],t[2]],e1=sub([t[3],t[4],t[5]],v0),e2=sub([t[6],t[7],t[8]],v0);
 const p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-12)continue;
 const iv=1/det,s=sub(a,v0),u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])*iv;if(u<0||u>1)continue;const q=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]];
 const v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*iv;if(v<0||u+v>1)continue;const tt=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*iv;if(tt>1e-4&&tt<0.995){hit=nm;break;}}return hit;}
function ptTriMin(p,re){let best=9,who=null;for(const [nm,t] of tris){if(re&&!re.test(nm))continue;const xm=Math.min(t[0],t[3],t[6]),xM=Math.max(t[0],t[3],t[6]),zm=Math.min(t[2],t[5],t[8]),zM=Math.max(t[2],t[5],t[8]);
 if(xm>p[0]+best||xM<p[0]-best||zm>p[2]+best||zM<p[2]-best)continue;const d=require(ROOT+'/tools/meadow-walk/lib/meadow-geo.cjs')&&dist(p,t);if(d<best){best=d;who=nm;}}return [best,who];}
function dist(p,t){// point-triangle distance (closest point, Ericson)
 const a=[t[0],t[1],t[2]],b=[t[3],t[4],t[5]],c=[t[6],t[7],t[8]],dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return Math.hypot(...ap);
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return Math.hypot(...bp);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return Math.hypot(...sub(p,add(a,ab.map(x=>x*v))));}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return Math.hypot(...cp);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return Math.hypot(...sub(p,add(a,ac.map(x=>x*w))));}
 const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return Math.hypot(...sub(p,add(b,sub(c,b).map(x=>x*w))));}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return Math.hypot(...sub(p,add(a,add(ab.map(x=>x*v),ac.map(x=>x*w)))));}
const feetL=[M6L[0],G.floorAt(M6L[0],M6L[2])??M6L[1],M6L[2]],feetW=W(feetL);
function judge(pose){const lp=L(pose.position),face=add(feetL,[0,1.55,0]),chest=add(feetL,[0,1.2,0]);
 return {share:BC.herHeightFrac(pose,feetW),face:segHit(lp,face),chest:segHit(lp,chest),clr:ptTriMin(lp)[0],wmClr:ptTriMin(lp,/windmill/)[0]};}
const rows=[];
(async()=>{const geo=await R.geometry();
for(const scr of R.SCREENS){const [w,h]=scr;
 // frame(): she is reset standing at M6 with world yaw 0; follow = 'walk'-style lens, finale/look base = finalePose (no star ring in a meadow-only scene)
 for(const [id,p] of [['frame follow',EC.followPose(feetW,0,w,h,0)],['frame finale/look',EC.finalePose(feetW,0,w,h)]]){const j=judge(p);rows.push({shot:id,scr:scr.join('x'),sharePct:+(j.share*100).toFixed(1),faceOcc:j.face||'-',chestOcc:j.chest||'-',clrM:+j.clr.toFixed(2),windmillM:+j.wmClr.toFixed(2)});}
 // M6→B1: live followPose at M6 (heading M5→M6) min-jerk blended (6.38 s, live-start) onto the ride's first lenses; her standing at M6
 const leg=R.balloonLeg(geo,scr),m5=W(M5L),yaw=Math.atan2(feetW[0]-m5[0],feetW[2]-m5[2]),live=EC.followPose(feetW,yaw,w,h,0);
 const mj=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(u*(u*6-15)+10);};const lerp=(a,b,k)=>a.map((v,i)=>v+(b[i]-v)*k);
 let hid=0,face=0,minS=1,maxS=0,minC=9,minWm=9,who=new Set();const T=6.38,dt=1/30;
 for(let t=0;t<=T+1e-9;t+=dt){const r=leg.cam(t),k=mj(t/T),p={position:lerp(live.position,r.position,k),target:lerp(live.target,r.target,k),fovVerticalDeg:live.fovVerticalDeg+(r.fovVerticalDeg-live.fovVerticalDeg)*k};
  const j=judge(p);if(j.face||j.chest){hid+=dt;who.add(j.face||j.chest);}minS=Math.min(minS,j.share);maxS=Math.max(maxS,j.share);minC=Math.min(minC,j.clr);minWm=Math.min(minWm,j.wmClr);}
 rows.push({shot:'M6→B1 start blend',scr:scr.join('x'),sharePct:`${(minS*100).toFixed(1)}–${(maxS*100).toFixed(1)}`,faceOcc:hid?`${hid.toFixed(2)}s ${[...who]}`:'0 s',chestOcc:'',clrM:+minC.toFixed(2),windmillM:+minWm.toFixed(2)});}
console.log(JSON.stringify({M6local:M6L,feetW:feetW.map(v=>+v.toFixed(3))}));console.table(rows);require('fs').writeFileSync(process.argv[4]||'/tmp/m6m/out.json',JSON.stringify(rows));})().catch(e=>{console.error(e);process.exit(1);});
