#!/usr/bin/env node
'use strict';
/** full8 P1-a: synthetic "new pose" trace = the m2 Mac prewalk/B1 poses passed through LensClear.lensClearStep with MeadowLensBoxes
 *  in the runtime meadow frame (rotY 180 + J.mOff, same frame collision-gate.cjs uses). Usage: make_cleared_trace.cjs <in> <out> */
const fs=require('fs'),path=require('path');
const L=require('../transitions/sail_farsea_lib.cjs');
const LC=L.load('region/LensClear.ts'),RW=L.load('region/RegionWalkable.ts',s=>s.includes('RegionWalkableData')?L.load('region/RegionWalkableData.ts'):{}),MB=L.load('region/MeadowLensBoxes.ts'),LV=L.load('region/LensVoxels.ts',s=>s.includes('MeadowLensVoxels')?L.load('region/MeadowLensVoxels.ts'):s.includes('MeadowLensBoxes')?MB:{}),J=require('../journey-integration/journey-scene.cjs');
const rotY=(d,p)=>{const t=d*Math.PI/180,c=Math.cos(t),s=Math.sin(t);return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]];};
const toW=p=>{const r=rotY(180,p);return [r[0]+J.mOff[0],r[1]+J.mOff[1],r[2]+J.mOff[2]];};
const boxes=[];for(const list of [MB.MEADOW_LENS_BOXES.windmill_sails]/* full8: sails sweep disc; everything else = occupancy grid */)for(const b of list){const m=[1e9,1e9,1e9],M=[-1e9,-1e9,-1e9];
 for(const x of [b[0],b[3]])for(const y of [b[1],b[4]])for(const z of [b[2],b[5]]){const w=toW([x,y,z]);for(let k=0;k<3;k++){m[k]=Math.min(m[k],w[k]);M[k]=Math.max(M[k],w[k]);}}boxes.push([...m,...M]);}
const unW=w=>{const p=[w[0]-J.mOff[0],w[1]-J.mOff[1],w[2]-J.mOff[2]];return rotY(-180,p);};
const ground=w=>{const l=unW(w),f=RW.walkFloorY('meadow',l[0],l[2]);return f===null?null:f+J.mOff[1];};
const grid=LV.meadowVox(),solid=(w,c)=>LV.voxClear(grid,unW(w),c);
const [inp,out]=process.argv.slice(2),st={pull:0};let last=null,n=0,moved=0;
const lines=fs.readFileSync(inp,'utf8').split('\n').map(l=>{const m=l.match(/^(.*\[QF_CAM_TRACE\] f=\d+ t=)([\d.]+) pos=([-\d.e,]+) yaw=([-\d.e]+) pitch=([-\d.e]+)(.*? w=BalloonTransit:(?:prewalk|B1)\b.*)$/);if(!m)return l;
 const t=+m[2],p=m[3].split(',').map(Number),y=+m[4]*Math.PI/180,pi=+m[5]*Math.PI/180,f=[-Math.sin(y)*Math.cos(pi),Math.sin(pi),-Math.cos(y)*Math.cos(pi)],D=6;
 const dt=last===null?0:Math.max(0,t-last);last=t;const pose={position:p,target:[p[0]+f[0]*D,p[1]+f[1]*D,p[2]+f[2]*D]};
 const st0=st.pull;const q=LC.lensClearStep(pose,boxes,dt,st,undefined,ground,solid).position;if(!solid(q,1.1)){st.bad=(st.bad||0)+1;}n++;if(Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])>1e-6)moved++;
 return m[1]+m[2]+' pos='+q.map(v=>+v.toFixed(3)).join(',')+' yaw='+m[4]+' pitch='+m[5]+m[6];});
fs.writeFileSync(out,lines.join('\n'));console.log(JSON.stringify({unclear:st.bad||0,poses:n,pulledIn:moved,boxes:boxes.length}));
