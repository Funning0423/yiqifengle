# blender -b <body.blend> --python hy_measure.py -- <out.json>
# Landmarks of the Hunyuan head in character space: face extents, eye centres (dark iris clusters), hat frame (PCA on the brim).
import bpy, sys, os, json, math, numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import hy_load as H
OUT=sys.argv[sys.argv.index('--')+1]
W,UV,I,cls,alb=H.load(); C=W[I].mean(1)
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
R={'bones':{b.name:[list(arm.matrix_world@b.head_local),list(arm.matrix_world@b.tail_local)] for b in arm.data.bones if b.name in('chest','neck','head')}}
sk=C[(cls==1)&(C[:,2]>1.44)&(np.abs(C[:,0])<0.11)]
R['face']=dict(min=sk.min(0).tolist(),max=sk.max(0).tolist(),chin_z=float(sk[:,2].min()))
# face width per height (front half, skin)
fw={}
for z in np.arange(1.46,1.62,0.01):
    s=sk[(np.abs(sk[:,2]-z)<0.005)&(sk[:,1]<0)]
    if len(s): fw[round(float(z),3)]=dict(hw=float(np.abs(s[:,0]).max()),front_y=float(s[:,1].min()))
R['face_slices']=fw
# eyes: dark, front-facing triangles inside the face box
rgb=np.load(os.environ.get('HY_RGB','/tmp/hy/face_rgb.npy')).astype(float); lum=rgb.mean(1)
m=(C[:,1]<-0.06)&(C[:,2]>1.48)&(C[:,2]<1.58)&(np.abs(C[:,0])<0.075)&(lum<90)
for side,sg in (('L',-1),('R',1)):
    s=C[m&(np.sign(C[:,0])==sg)&(np.abs(C[:,0])>0.012)]
    if len(s): R['eye_'+side]=dict(n=int(len(s)),centre=np.median(s,0).tolist(),min=np.percentile(s,5,0).tolist(),max=np.percentile(s,95,0).tolist())
# hat: straw+pink above 1.56; brim edge = outer 15% radial in xy around the hat centroid
h=C[((cls==2)|(cls==3))&(C[:,2]>1.56)]
cen=h.mean(0); r=np.linalg.norm((h-cen)[:,:2],axis=1); edge=h[r>np.percentile(r,85)]
ec=edge.mean(0); u,s,vt=np.linalg.svd(edge-ec,full_matrices=False); n=vt[2]; n=n if n[2]>0 else -n
R['hat']=dict(n=int(len(h)),brim_centre=ec.tolist(),brim_normal=n.tolist(),tilt_x_deg=float(math.degrees(math.atan2(n[1],n[2]))),tilt_y_deg=float(math.degrees(math.atan2(n[0],n[2]))),top_z=float(h[:,2].max()))
# hat local radial profile: distance from the axis vs height along the axis
d=h-ec; hz=d@n; hr=np.linalg.norm(d-np.outer(hz,n),axis=1)
prof={}
for z0 in np.arange(-0.03,0.13,0.01):
    s=hr[np.abs(hz-z0)<0.005]
    if len(s): prof[round(float(z0),3)]=dict(rmax=float(s.max()),rmin=float(s.min()),n=int(len(s)))
R['hat_profile']=prof
hr_=C[(cls==0)]; 
hp={}
for z in np.arange(1.40,1.68,0.02):
    s=hr_[np.abs(hr_[:,2]-z)<0.01]
    if len(s): hp[round(float(z),3)]=dict(xmin=float(s[:,0].min()),xmax=float(s[:,0].max()),ymin=float(s[:,1].min()),ymax=float(s[:,1].max()))
R['hair_slices']=hp
json.dump(R,open(OUT,'w'),indent=1); print(json.dumps(R,indent=1))
