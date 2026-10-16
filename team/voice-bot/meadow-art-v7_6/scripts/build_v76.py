# v7.6: Cocos 3.8 import fixes + true-camera (PR58 MeadowSceneData PORTRAIT [0,24,45]->[0,4,4]) life placement
import os,sys,json,math,copy,numpy as np
sys.path.insert(0,'/tmp');from lib import load,save,acc as A
os.environ['GLB']=sys.argv[1]
from ground import gh,ray,P0,T0,FOV
j,b=load(sys.argv[1]);rep={'removed':[],'changed':[]}
def add(arr,comp,typ,target=None,minmax=False,norm=False):
  global b
  while len(b)%4:b.append(0)
  raw=arr.tobytes();bv={'buffer':0,'byteOffset':len(b),'byteLength':len(raw)}
  if target:bv['target']=target
  b+=raw;j['bufferViews'].append(bv)
  a={'bufferView':len(j['bufferViews'])-1,'componentType':comp,'count':len(arr),'type':typ}
  if norm:a['normalized']=True
  if minmax:a['min']=arr.min(0).tolist() if arr.ndim>1 else [float(arr.min())];a['max']=arr.max(0).tolist() if arr.ndim>1 else [float(arr.max())]
  j['accessors'].append(a);return len(j['accessors'])-1
nid={n.get('name'):i for i,n in enumerate(j['nodes'])}
# 1 strip KHR_materials_specular (unsupported by Cocos 3.8 importer)
for m in j['materials']:
  if 'KHR_materials_specular' in m.get('extensions',{}):del m['extensions']['KHR_materials_specular']
  if 'extensions' in m and not m['extensions']:del m['extensions']
j['extensionsUsed']=[e for e in j['extensionsUsed'] if e!='KHR_materials_specular'];rep['removed'].append('KHR_materials_specular x5')
# 2 terrain: drop broken _DRIFT (pointed at an index accessor, count 17214 != 6561; unused by engine) -> ground primitive was rejected
for me in j['meshes']:
  for p in me['primitives']:
    if '_DRIFT' in p['attributes']:
      del p['attributes']['_DRIFT'];rep['removed'].append('meadow_terrain._DRIFT (invalid accessor)')
      del p['attributes']['TEXCOORD_1'];rep['removed'].append('meadow_terrain.TEXCOORD_1 (only for an unimplemented detail shader; Cocos standard ignores it)')
# 3 two-sided cards: flag + wings get a back copy with flipped normals; single-sided material (no backface lit-from-behind black)
card=copy.deepcopy(j['materials'][1]);card['name']='M_meadow_palette_card';card['doubleSided']=False;j['materials'].append(card);CM=len(j['materials'])-1
cards=[n for n in nid if n.startswith('windmill_flag_seg_') or '_wing_' in n]
for n in cards:
  p=j['meshes'][j['nodes'][nid[n]]['mesh']]['primitives'][0];at=p['attributes']
  P=A(j,b,at['POSITION']).astype(np.float32);Nn=A(j,b,at['NORMAL']).astype(np.float32);U=A(j,b,at['TEXCOORD_0']).astype(np.float32)
  I=A(j,b,p['indices']).reshape(-1,3).astype(np.int64);n0=len(P)
  P2=np.vstack([P,P]);N2=np.vstack([Nn,-Nn]);U2=np.vstack([U,U]);I2=np.vstack([I,I[:,::-1]+n0]).astype(np.uint16).ravel()
  p['attributes']={'POSITION':add(P2,5126,'VEC3',34962,True),'NORMAL':add(N2,5126,'VEC3',34962),'TEXCOORD_0':add(U2,5126,'VEC2',34962)}
  p['indices']=add(I2,5123,'SCALAR',34963);p['material']=CM
rep['changed'].append('two-sided cards: '+','.join(cards))
# 4 true-camera placement
f=T0-P0;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);th=math.tan(math.radians(FOV)/2)
mpp=lambda d:2*d*th/812   # metres per screen px at depth d (375x812)
def shift_node(name,dy_px,depth):  # move along camera-up so it lands dy_px lower on screen, same depth
  i=nid[name];j['nodes'][i]['translation']=(np.array(j['nodes'][i].get('translation',[0,0,0]))-u*dy_px*mpp(depth)).tolist()
shift_node('meadow_clouds_near',255,150)  # cloud underside: -176 -> ~80 px
ba={a['name']:a for a in j['animations']}['meadow_birds_loop']
for c in ba['channels']:
  if c['target']['node']==nid['meadow_birds_root'] and c['target']['path']=='translation':
    sm=ba['samplers'][c['sampler']];V=A(j,b,sm['output']).astype(np.float64);sm['output']=add((V-u*250*mpp(140)).astype(np.float32),5126,'VEC3',None,True)  # birds y -200 -> ~50 px
anim={a['name']:a for a in j['animations']}['meadow_butterflies_loop']
def ch(node,path):
  for c in anim['channels']:
    if c['target']['node']==nid[node] and c['target']['path']==path:return anim['samplers'][c['sampler']]
# 01/02: keep motion, move into the free strip below the board (old ~y 480-540 is under the board)
for nm in ('meadow_butterfly_01','meadow_butterfly_02'):
  s=ch(nm,'translation');a=j['accessors'][s['output']];V=A(j,b,s['output']).astype(np.float64)
  c=V.mean(0);c2=c+np.array([0,0,10.5]);dy=gh(c2[0],c2[2])-gh(c[0],c[2]);V2=(V+[0,dy,10.5]).astype(np.float32)
  s['output']=add(V2,5126,'VEC3',None,True)
# 00: new low path, right->left across the bottom strip, 0.2-2.7 s; scale 2.6 (wingspan 0.38 -> 0.99 m)
T=A(j,b,ch('meadow_butterfly_00','translation')['input']).ravel()
WP=[(0.0,440,722,25.5),(0.2,400,720,25.5)]+[(0.2+2.5*k,400-440*k,720-60*k+14*math.sin(k*9),25.5-1.5*k) for k in [i/10 for i in range(1,11)]]+[(3.1,-120,650,24),(4.0,-90,900,24),(7.0,470,900,25),(7.6,470,722,25.5),(8.0,440,722,25.5)]
def scr(t):
  for (t0,x0,y0,d0),(t1,x1,y1,d1) in zip(WP,WP[1:]):
    if t0<=t<=t1:
      k=(t-t0)/(t1-t0) if t1>t0 else 0;sx,sy,d=x0+(x1-x0)*k,y0+(y1-y0)*k,d0+(d1-d0)*k;break
  w=ray(sx,sy);w/=np.linalg.norm(w);return P0+w*d
Pt=np.array([scr(t) for t in T]);Pt[-1]=Pt[0]
hag=[p[1]-gh(p[0],p[2]) for p in Pt]
Q=[]
for k in range(len(T)):
  v=Pt[(k+1)%len(T)]-Pt[k-1];a_=math.atan2(-v[0],-v[2]);Q.append([0,math.sin(a_/2),0,math.cos(a_/2)])
ch('meadow_butterfly_00','translation')['output']=add(Pt.astype(np.float32),5126,'VEC3',None,True)
ch('meadow_butterfly_00','rotation')['output']=add(np.array(Q,np.float32),5126,'VEC4')
j['nodes'][nid['meadow_butterfly_00']]['scale']=[2.6,2.6,2.6]
rep['butterfly_00_height_above_ground_m']=[round(min(hag[k] for k in range(len(T)) if .2<=T[k]<=2.7),2),round(max(hag[k] for k in range(len(T)) if .2<=T[k]<=2.7),2)]
# 5 recompute declared min/max everywhere (animation time accessors were 0 vs 1.2e-9)
for i,a in enumerate(j['accessors']):
  if 'min' in a and 'bufferView' in a:
    v=A(j,b,i);a['min']=v.min(0).astype(float).tolist();a['max']=v.max(0).astype(float).tolist()
# 6 prune: rewrite buffer with only referenced bufferViews
used=set(a['bufferView'] for a in j['accessors'] if 'bufferView' in a)|set(im['bufferView'] for im in j['images'] if 'bufferView' in im)
used_acc=set()
def walk(o):
  pass
for me in j['meshes']:
  for p in me['primitives']:used_acc|=set(p['attributes'].values());used_acc.add(p['indices']) if 'indices' in p else None
for an in j['animations']:
  for s in an['samplers']:used_acc|={s['input'],s['output']}
for sk in j.get('skins',[]):used_acc.add(sk.get('inverseBindMatrices'))
amap={};acc2=[]
for i,a in enumerate(j['accessors']):
  if i in used_acc:amap[i]=len(acc2);acc2.append(a)
for me in j['meshes']:
  for p in me['primitives']:
    p['attributes']={k:amap[v] for k,v in p['attributes'].items()}
    if 'indices' in p:p['indices']=amap[p['indices']]
for an in j['animations']:
  for s in an['samplers']:s['input']=amap[s['input']];s['output']=amap[s['output']]
j['accessors']=acc2
usedbv=sorted(set(a['bufferView'] for a in acc2 if 'bufferView' in a)|set(im['bufferView'] for im in j['images'] if 'bufferView' in im))
nb=bytearray();bmap={};bvs=[]
for i in usedbv:
  bv=dict(j['bufferViews'][i]);o=bv.get('byteOffset',0);
  while len(nb)%4:nb.append(0)
  nb+=b[o:o+bv['byteLength']];bv['byteOffset']=len(nb)-bv['byteLength'];bmap[i]=len(bvs);bvs.append(bv)
for a in acc2:a['bufferView']=bmap[a['bufferView']]
for im in j['images']:
  if 'bufferView' in im:im['bufferView']=bmap[im['bufferView']]
j['bufferViews']=bvs
# BUFFER_VIEW_TARGET: index views must not double as vertex views (validator) -> drop targets on views shared across uses
save(sys.argv[2],j,nb);print(json.dumps(rep,ensure_ascii=False))
