# Shared loader for the Hunyuan V3.1 head (no glTF importer: raw arrays -> numpy -> BVH per albedo class).
# Character space: Blender Z-up, she faces -Y. Raw glTF node has +90deg X rotation, importer adds Y-up->Z-up,
# so Blender = (x,-y,-z) of the raw positions; then HY_S / HY_T (hunyuan-eval/common.py, PM-approved +8-10% head).
import os, json, struct, numpy as np
HY=os.environ.get('HUNYUAN_GLB','/workspace/yiqifengle/previews/grokbot/hunyuan-head/hunyuan_head_v31.glb')
HY_S=float(os.environ.get('HY_S','0.453')); HY_T=np.array((0.0,float(os.environ.get('HY_DY','0.0')),1.464-0.30*0.453))
CLS=os.environ.get('HY_CLASS','/tmp/hy/face_class.npy')   # from hunyuan-eval/scripts/classify_faces.py
NAMES=['hair','skin','hat_straw','pink','shirt_yellow','white','other']
def load():
    f=open(HY,'rb'); f.read(12); l,_=struct.unpack('<II',f.read(8)); j=json.loads(f.read(l)); f.read(8); B=f.read()
    def bv(i): v=j['bufferViews'][i]; o=v.get('byteOffset',0); return B[o:o+v['byteLength']]
    P=np.frombuffer(bv(0),np.float32).reshape(-1,3).astype(np.float64)
    UV=np.frombuffer(bv(2),np.float32).reshape(-1,2)
    I=np.frombuffer(bv(3),np.uint32).reshape(-1,3)
    W=np.stack([P[:,0],-P[:,1],-P[:,2]],1)*HY_S+HY_T
    cls=np.load(CLS) if os.path.exists(CLS) else None
    imgs={im.get('name',str(k)):bv(im['bufferView']) for k,im in enumerate(j['images'])}
    tex=j['textures']; mat=j['materials'][0]
    alb=bv(j['images'][tex[mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]['bufferView'])
    return W,UV,I,cls,alb
def weld(W,I,eps=1e-7):
    q=np.round(W/eps).astype(np.int64); _,first,inv=np.unique(q,axis=0,return_index=True,return_inverse=True)
    return W[first],inv.ravel()[I]
