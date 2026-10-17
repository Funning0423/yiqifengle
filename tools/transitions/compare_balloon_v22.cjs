#!/usr/bin/env node
'use strict';
/**
 * Side-by-side game | render comparisons. Uses sips (macOS) — no PIL.
 * Screenshots from Chromium are upright; we do NOT flipY (that was the balloon-art bug).
 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..');
const SHOTS=path.join(ROOT,'docs/r5/balloon-v22/shots');
const ART=path.resolve(ROOT,'../art/renders');
const TASK_SHOTS=path.resolve(ROOT,'../shots');
const PAIRS=[
 {game:'01_board.png',render:'r5_balloon_01_board_v2_3.png',out:'01_board_vs_render.png',label:'game t=0.9 / render v2.3'},
 {game:'02_liftoff.png',render:'r5_balloon_02_liftoff_v2_3.png',out:'02_liftoff_vs_render.png',label:'game t=5.2 / render v2.3'},
 {game:'03_clouds.png',render:'r5_balloon_03_clouds_v2_3.png',out:'03_clouds_vs_render.png',label:'game t=11.4 / render v2.3'},
 {game:'04_cruise.png',render:'r5_balloon_04_cruise_v2_3.png',out:'04_cruise_vs_render.png',label:'game t=18.5 / render v2.3'},
 {game:'05_city.png',render:'r5_balloon_05_city_v2_3.png',out:'05_city_vs_render.png',label:'game t=24.0 / render v2.3'},
 {game:'06_land.png',render:'r5_balloon_06_land_v2_3.png',out:'06_land_vs_render.png',label:'game t=33.6 / render v2.3'},
 {game:'07_night.png',render:'r5_balloon_07_night_v2_3.png',out:'07_night_vs_render.png',label:'game t=24.0 night / render v2.3'},
];
function sips(args){execFileSync('sips',args,{stdio:'pipe'});}
function dim(file){const o=execFileSync('sips',['-g','pixelWidth','-g','pixelHeight',file],{encoding:'utf8'});
 const w=/pixelWidth:\s*(\d+)/.exec(o),h=/pixelHeight:\s*(\d+)/.exec(o);return {w:+w[1],h:+h[1]};}
function ensureH(file,targetH){
 const d=dim(file);if(d.h===targetH)return file;
 const tmp=file+'.tmp.png';fs.copyFileSync(file,tmp);
 sips(['-z',String(targetH),String(Math.round(d.w*targetH/d.h)),tmp,'--out',tmp]);
 return tmp;
}
function main(){
 fs.mkdirSync(SHOTS,{recursive:true});
 fs.mkdirSync(TASK_SHOTS,{recursive:true});
 const rows=[];
 for(const p of PAIRS){
  const g0=path.join(SHOTS,p.game),r0=path.join(ART,p.render);
  if(!fs.existsSync(g0)){console.warn('skip missing game',p.game);continue;}
  if(!fs.existsSync(r0)){console.warn('skip missing render',p.render);continue;}
  // Match heights; keep game half short edge ≥ 844 after scale-up of the pair.
  const targetH=Math.max(844,dim(g0).h,Math.min(1200,dim(r0).h));
  const g=ensureH(g0,targetH),r=ensureH(r0,targetH);
  const gw=dim(g).w,rw=dim(r).w,H=targetH,W=gw+rw;
  const out=path.join(SHOTS,p.out);
  // Composite without flip: pad a canvas, draw game left, render right.
  const canvas=path.join(SHOTS,'.canvas_'+p.out);
  // Create blank white canvas via sips pad of game image then overlay — use Python for reliability if available
  execFileSync('python3',['-c',`
from struct import pack
import zlib,sys
W,H=${W},${H}
# read PNGs via sips->raw is hard; use Quartz via objc? Fall back: write PPM then sips
# Actually use PIL-free: call \`sips -p\` pad. Simpler path: macOS \`sips\` can't composite.
# Use pure Python PNG writer + read via \`sips -s format bmp\` ...
print('use_sips_pad')
`],{encoding:'utf8'});
  // Pure Python PNG decode/encode for RGBA8 screenshots
  const py=`
import struct,zlib,sys
def read_png(path):
  import subprocess,tempfile,os
  bmp=path+'.bmp'
  subprocess.check_call(['sips','-s','format','bmp',path,'--out',bmp],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  data=open(bmp,'rb').read(); os.remove(bmp)
  assert data[:2]==b'BM'
  off=struct.unpack_from('<I',data,10)[0]
  w,h=struct.unpack_from('<ii',data,18)
  bpp=struct.unpack_from('<H',data,28)[0]; assert bpp in (24,32)
  row=((w*bpp+31)//32)*4; bottom_up=h>0; h=abs(h)
  pixels=bytearray(w*h*3)
  for y in range(h):
    src=off+(h-1-y)*row if bottom_up else off+y*row
    for x in range(w):
      i=src+x*(bpp//8); o=(y*w+x)*3
      pixels[o]=data[i+2]; pixels[o+1]=data[i+1]; pixels[o+2]=data[i]
  return w,h,pixels
def write_png(path,w,h,rgb):
  def chunk(t,d):
    return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
  raw=b''.join(b'\\x00'+bytes(rgb[y*w*3:(y+1)*w*3]) for y in range(h))
  open(path,'wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
gw,gh,gp=read_png(${JSON.stringify(g)})
rw,rh,rp=read_png(${JSON.stringify(r)})
H=max(gh,rh); W=gw+rw
out=bytearray(W*H*3)
for y in range(H):
  for x in range(gw):
    if y<gh:
      i=(y*gw+x)*3; o=(y*W+x)*3; out[o:o+3]=gp[i:i+3]
  for x in range(rw):
    if y<rh:
      i=(y*rw+x)*3; o=(y*W+gw+x)*3; out[o:o+3]=rp[i:i+3]
write_png(${JSON.stringify(out)},W,H,out)
print(W,H)
`;
  const info=execFileSync('python3',['-c',py],{encoding:'utf8'}).trim();
  console.log('OK',p.out,info,p.label);
  if(g.endsWith('.tmp.png'))fs.unlinkSync(g);
  if(r.endsWith('.tmp.png'))fs.unlinkSync(r);
  // Compress
  try{sips(['-Z','1688',out]);}catch{}
  const st=fs.statSync(out);
  if(st.size>1.5*1024*1024){try{execFileSync('pngquant',['--force','--output',out,'--quality=70-90',out]);}catch{}}
  fs.copyFileSync(out,path.join(TASK_SHOTS,p.out));
  fs.copyFileSync(path.join(SHOTS,p.game),path.join(TASK_SHOTS,p.game));
  rows.push(out);
 }
 // Contact sheet: stack 7 rows
 if(rows.length===7){
  const py=`
import struct,zlib,subprocess,os
def read_png(path):
  bmp=path+'.bmp'
  subprocess.check_call(['sips','-s','format','bmp',path,'--out',bmp],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  data=open(bmp,'rb').read(); os.remove(bmp)
  off=struct.unpack_from('<I',data,10)[0]; w,h=struct.unpack_from('<ii',data,18); bpp=struct.unpack_from('<H',data,28)[0]
  row=((w*bpp+31)//32)*4; bottom_up=h>0; h=abs(h)
  pixels=bytearray(w*h*3)
  for y in range(h):
    src=off+(h-1-y)*row if bottom_up else off+y*row
    for x in range(w):
      i=src+x*(bpp//8); o=(y*w+x)*3
      pixels[o]=data[i+2]; pixels[o+1]=data[i+1]; pixels[o+2]=data[i]
  return w,h,pixels
def write_png(path,w,h,rgb):
  def chunk(t,d):
    return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
  raw=b''.join(b'\\x00'+bytes(rgb[y*w*3:(y+1)*w*3]) for y in range(h))
  open(path,'wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw,6))+chunk(b'IEND',b''))
imgs=[read_png(p) for p in ${JSON.stringify(rows)}]
W=max(i[0] for i in imgs); H=sum(i[1] for i in imgs)
out=bytearray(W*H*3); y0=0
for w,h,px in imgs:
  for y in range(h):
    for x in range(w):
      i=(y*w+x)*3; o=((y0+y)*W+x)*3; out[o:o+3]=px[i:i+3]
  y0+=h
dest=${JSON.stringify(path.join(SHOTS,'contact_vs_render_v2_3.png'))}
write_png(dest,W,H,out)
print(dest,W,H)
`;
  console.log(execFileSync('python3',['-c',py],{encoding:'utf8'}).trim());
  fs.copyFileSync(path.join(SHOTS,'contact_vs_render_v2_3.png'),path.join(TASK_SHOTS,'contact_vs_render_v2_3.png'));
 }
}
main();
