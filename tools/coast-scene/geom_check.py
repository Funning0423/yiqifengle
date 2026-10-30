import json,math,numpy as np
L=json.load(open('coast-build-r4b/coast_layout_full.json'))['layout'];M=json.load(open('coast-build-r4b/coast_meshes.json'))
T=np.array(M['terrain']['positions']).reshape(-1,3,3)  # Y-up local: (x, h, -y)
def gh(X,Z):
  best=None
  for t in T[(np.abs(T[:,:,0].mean(1)-X)<1.5)&(np.abs(T[:,:,2].mean(1)-Z)<1.5)]:
    a,b,c=t;v0=c-a;v1=b-a;v2=np.array([X,0,Z])-a
    d00=v0[0]**2+v0[2]**2;d01=v0[0]*v1[0]+v0[2]*v1[2];d11=v1[0]**2+v1[2]**2;d20=v2[0]*v0[0]+v2[2]*v0[2];d21=v2[0]*v1[0]+v2[2]*v1[2]
    den=d00*d11-d01*d01
    if abs(den)<1e-12:continue
    u=(d11*d20-d01*d21)/den;v=(d00*d21-d01*d20)/den
    if u>=-1e-4 and v>=-1e-4 and u+v<=1+1e-4:return a[1]+u*(c[1]-a[1])+v*(b[1]-a[1])
  return None
mb={n:(min(m['positions'][1::3]),max(m['positions'][1::3]),max(max(abs(v) for v in m['positions'][0::3]),max(abs(v) for v in m['positions'][2::3]))) for n,m in M.items()}
CHK=('dinghy','crabtrap','rope_coil','net_poles','driftwood','ebb_bell','boulder_','rock_','reuse_rock','reuse_grass','reuse_flowers','blob','starfish_deco','shells_scatter','sidepool','hermit','crab')
flo=[];sunk_blob=[];over=[]
inst=[d for d in L if d['mesh'].startswith(CHK) and math.hypot(d['p'][0],d['p'][2])>4.0]
for d in inst:
  x,z,y=d['p'];g=gh(x,y)
  if g is None:continue
  base=z+mb[d['mesh']][0]*d['s']
  if d['mesh']=='blob':
    if not (0.003<=z-g<=0.03):sunk_blob.append((round(x,2),round(y,2),round(z-g,3)))
  elif base-g>0.02:flo.append((d['mesh'],round(x,2),round(y,2),round(base-g,3)))
solid=[d for d in inst if d['mesh'].startswith(('dinghy','crabtrap','rope_coil','net_poles','driftwood','ebb_bell','boulder_','rock_','reuse_rock'))]
for i,a in enumerate(solid):
  for b in solid[i+1:]:
    ra=mb[a['mesh']][2]*a['s']*0.75;rb=mb[b['mesh']][2]*b['s']*0.75   # 0.75: faceted rocks are not full-radius discs
    dd=math.hypot(a['p'][0]-b['p'][0],a['p'][2]-b['p'][2])
    if dd<ra+rb and not (a['mesh'].startswith(('rock_','boulder_','reuse_rock')) and b['mesh'].startswith(('rock_','boulder_','reuse_rock'))) and not {a['mesh'],b['mesh']}<={'crabtrap','crabtrap_mesh','net','net_poles'}:
      over.append((a['mesh'],b['mesh'],round(dd,2),round(ra+rb,2)))
print('instances checked',len(inst));print('floating >2cm',flo);print('blob height off (want 3-30 mm above sand)',sunk_blob);print('prop-prop overlaps',over)

R={n:mb[n][2] for n in mb}
skip={'terrain','headland','foam','foam_inner','reef_base','tide_sheet','footprints','blob','contact','arrival_steps','drift','sidepool'}
cor=[(d['mesh'],d['p']) for d in L if d['mesh'] not in skip and d['mesh'] in R and 4.9-R[d['mesh']]*d['s']<d['p'][2]<13.1+R[d['mesh']]*d['s'] and abs(d['p'][0])<0.45+R[d['mesh']]*d['s'] and mb[d['mesh']][1]*d['s']>0.03]
print('corridor (|x|<0.45+r, z 4.9..13.1 local):',cor)
from scipy.spatial import Delaunay
def wpts(d):
  P=np.array(M[d['mesh']]['positions']).reshape(-1,3)*d['s'];r=d['rz'];c,s_=math.cos(r),math.sin(r)
  X=c*P[:,0]+s_*P[:,2];Z=-s_*P[:,0]+c*P[:,2];return np.c_[X+d['p'][0],P[:,1]+d['p'][1],Z+d['p'][2]]
print('mesh-level penetration (prop vertices inside rock/boulder hull, depth>2cm):')
for a,b,_,_ in over:
  A=[d for d in solid if d['mesh']==a];Bs=[d for d in solid if d['mesh']==b]
  for da in A:
    for db in Bs:
      if math.hypot(da['p'][0]-db['p'][0],da['p'][2]-db['p'][2])>3:continue
      rock,prop=(da,db) if da['mesh'].startswith(('rock_','boulder_','reuse_rock')) else (db,da)
      H=Delaunay(wpts(rock));pp=wpts(prop);ins=H.find_simplex(pp)>=0
      # shrink test: only count if still inside a 2 cm-shrunk hull (approx: centroid-scaled)
      cen=wpts(rock).mean(0);H2=Delaunay(cen+(wpts(rock)-cen)*0.97);ins2=H2.find_simplex(pp)>=0
      print('  %s@(%.2f,%.2f) vs %s@(%.2f,%.2f): %d/%d verts inside'%(prop['mesh'],prop['p'][0],prop['p'][2],rock['mesh'],rock['p'][0],rock['p'][2],ins2.sum(),len(pp)))
