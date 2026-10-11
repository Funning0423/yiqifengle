import math,json,pathlib
import numpy as np
from scipy.spatial import ConvexHull
ROOT=pathlib.Path(__file__).resolve().parents[2]
G={};M={
'wood':{'color':[.78,.61,.40,1],'wood':1,'metal':0},
'brass':{'color':[.82,.68,.42,1],'wood':0,'metal':1},
'inside':{'color':[.56,.40,.24,1],'wood':1,'metal':0},
'iron':{'color':[.39,.34,.25,1],'wood':0,'metal':.65},
'leaf':{'color':[.56,.64,.40,1],'wood':0,'metal':.2}}
def group(part,mat):return G.setdefault(part+'_'+mat,{'part':part,'material':mat,'positions':[],'normals':[],'indices':[]})
def tri(part,mat,pts):
 g=group(part,mat);a,b,c=pts;u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];s=math.sqrt(sum(x*x for x in n));
 if s<1e-9:return
 n=[x/s for x in n];start=len(g['positions'])//3
 for p in pts:g['positions']+=list(p);g['normals']+=n
 g['indices']+=list(range(start,start+3))
def face(part,mat,pts):
 for i in range(1,len(pts)-1):tri(part,mat,[pts[0],pts[i+1],pts[i]])
def box(part,mat,c,size,bevel=.025):
 # Beveled cuboid from clipped box planes, with six broad faces and bevel strips/corners.
 x,y,z=c;hx,hy,hz=[s/2 for s in size];b=min(bevel,hx*.45,hy*.45,hz*.45)
 # Each face is an octagon. Construct with a local axis basis preserving outward normals.
 for axis,sign,u,v in [(0,1,1,2),(0,-1,2,1),(1,1,2,0),(1,-1,0,2),(2,1,0,1),(2,-1,1,0)]:
  H=[hx,hy,hz];pts=[]
  for U,V in [(-H[u]+b,-H[v]),(H[u]-b,-H[v]),(H[u],-H[v]+b),(H[u],H[v]-b),(H[u]-b,H[v]),(-H[u]+b,H[v]),(-H[u],H[v]-b),(-H[u],-H[v]+b)]:
   p=[x,y,z];p[axis]+=sign*(H[axis]-b);p[u]+=U;p[v]+=V;pts.append(p)
  # Actual rounded cube generated below; this overlapping polygon construction would leave edge cracks.
 # Use bevelled cross-section rings along y, all faces explicit, watertight.
 corners=lambda X,Z:[(-X+b,-Z),(X-b,-Z),(X,-Z+b),(X,Z-b),(X-b,Z),(-X+b,Z),(-X,Z-b),(-X,-Z+b)]
 rings=[]
 for Y,X,Z in [(-hy,hx-b,hz-b),(-hy+b,hx,hz),(hy-b,hx,hz),(hy,hx-b,hz-b)]:rings.append([(x+X0,y+Y,z+Z0) for X0,Z0 in corners(X,Z)])
 face(part,mat,list(reversed(rings[0])));face(part,mat,rings[-1])
 for j in range(3):
  for i in range(8):face(part,mat,[rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]])
def sphere(part,mat,c,r,sc=(1,1,1),steps=8):
 rings=[]
 for j in range(5):
  a=-math.pi/2+math.pi*j/4;rings.append([(c[0]+r*math.cos(a)*math.cos(i*math.tau/steps)*sc[0],c[1]+r*math.sin(a)*sc[1],c[2]+r*math.cos(a)*math.sin(i*math.tau/steps)*sc[2]) for i in range(steps)])
 for j in range(4):
  for i in range(steps):face(part,mat,[rings[j][(i+1)%steps],rings[j+1][(i+1)%steps],rings[j+1][i],rings[j][i]])
def smooth(part,mat,start,r,sign):
 g=group(part,mat)
 for i in range(start,len(g['positions']),3):
  y=g['positions'][i+1]/(r[0]*r[0]);z=g['positions'][i+2]/(r[1]*r[1]);length=math.hypot(y,z);g['normals'][i:i+3]=[0,sign*y/length,sign*z/length]
def arch(part,mat,x0,x1,ro,ri,n=16):
 # Hollow barrel segment with thickness: normals from actual geometry, no single plane.
 outer=[(ro[0]*math.sin(i*math.pi/n),ro[1]*math.cos(i*math.pi/n)) for i in range(n+1)]
 inner=[(ri[0]*math.sin(i*math.pi/n),ri[1]*math.cos(i*math.pi/n)) for i in range(n+1)]
 for i in range(n):
  ya,za=outer[i];yb,zb=outer[i+1];ia,ja=inner[i];ib,jb=inner[i+1]
  start=len(group(part,mat)['positions']);face(part,mat,[(x0,ya,za),(x0,yb,zb),(x1,yb,zb),(x1,ya,za)]);smooth(part,mat,start,ro,1)
  im='inside' if mat=='wood' else mat;start=len(group(part,im)['positions']);face(part,im,[(x1,ia,ja),(x1,ib,jb),(x0,ib,jb),(x0,ia,ja)]);smooth(part,im,start,ri,-1)
  for x,reverse in [(x0,True),(x1,False)]:
   p=[(x,ya,za),(x,yb,zb),(x,ib,jb),(x,ia,ja)];face(part,mat,list(reversed(p)) if reverse else p)
 for i in [0,n]:
  ya,za=outer[i];ia,ja=inner[i];p=[(x0,ya,za),(x1,ya,za),(x1,ia,ja),(x0,ia,ja)];face(part,mat,p if i==0 else list(reversed(p)))
# Body: solid bottom + four thick walls, no filled interior volume.
box('body','wood',(0,.19,0),(2.56,.20,1.48),.035)
box('body','inside',(0,.315,0),(2.31,.055,1.20),.01)
for row in range(3):
 y=.43+row*.305
 for z in [-.68,.68]:box('body','wood',(0,y,z),(2.58,.298,.16),.04)
 for x in [-1.21,1.21]:box('body','wood',(x,y,0),(.16,.298,1.23),.038)
# Inner wall surfaces are solid shallow strips, visible only through open mouth.
for z in [-.588,.588]:box('body','inside',(0,.765,z),(2.28,.87,.018),.004)
for x in [-1.116,1.116]:box('body','inside',(x,.765,0),(.018,.87,1.15),.004)
for z in [-.7,.7]:box('body','brass',(0,1.205,z),(2.64,.075,.13),.016)
for x in [-1.245,1.245]:box('body','brass',(x,1.205,0),(.13,.075,1.30),.016)
for x in [-.85,.85]:
 for z in [-.78,.78]:
  box('body','brass',(x,.727,z),(.17,.97,.045),.015)
  for y in [.42,.75,1.07]:sphere('body','brass',(x,y,z+(.028 if z>0 else -.028)),.041,(1,1,.45))
for x in [-1.1,1.1]:
 for z in [-.55,.55]:box('body','brass',(x,.095,z),(.26,.17,.26),.045)
box('body','brass',(0,.92,.805),(.29,.36,.065),.035)
sphere('body','iron',(0,.96,.845),.045,(1,1,.25));box('body','iron',(0,.912,.853),(.033,.075,.012),.008)
# Lid local coordinates: y=0 at hinge elevation, z=0 at body centre; translate to hinge after construction.
arch('lid','wood',-1.26,1.26,(.58,.78),(.47,.68),20)
# closed solid end caps, separately bevel rim style
for x in [-1.29,1.29]:arch('lid','wood',x-.05,x+.05,(.575,.775),(.018,.024),20)
for x in [-.85,.85]:
 arch('lid','brass',x-.085,x+.085,(.613,.812),(.577,.777),20)
 for a in [.30,.80,1.35,1.90,2.5,2.84]:sphere('lid','brass',(x,.618*math.sin(a),.818*math.cos(a)),.036,(1,.7,.7))
for z in [-.788,.788]:box('lid','brass',(0,.009,z),(2.70,.08,.07),.015)
box('lid','brass',(0,-.10,.823),(.25,.25,.058),.025)
for x in [-.83,.83]:box('body','iron',(x,1.20,-.80),(.30,.13,.14),.045)
# Original woodland cue: raised leaves on the dome and a narrow stem, actual convex geometry.
sphere('lid','leaf',(-.12,.602,.04),.16,(1.35,.13,.6));sphere('lid','leaf',(.11,.592,.19),.14,(1.25,.14,.65));box('lid','leaf',(0,.609,.135),(.035,.025,.39),.006)
# Transfer lid mesh into local hinge coordinates. Native adapter uses position y=1.23,z=-.78 then rotates X.
for g in G.values():
 if g['part']=='lid':
  for i in range(0,len(g['positions']),3):g['positions'][i+2]+=.78
 for key in ['positions','normals']:g[key]=[round(v,6) for v in g[key]]
# Index identical face vertices; preserve hard bevel/wood normals while reducing upload and source size.
for g in G.values():
 lookup={};positions=[];normals=[];indices=[]
 for i in g['indices']:
  key=tuple(g['positions'][i*3:i*3+3]+g['normals'][i*3:i*3+3])
  if key not in lookup:lookup[key]=len(positions)//3;positions+=list(key[:3]);normals+=list(key[3:])
  indices.append(lookup[key])
 g['positions']=positions;g['normals']=normals;g['indices']=indices
bounds=[]
for part in ['body','lid']:
 positions=np.array([g['positions'][i:i+3] for g in G.values() if g['part']==part for i in range(0,len(g['positions']),3)])
 h=ConvexHull(positions);bounds.append({'part':part,'positions':positions[h.vertices].flatten().tolist()})
DATA={'boundsMeshes':bounds,'version':1,'hinge':[0,1.23,-.78],'openDegrees':-105,'materials':M,'meshes':list(G.values())}
path=ROOT/'creator-build-project/assets/scripts/ResultChestGeometry.ts';path.write_text('// Generated by tools/chest-model/build_geometry.py. Real, thick triangle meshes; no image planes.\nexport const RESULT_CHEST_GEOMETRY='+json.dumps(DATA,separators=(',',':'))+';\n')
(ROOT/'tools/chest-model/geometry.json').write_text(json.dumps(DATA,separators=(',',':')))
print({'groups':len(G),'triangles':sum(len(g['indices'])//3 for g in G.values()),'vertices':sum(len(g['positions'])//3 for g in G.values()),'bytes':path.stat().st_size})
