#!/usr/bin/env node
// 场景特效bot r5 S3 (QA only, not shipped): 露底 / 地图边缘 exposure list over the camera poses the GAME can reach.
//
// Geometry, ray casting and the region list come from 运镜bot's free_cam_audit.cjs (compiled here, its main() cut off,
// BUNDLES redirectable so a baseline tree can be measured with today's pivots). The difference to that audit: the pose
// grid is the game's FreeOrbit, not the Y2 spec grid --
//   pitch  ORBIT_LIMITS[region].pitchMinDeg .. pitchMaxDeg (5 deg steps, both ends included)
//   dist   ORBIT_LIMITS[region].distMin .. distMax (geometric samples), look point feet + lookM, fov = fovDeg
//   solve  arm shortened to the first solid mesh hit - clearM (0.6, but >= 0.8 m from the look point), lens kept
//          >= feet.y + groundClearM (0.45) and inside exploreBox + 2 m (RegionNodeStage.regionBounds), as FreeOrbit.solve.
//          The game collides with AABBs, not meshes; this is the mesh version (can be slightly looser or tighter).
// Pivots: every REGION_NODES node and edge midpoint (lakeside: LAKESIDE_CAMERA_LAYOUT landing + walk points).
// Per pose: 8x14 frustum rays (aspect 0.75 = iPad, the widest screen), counts
//   under = upward ray ending on the top of a GROUND mesh (lens below the ground it sees, 岛底/地形下面)
//   void  = ray below the horizon that hits nothing (map edge / hole)
//   shell = ray on the back of the single-sided room shell.
//   node tools/scene-fx/exposure_audit.cjs --results results.json [--out <dir for the audit's own side files>] [--bundles <root>/creator-build-project/assets/bundles]
//        [--only island,meadow,skycity,lakeside] [--audit <free_cam_audit.cjs>]
//        [--extra extra.json]  QA prototyping: {region: {meshName: [[v0,v1,v2], ...]}} world triangles added before indexing
//        [--pitchMin curve.json]  {region: [[dist, pitchMinDeg], ...]} distance-dependent pitch floor (linear between points)
'use strict';
const fs=require('fs'),path=require('path'),Module=require('module');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const ROOT=path.resolve(__dirname,'../..');
const AUDIT=arg('--audit',process.env.FREE_CAM_AUDIT||'/workspace/yiqifengle/work/运镜bot-freecam/tools/camera-frame-test/free_cam_audit.cjs');
const EXTRA=arg('--extra',null)?JSON.parse(fs.readFileSync(arg('--extra'),'utf8')):{},CURVE=arg('--pitchMin',null)?JSON.parse(fs.readFileSync(arg('--pitchMin'),'utf8')):{};
const OUTF=arg('--results',null),BUNDLES=arg('--bundles',null),ONLY=(arg('--only','island,meadow,skycity,lakeside')).split(',');
if(!OUTF){console.error('need --results results.json');process.exit(2);}
let src=fs.readFileSync(AUDIT,'utf8').replace(/^#!.*\n/,'');
const MAIN='(async()=>{const t0=Date.now()';const cut=src.indexOf(MAIN);
const BUN="BUNDLES=path.join(ROOT,'creator-build-project/assets/bundles')";
if(cut<0||src.indexOf(BUN)<0){console.error('free_cam_audit.cjs changed: anchors not found in '+AUDIT);process.exit(3);}
src=src.slice(0,cut).replace(BUN,"BUNDLES=process.env.EXPO_BUNDLES||path.join(ROOT,'creator-build-project/assets/bundles')")+
  '\nmodule.exports={regions,buildIndex,frustumRays,orbitDir,req,REGION_NODES,D2R};\n';
if(BUNDLES)process.env.EXPO_BUNDLES=path.resolve(BUNDLES);
const fake=path.join(ROOT,'tools/camera-frame-test/free_cam_audit.cjs');
const m=new Module(fake,module);m.filename=fake;m.paths=Module._nodeModulePaths(path.dirname(fake));m._compile(src,fake);
const A=m.exports,{ORBIT_LIMITS,ORBIT_FEEL}=A.req('region/FreeOrbit');
const unit=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l];};
function dists(L){const n=L.distMax/L.distMin>8?6:5,out=[];for(let i=0;i<n;i++)out.push(+(L.distMin*Math.pow(L.distMax/L.distMin,i/(n-1))).toFixed(2));return out;}
function floorAt(c,d){if(d<=c[0][0])return c[0][1];for(let i=1;i<c.length;i++)if(d<=c[i][0]){const u=(d-c[i-1][0])/(c[i][0]-c[i-1][0]);return c[i-1][1]+(c[i][1]-c[i-1][1])*u;}return c[c.length-1][1];}
function pitches(L){const out=[L.pitchMinDeg];for(let p=Math.ceil(L.pitchMinDeg/5)*5;p<L.pitchMaxDeg;p+=5)if(p>L.pitchMinDeg)out.push(p);out.push(L.pitchMaxDeg);return out;}
(async()=>{const t0=Date.now(),all=await A.regions(),out={about:'exposure_audit.cjs (场景特效bot). See header.',bundles:process.env.EXPO_BUNDLES||'worktree',regions:{}};
  for(const reg of all){if(!ONLY.includes(reg.id))continue;const L=ORBIT_LIMITS[reg.id];if(!L)continue;
    if(EXTRA[reg.id])Object.keys(EXTRA[reg.id]).forEach(n=>{reg.meshes[n]=(reg.meshes[n]||[]).concat(EXTRA[reg.id][n]);});
    const I=A.buildIndex(reg.meshes,reg.cell),t1=Date.now(),box=A.REGION_NODES[reg.id]?A.REGION_NODES[reg.id].exploreBox:null,poses=[];
    const P=pitches(L),D=dists(L);
    for(const pv of reg.pivots){const feet=pv.at,look=[feet[0],feet[1]+L.lookM,feet[2]];
      for(const p of P)for(let a=0;a<360;a+=10){const u0=A.orbitDir(a,p),hit=I.ray(look,u0,L.distMax+2,2),tFree0=hit?hit.t:1e9;
        for(const d0 of D){let u=u0,tFree=tFree0,pe=p;if(CURVE[reg.id]){pe=Math.max(p,floorAt(CURVE[reg.id],d0));if(pe!==p){u=A.orbitDir(a,pe);const h2=I.ray(look,u,L.distMax+2,2);tFree=h2?h2.t:1e9;}}
          let d=Math.min(d0,Math.max(0.8,tFree-ORBIT_FEEL.clearM));let cam=[look[0]+u[0]*d,look[1]+u[1]*d,look[2]+u[2]*d];
          if(box){const mg=2;let push=0;if(cam[0]<box[0]-mg)push=Math.max(push,(box[0]-mg-cam[0])/Math.max(1e-3,Math.abs(u[0])));if(cam[0]>box[2]+mg)push=Math.max(push,(cam[0]-box[2]-mg)/Math.max(1e-3,Math.abs(u[0])));
            if(cam[2]<box[1]-mg)push=Math.max(push,(box[1]-mg-cam[2])/Math.max(1e-3,Math.abs(u[2])));if(cam[2]>box[3]+mg)push=Math.max(push,(cam[2]-box[3]-mg)/Math.max(1e-3,Math.abs(u[2])));
            if(push>0){d=Math.max(0.8,d-push-0.05);cam=[look[0]+u[0]*d,look[1]+u[1]*d,look[2]+u[2]*d];}}
          if(cam[1]<feet[1]+ORBIT_FEEL.groundClearM)cam[1]=feet[1]+ORBIT_FEEL.groundClearM;
          const fwd=unit([look[0]-cam[0],look[1]-cam[1],look[2]-cam[2]]),RR=A.frustumRays(fwd,L.fovDeg,0.75,8,14);
          let un=0,vo=0,sh=0;const who={};
          for(const r of RR){const h=I.ray(cam,r,400,1);if(h){if(h.back){sh++;who[h.name]=(who[h.name]||0)+1;}if(h.under){un++;who[h.name]=(who[h.name]||0)+1;}}else if(r[1]<-0.03)vo++;}
          const n=RR.length,s={pv:pv.id,a,p,pe,d:d0,dUse:+d.toFixed(2),cam:cam.map(v=>+v.toFixed(3)),look:look.map(v=>+(+v).toFixed(3)),fov:L.fovDeg,
            under:+(un/n).toFixed(3),void:+(vo/n).toFixed(3),shell:+(sh/n).toFixed(3)};
          s.score=+(s.under+s.void+s.shell).toFixed(3);if(s.score>0)s.who=Object.keys(who).sort((x,y)=>who[y]-who[x]).slice(0,3);poses.push(s);}}}
    const bad=poses.filter(s=>s.under>0.02||s.void>0.02||s.shell>0.02);
    out.regions[reg.id]={limits:L,pitches:P,dists:D,pivots:reg.pivots.map(p=>p.id),poses:poses.length,bad:bad.length,
      badUnder:bad.filter(s=>s.under>0.02).length,badVoid:bad.filter(s=>s.void>0.02).length,badShell:bad.filter(s=>s.shell>0.02).length,samples:poses};
    console.log(`${reg.id}: ${poses.length} poses, bad ${bad.length} (under ${out.regions[reg.id].badUnder}, void ${out.regions[reg.id].badVoid}, shell ${out.regions[reg.id].badShell}), ${((Date.now()-t1)/1000).toFixed(1)} s`);}
  fs.writeFileSync(OUTF,JSON.stringify(out));console.log('wrote',OUTF,((Date.now()-t0)/1000).toFixed(1),'s');})().catch(e=>{console.error(e);process.exit(1);});
