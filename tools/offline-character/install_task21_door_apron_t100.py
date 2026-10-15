"""door_reach t=1.00 apron clearance.

Move the apron triangles that intersect the dress at t=1.00, except the five
apron triangles that formed the six new pairs in the rejected 4 mm move of
every intersecting triangle. Vertices of those five triangles stay put.
Posed displacement is 4 mm along the same outward direction. Weight 1 only
at t=1.00.
"""
from pathlib import Path
import json, shutil, sys
import numpy as np
from scipy.spatial import cKDTree
from common import *
from triangle_cross import cross_chunk

NAME = 'task21_door_apron_clear'
DIST = 0.004

def fast_pairs(A, B):
    if len(A)==0 or len(B)==0: return set()
    a0=A.min(1); a1=A.max(1); b0=B.min(1); b1=B.max(1)
    lo=np.maximum(a0.min(0), b0.min(0))-1e-4
    hi=np.minimum(a1.max(0), b1.max(0))+1e-4
    if np.any(lo>hi): return set()
    ma=np.all((a1>=lo)&(a0<=hi),1); mb=np.all((b1>=lo)&(b0<=hi),1)
    ia=np.flatnonzero(ma); ib=np.flatnonzero(mb)
    if len(ia)==0 or len(ib)==0: return set()
    As=A[ia]; Bs=B[ib]
    cb=Bs.mean(1); rb=np.linalg.norm(Bs-cb[:,None], axis=2).max(1)
    out=set()
    for lo_r, hi_r in ((0,.02),(.02,.045),(.045,10)):
        m=(rb>lo_r)&(rb<=hi_r) if lo_r else (rb<=hi_r)
        idx=np.flatnonzero(m)
        if len(idx):
            ii,jj=cross_chunk(As, Bs[idx])
            if len(ii): out.update(zip(map(int, ia[ii]), map(int, ib[idx[jj]])))
    return out

def skinM(md, world, w, extra=None):
    Sk=world @ r.ibm
    M=np.einsum('vk,vkij->vij', md['W'], Sk[md['J']])
    p=md['P'].copy()
    for n,d in zip(md['names'], md['D']):
        if w.get(n,0): p=p+d*float(w[n])
    if extra is not None: p=p+extra
    vh=np.concatenate([p, np.ones((len(p),1))], 1)
    return np.einsum('vij,vj->vi', M, vh)[:,:3], M

def outward_delta(apron, dress, world, w):
    av,Ma=skinM(apron, world, w)
    dv,_=skinM(dress, world, w)
    Fa,Fd=apron['F'], dress['F']
    ad=fast_pairs(av[Fa], dv[Fd])
    orig=np.array(sorted({i for i,_ in ad}))
    ib=np.array(sorted({j for _,j in ad}))
    verts=np.unique(Fa[orig])
    interior=np.array([0.0, 0.66, -0.05])
    c=dv[Fd].mean(1)
    fn=np.cross(dv[Fd[:,1]]-dv[Fd[:,0]], dv[Fd[:,2]]-dv[Fd[:,0]])
    fn/=np.maximum(np.linalg.norm(fn,axis=1,keepdims=True),1e-12)
    fn2=fn.copy()
    fn2[np.einsum('ij,ij->i', fn, c-interior)<0]*=-1
    nn=cKDTree(c[ib]).query(av[verts], k=1)[1]
    mu=fn2[ib[nn]].mean(0)
    mu=mu/np.linalg.norm(mu)
    R=Ma[verts,:3,:3]
    delta=np.repeat(mu[None]*DIST, len(verts), 0)
    Dfull=np.zeros_like(apron['P'])
    Dfull[verts]=np.linalg.solve(R, delta[:,:,None])[:,:,0]
    av2,_=skinM(apron, world, w, Dfull)
    ad2=fast_pairs(av2[Fa], dv[Fd])
    new=sorted(ad2-ad)
    if len(new)!=6:
        sys.exit('expected 6 new pairs from the full 4mm move, got %d' % len(new))
    bad=sorted({int(a) for a,_ in new})
    reduced=np.array(sorted(set(map(int, orig))-set(bad)))
    bad_verts=set(map(int, np.unique(Fa[bad])))
    move=np.array(sorted(set(map(int, np.unique(Fa[reduced])))-bad_verts))
    D=np.zeros_like(apron['P'])
    Rm=Ma[move,:3,:3]
    D[move]=np.linalg.solve(Rm, np.repeat(mu[None]*DIST, len(move), 0)[:,:,None])[:,:,0]
    return D, reduced, bad, new, ad, mu

src=(ROOT/'tools/offline-character/repair_lower_task16.py').read_text()
exec(src[src.index('def sparse('):src.index('for md in [ds[0],ds[-1]]:')])

backup_glb=Path('/tmp/task21_door_apron_backup.glb')
backup_meta=Path('/tmp/task21_door_apron_backup.json')
shutil.copy(ASSET, backup_glb)
shutil.copy(META, backup_meta)

g, r, ds = load(ASSET)
meta=json.load(open(META))
apron=next(m for m in ds if m['name']=='LOD0_G2_APRON')
dress=next(m for m in ds if m['name']=='LOD0_G2_DRESS')
if NAME in apron['names']:
    sys.exit('already installed '+NAME)
world,w=sample(r,'door_reach',1.0,meta)
w.pop(NAME, None)
D, reduced, bad, new_pairs, before_pairs, mu = outward_delta(apron, dress, world, w)
print('dir', mu.tolist(), 'tris', len(reduced), 'bad', bad, 'maxM', float(np.linalg.norm(D,axis=1).max()), flush=True)

mesh=next(m for m in g.j['meshes'] if m['name']==apron['name'])
entry=meta['morph']['meshes'][apron['name']]['targets']
_,rep=np.unique(np.round(apron['P'],6),axis=0,return_inverse=True)
affected=np.unique(apron['F'][np.any((np.linalg.norm(D,axis=1)>1e-8)[apron['F']],axis=1)])
N=np.zeros_like(apron['N'])
N[affected]=(normals(apron['P']+D, apron['F'], rep)-normals(apron['P'], apron['F'], rep))[affected]
target={'POSITION':sparse(None, D), 'NORMAL':sparse(None, N)}
entry[NAME]=len(apron['pr']['targets'])
apron['pr']['targets'].append(target)
apron['names'].append(NAME)
apron['D'].append(D)
if mesh['extras']['targetNames'] is not apron['names']:
    mesh['extras']['targetNames'].append(NAME)
mesh['weights'].append(0.)
for n in g.j['nodes']:
    if n.get('mesh')==g.j['meshes'].index(mesh) and 'weights' in n:
        n['weights'].append(0.)

cache=np.load('/tmp/task21_frames_cache.npz')
door_t=sorted(set(float(cache['times'][i]) for i,c in enumerate(cache['clips']) if str(c)=='door_reach'))
prev=max(t for t in door_t if t<1.0)
nxt=min(t for t in door_t if t>1.0)
dur=float(meta['clips']['door_reach']['duration_s'])
curve=[[0.0,0.0],[prev,0.0],[1.0,1.0],[nxt,0.0],[dur,0.0]]
meta['clips']['door_reach'].setdefault('morph',{}).setdefault('curves',{})[NAME]=curve

exec(src[src.index('# Repack only referenced bufferViews;'):src.index('META.write_text(')])
META.write_text(json.dumps(meta, ensure_ascii=False, indent=2)+'\n')

# Reload and confirm the installed weight changes only t=1.00, gainedPairs 0.
g2,r2,ds2=load(ASSET)
meta2=json.load(open(META))
apron2=next(m for m in ds2 if m['name']=='LOD0_G2_APRON')
dress2=next(m for m in ds2 if m['name']=='LOD0_G2_DRESS')
body=next(m for m in ds2 if m['name']=='LOD0_G2_BODY' and m['pi']==0)
legm=next(m for m in ds2 if m['name']=='LOD0_G2_BODY' and m['pi']==4)
r=r2
world,w1=sample(r2,'door_reach',1.0,meta2)
w0=dict(w1); w0[NAME]=0.0
assert abs(w1[NAME]-1.0)<1e-8
av0,_=skinM(apron2, world, w0)
av1,_=skinM(apron2, world, w1)
dv,_=skinM(dress2, world, w1)
bv,_=skinM(body, world, w1)
lv,_=skinM(legm, world, w1)
F=body['F']
hf=F[np.all(np.isin(F, np.r_[2758:3231,4136:4176,4449:4779]),1)]
sf=F[np.any(np.isin(F, np.arange(1503,2543)),1)]
legbones=[r2.idx[n] for n in ['thigh.L','thigh.R','shin.L','shin.R']]
legvert=(body['W']*np.isin(body['J'], legbones)).sum(1)>.5
lf=F[np.all(legvert[F],1)]
lt=np.concatenate([bv[lf], lv[legm['F']]])
Fa,Fd=apron2['F'], dress2['F']
ad0=fast_pairs(av0[Fa], dv[Fd])
ad1=fast_pairs(av1[Fa], dv[Fd])
gained=len(ad1-ad0)
gained+=len(fast_pairs(bv[sf], av1[Fa])-fast_pairs(bv[sf], av0[Fa]))
gained+=len(fast_pairs(bv[hf], av1[Fa])-fast_pairs(bv[hf], av0[Fa]))
gained+=len(fast_pairs(lt, av1[Fa])-fast_pairs(lt, av0[Fa]))
legs0=len(fast_pairs(lt, dv[Fd]))
print('installed apronDress', len(ad0), '->', len(ad1), 'legsDress', legs0, 'gainedPairs', gained, 'tris', len(reduced), flush=True)
changed=[]
for i,c in enumerate(cache['clips']):
    if str(c)!='door_reach': continue
    t=float(cache['times'][i])
    wt=float(np.interp(t, [p[0] for p in curve], [p[1] for p in curve]))
    if wt>1e-8: changed.append((t, wt))
if changed or gained or len(ad1)>=len(ad0) or legs0!=43:
    shutil.copy(backup_glb, ASSET)
    shutil.copy(backup_meta, META)
    sys.exit('revert install gained=%s before=%s after=%s legs=%s leaked=%s' % (gained, len(ad0), len(ad1), legs0, changed))
wl=meta2['clips']['walk_loop']['morph']['curves']['task21_walk_apron_side']
assert [p for p in wl if p[1]!=0]==[[0.020511390162787357, 1]]
old=np.load(ROOT/'tools/offline-character/task21-walk-stop-bodyR-fields.npz')
fields={k: np.array(old[k]) for k in old.files}
old.close()
fields['D_door']=D.astype(np.float32)
np.savez(ROOT/'tools/offline-character/task21-walk-stop-bodyR-fields.npz', **fields)
print('kept', NAME, sha(ASSET.read_bytes()), flush=True)
