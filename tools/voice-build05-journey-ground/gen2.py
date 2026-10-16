"""Re-runnable ground-detail scatter for env_skycity.glb (glTF/glb-local space).
usage: blender -b --python gen2.py -- <env_skycity.glb> <route.csv> <dmin> <dmax> <tag> <out.json> [exclude.json...]
 route.csv = GGbot route-height CSV (d_m,phase,...,sky_local_x/y/z). Cameras = journeyCamera@d28ee16 along [dmin,dmax].
 Mid platform pass (a373227): 13.5 35 mid.  Late pass: 35 46 late  (pass mid json as exclude to avoid doubles)."""
import sys,random; exec(open(__file__.rsplit('/',1)[0]+'/c2.py').read())
glb,csvf,dmin,dmax,tag,out=sys.argv[sys.argv.index('--')+1:][:6]; excl=sys.argv[sys.argv.index('--')+7:]
dmin,dmax=float(dmin),float(dmax)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
random.seed(20261016+sum(map(ord,tag)))
R=load_route(csvf); go=bpy.data.objects['env_sky_static_palette']; mw=go.matrix_world; me=go.data
ds=[dmin+i*1.0 for i in range(int(dmax-dmin)+1)]; cams=[cam(R,d) for d in ds]; chars=[at(R,d) for d in ds]
boards=[(board_cam_aspect(a),a) for a in BOARD_ASPECTS]
rpts=[at(R,R[0][0]+i*0.25) for i in range(int((R[-1][0]-R[0][0])/0.25)+1)]
prev=[]
for e in excl:
    for k in ('tufts','stones','patches'): prev+=json.load(open(e)).get('points',{}).get(k,[])
CLEAR=1.0; ASP=9/19.5; stat=dict(faces=0,cand=0,board=0,route=0,char=0,dup=0)
def rdist(pg): return min(math.hypot(pg[0]-r[0],pg[2]-r[2]) for r in rpts)
def ok(pg):
    for b,a in boards:
        pr=project(b,pg,a)
        if pr and abs(pr[0])<1.35 and abs(pr[1])<1.35: stat['board']+=1; return False
    if rdist(pg)<CLEAR+0.35: stat['route']+=1; return False
    if prev and min(math.dist(pg,q) for q in prev)<0.25: stat['dup']+=1; return False
    vis=False
    for cm,ch in zip(cams,chars):
        pr=project(cm,pg,ASP)
        if not pr or abs(pr[0])>1.15 or abs(pr[1])>1.15 or pr[2]>22 or pr[2]<1.5: continue
        pc=project(cm,[ch[0],ch[1]+.8,ch[2]],ASP)
        if pc and abs(pr[0]-pc[0])<0.22 and pc[1]-0.6<pr[1]<pc[1]+0.35 and pr[2]<pc[2]+0.5: stat['char']+=1; return False
        vis=True
    return vis
T=[];S=[];Pt=[]
for poly in me.polygons:
    n=(mw.to_3x3()@poly.normal).normalized()
    if n.z<0.75: continue
    vs=[mw@me.vertices[i].co for i in poly.vertices]; c=sum(vs,Vector())/len(vs)
    if not any((project(cm,b2g(c),ASP) or (9,9,99))[2]<34 for cm in cams): continue
    stat['faces']+=1; A=poly.area; DEN=float(__import__("os").environ.get("VB_DENSITY","2.5")); N=int(A*DEN)+(random.random()<(A*DEN)%1)
    for k in range(N):
        a,b=random.random(),random.random()
        if a+b>1:a,b=1-a,1-b
        tri=random.randrange(len(vs)-2); p=vs[0]+(vs[tri+1]-vs[0])*a+(vs[tri+2]-vs[0])*b; pg=b2g(p); stat['cand']+=1
        if not ok(pg): continue
        r=random.random()
        if r<0.07: Pt.append(pg)
        elif r<0.19: S.append(pg)
        else: T.append(pg)
S=[q for q in S if rdist(q)>=CLEAR+0.62]; Pt=[q for q in Pt if rdist(q)>=CLEAR+1.55 and all((project(cm,q,ASP) or (0,0,99))[2]>=6 for cm in cams)]  # flat patches only away from the lens (no near colour blocks)
print('STAT',tag,stat,'tufts',len(T),'stones',len(S),'patches',len(Pt))
def cards():
    pos=[];nor=[];uv=[];idx=[]; cells=[(0,0)]*5+[(1,0)]*5+[(2,0)]*2+[(1,3),(0,1),(1,1),(2,1)]
    for p in T:
        cx,cy=random.choice(cells); s=random.uniform(.7,1.15); w=.55*s; h=.42*s; yaw=random.uniform(0,math.pi)
        for k in range(2):
            a=yaw+k*math.pi/2; dx,dz=math.cos(a)*w/2,math.sin(a)*w/2; b=len(pos)
            for sx,sy in ((-1,0),(1,0),(1,1),(-1,1)):
                pos.append([p[0]+sx*dx,p[1]-0.03+sy*h,p[2]+sx*dz]); nor.append([0,1,0])
                uv.append([(cx+(sx+1)/2)/4*0.995+0.0025,(cy+1-sy)/4-(0.004 if sy==0 else -0.004)])
            idx+=[b,b+1,b+2,b,b+2,b+3]
    return pos,nor,uv,idx
def palette():
    t=(1+5**.5)/2; V=[(-1,t,0),(1,t,0),(-1,-t,0),(1,-t,0),(0,-1,t),(0,1,t),(0,-1,-t),(0,1,-t),(t,0,-1),(t,0,1),(-t,0,-1),(-t,0,1)]
    F=[(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),(1,5,9),(5,11,4),(11,10,2),(10,7,6),(7,1,8),(3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),(4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
    sc=[(3,0),(3,0),(4,3),(4,5),(3,5),(2,7),(1,7)]; gc=[(0,6),(1,6),(2,6),(4,6),(5,6),(7,7),(4,5)]
    pos=[];nor=[];uv=[];idx=[]
    for p in S:
        s=random.uniform(.10,.32) if random.random()<.8 else random.uniform(.35,.5); cx,cy=random.choice(sc); sq=random.uniform(.45,.7); yaw=random.uniform(0,6.3); b=len(pos)
        for v in V:
            v=[x/1.902*random.uniform(.8,1.15) for x in v]; x,y,z=v[0]*s*1.2,v[1]*s*sq,v[2]*s
            x,z=x*math.cos(yaw)-z*math.sin(yaw),x*math.sin(yaw)+z*math.cos(yaw)
            pos.append([p[0]+x,p[1]+y-s*sq*0.35,p[2]+z]); l=math.sqrt(sum(q*q for q in v)) or 1; nor.append([q/l for q in v]); uv.append([(cx+.5)/8,(cy+.5)/8])
        for f in F: idx+=[b+f[0],b+f[1],b+f[2]]
    for p in Pt:  # flat colour-variation patch, 7-gon, 3 cm above ground
        cx,cy=random.choice(gc); rad=random.uniform(.6,1.4); b=len(pos)
        pos.append([p[0],p[1]+.03,p[2]]); nor.append([0,1,0]); uv.append([(cx+.5)/8,(cy+.5)/8])
        for i in range(7):
            a=i/7*2*math.pi+random.uniform(-.2,.2); rr=rad*random.uniform(.7,1.1)
            pos.append([p[0]+math.cos(a)*rr,p[1]+.03,p[2]+math.sin(a)*rr]); nor.append([0,1,0]); uv.append([(cx+.5)/8,(cy+.5)/8])
        for i in range(7): idx+=[b,b+1+i,b+1+(i+1)%7]
    return pos,nor,uv,idx
K=['pos','nor','uv','idx']
json.dump({'env_sky_static_foliage_cards':dict(zip(K,cards())),'env_sky_static_palette':dict(zip(K,palette())),'stat':stat,'tag':tag,'range':[dmin,dmax],'points':{'tufts':T,'stones':S,'patches':Pt}},open(out,'w'))
