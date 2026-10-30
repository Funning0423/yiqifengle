'use strict';
// 运镜bot b20: island stage-04 burst strips (flat-shaded NOT_ENGINE raster of the real island GLB, her = red box), 7 screens,
// per screen: row before (96dfbd33 legacy: BLEND_S.boardToFollow onto the follow pose, then held) / row after (IslandStageLens).
// node tools/region-nodes/render-island-stage04-strips.cjs <outdir>
const fs=require('fs'),path=require('path'),zlib=require('zlib');const L=require('../journey-integration/clip3/lens-scene.cjs');const J=require('../journey-integration/journey-scene.cjs');const {H,S}=J;
const E=H.load(S+'region/ExploreCameraCore.ts'),NW=H.load(S+'region/NodeWalker.ts'),IL=H.load(S+'region/IslandStageLens.ts');
const OUT=process.argv[2]||'team/cinematic/outbox/20261030-meadow-nodelens';fs.mkdirSync(OUT,{recursive:true});
function png(file,w,h,rgb){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}
 const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1;}return ~c>>>0;},chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
 const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};const lu=E.followLookUp('island',99);
const ci=J.Cam.islandPoseEntry(),fw=unit(ci.target.map((x,i)=>x-ci.position[i]));
const P0={position:ci.position.map((x,i)=>x+fw[i]*2.6),target:ci.position.map((x,i)=>x+fw[i]*40),fovVerticalDeg:ci.fovVerticalDeg-6},board={position:ci.position.slice(),target:ci.target.slice(),fovVerticalDeg:ci.fovVerticalDeg};
const isl=J.island.filter(o=>!/seagull|smoke|beam|glow/.test(o.name));
function lenses(kind,w,h){const dep=kind==='departure',pl=NW.planWalk('island',dep?'I4':'I3',dep?'I6':'I4'),p=pl.segments[0].path,Lm=NW.pathLength(p),from=dep?P0:board;
 const end=E.followPose(p[p.length-1],IL.endHeading(p),w,h,lu),l=dep?IL.islandDepartLens(from,p,end):IL.islandEntryPan(from,p),B=E.BLEND_S.boardToFollow,held=E.followPose(p[0],0,w,h,lu);
 return {after:{at:l.at,her:t=>NW.pointAlong(p,Math.max(0,Math.min(Lm,(t-l.preS)*1.2)))},before:{at:t=>t<B?E.blendPose(from,held,t,B):held,her:t=>NW.pointAlong(p,Math.max(0,Math.min(Lm,(t-B)*1.2)))}};}
const TIMES={departure:[0,0.15,0.3,0.45,0.6,2,4,6,7.8],entry:[0,0.15,0.3,0.45,0.6,1.5,3,4.5]};const FH=150,G=3,BAR=5,readme=[];
for(const kind of ['departure','entry']){const T=TIMES[kind],rows=[];
 for(const [w,h] of SCREENS){const Lz=lenses(kind,w,h);for(const k of ['before','after'])rows.push({k,fr:T.map(t=>L.render([...isl,...L.herObjs(Lz[k].her(t))],Lz[k].at(t),w,h,FH))});}
 const fw0=Math.max(...rows.flatMap(r=>r.fr.map(f=>f.w))),Wd=T.length*(fw0+G)+G,Hh=rows.length*(FH+G+BAR)+G,img=Buffer.alloc(Wd*Hh*3,30);
 rows.forEach((r,ri)=>{const y0=G+ri*(FH+G+BAR);for(let x=G;x<Wd-G;x++)for(let y=y0;y<y0+BAR-1;y++){const j=(y*Wd+x)*3;img[j]=r.k==='after'?60:200;img[j+1]=r.k==='after'?190:70;img[j+2]=r.k==='after'?90:60;}
  r.fr.forEach((R,ci2)=>{const x0=G+ci2*(fw0+G);for(let y=0;y<R.h;y++)R.img.copy(img,((y0+BAR+y)*Wd+x0)*3,y*R.w*3,(y+1)*R.w*3);});});
 const name=`island-stage04-${kind}-strips-7screens.png`;png(path.join(OUT,name),Wd,Hh,img);readme.push(`- ${name}: rows = ${SCREENS.map(s=>s.join('x')).join(', ')} (each: red bar before 96dfbd33, green bar after); columns t = ${T.join(', ')} s from the ${kind==='departure'?'reveal (push-in end)':'reward-walk start (board lens)'}`);}
fs.writeFileSync(path.join(OUT,'STRIPS.md'),readme.join('\n')+'\n');console.log(readme.join('\n'));
