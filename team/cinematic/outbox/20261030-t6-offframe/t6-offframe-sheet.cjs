'use strict';process.chdir('/workspace/wt-t6');
const fs=require('fs'),zlib=require('zlib'),L=require('/workspace/wt-t6/tools/journey-integration/clip3/lens-scene.cjs');
const M=require('/workspace/wt-t6/tools/region-nodes/sky-rail-model.cjs'),{H}=M,SW=H.load('region/SkyWalkShot.ts'),TS=H.load('region/TransitionStaging.ts');
const W=p=>SW.skyLocalToWorld(TS.TRANSITION_STAGING.skyMooring5a,p),wp=p=>({position:W(p.position),target:W(p.target),fovVerticalDeg:p.fovVerticalDeg});
function png(file,w,h,rgb){const raw=Buffer.alloc((w*3+1)*h);for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}
 const crc=b=>{let c=~0;for(const x of b){c^=x;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xEDB88320:c>>>1;}return ~c>>>0;},chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
 const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;fs.writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
(async()=>{const sky=await L.skyObjs(),her=h=>L.herObjs(W(h)),sc=[390,844];
 const rows=[['S2>S3','out'],['S3>S4','in'],['S3>S4','out'],['S4>S5','in'],['S4>S5','out'],['S4>S6','in']];const fr=[],cap=[];
 for(const [w,j] of rows){const smp=M.samples(w,sc);const LS=H.load('region/LensSmooth.ts');const idx=smp.map((s,i)=>s.join===j?i:-1).filter(i=>i>=0);
  const off=idx.filter(i=>LS.herMargin(smp[i].p.position,smp[i].p.target,smp[i].p.fovVerticalDeg,smp[i].h,[sc])<0);
  const pick=j==='in'?[off[0],off[off.length>>1],off.at(-1),off.at(-1)+1,off.at(-1)+15]:[off[0]-15,off[0]-1,off[0],off[off.length>>1],off.at(-1)];
  fr.push(pick.map(i=>L.render([...sky,...her(smp[i].h)],wp(smp[i].p),sc[0],sc[1],260)));cap.push(`${w} ${j}: sample #${pick.join(', #')} (${pick.map(i=>off.includes(i)?'OFF':'in').join('/')})`);}
 const fw=fr[0][0].w,fh=fr[0][0].h,G=6,BAR=8,n=5,Wd=n*(fw+G)+G,Hh=rows.length*(fh+G+BAR)+G,img=Buffer.alloc(Wd*Hh*3,30);
 fr.forEach((r,ri)=>{const y0=G+ri*(fh+G+BAR);r.forEach((R,ci)=>{const x0=G+ci*(fw+G);const off=cap[ri].split('(')[1].split('/')[ci].startsWith('OFF');for(let x=x0;x<x0+fw;x++)for(let y=y0;y<y0+BAR-2;y++){const k=(y*Wd+x)*3;img[k]=off?200:60;img[k+1]=off?70:190;img[k+2]=off?60:90;}for(let y=0;y<fh;y++)R.img.copy(img,((y0+BAR+y)*Wd+x0)*3,y*fw*3,(y+1)*fw*3);});});
 png('team/cinematic/outbox/20261030-t6-offframe/t6-offframe-390x844.png',Wd,Hh,img);fs.writeFileSync('/workspace/t6scratch/sheet-cap.txt',cap.join('\n'));console.log(cap.join('\n'));})().catch(e=>{console.error(e);process.exit(1);});
