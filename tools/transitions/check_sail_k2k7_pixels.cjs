#!/usr/bin/env node
'use strict';
/** Pixel check on the delivered 390×844 stills (after sips). Not part of run-suite. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const dir=process.argv[2]||path.resolve(__dirname,'../../docs/r5/sail-k2k7/shots');
function decode(file){
 const png=fs.readFileSync(file);
 let o=8,w,h,ct,idat=[];
 while(o<png.length){
  const len=png.readUInt32BE(o),type=png.toString('ascii',o+4,o+8),d=png.subarray(o+8,o+8+len);
  if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9];}
  else if(type==='IDAT')idat.push(d);
  else if(type==='IEND')break;
  o+=12+len;
 }
 const bpp=ct===6?4:3;
 const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*bpp,out=Buffer.alloc(h*stride);
 for(let r=0;r<h;r++){
  const f=raw[r*(stride+1)],src=raw.subarray(r*(stride+1)+1,(r+1)*(stride+1));
  for(let i=0;i<stride;i++){
   const a=i>=bpp?out[r*stride+i-bpp]:0,b=r?out[(r-1)*stride+i]:0,c=r&&i>=bpp?out[(r-1)*stride+i-bpp]:0;
   let v=src[i];
   if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
   out[r*stride+i]=v&255;
  }
 }
 return {w,h,bpp,out};
}
const luma=(im,x,y)=>{const i=(y*im.w+x)*im.bpp,o=im.out;return 0.2126*o[i]+0.7152*o[i+1]+0.0722*o[i+2];};
/** Mean of the brightest fifth inside the mainsail window (cloth, not the sea around it). */
function sailCloth(im){
 const x0=Math.floor(im.w*0.22),x1=Math.floor(im.w*0.50),y0=Math.floor(im.h*0.18),y1=Math.floor(im.h*0.46);
 const vals=[];
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)vals.push(luma(im,x,y));
 vals.sort((a,b)=>b-a);
 const n=Math.max(1,Math.floor(vals.length*0.2));
 let s=0;for(let i=0;i<n;i++)s+=vals[i];
 return s/n;
}
function skyStars(im){
 const y1=Math.floor(im.h*0.12),thr=160;
 const w=im.w,seen=new Uint8Array(w*y1);
 const comps=[];
 for(let y=2;y<y1-1;y++)for(let x=2;x<w-2;x++){
  const id=y*w+x;if(seen[id]||luma(im,x,y)<thr)continue;
  const stack=[[x,y]];seen[id]=1;let n=0,x0=x,x1=x,y0=y,y2=y;
  while(stack.length){
   const [cx,cy]=stack.pop();n++;
   x0=Math.min(x0,cx);x1=Math.max(x1,cx);y0=Math.min(y0,cy);y2=Math.max(y2,cy);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=w||ny>=y1)continue;
    const k=ny*w+nx;if(seen[k]||luma(im,nx,ny)<thr)continue;seen[k]=1;stack.push([nx,ny]);
   }
  }
  const dim=Math.max(x1-x0+1,y2-y0+1);
  if(n>=2&&n<=80&&dim<=12)comps.push({n,dim,x:x0,y:y0});
 }
 return comps;
}
const k3=decode(path.join(dir,'K3_open_sea.png'));
const k7=decode(path.join(dir,'K7_night_open_sea.png'));
const day=sailCloth(k3),night=sailCloth(k7),ratio=night/day;
const stars=skyStars(k7);
const report={daySail:+day.toFixed(1),nightSail:+night.toFixed(1),ratio:+ratio.toFixed(3),skyStars:stars.length,starPx:stars.length?{min:Math.min(...stars.map(s=>s.dim)),max:Math.max(...stars.map(s=>s.dim))}:null};
console.log(JSON.stringify(report));
assert(stars.length>=15,'sky bright points '+stars.length);
assert(ratio>=0.45&&ratio<=0.65,'night sail vs day K3 sail '+ratio.toFixed(3));
console.log('PASS');
