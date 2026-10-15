"""Standalone frozen diagnostic composition; never writes product files.
Requires source's common.py, rig/glb/triangle helpers, NumPy/Pillow. All inputs explicit.
"""
import argparse, pathlib, sys, json, hashlib, os
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--replay',required=True);p.add_argument('--world',required=True);p.add_argument('--chair-world',required=True);p.add_argument('--tail-target',required=True);p.add_argument('--tail-faces',required=True);p.add_argument('--out',required=True);p.add_argument('--frame',type=int,default=31768);p.add_argument('--views',default='front,side,back');p.add_argument('--no-render',action='store_true');args=p.parse_args()
S=pathlib.Path(args.source).resolve();O=pathlib.Path(args.out).resolve();O.mkdir(parents=True,exist_ok=True)
HELPERS=pathlib.Path(__file__).resolve().parent/"helpers"
os.environ["SIT_FIX_SOURCE"]=str(S)
sys.path.insert(0,str(HELPERS));from common import *
asset=ASSET;out=O;snapshot_args=args
# Define the actual source renderer without invoking its canned fixtures.
sys.argv=['software_render.py',str(asset),str(O)]
exec((HELPERS/'software_render.py').read_text().split('for label,clip,t in')[0])
args=snapshot_args
replay_data=json.load(open(args.replay));frames=replay_data['frames'];f=next(z for z in frames if z['engineFrame']==args.frame);wt=dict(f['morphWeights']);t=f['time'];outgoing=f.get('plan',{}).get('out');fade=1-outgoing['weight'] if outgoing else min(1,t/.2) if f['clip'] in ['stand_up','sit_down'] else 1
for n,a in meta['clips'][f['clip']].get('morph',{}).get('curves',{}).items():
 if n.startswith('task21_'):
  a=np.array(a);wt[n]=float(np.interp(t,a[:,0],a[:,1]))*fade
if outgoing:
 for n,a in meta['clips'][outgoing['clip']].get('morph',{}).get('curves',{}).items():
  if n.startswith('task21_'):
   a=np.array(a);wt[n]=wt.get(n,0)+float(np.interp(outgoing['time'],a[:,0],a[:,1]))*outgoing['weight']
world=np.load(args.world);assert world.shape==(len(r.names),4,4) and np.isfinite(world).all()
md=next(m for m in data if m['name']=='LOD0_G2_BOW' and m['pi']==0);target=np.load(args.tail_target);faces=np.load(args.tail_faces)
assert target.shape==md['P'].shape and faces.shape==md['F'].shape and np.issubdtype(faces.dtype,np.integer)
base=posed(md,r,world,wt);linear=np.sum((world@r.ibm)[md['J'],:3,:3]*md['W'][:,:,None,None],axis=1);delta=np.linalg.solve(linear,(target-base)[...,None])[...,0]
md['D']=list(md['D'])+[delta];md['names']=list(md['names'])+['diagnostic_tail'];wt['diagnostic_tail']=1.;md['F']=faces
err=float(np.max(np.linalg.norm(posed(md,r,world,wt)-target,axis=1)));assert err<1e-10
C=np.load(args.chair_world);a=f['yawRad'];c=np.cos(a);sn=np.sin(a);rr=np.array([[c,0,sn],[0,1,0],[-sn,0,c]]);CC=(C.reshape(-1,3)-f['root'])@rr
root=r.idx['root'];M=world[root]@r.ibm[root]
def rigid_mesh(name,P,F,color):
 mi=len(g.j['materials']);g.j['materials'].append({'pbrMetallicRoughness':{'baseColorFactor':color}});P=(P-M[:3,3])@np.linalg.inv(M[:3,:3]).T;n=len(P)
 data.append(dict(name=name,pi=0,pr={'attributes':{},'material':mi},P=P,N=np.zeros_like(P),J=np.full((n,4),root),W=np.tile([1.,0,0,0],(n,1)),F=F,D=[],names=[]))
rigid_mesh('ContextChair',CC,np.arange(len(CC)).reshape(-1,3),[.35,.18,.08,1])
rigid_mesh('DiagnosticGroundY0',np.array([[-.8,0,-.8],[-.8,0,1],[.8,0,1],[.8,0,-.8]]),np.array([[0,1,2],[0,2,3]]),[.72,.72,.72,1])
views={}
if not args.no_render:
 for label,eye in [('front',[0,.15,3]),('side',[3,.15,.1]),('back',[0,.15,-3])]:
  if label in args.views.split(','):render(world,wt,f'frame{args.frame}-{label}',[0,.85,0],1.9,eye);views[label]=eye
H=lambda x:hashlib.sha256(pathlib.Path(x).read_bytes()).hexdigest()
manifest=dict(status='WIP_OFFLINE_COMPOSITION_NOT_ACCEPTED_NOT_NATIVE',sourceAssetSHA256=H(asset),replaySHA256=H(args.replay),fullOriginalReplaySHA256=replay_data.get('sourceReplaySHA256',H(args.replay)),frame=f['engineFrame'],clip=f['clip'],time=f['time'],root=f['root'],yawRad=f['yawRad'],worldSHA256=H(args.world),chairWorldSHA256=H(args.chair_world),targetSHA256=H(args.tail_target),facesSHA256=H(args.tail_faces),reconstructionErrorM=err,weights=wt,views=views,sourceRendererSHA256=H(HELPERS/'software_render.py'),productChanged=False)
(O/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({k:manifest[k]for k in ['status','frame','reconstructionErrorM']}))
