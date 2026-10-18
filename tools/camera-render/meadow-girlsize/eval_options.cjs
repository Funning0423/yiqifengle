#!/usr/bin/env node
'use strict';
/**
 * r5 meadow girl-size options (PREP): numbers for docs/r5/meadow-girlsize/RESULT.md and the Blender shot list.
 * node eval_options.cjs OUT_METRICS.json OUT_SHOTS.json
 * Model / board-rig coordinates (MeadowBoardBackground mounts env_meadow.glb unrotated).
 */
const fs=require('node:fs'),path=require('node:path');
const {load,ROOT}=require('../../region-nodes/load.cjs');
const {load:loadGlb}=require('../../journey-integration/occlusion/lib-glb.cjs');
const O=load('region/MeadowGirlSizeOptions.ts'),RB=load('region/RegionBoardLanding.ts'),BL=load('ui/BoardLayout.ts'),N=load('region/RegionNodes.ts'),C=load('region/ExploreCameraCore.ts');
const SCREENS=[[390,844],[360,780],[768,1024]],NODES=['M1','M2','M3','M4'],OPTS=['off','A','B','C','D'];
const SKIP=/^(meadow_sky_dome|meadow_clouds_near|meadow_far_hills)$/;
const mesh=loadGlb(path.join(ROOT,'creator-build-project/assets/bundles/region_meadow/env_meadow.glb')).filter(n=>n.tris&&n.tris.length);
const flat=mesh.filter(n=>!SKIP.test(n.name));let solid=flat;const dome=mesh.filter(n=>n.name==='meadow_sky_dome'),mill=mesh.filter(n=>/^windmill_(static_merged|sails)$/.test(n.name));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
function ray(o,d,a,b,c){const e1=sub(b,a),e2=sub(c,a),p=cross(d,e2),det=dot(e1,p);if(Math.abs(det)<1e-9)return -1;const iv=1/det,tv=sub(o,a),u=dot(tv,p)*iv;if(u<0||u>1)return -1;const q=cross(tv,e1),v=dot(d,q)*iv;if(v<0||u+v>1)return -1;return dot(e2,q)*iv;}
function firstHit(o,d,list,maxT){let best=null;for(const m of list){const t=m.tris;for(let i=0;i<t.length;i+=9){const k=ray(o,d,[t[i],t[i+1],t[i+2]],[t[i+3],t[i+4],t[i+5]],[t[i+6],t[i+7],t[i+8]]);if(k>1e-4&&k<maxT&&(!best||k<best.t))best={t:k,name:m.name};}}return best;}
function triDist(o,a,b,c){const ab=sub(b,a),ac=sub(c,a),ao=sub(o,a),d1=dot(ab,ao),d2=dot(ac,ao);if(d1<=0&&d2<=0)return len(ao);const bo=sub(o,b),d3=dot(ab,bo),d4=dot(ac,bo);if(d3>=0&&d4<=d3)return len(bo);const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const k=d1/(d1-d3);return len(sub(o,[a[0]+ab[0]*k,a[1]+ab[1]*k,a[2]+ab[2]*k]));}const co=sub(o,c),d5=dot(ab,co),d6=dot(ac,co);if(d6>=0&&d5<=d6)return len(co);const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const k=d2/(d2-d6);return len(sub(o,[a[0]+ac[0]*k,a[1]+ac[1]*k,a[2]+ac[2]*k]));}const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const k=(d4-d3)/((d4-d3)+(d5-d6));return len(sub(o,[b[0]+(c[0]-b[0])*k,b[1]+(c[1]-b[1])*k,b[2]+(c[2]-b[2])*k]));}const den=1/(va+vb+vc),v=vb*den,w=vc*den;return len(sub(o,[a[0]+ab[0]*v+ac[0]*w,a[1]+ab[1]*v+ac[1]*w,a[2]+ab[2]*v+ac[2]*w]));}
function clearance(o){let best=1e9,who='';for(const m of solid){const t=m.tris;for(let i=0;i<t.length;i+=9){if(Math.min(Math.abs(t[i]-o[0]),Math.abs(t[i+3]-o[0]),Math.abs(t[i+6]-o[0]))>best)continue;const d=triDist(o,[t[i],t[i+1],t[i+2]],[t[i+3],t[i+4],t[i+5]],[t[i+6],t[i+7],t[i+8]]);if(d<best){best=d;who=m.name;}}}return {m:best,who};}
function occluded(pose,p){const d=sub(p,pose.position),D=len(d),h=firstHit(pose.position,unit(d),solid,D-0.15);return h?h.name:null;}
function voidFrac(pose,w,h){const f=unit(sub(pose.target,pose.position)),r=unit([-f[2],0,f[0]]),u=cross(r,f),tv=Math.tan(pose.fovVerticalDeg*Math.PI/360),asp=w/h;let n=0,v=0;
 for(let j=0;j<10;j++)for(let i=0;i<5;i++){const x=((i+.5)/5*2-1)*tv*asp,y=((j+.5)/10*2-1)*tv;const d=unit([f[0]+r[0]*x+u[0]*y,f[1]+r[1]*x+u[1]*y,f[2]+r[2]*x+u[2]*y]);n++;if(!firstHit(pose.position,d,solid.concat(dome),2000))v++;}return v/n;}
function ndc(pose,p,w,h){const f=unit(sub(pose.target,pose.position)),r=unit([-f[2],0,f[0]]),u=cross(r,f),tv=Math.tan(pose.fovVerticalDeg*Math.PI/360),q=sub(p,pose.position),z=dot(q,f);return [dot(q,r)/(z*tv*w/h),dot(q,u)/(z*tv),z];}
/** F7b-style bearing of the lens from her vs her facing (faceDeg 180 → -Z): ≤ 0 = behind or on her right. */
function bearing(pose,foot){const hx=0,hz=-1,vx=pose.position[0]-foot[0],vz=pose.position[2]-foot[2],back=-(vx*hx+vz*hz),right=vx*(-hz)+vz*hx;return Math.atan2(-right,back)*180/Math.PI;}
function blendPeak(from,to,seconds){const b=RB.poseBlend(from,to,seconds);let prev=null,w=0,a=0,pw=0;for(let t=0;t<=seconds+1e-9;t+=1/60){const p=b(t),d=unit(sub(p.target,p.position));if(prev){const ang=Math.acos(Math.max(-1,Math.min(1,dot(prev,d))))*180/Math.PI*60;a=Math.max(a,Math.abs(ang-pw)*60);w=Math.max(w,ang);pw=ang;}prev=d;}return {wDegS:+w.toFixed(1),aDegS2:+a.toFixed(0),gap:RB.poseGap(from,to)};}
/** D: world bent radially about her (cx,cz), radius R; sky dome / near clouds / far hills untouched. mode 'cyl' = z-only (for the turn test). */
const bendP=(p,b)=>b?[p[0],p[1]-(b.mode==='cyl'?(p[2]-b.cz)**2:(p[0]-b.cx)**2+(p[2]-b.cz)**2)/(2*b.R),p[2]]:p;
const bentCache={};function bentSolid(b){const key=b.mode+b.cx+','+b.cz;if(!bentCache[key])bentCache[key]=flat.map(m=>{const t=Float64Array.from(m.tris);for(let i=0;i<t.length;i+=3)t[i+1]=bendP([t[i],t[i+1],t[i+2]],b)[1];return {name:m.name,tris:t};});return bentCache[key];}
const node=k=>N.REGION_NODES.meadow.nodes.find(n=>n.key===k);
const millC=[0,12.5,-27.5];
const rows=[],shots=[];
for(const [w,h] of SCREENS){const safe=BL.boardSafeInsets(w,h),ui=RB.girlStandUi(w,h,safe);
 for(const k of NODES){const n=node(k),foot=n.at;
  // follow pose she arrives with (last segment heading of the edge into this node); M1 = sail arrival end (boardPose) so no follow blend
  const e=N.REGION_NODES.meadow.edges.find(x=>x.b===k&&x.a!=='M0'),pts=e?e.path:null,yaw=pts?Math.atan2(pts[pts.length-1][0]-pts[pts.length-2][0],pts[pts.length-1][2]-pts[pts.length-2][2]):Math.PI;
  const follow=C.followPose(foot,yaw,w,h);
  for(const o of OPTS){
   const poses=o==='C'?[['C0',O.meadowGirlSizePush(foot,w,h,safe,0)],['C',O.meadowGirlSizePush(foot,w,h,safe,O.MEADOW_GIRLSIZE.cPushS)]]:[[o,O.meadowGirlSizePose(o,foot,w,h,safe)]];
   for(const [id,pose] of poses){const bend=id==='D'?{mode:'sphere',cx:foot[0],cz:foot[2],R:O.MEADOW_GIRLSIZE.dBendR}:null;solid=bend?bentSolid(bend):flat;
    const b=RB.girlBoxPt(pose,foot,w,h);let gap=Infinity,cover=false;
    for(const q of ui){const ox=Math.min(b.r,q.r)-Math.max(b.l,q.l),oy=Math.min(b.b,q.b)-Math.max(b.t,q.t);if(ox>0&&oy>0)cover=true;else gap=Math.min(gap,Math.hypot(Math.max(q.l-b.r,b.l-q.r,0),Math.max(q.t-b.b,b.t-q.b,0)));}
    gap=Math.min(gap,b.l,w-b.r,b.t,h-b.b);
    const cl=clearance(pose.position),head=occluded(pose,[foot[0],foot[1]+1.6,foot[2]]),chest=occluded(pose,[foot[0],foot[1]+1.1,foot[2]]);
    const m=ndc(pose,bendP(millC,bend),w,h);
    const row={screen:w+'x'+h,node:k,option:id,heightFrac:+((b.b-b.t)/h).toFixed(4),boxPt:[b.l,b.t,b.r,b.b].map(v=>+v.toFixed(1)),covered:cover,uiGapPt:cover?-1:+gap.toFixed(1),
     distM:+len(sub(pose.position,[foot[0],foot[1]+0.86,foot[2]])).toFixed(2),fovDeg:+pose.fovVerticalDeg.toFixed(2),clearM:+cl.m.toFixed(2),clearWho:cl.who,headOccluder:head,chestOccluder:chest,
     void:voidFrac(pose,w,h),windmillNdc:m.map(v=>+v.toFixed(2)),windmillInFrame:m[2]>0&&Math.abs(m[0])<=1&&Math.abs(m[1])<=1,lensBearingDeg:+bearing(pose,foot).toFixed(1),
     followToBoard:k==='M1'?null:blendPeak(follow,pose,C.BLEND_S.followToBoard),boardToFollow:k==='M4'?blendPeak(pose,C.followPose(foot,Math.atan2(0,-4),w,h),C.BLEND_S.boardToFollow):null};
    rows.push(row);
    if(k==='M1'||(k==='M4'&&w===390))shots.push({name:k+'_'+w+'x'+h+'_'+id,node:k,w,h,foot,faceDeg:n.faceDeg,cam:pose,ui,box:row.boxPt,bend});
   }
  }
 }
}
solid=flat;
// D free-view turn test: orbit her at M1, 9 m (draft spec max; ORBIT_LIMITS today 3.2–14 m), pitch 25°, three yaws; flat vs sphere vs cylinder.
const free=[];{const n=node('M1'),foot=n.at,R=O.MEADOW_GIRLSIZE.dBendR,w=390,h=844;
 for(const yaw of [0,90,225])for(const dist of [9,14]){const pr=25*Math.PI/180,ay=yaw*Math.PI/180,c=[foot[0],foot[1]+0.86,foot[2]];
  const pose={position:[c[0]+Math.sin(ay)*dist*Math.cos(pr),c[1]+dist*Math.sin(pr),c[2]+Math.cos(ay)*dist*Math.cos(pr)],target:c,fovVerticalDeg:49.43};
  for(const mode of ['none','sphere','cyl']){const bend=mode==='none'?null:{mode,cx:foot[0],cz:foot[2],R};solid=bend?bentSolid(bend):flat;const b=RB.girlBoxPt(pose,foot,w,h),m=ndc(pose,bendP(millC,bend),w,h);
   const r={yaw,dist,mode,heightFrac:+((b.b-b.t)/h).toFixed(4),clearM:+clearance(pose.position).m.toFixed(2),void:voidFrac(pose,w,h),windmillNdc:m.map(v=>+v.toFixed(2)),camGroundDropM:bend?+((mode==='cyl'?(pose.position[2]-foot[2])**2:(pose.position[0]-foot[0])**2+(pose.position[2]-foot[2])**2)/(2*R)).toFixed(2):0};free.push(r);
   console.log('free',yaw,dist,mode,(r.heightFrac*100).toFixed(1)+'%','cl',r.clearM,'void',r.void,'mill',r.windmillNdc.join(','),'drop@cam',r.camGroundDropM);
   if(dist===9)shots.push({name:'free_M1_yaw'+yaw+'_'+mode,node:'M1',w,h,foot,faceDeg:n.faceDeg,cam:pose,ui:[],box:[b.l,b.t,b.r,b.b],bend});}}}
solid=flat;rows.push({freeView:free});
fs.writeFileSync(process.argv[2],JSON.stringify(rows,null,1));
fs.writeFileSync(process.argv[3],JSON.stringify({shots},null,1));
for(const r of rows)if(r.screen)console.log([r.screen,r.node,r.option,(r.heightFrac*100).toFixed(1)+'%','gap',r.uiGapPt,'cl',r.clearM,r.headOccluder||'-',r.chestOccluder||'-','void',r.void,'mill',r.windmillInFrame,'brg',r.lensBearingDeg,r.followToBoard?'f2b '+r.followToBoard.wDegS+'°/s '+r.followToBoard.gap.positionM.toFixed(1)+'m':'',r.boardToFollow?'b2f '+r.boardToFollow.wDegS+'°/s '+r.boardToFollow.gap.positionM.toFixed(1)+'m':''].join(' '));
