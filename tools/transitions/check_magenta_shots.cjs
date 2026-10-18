#!/usr/bin/env node
'use strict';
/** Magenta pixel check: R>200,G<80,B>200 share must be <0.1% per shot. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const SHOTS=process.argv[2]||path.resolve(__dirname,'../../docs/r5/balloon-v23fix/shots');
const LIMIT=0.001;
function scan(file){
  const bmp=file+'.mag.bmp';
  execFileSync('sips',['-s','format','bmp',file,'--out',bmp],{stdio:'pipe'});
  const data=fs.readFileSync(bmp);fs.unlinkSync(bmp);
  const off=data.readUInt32LE(10),w=data.readInt32LE(18),h0=data.readInt32LE(22),h=Math.abs(h0);
  const bpp=data.readUInt16LE(28),row=((w*bpp+31)>>5)*4,bottom=h0>0;
  let mag=0,n=0;
  for(let y=0;y<h;y++){
    const src=off+(bottom?h-1-y:y)*row;
    for(let x=0;x<w;x++){
      const i=src+x*(bpp/8);const b=data[i],g=data[i+1],r=data[i+2];n++;
      if(r>200&&g<80&&b>200)mag++;
    }
  }
  return {file:path.basename(file),w,h,n,mag,pct:mag/n};
}
const files=fs.readdirSync(SHOTS).filter(f=>/\.png$/i.test(f)&&!/_vs_render|contact_/.test(f)).sort();
const rows=files.map(f=>scan(path.join(SHOTS,f)));
const bad=rows.filter(r=>r.pct>=LIMIT);
console.log(JSON.stringify({shots:SHOTS,limit:LIMIT,rows,bad:bad.map(r=>r.file)},null,2));
if(bad.length){console.error('MAGENTA FAIL',bad);process.exit(1);}
console.log('MAGENTA PASS all',rows.length,'shots');
