# Palette step for the shipped coast piece sprites (Grok Bot 10/30, size plan "v2"):
#   python3 sprite_palette.py <rgba_sprite_dir> <outdir>
# Input = export_piece_sprites.py post output (192 RGBA). Output = 8-bit palette PNG with tRNS:
#   160 colours for the opaque body (alpha>=250, median cut), up to 47 RGBA entries for the body anti-aliased edge,
#   48 alpha levels for the soft shadow (each level = mean colour of its pixels), 1 fully transparent entry.
import sys,os,io,glob,numpy as np
from PIL import Image
from scipy import ndimage
def palette(im):
  a=np.asarray(im.convert('RGBA')).copy();al=a[...,3];op=al>=250;semi=(al>0)&~op;idx=np.zeros(al.shape,np.uint8)
  o=Image.fromarray(a[op][:,:3].reshape(1,-1,3).astype(np.uint8),'RGB').quantize(160,method=Image.Quantize.MEDIANCUT)
  po=np.array(o.getpalette()[:160*3]).reshape(-1,3);idx[op]=np.asarray(o)[0]
  zone=semi&~ndimage.binary_dilation(op,iterations=3);edge=semi&~zone
  srgb=np.median(a[zone][:,:3],0).astype(int);amax=int(a[zone][:,3].max());NA=min(48,amax)
  lev=np.unique(np.round(np.linspace(1,amax,NA)).astype(int))
  s=Image.fromarray(a[edge].reshape(1,-1,4).astype(np.uint8),'RGBA').quantize(255-160-len(lev)-1,method=Image.Quantize.FASTOCTREE)
  sq=np.asarray(s.convert('RGBA'))[0];uniq,inv=np.unique(sq.reshape(-1,4),axis=0,return_inverse=True)
  idx[edge]=160+inv.reshape(-1);base=160+len(uniq)
  zi=np.abs(a[zone][:,3][:,None]-lev[None]).argmin(1);idx[zone]=base+zi
  ent=np.vstack([np.c_[po,np.full(len(po),255)],uniq,np.c_[np.array([np.round(a[zone][zi==j][:,:3].mean(0)) if (zi==j).any() else srgb for j in range(len(lev))]).astype(int),lev]]);n=len(ent);idx[al==0]=n
  ent=np.vstack([ent,[0,0,0,0]]);assert len(ent)<=256,len(ent)
  P=Image.fromarray(idx,'P');P.putpalette(ent[:,:3].astype(int).flatten().tolist());tr=bytes(ent[:,3].astype(np.uint8).tolist())
  b=io.BytesIO();P.save(b,'PNG',optimize=True,transparency=tr);return b.getvalue()
if __name__=='__main__':
  src,out=sys.argv[1],sys.argv[2];os.makedirs(out,exist_ok=True)
  for f in sorted(glob.glob(os.path.join(src,'piece_*.png'))):
    d=palette(Image.open(f));open(os.path.join(out,os.path.basename(f)),'wb').write(d);print(os.path.basename(f),len(d))
