#!/usr/bin/env node
'use strict';
/* 彩虹桥 r5: bakes the ground under each REAL bridge end from the shipped GLBs, in the exact journey placement that
 * RegionJourneyAdapter uses (journey-scene.cjs / lakesideJourney). Output: creator-build-project/assets/scripts/region/RainbowBridgeGround.ts
 * (a 21×21 grid, 0.3 m step, ±3 m around the end; per cell: surface class + height in cm). test_rainbow_bridge_mesh.cjs
 * re-bakes and requires the shipped table to match, so a moved anchor / changed GLB / changed layout fails the suite.
 *   island   : bridge START of 04→05 and island→lakeside (islandApproach(exit_path_17)), frame 'world' (the island never moves).
 *              Replaces 场景设计部's stand-in-terrain island cap (no island GLB was found by them; the real island triangles are in
 *              the occlusion fixture = static_seat_preview/room/room_no_original_chair.glb).
 *   meadow   : bridge END of 04→05 (player_spawn of the placed env_meadow), frame 'end'.
 *   lakeside : bridge END of island→lakeside (toWorld(landingLocal)), frame 'end'.
 *   sky city : none yet — plan B §8.4 is not final (r5); its ends render without a cap.
 * Usage: node tools/rainbow-bridge/bake-ground.cjs [--write] */
const fs=require('node:fs'),path=require('node:path');
const HALF=3,STEP=.3,N=Math.round(2*HALF/STEP)+1;
function scene(){
 const J=require('../journey-integration/journey-scene.cjs');
 const LK=J.H.load(J.S+'region/LakesideCameraLayout.ts'),lk=LK.lakesideJourney(J.start);
 const LKS=require('../journey-integration/lakeside/lakeside-scene.cjs');
 const lake=LKS.instances().map(o=>{const t=new Float64Array(o.tris.length);for(let k=0;k<t.length;k+=3){const w=lk.toWorld([o.tris[k],o.tris[k+1],o.tris[k+2]]);t[k]=w[0];t[k+1]=w[1];t[k+2]=w[2];}return {name:o.name,tris:t};});
 return {J,lk,lake};
}
/** Highest hit of a down-ray (from y0+0.8, i.e. under palm canopies / props tops) on the given ground objects; with the hit normal. */
function hit(objs,x,z,y0){let best=null;const o=[x,y0+.8,z];
 for(const ob of objs){const t=ob.tris;ob.bb??=bb(t);if(x<ob.bb[0][0]-.01||x>ob.bb[1][0]+.01||z<ob.bb[0][2]-.01||z>ob.bb[1][2]+.01)continue;
  for(let k=0;k<t.length;k+=9){const ax=t[k],ay=t[k+1],az=t[k+2],bx=t[k+3],by=t[k+4],bz=t[k+5],cx=t[k+6],cy=t[k+7],cz=t[k+8];
   if(Math.max(ax,bx,cx)<x||Math.min(ax,bx,cx)>x||Math.max(az,bz,cz)<z||Math.min(az,bz,cz)>z)continue;
   const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;
   if(l1<-1e-9||l2<-1e-9||l3<-1e-9)continue;const y=l1*ay+l2*by+l3*cy;if(y>o[1]||y<y0-4)continue;
   if(!best||y>best.y){const e1=[bx-ax,by-ay,bz-az],e2=[cx-ax,cy-ay,cz-az],n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],nl=Math.hypot(...n)||1;best={y,ny:Math.abs(n[1]/nl),name:ob.name,water:!!ob.water};}}}
 return best;}
function bb(t){const a=[1e9,1e9,1e9],b=[-1e9,-1e9,-1e9];for(let k=0;k<t.length;k++){const c=k%3;if(t[k]<a[c])a[c]=t[k];if(t[k]>b[c])b[c]=t[k];}return [a,b];}
const enc=(c,h)=>{const v=Math.round(h*100)+640;if(v<0||v>1295)return '000';return c+v.toString(36).padStart(2,'0');};
/** 'r' (rough): the cell's 0.3 m footprint (3×3 sub-rays at ±0.1 m) is not one plane of one object — a pebble, tide-pool rim,
 * step or bank smaller than the grid. Heights stay the centre hit; petals and flowers avoid rough cells (the table can't see
 * features under one step, the real-ground test can). */
function rough(objs,x,z,at,h){const s=[];for(const dz of [-.1,0,.1])for(const dx of [-.1,0,.1]){const k=hit(objs,x+dx,z+dz,at[1]);if(!k||k.water||k.name!==h.name)return true;s.push([dx,dz,k.y]);}
 const gx=(s[5][2]-s[3][2])/.2,gz=(s[7][2]-s[1][2])/.2;return s.some(([dx,dz,y])=>Math.abs(y-(h.y+gx*dx+gz*dz))>.006);}
function grid(id,frame,at,objs,classify){let data='';
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=at[0]-HALF+i*STEP,z=at[2]-HALF+j*STEP,h=hit(objs,x,z,at[1]);data+=h&&!h.water?enc(rough(objs,x,z,at,h)?'r':classify(h,at),h.y-at[1]):'000';}
 return {id,frame,at:at.map(v=>+v.toFixed(4)),half:HALF,step:STEP,data};}
function bake(){
 const {J,lk,lake}=scene();
 const islandGround=J.island.filter(o=>/^env_island_main|^env_beach_wet_sand|^env_beach_tide_pools/.test(o.name));
 // water surfaces are kept as candidates so a cell whose top hit is water reads as "none" (no halo / petals under water)
 const wet=o=>({...o,water:true});
 const meadowGround=[...J.meadow.filter(o=>/^meadow_terrain$|^meadow_path$|^meadow_river_bank$/.test(o.name)),...J.meadow.filter(o=>o.name==='meadow_river').map(wet)];
 const lakeGround=[...lake.filter(o=>o.name==='LK_terrain_i'),...lake.filter(o=>o.name==='LK_lake_i').map(wet)];
 const islandEnd=J.edge1,meadowEnd=J.bridge1.at(-1),lakeEnd=lk.bridge.at(-1);
 // island: no per-material split in the fixture; level, walkable env_island_main near the path level reads as grass, the rest
 // (boulders, wet sand, tide pools, the slope under the cliff) as 's' — flowers only go on 'g'.
 const island=grid('island','world',islandEnd,islandGround,(h,at)=>/^env_island_main/.test(h.name)&&h.ny>.97&&Math.abs(h.y-at[1])<.2?'g':'s');
 const meadow=grid('meadow','end',meadowEnd,meadowGround,h=>h.name==='meadow_path'?'p':h.name==='meadow_terrain'?'g':'s');
 const lakeside=grid('lakeside','end',lakeEnd,lakeGround,h=>/path/i.test(h.name)?'p':/terrain/i.test(h.name)&&h.ny>.9?'g':'s');
 return {tables:{island,meadow,lakeside},ends:{island:islandEnd,meadow:meadowEnd,lakeside:lakeEnd},J,lk,lake,ground:{island:islandGround,meadow:meadowGround,lakeside:lakeGround},hit};
}
function source(tables){
 const rows=Object.values(tables).map(t=>' '+t.id+':{id:'+JSON.stringify(t.id)+',frame:'+JSON.stringify(t.frame)+',at:'+JSON.stringify(t.at)+',half:'+t.half+',step:'+t.step+',\n  data:'+JSON.stringify(t.data)+'},');
 return '/** GENERATED by tools/rainbow-bridge/bake-ground.cjs — do not edit. Ground under the real rainbow-bridge ends (r5), baked from the\n'+
  ' *  shipped GLBs in the journey placement of RegionJourneyAdapter. Cell = surface class (g grass, p path, s other, 0 none) + height in\n'+
  ' *  cm (base 36, +640) relative to `at` (frame world) or to the bridge end (frame end). Sky city: none until plan B §8.4 is final. */\n'+
  "import type {RainbowGroundTable} from './RainbowBridgeMesh';\n"+
  'export const RAINBOW_GROUND:{readonly island:RainbowGroundTable;readonly meadow:RainbowGroundTable;readonly lakeside:RainbowGroundTable}={\n'+rows.join('\n')+'\n};\n';
}
module.exports={bake,source,HALF,STEP,N};
if(require.main===module){const b=bake(),src=source(b.tables),out=path.resolve(__dirname,'../../creator-build-project/assets/scripts/region/RainbowBridgeGround.ts');
 for(const t of Object.values(b.tables)){const cnt={};for(let k=0;k<t.data.length;k+=3)cnt[t.data[k]]=(cnt[t.data[k]]||0)+1;console.log(t.id,t.frame,JSON.stringify(t.at),JSON.stringify(cnt));}
 if(process.argv.includes('--write')){fs.writeFileSync(out,src);console.log('wrote',out,src.length,'B');}else console.log(src.length,'B (dry run; --write to save)');}
