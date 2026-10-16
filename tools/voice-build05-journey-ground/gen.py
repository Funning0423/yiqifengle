import sys,random; exec(open('/tmp/vbw/common.py').read())
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=sys.argv[-2])
random.seed(20261016)
bvh,go=ground_bvh(); P=route_local(); L=length(P)
cams=[]; chars=[]
for back in LATE_BACKS:
    q=lifted(sample(P,L-back),bvh); cams.append(journey_cam(q)); chars.append(q)
boards=[board_cam_aspect(a) for a in (9/19.5,9/16,3/4,1.0,16/9,2.2)]
route_pts=[sample(P,L-i*0.25) for i in range(int(L/0.25)+1)]
mw=go.matrix_world; me=go.data
tufts=[];stones=[];stat={'faces':0,'cand':0,'rej_board':0,'rej_route':0,'rej_char':0}
def ok(pg):
    if any(project(b,pg,asp) and abs(project(b,pg,asp)[0])<1.35 and abs(project(b,pg,asp)[1])<1.35 for b,asp in zip(boards,(9/19.5,9/16,3/4,1.0,16/9,2.2))): stat['rej_board']+=1; return False
    if min(math.hypot(pg[0]-r[0],pg[2]-r[2]) for r in route_pts)<1.0: stat['rej_route']+=1; return False
    vis=False
    for cam,ch in zip(cams,chars):
        pr=project(cam,pg,9/19.5)
        if not pr or abs(pr[0])>1.15 or abs(pr[1])>1.15 or pr[2]>26 or pr[2]<1.5: continue
        pc=project(cam,[ch[0],ch[1]+.8,ch[2]],9/19.5)
        if pc and abs(pr[0]-pc[0])<0.22 and pr[1]<pc[1]+0.35 and pr[1]>pc[1]-0.6 and pr[2]<pc[2]+0.5: stat['rej_char']+=1; return False
        vis=True
    return vis
for poly in me.polygons:
    n=(mw.to_3x3()@poly.normal).normalized()
    if n.z<0.75: continue
    vs=[mw@me.vertices[i].co for i in poly.vertices]
    c=sum(vs,Vector())/len(vs)
    if not any((project(cam,b2g(c),9/19.5) or (9,9,99))[2]<30 for cam in cams): continue
    stat['faces']+=1
    area=poly.area
    for k in range(int(area*5.0)+(1 if random.random()<(area*5.0)%1 else 0)):
        a,b=random.random(),random.random()
        if a+b>1:a,b=1-a,1-b
        p=vs[0]+(vs[1]-vs[0])*a+(vs[2]-vs[0])*b
        pg=b2g(p); stat['cand']+=1
        if not ok(pg): continue
        if random.random()<0.13: stones.append((pg,b2g(n)))
        else: tufts.append((pg,b2g(n)))
print('STAT',stat,len(tufts),len(stones))
# --- build geometry in glTF space
def card_geo():
    pos=[];nor=[];uv=[];idx=[]
    cells=[(0,0)]*5+[(1,0)]*5+[(2,0)]*2+[(1,3),(0,1),(1,1),(2,1)]
    for p,n in tufts:
        cx,cy=random.choice(cells); s=random.uniform(.7,1.15); w=.55*s; h=.42*s; yaw=random.uniform(0,math.pi)
        for k in range(2):
            a=yaw+k*math.pi/2; dx,dz=math.cos(a)*w/2,math.sin(a)*w/2; b=len(pos)
            for (sx,sy) in ((-1,0),(1,0),(1,1),(-1,1)):
                pos.append([p[0]+sx*dx,p[1]-0.03+sy*h,p[2]+sx*dz]); nor.append([0,1,0])
                uv.append([(cx+(sx+1)/2)/4*0.995+0.0025, (cy+1-sy)/4 - (0.004 if sy==0 else -0.004)])
            idx+= [b,b+1,b+2,b,b+2,b+3]
    return pos,nor,uv,idx
def stone_geo():
    t=(1+5**.5)/2; V=[(-1,t,0),(1,t,0),(-1,-t,0),(1,-t,0),(0,-1,t),(0,1,t),(0,-1,-t),(0,1,-t),(t,0,-1),(t,0,1),(-t,0,-1),(-t,0,1)]
    F=[(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),(1,5,9),(5,11,4),(11,10,2),(10,7,6),(7,1,8),(3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),(4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
    cells=[(3,0),(3,0),(4,3),(4,5),(3,5),(2,7),(1,7)]
    pos=[];nor=[];uv=[];idx=[]
    for p,n in stones:
        s=random.uniform(.10,.32) if random.random()<.8 else random.uniform(.35,.5); cx,cy=random.choice(cells)
        sq=random.uniform(.45,.7); yaw=random.uniform(0,6.3); b=len(pos)
        for v in V:
            v=[x/ (1.902) * random.uniform(.8,1.15) for x in v]; x,y,z=v[0]*s*1.2,v[1]*s*sq,v[2]*s
            x,z=x*math.cos(yaw)-z*math.sin(yaw),x*math.sin(yaw)+z*math.cos(yaw)
            pos.append([p[0]+x,p[1]+y-s*sq*0.35,p[2]+z]); l=math.sqrt(v[0]**2+v[1]**2+v[2]**2) or 1; nor.append([v[0]/l,v[1]/l,v[2]/l])
            uv.append([(cx+.5)/8,(cy+.5)/8])
        for f in F: idx+=[b+f[0],b+f[1],b+f[2]]
    return pos,nor,uv,idx
c=card_geo(); s=stone_geo()
json.dump({'env_sky_static_foliage_cards':dict(zip(['pos','nor','uv','idx'],c)),'env_sky_static_palette':dict(zip(['pos','nor','uv','idx'],s)),'stat':stat,'tufts':len(tufts),'stones':len(stones)},open(sys.argv[-1],'w'))
