import re
import json,struct,numpy as np,hashlib,gzip
def load(p):
  d=open(p,'rb').read();n=struct.unpack('<I',d[12:16])[0];j=json.loads(d[20:20+n]);b=d[28+n:]
  def acc(i):
    a=j['accessors'][i];ct={5126:'f4',5123:'u2',5121:'u1',5125:'u4',5122:'i2',5120:'i1'}[a['componentType']]
    k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    if 'bufferView' not in a: return np.zeros((a['count'],k),ct).tobytes()
    v=j['bufferViews'][a['bufferView']];st=v.get('byteStride',0);es=np.dtype(ct).itemsize*k;o=v.get('byteOffset',0)+a.get('byteOffset',0)
    if st and st!=es: return b''.join(b[o+i*st:o+i*st+es] for i in range(a['count']))
    return bytes(b[o:o+a['count']*es])
  def img(i):
    im=j['images'][i];v=j['bufferViews'][im['bufferView']];return bytes(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
  return j,acc,img,d
def chans(j,acc):
  r={}
  for a in j['animations']:
    for c in a['channels']:
      s=a['samplers'][c['sampler']];r[(a['name'],j['nodes'][c['target']['node']]['name'],c['target']['path'])]=(acc(s['input']),acc(s['output']),s.get('interpolation','LINEAR'))
  return r
def meshes(j,acc,img):
  r={}
  for x in j['nodes']:
    if 'mesh' not in x:continue
    m=j['meshes'][x['mesh']];prims=[]
    for p in m['primitives']:
      mat=j['materials'][p['material']] if 'material' in p else None
      tex=[]
      def walk(o):
        if isinstance(o,dict):
          for k,v in o.items():
            if k.endswith('Texture') and isinstance(v,dict) and 'index' in v: tex.append(hashlib.sha256(img(j['textures'][v['index']]['source'])).hexdigest())
            else: walk(v)
      walk(mat)
      prims.append(({k:hashlib.sha256(acc(v)).hexdigest() for k,v in p['attributes'].items()},hashlib.sha256(acc(p['indices'])).hexdigest() if 'indices' in p else None,[{k:hashlib.sha256(acc(v)).hexdigest() for k,v in t.items()} for t in p.get('targets',[])],re.sub(r"\"index\": [0-9]+","\"index\": T",json.dumps(mat,sort_keys=True)),tex))
    r[x['name']]=(prims,json.dumps({k:x.get(k) for k in ('translation','rotation','scale','skin')},sort_keys=True),json.dumps(m.get('weights')),json.dumps(m.get('extras'),sort_keys=True))
  return r
def skin(j,acc):
  s=j['skins'][0];return [j['nodes'][i]['name'] for i in s['joints']],hashlib.sha256(acc(s['inverseBindMatrices'])).hexdigest()
def tree(j):
  out=[]
  def w(i,p):
    x=j['nodes'][i];
    if 'mesh' not in x: out.append((p+'/'+x['name'],json.dumps({k:x.get(k) for k in ('translation','rotation','scale')},sort_keys=True)))
    for c in x.get('children',[]):w(c,p+'/'+x['name'])
  for r in j['scenes'][0]['nodes']:w(r,'')
  return out
P='/workspace/yiqifengle/previews/角色动画bot/'
S=load(P+'scarf-lantern/planB_cand3b_ribbonwind4b_stepdown_scarf.glb');M=load('planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb');B=load(P+'planB-verify/cand3/planB_cand3b_ribbonwind4b_stepdown.glb');C=load('scarf_snow_subpkg.glb')
R={}
cs,cm,cb=chans(S[0],S[1]),chans(M[0],M[1]),chans(B[0],B[1])
R['main_vs_3b49_channels']={'n_3b49':len(cs),'n_main':len(cm),'identical':sum(cs[k]==cm.get(k) for k in cs),'missing_or_diff':[str(k) for k in cs if cs[k]!=cm.get(k)]+[str(k) for k in cm if k not in cs]}
nonscarf=[k for k in cb]
R['main_vs_31eb_channels']={'n_base':len(cb),'identical':sum(cb[k]==cm.get(k) for k in cb),'diff':[str(k) for k in cb if cb[k]!=cm.get(k)],'extra_in_main':sorted({k[1] for k in cm if k not in cb}),'extra_count':sum(k not in cb for k in cm)}
R['anim_names_durations_equal_3b49']=[a['name'] for a in S[0]['animations']]==[a['name'] for a in M[0]['animations']]
mm,mb,ms=meshes(M[0],M[1],M[2]),meshes(B[0],B[1],B[2]),meshes(S[0],S[1],S[2])
R['main_meshes_vs_31eb']={'names_main':sorted(mm),'names_base':sorted(mb),'all_identical':mm==mb}
R['main_meshes_vs_3b49_nonscarf']=all(mm[k]==ms[k] for k in mm)
R['skin_main_eq_3b49']=skin(M[0],M[1])==skin(S[0],S[1]);R['skin_main_joints']=len(skin(M[0],M[1])[0])
R['skin_scarfpkg_eq_main']=skin(C[0],C[1])==skin(M[0],M[1])
R['tree_main_eq_3b49']=tree(M[0])==tree(S[0]);R['tree_scarfpkg_eq_main']=tree(C[0])==tree(M[0])
mc=meshes(C[0],C[1],C[2]);R['scarf_mesh_eq_3b49']=mc.get('LOD0_G2_SCARF')==ms['LOD0_G2_SCARF'];R['scarfpkg_meshes']=sorted(mc);R['scarfpkg_has_anim']='animations' in C[0]
# base vs main skin joints
jb=skin(B[0],B[1])[0];R['base_joints']=len(jb)
def sz(p):d=open(p,'rb').read();return len(d),len(gzip.compress(d,9)),hashlib.sha256(d).hexdigest()
for k,p in [('base_31eb',P+'planB-verify/cand3/planB_cand3b_ribbonwind4b_stepdown.glb'),('scarf_3b49',P+'scarf-lantern/planB_cand3b_ribbonwind4b_stepdown_scarf.glb'),('main',  'planB_cand3b_ribbonwind4b_stepdown_scarfbones.glb'),('scarf_subpkg','scarf_snow_subpkg.glb')]:R['size_'+k]=sz(p)
R['delta_main_vs_base']={'bytes':R['size_main'][0]-R['size_base_31eb'][0],'gzip':R['size_main'][1]-R['size_base_31eb'][1]}
json.dump(R,open('verify_split.json','w'),indent=1,ensure_ascii=False);print(json.dumps(R,indent=1,ensure_ascii=False))
