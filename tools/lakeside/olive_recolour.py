#!/usr/bin/env python3
"""Voice Bot, lakeside olive (r5h3 alignment, Grok Bot approved): give LK_far_hills / LK_terrain / LK_far_shore their OWN palette
cells (free row 10 of T_LK_palette_256.png, previously all black and sampled by no GLB) and point their TEXCOORD_0 at them.
Grass tufts, bushes, trees and every other asset keep the shared cells. Same image, same material -> the static merge and the
instanced batches are unchanged (0 added draw calls). Only float32 UVs are rewritten in place (byte sizes unchanged).
Idempotent: a re-run finds no UVs on the source cells and rewrites the same pixels. Re-exporting the GLBs from the .blend
reverts the UVs - re-run this script after any re-export (or port the mapping to the .blend).
Colours: stand-in emulator fit (Mac-calibrated Cocos shading, board handoff camera) to r5h3 hills 71/83/20, grass_L 81/107/24."""
import json,struct,sys,pathlib
import numpy as np
from PIL import Image
M=pathlib.Path(__file__).resolve().parents[2]/'creator-build-project/assets/bundles/region_lakeside/models'
ROW=10  # free palette row (16x16 cells, glTF v from the top)
# source cell (col,row) -> (new col in ROW, new sRGB colour); per GLB
CELLS={
 'hills_4fa0a0':((14,15),0,(147,167,124)),'hills_2f6446':((9,13),1,(91,104,53)),'hills_3f7f52':((8,13),2,(119,133,62)),'hills_5a93a8':((7,13),3,(166,153,130)),
 'grass_6dbe45':((9,15),4,(57,143,18)),'grass_a8d64a':((10,15),5,(92,162,20)),
}
GLBS={'LK_far_hills.glb':['hills_4fa0a0','hills_2f6446','hills_3f7f52','hills_5a93a8'],'LK_terrain.glb':['grass_6dbe45'],'LK_far_shore.glb':['grass_6dbe45','grass_a8d64a']}
def glb(p):
  b=bytearray(p.read_bytes());n=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+n]);return b,j,20+n+8
def _chunks(b):
  i=8;out=[]
  while i<len(b):
    n=struct.unpack('>I',b[i:i+4])[0];out.append((b[i+4:i+8],b[i:i+12+n]));i+=12+n
  return out
def save_png_like(png,rgb):
  """Same PNG layout as the export (RGB, sRGB/gAMA/cHRM/eXIf/oFFs/pHYs kept), only the IDAT re-encoded."""
  import io
  orig=png.read_bytes();buf=io.BytesIO();Image.fromarray(np.ascontiguousarray(rgb),'RGB').save(buf,format='PNG',optimize=True)
  new=[c for t,c in _chunks(buf.getvalue()) if t==b'IDAT'];out=[orig[:8]];done=False
  for t,c in _chunks(orig):
    if t==b'IDAT':
      if not done:out+=new;done=True
    else:out.append(c)
  png.write_bytes(b''.join(out))
def main(check=False):
  png=M/'T_LK_palette_256.png';im=np.array(Image.open(png).convert('RGBA'))
  for k,(src,col,rgb) in CELLS.items():
    s=im[src[1]*16+8,src[0]*16+8];assert s[3]==255,k
    cell=im[ROW*16:(ROW+1)*16,col*16:(col+1)*16];assert (cell[...,:3]==0).all() or (cell[...,:3]==rgb).all(),'row %d col %d not free'%(ROW,col)
    cell[...,:3]=rgb;cell[...,3]=255
  changed={}
  for name,keys in GLBS.items():
    p=M/name;b,j,bo=glb(p);moved=0
    for m in j['meshes']:
      for pr in m['primitives']:
        a=j['accessors'][pr['attributes']['TEXCOORD_0']];assert a['componentType']==5126 and a['type']=='VEC2'
        bv=j['bufferViews'][a['bufferView']];st=bv.get('byteStride',8);off=bo+bv.get('byteOffset',0)+a.get('byteOffset',0)
        for i in range(a['count']):
          o=off+i*st;u,v=struct.unpack_from('<ff',b,o);cx,cy=int(u*16),int(v*16)
          for k in keys:
            src,col,_=CELLS[k]
            if (cx,cy)==src:struct.pack_into('<ff',b,o,(col*16+u*256-src[0]*16)/256,(ROW*16+v*256-src[1]*16)/256);moved+=1
    changed[name]=moved
    if not check:p.write_bytes(bytes(b))
  if not check:save_png_like(png,im[...,:3])
  print(json.dumps(changed))
if __name__=='__main__':main('--check' in sys.argv)
