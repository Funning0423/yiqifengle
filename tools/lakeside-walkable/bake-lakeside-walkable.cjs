#!/usr/bin/env node
'use strict';
/**
 * Bake the 风铃湖畔 explore walkable area from the real r5h3 export (bundles/region_lakeside: scene_r5h_slim_transforms.json +
 * models/*.glb). Same grid rules as tools/region-nodes/bake-region-nodes.cjs (floor |ny|/len > 0.72, STEP 0.36 per 0.4 m,
 * headroom 1.7 m, low clearance 0.3 m), plus the water rule: a floor sample at or below the lake surface (LK_lake, y=0) + 0.05 m
 * is water, never walkable. Two seeds: her landing stop and the LK_bridge deck; the two shores are separate pieces (water between), the runtime path
 * search never crosses water, so a tap on the far side is answered 'unreachable'. Floors: LK_terrain (grass / shore), LK_bridge + LK_bridge_steps (boardwalk bridge), LK_porch_steps,
 * LK_pavilion deck. Flood-filled from her landing stop (LAKESIDE_CAMERA_LAYOUT.stopLocal), so islands of grass she cannot reach drop out.
 * Output: creator-build-project/assets/scripts/region/LakesideWalkableData.ts (bit mask + cm heights, base64) and
 *         tools/lakeside-walkable/lakeside-walkable.json (stats).   Usage: node bake-lakeside-walkable.cjs [--check]
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {load}=require('../journey-integration/occlusion/lib-glb.cjs');
const ROOT=path.resolve(__dirname,'../..');
const BUNDLE=path.join(ROOT,'creator-build-project/assets/bundles/region_lakeside');
const OUT_TS=path.join(ROOT,'creator-build-project/assets/scripts/region/LakesideWalkableData.ts');
const OUT_JSON=path.join(__dirname,'lakeside-walkable.json');
const STEP=.36,HEAD=1.7,LOW=.3,C=.4,BOX=[-40,-30,40,52],WATER_Y=0,WATER_EPS=.05,START=[3.2531,.5714,25.0904],BRIDGE=[0,3.5,0];
const FLOOR=/^LK_(terrain|bridge|bridge_steps|porch_steps|pavilion)\.glb$/;
const SOLID=/^LK_(house_[ABC]|tree_conifer|tree_round|rock|barrel|bush|lantern|chime_post|clothesline|pavilion|flowerpot|windchime|bridge)\.glb$/;
function quatMat(q,s,t){const [x,y,z,w]=q,[sx,sy,sz]=s;return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,t[0],t[1],t[2],1];}
const xf=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
function bake(){
 const tf=JSON.parse(fs.readFileSync(path.join(BUNDLE,'scene_r5h_slim_transforms.json'),'utf8'));
 const [x0,z0,x1,z1]=BOX,W=Math.ceil((x1-x0)/C),H=Math.ceil((z1-z0)/C);
 const floors=Array.from({length:W*H},()=>[]),solids=Array.from({length:W*H},()=>[]);
 const cell=(x,z)=>{const gx=Math.floor((x-x0)/C),gz=Math.floor((z-z0)/C);return gx<0||gz<0||gx>=W||gz>=H?-1:gz*W+gx;};
 const meshCache=new Map(),hash=crypto.createHash('sha256');hash.update(fs.readFileSync(path.join(BUNDLE,'scene_r5h_slim_transforms.json')));
 const used=new Set();
 for(const inst of tf.instances){
  const isF=FLOOR.test(inst.glb),isS=SOLID.test(inst.glb);if(!isF&&!isS)continue;if(inst.group==='board')continue;
  if(!meshCache.has(inst.glb)){const f=path.join(BUNDLE,'models',inst.glb);meshCache.set(inst.glb,load(f));used.add(inst.glb);}
  const M=quatMat(inst.rot_quat_xyzw,inst.scale,inst.pos);
  for(const n of meshCache.get(inst.glb)){if(!n.tris)continue;const t=n.tris;
   for(let k=0;k<t.length;k+=9){const A=xf(M,[t[k],t[k+1],t[k+2]]),B=xf(M,[t[k+3],t[k+4],t[k+5]]),Cc=xf(M,[t[k+6],t[k+7],t[k+8]]);
    const e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[Cc[0]-A[0],Cc[1]-A[1],Cc[2]-A[2]];
    const nx=e1[1]*e2[2]-e1[2]*e2[1],ny=e1[2]*e2[0]-e1[0]*e2[2],nz=e1[0]*e2[1]-e1[1]*e2[0],up=Math.abs(ny)/(Math.hypot(nx,ny,nz)||1);
    const L=Math.max(Math.hypot(...e1),Math.hypot(...e2),Math.hypot(Cc[0]-B[0],Cc[1]-B[1],Cc[2]-B[2])),N=Math.max(1,Math.ceil(L/(C*.5)));
    for(let i=0;i<=N;i++)for(let j=0;j<=N-i;j++){const u=i/N,v=j/N,x=A[0]+e1[0]*u+e2[0]*v,y=A[1]+e1[1]*u+e2[1]*v,z=A[2]+e1[2]*u+e2[2]*v,ci=cell(x,z);if(ci<0)continue;
     if(isF&&up>.72)floors[ci].push(y);if(isS&&!(isF&&up>.72))solids[ci].push(y);}}}
 }
 for(const g of [...used].sort())hash.update(fs.readFileSync(path.join(BUNDLE,'models',g)));
 // one walk layer per cell: the highest floor (bridge deck over water wins over the lake bed / terrain under it)
 const top=floors.map(a=>a.length?Math.max(...a):null);
 const water=top.map(y=>y===null||y<=WATER_Y+WATER_EPS);
 const ok=top.map((y,ci)=>{if(y===null||water[ci])return false;for(const q of solids[ci])if(q>y+LOW&&q<y+HEAD)return false;return true;});
 const s=cell(START[0],START[2]);if(s<0||!ok[s])throw Error('start-not-walkable '+s);
 // seeds: her landing stop (near grass shore) and the boardwalk bridge deck (far shore + LK_bridge, across the water)
 const b0=cell(BRIDGE[0],BRIDGE[2]);if(b0<0||!ok[b0])throw Error('bridge-not-walkable');
 const reach=new Uint8Array(W*H),q=[s,b0];reach[s]=1;reach[b0]=2;
 for(let qi=0;qi<q.length;qi++){const ci=q[qi],gx=ci%W,gz=(ci/W)|0,y=top[ci];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=gx+dx,nz=gz+dz;if(nx<0||nz<0||nx>=W||nz>=H)continue;const nc=nz*W+nx;
   if(reach[nc]||!ok[nc]||Math.abs(top[nc]-y)>STEP*Math.hypot(dx,dz))continue;
   if(dx&&dz&&(!ok[gz*W+nx]||!ok[nz*W+gx]))continue; // no corner cutting past water
   reach[nc]=reach[ci];q.push(nc);}}
 const bits=Buffer.alloc(Math.ceil(W*H/8)),hts=[];let n=0,bridge=0;
 for(let ci=0;ci<W*H;ci++)if(reach[ci]){bits[ci>>3]|=1<<(ci&7);hts.push(Math.round(top[ci]*100));n++;if(reach[ci]===2)bridge++;}
 const hb=Buffer.alloc(hts.length*2);hts.forEach((h,i)=>hb.writeInt16LE(h,i*2));
 let waterCells=0;for(let ci=0;ci<W*H;ci++)if(top[ci]!==null&&water[ci])waterCells++;
 return {W,H,c:C,x0,z0,bits:bits.toString('base64'),heights:hb.toString('base64'),cells:n,raisedCells:bridge,waterCells,sha256:hash.digest('hex'),top,water,reach};
}
function ts(b){
 return ['/** Baked by tools/lakeside-walkable/bake-lakeside-walkable.cjs from bundles/region_lakeside (r5h3). Pure data, no cc. Do not edit by hand. */',
 `export const LAKESIDE_WALKABLE_DATA={sourceSha256:'${b.sha256}',x0:${b.x0},z0:${b.z0},c:${b.c},W:${b.W},H:${b.H},cells:${b.cells},waterY:0,`,
 ` bits:'${b.bits}',`,` heights:'${b.heights}'} as const;`,''].join('\n');}
if(require.main===module){
 const b=bake(),text=ts(b);
 if(process.argv.includes('--check')){if(fs.readFileSync(OUT_TS,'utf8')!==text){console.error('LAKESIDE WALKABLE DRIFT');process.exit(1);}console.log('check-ok',b.cells);process.exit(0);}
 fs.writeFileSync(OUT_TS,text);
 fs.writeFileSync(OUT_JSON,JSON.stringify({sourceSha256:b.sha256,box:BOX,c:C,W:b.W,H:b.H,walkableCells:b.cells,walkableM2:+(b.cells*C*C).toFixed(1),farShoreCells:b.raisedCells,nearShoreCells:b.cells-b.raisedCells,waterCellsInBox:b.waterCells,start:START},null,1));
 console.log('cells',b.cells,'m2',(b.cells*C*C).toFixed(1),'far(bridge side)',b.raisedCells,'water',b.waterCells,'bytes',text.length);
}
module.exports={bake,BOX,C,START};
