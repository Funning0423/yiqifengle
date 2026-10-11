#!/usr/bin/env python3
"""T6 cheer bitmap font generator (GGbot).
Input : Fredoka[wdth,wght].ttf from github.com/google/fonts (ofl/fredoka, see SOURCE.md; sha256 checked below).
Output: cheer-fredoka.fnt + cheer-fredoka.png for Cocos Creator 3.8 BMFont: ONE white fill-only atlas holding exactly the
        characters of the four cheer words. Fill / outline / shadow colours are runtime Label.color tints; the outline is drawn
        by 8 offset copies of the same label (radius 4, = system Label outlineWidth 4) and the shadow by 3 more, so no outline
        glyphs or per-tier atlases are baked (halves atlas + fnt JSON size; see README).
Usage : python3 gen-bmfont.py <Fredoka[wdth,wght].ttf> <outdir>   (needs Pillow, numpy, fontTools, pngquant, optipng)"""
import sys, os, hashlib, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
WORDS=['Great!','Excellent!','Amazing!','Unbelievable!']   # must equal CHEER_STYLES words (test checks)
SIZE=38; SS=4; WGHT=600; PAD=1; ATLAS_W=128; LEVELS=16
SRC_SHA='2ba02e68b152868aef9ba28e24b3648c7d457fe6f25c761f2c2c53fb61a73fc8'
src,outdir=sys.argv[1],sys.argv[2]; name='cheer-fredoka'
assert hashlib.sha256(open(src,'rb').read()).hexdigest()==SRC_SHA,'Fredoka source sha256 mismatch'
inst=os.path.join(outdir,'.fredoka-w%d.ttf'%WGHT)
f=TTFont(src); instancer.instantiateVariableFont(f,{'wght':WGHT,'wdth':100},inplace=True); f.save(inst)
hi=ImageFont.truetype(inst,SIZE*SS); lo=ImageFont.truetype(inst,SIZE); os.remove(inst)
asc,desc=lo.getmetrics(); chars=sorted(set(''.join(WORDS)))
glyphs=[]
for ch in chars:   # supersampled coverage, box-filtered down; bbox snapped to whole 1x pixels
  l,t,r,b=hi.getbbox(ch,anchor='la'); l=(l//SS)*SS; t=(t//SS)*SS; r=-(-r//SS)*SS; b=-(-b//SS)*SS
  im=Image.new('L',(r-l,b-t),0); ImageDraw.Draw(im).text((-l,-t),ch,font=hi,fill=255,anchor='la')
  a=np.asarray(im,dtype=np.float32); h,w=a.shape; a=a.reshape(h//SS,SS,w//SS,SS).mean(axis=(1,3)).round().astype(np.uint8)
  glyphs.append((ord(ch),a,l//SS,t//SS,round(lo.getlength(ch))))
order=sorted(glyphs,key=lambda g:(-g[1].shape[0],g[0])); x=y=PAD; rowh=0; place={}   # shelf pack, 1px gutter
for g in order:
  h,w=g[1].shape
  if x+w+PAD>ATLAS_W: x=PAD; y+=rowh+PAD; rowh=0
  place[g[0]]=(x,y); x+=w+PAD; rowh=max(rowh,h)
AH=y+rowh+PAD; rgba=np.zeros((AH,ATLAS_W,4),np.uint8); rgba[...,:3]=255
for cid,a,*_ in glyphs: px,py=place[cid]; rgba[py:py+a.shape[0],px:px+a.shape[1],3]=a
png=os.path.join(outdir,name+'.png'); Image.fromarray(rgba,'RGBA').save(png)
subprocess.run(['pngquant','--force','--speed','1','--nofs',str(LEVELS),'-o',png,png],check=True)
subprocess.run(['optipng','-quiet','-o7','-strip','all',png],check=True)
lines=[f'info face="Fredoka SemiBold" size={SIZE} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing={PAD},{PAD}',
 f'common lineHeight={asc+desc} base={asc} scaleW={ATLAS_W} scaleH={AH} pages=1 packed=0',f'page id=0 file="{name}.png"',f'chars count={len(glyphs)}']
for cid,a,xo,yo,adv in glyphs:
  px,py=place[cid]; lines.append(f'char id={cid} x={px} y={py} width={a.shape[1]} height={a.shape[0]} xoffset={xo} yoffset={yo} xadvance={adv} page=0 chnl=15')
open(os.path.join(outdir,name+'.fnt'),'w').write('\n'.join(lines)+'\n')
print(f'{len(glyphs)} glyphs {"".join(chars)!r}, atlas {ATLAS_W}x{AH}, png {os.path.getsize(png)} B, lineHeight {asc+desc} base {asc}')
# ---- Cocos Creator 3.8 metas with FIXED uuids (uuid5 of 'yiqifengle/T6/<name>'), so re-running never changes references.
import json
DIR_UUID='ca3daf9d-8958-5471-935b-046b19b1c1e8'; PNG_UUID='47ab18e4-c2ba-5cf3-b79a-3a972360ba9b'; FNT_UUID='f2088dd0-6f97-5977-812f-9f95eb6d98fe'
def dump(path,obj): open(path,'w').write(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
dump(outdir+'.meta',{"ver":"1.2.0","importer":"directory","imported":True,"uuid":DIR_UUID,"files":[],"subMetas":{},"userData":{}})
tex={"wrapModeS":"clamp-to-edge","wrapModeT":"clamp-to-edge","minfilter":"linear","magfilter":"linear","mipfilter":"none","premultiplyAlpha":False,"anisotropy":0,"isUuid":True}
dump(png+'.meta',{"ver":"1.0.27","importer":"image","imported":True,"uuid":PNG_UUID,"files":[".json",".png"],"subMetas":{
 "6c48a":{"importer":"texture","uuid":PNG_UUID+"@6c48a","displayName":name,"id":"6c48a","name":"texture","userData":{**tex,"imageUuidOrDatabaseUri":PNG_UUID,"visible":False},"ver":"1.0.22","imported":True,"files":[".json"],"subMetas":{}},
 "f9941":{"importer":"sprite-frame","uuid":PNG_UUID+"@f9941","displayName":name,"id":"f9941","name":"spriteFrame","userData":{**tex,"trimType":"none","trimThreshold":1,"rotated":False,
   "offsetX":0,"offsetY":0,"trimX":0,"trimY":0,"width":ATLAS_W,"height":AH,"rawWidth":ATLAS_W,"rawHeight":AH,"borderTop":0,"borderBottom":0,"borderLeft":0,"borderRight":0,
   "imageUuidOrDatabaseUri":PNG_UUID+"@6c48a","atlasUuid":"","packable":False,"pixelsToUnit":100,"pivotX":0.5,"pivotY":0.5,"meshType":0,"vertices":{"rawPosition":[],"indexes":[],"uv":[],"nuv":[],"minPos":[],"maxPos":[]}},
   "ver":"1.0.9","imported":True,"files":[".json"],"subMetas":{}}},
 "userData":{"type":"sprite-frame","hasAlpha":True,"fixAlphaTransparencyArtifacts":False,"redirect":PNG_UUID+"@f9941"}})
fdd={str(cid):{"rect":{"x":place[cid][0],"y":place[cid][1],"width":a.shape[1],"height":a.shape[0]},"xOffset":xo,"yOffset":yo,"xAdvance":adv} for cid,a,xo,yo,adv in glyphs}
dump(os.path.join(outdir,name+'.fnt.meta'),{"ver":"1.0.5","importer":"bitmap-font","imported":True,"uuid":FNT_UUID,"files":[".json"],"subMetas":{},"userData":{
 "_fntConfig":{"commonHeight":asc+desc,"fontSize":SIZE,"atlasName":name+'.png',"fontDefDictionary":fdd,"kerningDict":{}},"fontSize":SIZE,"textureUuid":PNG_UUID}})
print('metas written:',DIR_UUID,PNG_UUID,FNT_UUID)
