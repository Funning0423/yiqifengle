# char-polish 2026-11-05: in-place GLB edits (vertex counts, morph counts, names, anims unchanged)
import sys,io,numpy as np
from PIL import Image,ImageFilter,ImageDraw
from gltfio import G,scale_target
SRC,DST=sys.argv[1],sys.argv[2]
P=dict(head_scale=1.12,hand_scale=1.0,apron_push_m=0.002,skirt_low_to_parent=float(sys.argv[3]) if len(sys.argv)>3 else 0.3,
       mustard=(226,170,46))
import os,json as _j; P.update(_j.loads(os.environ.get('POLISH_P','{}')))
g=G(SRC); j=g.j; sk=j['skins'][0]; jn=[j['nodes'][i]['name'] for i in sk['joints']]; JI={n:i for i,n in enumerate(jn)}
ibm=g.get(sk['inverseBindMatrices']).reshape(-1,4,4); JW={n:np.linalg.inv(ibm[i].T)[:3,3] for n,i in JI.items()}
def prims(name): return [p for m in j['meshes'] if m['name']==name for p in m['primitives']]
def jw(p,joint):
    J=g.get(p['attributes']['JOINTS_0']).astype(int); W=g.get(p['attributes']['WEIGHTS_0']); return (W*(J==JI[joint])).sum(1)
def scale_about(p,w,s,piv):
    f=(1+w*(s-1))[:,None]; pos=g.get(p['attributes']['POSITION']); g.put(p['attributes']['POSITION'],piv+(pos-piv)*f)
    for t in p.get('targets',[]):
        if 'POSITION' in t: scale_target(g,t['POSITION'],f)
# 1 head (+hair+hat, all head-weighted on BODY) bigger, pivot = head joint (skull base)
for p in prims('LOD0_G2_BODY'):
    scale_about(p,jw(p,'head'),P['head_scale'],JW['head'])
    for s in 'LR': scale_about(p,jw(p,'hand.'+s),P['hand_scale'],JW['hand.'+s])
# 2 apron off the dress (kills poke-through)
for p in prims('LOD0_G2_APRON'):
    pos=g.get(p['attributes']['POSITION']); n=g.get(p['attributes']['NORMAL']); g.put(p['attributes']['POSITION'],pos+n*P['apron_push_m'])
# 3 skirt weights: move part of each *.low weight to its upper bone -> softer hem swing / less seated flare
up={'skirt.front.low':'skirt.front','skirt.front.low.mid':'skirt.front.mid','skirt.left.low':'skirt.left','skirt.right.low':'skirt.right','skirt.back.low':'skirt.back'}
k=P['skirt_low_to_parent']
for mesh in ('LOD0_G2_DRESS','LOD0_G2_APRON'):
    for p in prims(mesh):
        J=g.get(p['attributes']['JOINTS_0']).astype(int); W=g.get(p['attributes']['WEIGHTS_0'])
        for lo,hi in up.items():
            for c in range(4):
                m=(J[:,c]==JI[lo])&(W[:,c]>0)
                if not m.any(): continue
                if k<=0: continue
                Jm=J[m]; Wm=W[m]; mv=Wm[:,c]*k
                for r in range(len(Jm)):
                    has=np.where((Jm[r]==JI[hi]))[0]
                    free=[s_ for s_ in range(4) if s_!=c and Wm[r,s_]<=1e-6]
                    if len(has): Wm[r,has[0]]+=mv[r]; Wm[r,c]-=mv[r]
                    elif free: Jm[r,free[0]]=JI[hi]; Wm[r,free[0]]=mv[r]; Wm[r,c]-=mv[r]
                J[m]=Jm; W[m]=Wm
        g.put(p['attributes']['JOINTS_0'],J); g.put(p['attributes']['WEIGHTS_0'],W)
# 4/5 textures
def load(n): d,bv=g.image_bytes(n); return Image.open(io.BytesIO(d)).convert('RGB'),bv
def save(n,im,bv):
    b=io.BytesIO(); im.save(b,'JPEG',quality=92); g.replace_view(bv,b.getvalue())
def mustard(im):
    a=np.asarray(im).astype('f4'); r,gg,b=a[...,0],a[...,1],a[...,2]
    m=(r>120)&(gg>100)&(b<0.45*gg)&(gg>0.75*r)  # saturated yellow
    lum=(0.3*r+0.59*gg+0.11*b)/(0.3*252+0.59*235+0.11*40); M=np.array(P['mustard'],'f4')
    a[m]=np.clip(M[None,:]*lum[m][:,None],0,255); return Image.fromarray(a.astype('u1')),int(m.sum())
for n in ('T_G2_DRESS_1024','T_G2_BODY_1024'):
    im,bv=load(n); im,c=mustard(im); save(n,im,bv); print('mustard',n,c)
# face: bigger eyes, darker/thicker brows+lash, readable mouth & nose (main face = lower-left quadrant)
im,bv=load('T_G2_FACE_1024'); im,c=mustard(im); skin=np.array(im.getpixel((300,560)),'f4')
for box in ((80,680,205,815),(305,680,430,815)):
    cx,cy=(box[0]+box[2])/2,(box[1]+box[3])/2; cr=im.crop(box); s=1.22; w,h=cr.size
    big=cr.resize((int(w*s),int(h*s)),Image.LANCZOS)
    a=np.asarray(big).astype('f4'); d=np.abs(a-skin).sum(2); mask=Image.fromarray(((d>25)*255).astype('u1')).filter(ImageFilter.GaussianBlur(1.2))
    im.paste(big,(int(cx-big.size[0]/2),int(cy-big.size[1]/2-6)),mask)
def ink(region,col,grow,thr=30):
    x0,y0,x1,y1=region; cr=im.crop(region); a=np.asarray(cr).astype('f4'); d=np.abs(a-skin).sum(2)
    m=Image.fromarray(((d>thr)*255).astype('u1')).filter(ImageFilter.MaxFilter(grow)).filter(ImageFilter.GaussianBlur(0.8))
    im.paste(Image.new('RGB',cr.size,col),(x0,y0),m)
ink((80,645,215,679),(64,38,34),5)      # brows
ink((300,645,435,679),(64,38,34),5)
ink((225,900,290,935),(150,62,62),5)    # mouth
ink((240,835,275,865),(196,140,120),5,thr=15)  # nose tick
save('T_G2_FACE_1024',im,bv); im.save('/workspace/qifengle/char-polish/work/face_after.png')
g.save(DST); print('saved',DST,P)
