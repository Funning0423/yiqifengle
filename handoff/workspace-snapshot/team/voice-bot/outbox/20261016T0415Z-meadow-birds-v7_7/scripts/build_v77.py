# v7.7: (a) birds re-routed into the free band between info plate (y96-156) and tray (y212) under PR58 true camera,
# 3 visible birds (03/04 node scale 0), slow left->right drift; (b) cloud COLOR_0 re-encoded linear->sRGB
# because Cocos builtin-unlit does SRGBToLinear(v_color) (glTF linear values rendered near-black underside).
import sys,math,json,re,subprocess,numpy as np
sys.path.insert(0,'/tmp/b77');from lib import load,save,acc as A
src,dst=sys.argv[1],sys.argv[2]
j,b=load(src);N=j['nodes'];nid={n.get('name'):i for i,n in enumerate(N)}
ts=subprocess.check_output(['git','-C','/workspace/wechat-game/yiqifengle','show','aabd8a2:creator-build-project/assets/scripts/region/MeadowSceneData.ts'],text=True)
m=re.search(r'const PORTRAIT: AuthoredPose = (\{.*?\});',ts);pose=json.loads(re.sub(r'(\w+):',r'"\1":',m.group(1)))
P0=np.array(pose['position'],float);T0=np.array(pose['target'],float);FOV=pose['fovVerticalDeg']
f=T0-P0;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);th=math.tan(math.radians(FOV)/2)
W,H=float(sys.argv[3]),float(sys.argv[4])
def world(px,py,d): # screen pt -> world at camera depth d
  x=(px/W*2-1)*th*W/H*d;y=(1-py/H*2)*th*d;return P0+f*d+r*x+u*y
def add(arr,comp,typ,minmax=True):
  while len(b)%4:b.append(0)
  raw=arr.tobytes();j['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':len(raw)});b.extend(raw)
  a={'bufferView':len(j['bufferViews'])-1,'componentType':comp,'count':len(arr),'type':typ}
  if minmax:a['min']=arr.min(0).tolist();a['max']=arr.max(0).tolist()
  j['accessors'].append(a);return len(j['accessors'])-1
D=float(sys.argv[5]);S=float(sys.argv[6]);YC=float(sys.argv[7]);BOB=float(sys.argv[8])
root=nid['meadow_birds_root'];N[root]['scale']=[S,S,S]
for k in ('meadow_bird_03','meadow_bird_04'):N[nid[k]]['scale']=[0,0,0]
an=[a for a in j['animations'] if a['name']=='meadow_birds_loop'][0]
def put(ai,arr):
  a=j['accessors'][ai];bv=j['bufferViews'][a['bufferView']];o=bv.get('byteOffset',0)+a.get('byteOffset',0)
  assert bv.get('byteStride',arr.itemsize*arr.shape[1])==arr.itemsize*arr.shape[1] and a['count']==len(arr) and a['componentType']==5126
  b[o:o+arr.nbytes]=arr.tobytes()
  if 'min' in a:a['min']=arr.min(0).tolist();a['max']=arr.max(0).tolist()
X0,X1,TC=-110,W+110,18.0;
for c in an['channels']:
  if c['target']['node']==root and c['target']['path']=='translation':
    s_=an['samplers'][c['sampler']];T=A(j,b,s_['input']).ravel();V=[]
    shared=[c2 for a2 in j['animations'] for c2 in a2['samplers'] if c2['output']==s_['output']];assert len(shared)==1
    for t in T:
      if t<=TC:V.append(world(X0+(X1-X0)*t/TC,YC+BOB*math.sin(2*math.pi*t/9),D))
      else:
        Q=[(TC,world(X1,YC,D)),(18.6,P0+r*25-f*6),(19.4,P0-r*25-f*6),(20.0,world(X0,YC,D))]
        for (ta,pa),(tb,pb) in zip(Q,Q[1:]):
          if t<=tb+1e-6:V.append(pa+(pb-pa)*(t-ta)/(tb-ta));break
    put(s_['output'],np.array(V,np.float32))
p=j['meshes'][N[nid['meadow_clouds_near']]['mesh']]['primitives'][0]
C=A(j,b,p['attributes']['COLOR_0']).astype(np.float64)
Cs=np.where(C<=0.0031308,12.92*C,1.055*np.power(C,1/2.4)-0.055).astype(np.float32)
put(p['attributes']['COLOR_0'],Cs)
save(dst,j,b);print('ok',Cs.min(0),Cs.max(0))
