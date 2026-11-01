'use strict';
// 运镜bot r5 meadow pitch floor: before/after lens at the lowest pitch, ~4 m, from the real FreeOrbit (input path: pinch to
// the arm, drag fully down, settle). Before = FreeOrbit.ts @6eafc35f (git show), after = the working tree.
//   node pair_poses.cjs OUT.json [DIST=4] [YAW=180]   (cwd anywhere; QF_TYPESCRIPT_MODULE -> typescript)
// Girl at meadow node M2 (RegionNodes.ts, mainline-06, faceDeg 180); groundY = her feet (as RegionNodeStage.solve), no boxes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {load,ROOT}=require('../../region-nodes/load.cjs');
const out=process.argv[2],dist=+(process.argv[3]||4),yaw=+(process.argv[4]||180),feet=[-1.4,3.193,1.2];
const src=cp.execFileSync('git',['show','6eafc35f:creator-build-project/assets/scripts/region/FreeOrbit.ts'],{cwd:ROOT,encoding:'utf8'});
const bf=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'fo-base-')),'FreeOrbit.ts');fs.writeFileSync(bf,src);
const sha=cp.execFileSync('git',['rev-parse','--short=8','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
function pose(K,name,code){const o=new K.FreeOrbit('meadow');o.yaw=yaw;o.dist=dist;o.drag(0,0,1/60);o.drag(0,5,1/60);o.release();for(let i=0;i<180;i++)o.step(1/60);
 const raw=o.rawPose(feet),p=o.solve(feet,[],feet[1]);
 const d=[0,1,2].map(k=>p.target[k]-p.position[k]),n=Math.hypot(...d);
 return {name,code,yaw:o.yaw,pitch:+o.pitch.toFixed(3),dist:+o.dist.toFixed(3),position:p.position.map(v=>+v.toFixed(4)),target:p.target.map(v=>+v.toFixed(4)),fov:p.fovVerticalDeg,
  rawLensY:+raw.position[1].toFixed(4),groundClamped:Math.abs(raw.position[1]-p.position[1])>1e-6,viewPitchDeg:+(Math.asin(d[1]/n)*180/Math.PI).toFixed(3),lensAboveFeetM:+(p.position[1]-feet[1]).toFixed(3)}}
const r=[pose(load(bf),'before_6eafc35f','6eafc35f'),pose(load('region/FreeOrbit.ts'),'after_'+sha,sha)];
fs.writeFileSync(out,JSON.stringify({feet,faceDeg:180,node:'M2',poses:r},null,1));console.log(JSON.stringify(r,null,1));
