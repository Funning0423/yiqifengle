'use strict';
// 运镜bot full9c: before/after contact sheets (flat-shaded NOT_ENGINE raster of the real meshes, lens-scene.cjs; her = red box) → PNG.
// Sheets: mid-walk S1>S2 / S2>S3 (before = d3b8e5e4 FollowWalk writer followPose(lookUp skycity), after = rail), T-02 S4>S6 (before =
// d3b8e5e4 held follow lookUp 8 + skyFinaleApproach, after = rail), 3b landing (tools/transitions-continuous/test_landing_move.cjs --json
// series), B1 sit (MODEL: balloon + her only, no meadow mesh; before = close→cam0 snap over min(blendS, sitDown·.9), after = held close
// then the flight blend flightBlendSeconds). Row 1 = before, row 2 = after; frame times in the README next to the PNGs.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),L=require('../journey-integration/clip3/lens-scene.cjs');
const M=require('./sky-rail-model.cjs'),{H,RL}=M,SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts'),C=H.load('region/ExploreCameraCore.ts'),F=H.load('region/SkyFinaleShot.ts'),NW=H.load('region/NodeWalker.ts');
const W=p=>SW.skyLocalToWorld(TS.TRANSITION_STAGING.skyMooring5a,p),wp=p=>({position:W(p.position),target:W(p.target),fovVerticalDeg:p.fovVerticalDeg});
const OUT=process.argv[2]||'team/cinematic/outbox/20261029-full9c-final-cam',readme=[];
function png(file,w,h,rgb){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}
 const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1;}return ~c>>>0;},chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
 const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
function sheet(name,rows,title,scr=[390,844]){const fr=rows.map(r=>r.map(f=>L.render(f.objs,f.pose,scr[0],scr[1],260)));const fw=fr[0][0].w,fh=fr[0][0].h,G=6,BAR=8,n=Math.max(...fr.map(r=>r.length));
 const Wd=n*(fw+G)+G,Hh=rows.length*(fh+G+BAR)+G,img=Buffer.alloc(Wd*Hh*3,30);
 fr.forEach((r,ri)=>{const y0=G+ri*(fh+G+BAR);for(let x=G;x<Wd-G;x++)for(let y=y0;y<y0+BAR-2;y++){const j=(y*Wd+x)*3;img[j]=ri?60:200;img[j+1]=ri?190:70;img[j+2]=ri?90:60;}
  r.forEach((R,ci)=>{const x0=G+ci*(fw+G);for(let y=0;y<fh;y++)R.img.copy(img,((y0+BAR+y)*Wd+x0)*3,y*fw*3,(y+1)*fw*3);});});
 png(path.join(OUT,name),Wd,Hh,img);readme.push(`- ${name}: ${title} (top bar red = before, green = after)`);}
(async()=>{const sky=await L.skyObjs();const her=h=>L.herObjs(W(h));
 // mid-walk: frames at 0.6 s steps where the d3b8e5e4 lens hid her longest
 const FL=require('../journey-integration/journey-framing-lib.cjs'),B=L.bvh(sky.filter(o=>!/foliage_cards|flowers|robot_gardener|cloud|cumulus/.test(o.name)));
 const RLg=require('../journey-integration/route/route-legs.cjs'),geo=await RLg.geometry(),hid=(p,h)=>!!RLg.hit(geo.skyJ,W(p.position),W([h[0],h[1]+1.05,h[2]]))||!!RLg.hit(geo.skyJ,W(p.position),W([h[0],h[1]+1.45,h[2]]))/* sky_run_lens_eval's metric */;void FL;void B;
 for(const w of ['S1>S2','S2>S3']){const sg=M.segsOf(w),fr=[];sg.forEach((s,si)=>{const Lm=NW.pathLength(s.path);for(let d=0;d<=Lm;d+=1.2/60){const h=NW.pointAlong(s.path,d),q=NW.pointAlong(s.path,Math.min(Lm,d+0.05));fr.push({si,d,h,yaw:Math.atan2(q[0]-h[0],q[2]-h[2])});}});
  const base=f=>C.followPose(f.h,f.yaw,390,844,C.followLookUp('skycity',99));let best=0,run=0,end=0;fr.forEach((f,i)=>{run=hid(base(f),f.h)?run+1:0;if(run>best){best=run;end=i;}});
  const pick=[-24,0,24,48,72,96].map(k=>Math.max(0,Math.min(fr.length-1,end-best+k)));
  sheet(`midwalk-${w.replace('>','to')}-before-after.png`,[pick.map(i=>({objs:[...sky,...her(fr[i].h)],pose:wp(base(fr[i]))})),pick.map(i=>({objs:[...sky,...her(fr[i].h)],pose:wp(RL.skyRailPose(w,fr[i].h))}))],
   `${w} mid-walk, 390x844, frames ${pick.map(i=>`run ${fr[i].si+1} ${fr[i].d.toFixed(2)} m`).join(', ')}; d3b8e5e4 chest hidden ${(best/60).toFixed(2)} s here`);}
 // T-02 S4>S6
 {const sg=M.segsOf('S4>S6'),last=sg.at(-1).path,feet=last.at(-1),p0=sg[0].path,live0=C.followPose(p0[0],Math.atan2(p0.at(-1)[0]-p0[0][0],p0.at(-1)[2]-p0[0][2]),390,844,8);
  const SO=H.load('region/SkycityLensOccluders.ts'),bx=SO.SKYCITY_LENS_OCCLUDERS.map(b=>({min:b.slice(0,3),max:b.slice(3,6)}));
  const from=C.followPose(feet,Math.atan2(feet[0]-last.at(-2)[0],feet[2]-last.at(-2)[2]),390,844,8),ap=F.skyFinaleApproach(from,F.SKY_FINALE_POSE_LOCAL,feet,bx);
  const ts=[0,.2,.4,.6,.8,1].map(u=>u*ap.T),Lm=NW.pathLength(last),ds=[0,.2,.4,.6,.8,1].map(u=>Lm*u);
  sheet('t02-S4toS6-before-after.png',[ts.map(t=>({objs:[...sky,...her(feet)],pose:wp(F.skyFinaleApproachPose(from,F.SKY_FINALE_POSE_LOCAL,feet,t,ap.T,ap.dir))})),ds.map(d=>{const h=NW.pointAlong(last,d);return {objs:[...sky,...her(h)],pose:wp(RL.skyRailPose('S4>S6',h))};})],
   `T-02 finale, 390x844; before = d3b8e5e4 skyFinaleApproach from the S6 follow lens (t = ${ts.map(t=>t.toFixed(2)).join(', ')} s of ${ap.T.toFixed(2)} s), after = S4>S6 rail last run at ${ds.map(d=>d.toFixed(2)).join(', ')} m (ends on the stand shot)`);}
 // 3b landing
 {const S=JSON.parse(fs.readFileSync('/workspace/logs-fc/landing.json','utf8')).series,RT=require('../journey-integration/route/route-legs.cjs'),idx=[-3,-2,-1,0,1,2,3].map(s=>Math.round((6+s)*60));
  const T=H.load('region/TransportLeg.ts'),TM=H.load('region/TransitionStagingMath.ts');void T;void TM;
  sheet('landing-3b-before-after.png',[idx.map(i=>({objs:[...sky,...L.herObjs(S.her[i])],pose:S.before[i]})),idx.map(i=>({objs:[...sky,...L.herObjs(S.her[i])],pose:S.after[i]}))],
   '3b balloon landing (day, 390x844; skycity mesh + her box, balloon mesh not drawn), ride clock −3 … +3 s around the ride end (0 = B5 start); before: lens still then the 26.5 m B5 swing in 4.52 s; after: one 6.52 s min-jerk move from −2 s');}
 fs.writeFileSync(path.join(OUT,'README-images.md'),'# full9c final-cam images (运镜bot, NOT_ENGINE flat raster of the real meshes)\n'+readme.join('\n')+'\n');console.log(readme.join('\n'));})().catch(e=>{console.error(e);process.exit(1);});
