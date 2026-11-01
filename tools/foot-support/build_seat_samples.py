from pathlib import Path
import sys,json,math,struct
import numpy as np
from scipy.spatial.transform import Rotation as R
import argparse
args=argparse.ArgumentParser();args.add_argument('--input',required=True);args.add_argument('--output',required=True);args.add_argument('--report',required=True);args=args.parse_args();P=Path(__file__).resolve().parents[2];sys.path.insert(0,str(P/'tools/static-seat'));sys.path.insert(0,str(P/'tools/character-repair'))
from glb_local import Glb
from door_ik import worlds,sample,between
g=Glb(args.input);old=Glb(args.input);seat=Glb(P/'output/character-repair/original.glb');names={n['name']:i for i,n in enumerate(g.j['nodes'])};report=[]
def append(arr,typ):
 arr=np.asarray(arr,dtype='<f4');padding=(-len(g.b))%4;g.b+=b'\0'*padding;off=len(g.b);g.b+=arr.tobytes();vi=len(g.j['bufferViews']);g.j['bufferViews'].append(dict(buffer=0,byteOffset=off,byteLength=arr.nbytes));ai=len(g.j['accessors']);a=dict(bufferView=vi,componentType=5126,count=len(arr),type=typ)
 if typ=='SCALAR':a.update(min=[float(arr.min())],max=[float(arr.max())])
 g.j['accessors'].append(a);return ai
for a in g.j['animations']:
 name=a['name']
 if name not in ['stand_up','sit_down','sit_hold']:continue
 oa=next(x for x in old.j['animations'] if x['name']==name);sa=next(x for x in seat.j['animations'] if x['name']==name)
 dur=max(float(old.accessor(s['input'])[-1,0]) for s in oa['samplers']);N=round(dur*120);times=np.linspace(0,dur,N+1);targets={};maxcorr=0
 for side in ['L','R']:targets[side]=[worlds(seat,sa,float(t))[0][names['foot.'+side]][:3,3] for t in times]
 for side in ['L','R']:
  thigh,shin,foot=[names[n+'.'+side] for n in ['thigh','shin','foot']];out={i:[] for i in [thigh,shin,foot]};unreachable=0
  for t,target in zip(times,targets[side]):
   wm,parent=worlds(old,oa,float(t));start=wm[thigh][:3,3];knee=wm[shin][:3,3];v1=sample(old,oa,shin,'translation',t);v2=sample(old,oa,foot,'translation',t);l1=np.linalg.norm(v1);l2=np.linalg.norm(v2);d=np.linalg.norm(target-start);axis=(target-start)/d
   if d>=l1+l2-1e-7 or d<=abs(l1-l2)+1e-7:unreachable+=1;d=np.clip(d,abs(l1-l2)+1e-7,l1+l2-1e-7);target=start+axis*d
   x=(d*d+l1*l1-l2*l2)/(2*d);height=math.sqrt(max(0,l1*l1-x*x));perp=knee-start-axis*((knee-start)@axis)
   if np.linalg.norm(perp)<1e-8:perp=np.cross(axis,[0,0,1])
   perp/=np.linalg.norm(perp);newk=start+axis*x+perp*height;upper=between(knee-start,newk-start)@wm[thigh][:3,:3];base=upper@R.from_quat(sample(old,oa,shin,'rotation',t)).as_matrix();lower=between(base@v2,target-newk)@base
   orient=worlds(seat,sa,float(t))[0][foot][:3,:3]
   for node,rot in [(thigh,wm[parent[thigh]][:3,:3].T@upper),(shin,upper.T@lower),(foot,lower.T@orient)]:out[node].append(R.from_matrix(rot).as_quat())
  ti=append(times[:,None],'SCALAR')
  for node,vals in out.items():
   vals=np.array(vals)
   for i in range(1,len(vals)):
    if vals[i]@vals[i-1]<0:vals[i]*=-1
   c=next(c for c in a['channels'] if c['target']==dict(node=node,path='rotation'));s=a['samplers'][c['sampler']];s['input']=ti;s['output']=append(vals,'VEC4')
  report.append(dict(clip=name,side=side,samples=len(times),unreachable=unreachable,max_contact_correction_mm=maxcorr*1000))
# All old BIN bytes, mesh topology/materials/skin and unrelated channels are retained; replace only six leg rotation sampler references per seated clip.
g.j['buffers'][0]['byteLength']=len(g.b);jb=json.dumps(g.j,separators=(',',':'),ensure_ascii=False).encode();jb+=b' '*((-len(jb))%4);bb=bytes(g.b)+b'\0'*((-len(g.b))%4);raw=struct.pack('<III',0x46546c67,2,28+len(jb)+len(bb))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(bb),b'BIN\0')+bb;Path(args.output).write_bytes(raw);Path(args.report).write_text(json.dumps(report,indent=2));print(report)
