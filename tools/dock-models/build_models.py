#!/usr/bin/env python3
"""b19 dock models (场景设计部): island_dock / sail_gangway / sky_mooring (deck + 5a stakes, ropes, stool) as palette-UV meshes.
Writes /tmp/b19dock/parts_<model>.json (nodes in Cocos frame) for blender_export.py. Design numbers = stances.json / PLAN.md.
Original shapes (no reference art). usage: python3 build_models.py"""
import json,math,os,sys,gzip,numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from geom import *
OUT='/tmp/b19dock';os.makedirs(OUT,exist_ok=True)
H=os.path.dirname(os.path.abspath(__file__));R=os.path.abspath(os.path.join(H,'../..'))
rng=np.random.default_rng(1925)
# ---------------- palettes ----------------
def ip(row,u):return [float(u),(row+0.5)/16]                     # island M_env_palette: 16 rows, gradient along u
def sp(row,col,t=0.5):return [(col+0.5)/8,(row+0.12+0.76*t)/8]  # skycity M_sky_palette: 8x8 cells, vertical gradient
def tp(row,col):return [(col+0.5)/8,(row+0.5)/8]                 # transit palette (sailboat M_sailboat_hull): 8x8 grain cells
def tp_rect(row,col,a,b):                                        # grain: map a face's 4 corners into the cell (2 px margin)
    m=2/256;u0,u1=col/8+m,(col+1)/8-m;v0,v1=row/8+m,(row+1)/8-m;return [[u0+(u1-u0)*a[0],v0+(v1-v0)*a[1]],[u0+(u1-u0)*b[0],v0+(v1-v0)*a[1]],[u0+(u1-u0)*b[0],v0+(v1-v0)*b[1]],[u0+(u1-u0)*a[0],v0+(v1-v0)*b[1]]]
# ---------------- island ground (fixture tris, for footings / waterlines) ----------------
def load_fix(name,rx=None):
    import re
    d=json.loads(gzip.open(os.path.join(R,'tools/transition-spaces/fixtures',name+'.json.gz')).read());T=[]
    for k,v in d.items():
        if rx and not re.search(rx,k):continue
        a=np.array(v,float).reshape(-1,9);T.append(a)
    return np.vstack(T)
ISL=None
def ground(x,z):
    global ISL
    if ISL is None:ISL=load_fix('island','island_main|beach')
    T=ISL;A,B,C=T[:,0:3],T[:,3:6],T[:,6:9]
    den=(B[:,2]-C[:,2])*(A[:,0]-C[:,0])+(C[:,0]-B[:,0])*(A[:,2]-C[:,2]);ok=np.abs(den)>1e-12;den=np.where(ok,den,1)
    l1=((B[:,2]-C[:,2])*(x-C[:,0])+(C[:,0]-B[:,0])*(z-C[:,2]))/den;l2=((C[:,2]-A[:,2])*(x-C[:,0])+(A[:,0]-C[:,0])*(z-C[:,2]))/den;l3=1-l1-l2
    m=ok&(l1>=-1e-6)&(l2>=-1e-6)&(l3>=-1e-6);y=l1*A[:,1]+l2*B[:,1]+l3*C[:,1]
    return float(y[m].max()) if m.any() else -2.0
SEA=-0.92  # IslandPropsLayout seaY (env_sea_surface)
# ================= 1. island_dock =================
def island_dock():
    W=Mesh();rows={'deck':[],'piles':[]}
    X0,X1,Z0,Z1,TOP=-2.5,-1.1,8.9,14.4,-0.18;TH=0.045
    wood=[ip(8,.45),ip(8,.58),ip(8,.66),ip(10,.40),ip(5,.30),ip(5,.45),ip(2,.62)]   # warm brown .. sun-greyed
    endg=ip(8,.18);wet=ip(14,.30);algae=ip(11,.12);under=ip(9,.08);iron=ip(14,.12);rope=ip(3,.62);rope_d=ip(3,.38);stone=ip(2,.30);stone_l=ip(2,.48);moss=ip(11,.30)
    # deck planks across x, pitch 0.23 (0.2 board + 0.03 gap)
    z=Z0+0.015;i=0;planks=[]
    while z+0.2<=Z1+1e-6:
        w=0.2 if i%5!=3 else 0.17;c=z+w/2;jit=rng.normal()*0.004;yaw=rng.normal()*0.9;sh=wood[rng.integers(len(wood))]
        if i==9:sh=ip(10,.72)   # a newer replacement board (lighter)
        x0,x1=X0-0.03-rng.random()*0.03,X1+0.03+rng.random()*0.03
        if i==15:x1=X1-0.05     # one short board
        top=TOP+jit
        if i in (4,17):  # stained / sun-split board: two shades along its length
            xm=x0+(x1-x0)*(0.35+0.3*rng.random())
            box(W,[(x0+xm)/2,top-TH/2,c],[xm-x0,TH,w],yaw,sh,ip(8,.3),endg);box(W,[(xm+x1)/2,top-TH/2,c],[x1-xm,TH,w],yaw,ip(5,.22),ip(8,.3),endg)
        else:box(W,[(x0+x1)/2,top-TH/2,c],[x1-x0,TH,w],yaw,sh,ip(8,.3),endg,roll=rng.normal()*0.6)
        planks.append((c,w,top));z+=w+0.03;i+=1
    # joists along z under the boards, headers on the pile rows, fascia boards on the long edges
    JX=[-2.38,-1.80,-1.22];JT=TOP-TH
    for jx in JX:box(W,[jx,JT-0.05,(Z0+Z1)/2],[0.09,0.10,Z1-Z0+0.1],0,ip(8,.25),ip(8,.22),endg)
    for fx,s in ((X0-0.05,1),(X1+0.05,-1)):box(W,[fx,TOP-0.09,(Z0+Z1)/2],[0.035,0.13,Z1-Z0+0.06],0,ip(8,.35),ip(5,.28),endg)
    PR=[9.05,10.85,12.65,14.3];PX=[-2.42,-1.18]
    for pz in PR:box(W,[(PX[0]+PX[1])/2,JT-0.155,pz],[1.55,0.11,0.12],0,ip(8,.28),ip(8,.24),endg)
    # nails: one dark head per board per joist (alternating front/back), tiny 4-tri pyramids
    for k,(c,w,top) in enumerate(planks):
        for j,jx in enumerate(JX):
            nz=c+(0.05 if (k+j)%2 else -0.05);s=0.011;y=top+0.001
            a,b,cc,d=[jx-s,y,nz-s],[jx+s,y,nz-s],[jx+s,y,nz+s],[jx-s,y,nz+s];ap=[jx,y+0.006,nz]
            for p,q in ((a,d),(d,cc),(cc,b),(b,a)):W.tri(p,q,ap,iron)
    # piles: hexagonal, buried in sand or standing in the sea with a waterline (wet band + algae ring)
    def pile(x,zz,top,r=0.085,post=False):
        g=ground(x,zz);bot=min(g-0.35,SEA-0.75) if g<SEA else g-0.35;sh=wood[rng.integers(4)]
        if g<SEA-0.02:
            prism(W,[x,bot,zz],[x,SEA-0.06,zz],r,6,under,cap_b=False)
            prism(W,[x,SEA-0.06,zz],[x,SEA+0.14,zz],r+0.004,6,wet,cap_b=False)
            prism(W,[x,SEA+0.14,zz],[x,SEA+0.22,zz],r+0.006,6,algae,cap_b=False)
            prism(W,[x,SEA+0.22,zz],[x,top,zz],r,6,sh,cap_b=True)
        else:
            prism(W,[x,bot,zz],[x,g+0.06,zz],r+0.004,6,wet,cap_b=False)   # damp sand stain at the foot
            prism(W,[x,g+0.06,zz],[x,top,zz],r,6,sh,cap_b=True)
        if post:  # iron band near the top of the tall end posts
            prism(W,[x,top-0.16,zz],[x,top-0.12,zz],r+0.01,6,iron,cap_a=True,cap_b=True)
        rows['piles'].append([x,zz,g])
    for pz in PR:
        for px in PX:
            tall=(pz==PR[-1]) or (px==PX[1] and pz in (PR[1],PR[2]))
            pile(px,pz,TOP+0.42 if tall else JT-0.10,0.095 if tall else 0.085,post=tall)
    # cross braces on both long sides, one diagonal per bay, above the water
    for px in PX:
        for a,b in zip(PR[:-1],PR[1:]):
            y0=JT-0.2;y1=max(SEA+0.32,min(ground(px,b),ground(px,a))+0.1) if True else 0
            if y0-y1<0.12:continue
            dx=-0.1 if px<-1.8 else 0.1;p0=[px+dx,y0,a+0.08];p1=[px+dx,y1,b-0.08]
            L=math.dist(p0,p1);c=[(p0[i]+p1[i])/2 for i in range(3)];pitch=math.degrees(math.atan2(p0[1]-p1[1],p1[2]-p0[2]))
            box(W,c,[0.04,0.09,L],0,ip(8,.33),ip(8,.3),endg,pitch=pitch)
    # ramp (x -1.7..-1.1, z 8.2..8.9, top 0 -> -0.18) with two stringers and a shore sill log + footing stones
    RZ0,RZ1=8.2,8.9;ang=math.degrees(math.atan2(0.18,RZ1-RZ0));L=math.hypot(0.18,RZ1-RZ0)
    for k in range(3):
        t=(k+0.5)/3;zc=RZ0+t*(RZ1-RZ0);yc=0.0-0.18*t
        box(W,[-1.4,yc-TH/2,zc],[0.66,TH,L/3-0.03],0,wood[(k+2)%len(wood)],ip(8,.3),endg,pitch=-ang)
    for sx in (-1.62,-1.18):box(W,[sx,-0.09-0.1,(RZ0+RZ1)/2],[0.07,0.09,L+0.04],0,ip(8,.25),ip(8,.22),endg,pitch=-ang)
    gs=max(ground(-1.4,8.12),ground(-1.0,8.12),ground(-1.8,8.12))
    prism(W,[-1.85,gs-0.03,8.12],[-0.95,gs-0.03,8.12],0.075,6,ip(8,.22),cap_a=True,cap_b=True)
    for k,(x,zz,r,h) in enumerate([(-1.98,8.25,0.16,0.14),(-0.88,8.30,0.13,0.11),(-2.2,8.75,0.2,0.16),(-0.95,8.75,0.14,0.10)]):
        rock(W,[x,ground(x,zz)-0.03,zz],r,h,stone if k%2 else stone_l,6,seed=k)
    # shore end of the deck (west part over the slope): fascia board facing the beach
    box(W,[(X0-0.04+(-1.72))/2,TOP-0.09,Z0-0.01],[(-1.72)-(X0-0.04),0.13,0.035],0,ip(8,.35),ip(5,.28),endg)
    # rope railing along the west edge (three short posts, sagging rope), coils on the two east bollards, a loose coil on the deck
    rp=[(X0-0.02,9.6),(X0-0.02,11.7),(X0-0.02,13.8)]
    for x,zz in rp:prism(W,[x,TOP-0.25,zz],[x,TOP+0.62,zz],0.045,6,wood[4],cap_b=True)
    for (xa,za),(xb,zb) in zip(rp[:-1],rp[1:]):tube(W,catenary([xa,TOP+0.55,za],[xb,TOP+0.55,zb],0.12,8),0.016,4,rope)
    tube(W,catenary([rp[-1][0],TOP+0.55,rp[-1][1]],[PX[0],TOP+0.30,PR[-1]],0.08,4),0.016,4,rope)
    for x,zz in ((PX[1],PR[1]),(PX[1],PR[2])):coil(W,[x,TOP+0.18,zz],0.105,0.018,2.0,8,rope_d,y_step=0.035)
    coil(W,[-2.15,TOP+0.018,13.75],0.17,0.018,2.6,8,rope)
    tube(W,[[-2.0,TOP+0.018,13.8],[-1.8,TOP+0.018,13.95],[-1.55,TOP+0.03,14.22],[PX[1],TOP+0.25,PR[-1]]],0.016,4,rope)
    # moss tufts at the foot of the shore piles
    for x,zz,g in rows['piles']:
        if g>SEA:rock(W,[x+0.05,g-0.02,zz+0.05],0.09,0.05,moss,5,seed=int(abs(x*100+zz)))
    return {'island_dock':{'mesh':W,'material':'M_env_palette','parent':None}},{'tris':W.ntris(),'piles':rows['piles']}
# ================= 2. sail_gangway (sailboat.glb, hinge on the port rail outer top) =================
def sail_gangway():
    G=Mesh();L=0.58;Wd=0.5;T=0.035
    # three boards along the length (grain cells), two top battens, two cleats underneath, iron hinge straps, rope grab loops
    for k,(z0,z1) in enumerate([(-0.25,-0.09),(-0.075,0.075),(0.09,0.25)]):
        cell=[(0,3),(0,4),(1,3)][k];c=[(L)/2,0.015-T/2,(z0+z1)/2]
        box(G,c,[L,T,z1-z0],0,tp_rect(cell[0],cell[1],(0,0),(1,0.3)),tp(0,5),tp(0,5))
    for bx in (0.17,0.40):box(G,[bx,0.015+0.009,0],[0.035,0.018,Wd-0.04],0,tp(0,5),tp(0,5),tp(0,5))
    for bx in (0.07,0.5):box(G,[bx,-T-0.01,0],[0.05,0.04,Wd-0.06],0,tp(2,2),tp(2,2),tp(2,2))
    for sz in (-0.17,0.17):box(G,[0.05,0.015+0.003,sz],[0.11,0.006,0.04],0,tp(1,0),tp(1,0),tp(1,0))
    for sz in (-0.17,0.17):prism(G,[0,-0.012,sz-0.03],[0,-0.012,sz+0.03],0.016,6,tp(1,0),cap_a=True,cap_b=True)  # hinge knuckles
    for sz in (-0.235,0.235):tube(G,[[L-0.02,0.016,sz],[L+0.03,0.0,sz],[L+0.04,-0.04,sz],[L-0.01,-0.05,sz]],0.009,4,tp(0,6))
    return {'sail_gangway_hinge':{'mesh':None,'parent':'transport_sailboat'},'sail_gangway':{'mesh':G,'material':'M_sailboat_hull','parent':'sail_gangway_hinge'}},{'tris':G.ntris()}
# ================= 3. sky_mooring (skycity landing deck + posts/ropes; 5a stakes/ropes/stool) =================
def sky():
    S=json.load(open(os.path.join(R,'tools/transition-spaces/stances.json')))['segments']
    s4=S['4_skycity_balloon_out'];b4=s4['balloon'];dk=s4['deck'];s5=S['5a_skycity_balloon_in'];b5=s5['balloon']
    wood=[sp(5,0,.35),sp(5,1,.4),sp(5,1,.65),sp(5,4,.45),sp(5,3,.5)];endg=sp(5,0,.8);iron=sp(0,7,.5);rope=sp(5,5,.45);rope_d=sp(5,6,.7);stone=sp(3,3,.5)
    D=Mesh();P=Mesh();RP=Mesh()
    root=b4['root'];yaw=b4['yawDeg']
    def xf(p,y=0.0):q=rotY(yaw,[p[0],0,p[2]]);return [q[0]+root[0],y,q[2]+root[2]]
    TOP=dk['topY'];TH=0.04;x0,x1=dk['sizeBasketLocal']['x'];z0,z1=dk['sizeBasketLocal']['z']
    # planks along basket-local x (two staggered pieces per row), z pitch 0.25; bevelled lip at the exit-side edge z0
    z=z0+0.02;i=0;rowsZ=[]
    while z+0.22<=z1-0.02+1e-6:
        c=z+0.11;split=-0.35 if i%2 else 0.4;rowsZ.append(c)
        for a_,b_ in ((x0,split-0.012),(split+0.012,x1)):
            sh=wood[rng.integers(len(wood))];box(D,xf([(a_+b_)/2,0,c],TOP-TH/2+rng.normal()*0.002),[b_-a_,TH,0.22],yaw,sh,sp(5,0,.6),endg)
        z+=0.25;i+=1
    for jx in (-1.05,0.0,1.05):box(D,xf([jx,0,(z0+z1)/2],TOP-TH-0.04),[0.09,0.08,z1-z0-0.05],yaw,sp(5,0,.3),sp(5,0,.3),endg)
    box(D,xf([0,0,z0+0.02],TOP-0.035),[x1-x0,0.03,0.06],yaw,sp(5,1,.75),sp(5,0,.6),endg,pitch=-35)
    for fx in (x0-0.02,x1+0.02):box(D,xf([fx,0,(z0+z1)/2],TOP-0.05),[0.03,0.1,z1-z0],yaw,sp(5,1,.55),sp(5,0,.6),endg)
    for k,c0 in enumerate(rowsZ):
        for j,jx in enumerate((-1.05,0.0,1.05)):
            c=xf([jx,0,c0+(0.05 if (k+j)%2 else -0.05)]);s_=0.012;y=TOP+0.001
            a_,b_,cc,d=[c[0]-s_,y,c[2]-s_],[c[0]+s_,y,c[2]-s_],[c[0]+s_,y,c[2]+s_],[c[0]-s_,y,c[2]+s_];ap=[c[0],y+0.006,c[2]]
            for p,q in ((a_,d),(d,cc),(cc,b_),(b_,a_)):D.tri(p,q,ap,iron)
    # mooring posts (deck) with iron cap band and rope coils, small stone chocks at their feet
    for px,_,pz in dk['postsBasketLocal']:
        c=xf([px,0,pz]);prism(P,[c[0],TOP-0.3,c[2]],[c[0],0.92,c[2]],0.07,6,wood[0],cap_b=True)
        prism(P,[c[0],0.80,c[2]],[c[0],0.85,c[2]],0.078,6,iron,cap_a=True,cap_b=True)
        coil(P,[c[0],0.55,c[2]],0.085,0.016,2,8,rope_d,y_step=0.03)
    # taut ropes post -> basket rim corner (hidden by code when the balloon leaves)
    for (px,_,pz),cx in zip(dk['postsBasketLocal'],(0.78,-0.78)):
        a=xf([px,0,pz]);b=xf([cx,0,0.62]);tube(RP,catenary([a[0],0.74,a[2]],[b[0],root[1]+0.98,b[2]],0.03,5),0.014,4,rope)
    out={'sky_mooring_deck':{'mesh':D,'material':'M_sky_palette','parent':'sky_mooring'},'sky_mooring_posts':{'mesh':P,'material':'M_sky_palette','parent':'sky_mooring'},
         'sky_mooring_rope':{'mesh':RP,'material':'M_sky_palette','parent':'sky_mooring'}}
    # ---- 5a: stakes + ropes + step stool (no deck: the basket stands on the terrace floor) ----
    K=Mesh();KR=Mesh();ST=Mesh();r5=b5['root'];y5=b5['yawDeg'];xf5=lambda p:(rotY(y5,p)+np.array([r5[0],0,r5[2]])).tolist();G5=0.03
    for px,pz in ((-1.15,-0.9),(1.15,-0.9)):
        c=xf5([px,0,pz]);prism(K,[c[0],G5-0.25,c[2]],[c[0],G5+0.42,c[2]],0.05,6,wood[1],cap_b=True,r_b=0.04)
        prism(K,[c[0],G5+0.30,c[2]],[c[0],G5+0.34,c[2]],0.055,6,iron,cap_a=True,cap_b=True)
        coil(K,[c[0],G5+0.10,c[2]],0.065,0.014,1.5,8,rope_d,y_step=0.03)
        for k in range(3):rock(K,[c[0]+0.09*math.cos(k*2.1),G5-0.02,c[2]+0.09*math.sin(k*2.1)],0.05,0.04,stone,5,seed=k+7)
        b=xf5([0.78*np.sign(px),0,-0.62]);tube(KR,catenary([c[0],G5+0.32,c[2]],[b[0],r5[1]+0.98,b[2]],0.03,5),0.013,4,rope)
    st=s5.get('stool') or {'basketLocal':{'x':[-0.25,0.25],'z':[0.9,1.2]},'topY':0.06}
    bl=st['basketLocal'];cx,cz=(bl['x'][0]+bl['x'][1])/2,(bl['z'][0]+bl['z'][1])/2
    c=xf5([cx,0,cz]);c[1]=st['topY']-0.0125;box(ST,c,[bl['x'][1]-bl['x'][0],0.025,bl['z'][1]-bl['z'][0]],y5,wood[2],sp(5,0,.6),endg)
    for rx in (-0.18,0.18):
        c=xf5([rx,0,cz]);c[1]=G5+0.0125;box(ST,c,[0.05,0.02,bl['z'][1]-bl['z'][0]-0.02],y5,sp(5,0,.4),sp(5,0,.4),endg)
    out.update({'sky_mooring_5a_stakes':{'mesh':K,'material':'M_sky_palette','parent':'sky_mooring_5a'},'sky_mooring_5a_rope':{'mesh':KR,'material':'M_sky_palette','parent':'sky_mooring_5a'},
                'balloon_step_stool_5a':{'mesh':ST,'material':'M_sky_palette','parent':'sky_mooring_5a'},'sky_mooring':{'mesh':None,'parent':'sky_mooring_props'},'sky_mooring_5a':{'mesh':None,'parent':'sky_mooring_props'},'sky_mooring_props':{'mesh':None,'parent':None}})
    return out,{'tris':sum(o['mesh'].ntris() for o in out.values() if o.get('mesh'))}
def dump(name,parts,info):
    js={'model':name,'info':info,'nodes':{}}
    for n,p in parts.items():
        d={'parent':p.get('parent')}
        if p.get('mesh') is not None:
            V,F,UV=p['mesh'].arrays();d.update({'material':p['material'],'V':np.round(V,4).tolist(),'F':F.tolist(),'UV':np.round(UV,5).tolist()})
        js['nodes'][n]=d
    json.dump(js,open(f'{OUT}/parts_{name}.json','w'));print(name,info.get('tris'),'tris ->',f'{OUT}/parts_{name}.json')
if __name__=='__main__':
    which=sys.argv[1:] or ['island_dock','sail_gangway','sky_mooring']
    if 'island_dock' in which:p,i=island_dock();dump('island_dock',p,i)
    if 'sail_gangway' in which:p,i=sail_gangway();dump('sail_gangway',p,i)
    if 'sky_mooring' in which:p,i=sky();dump('sky_mooring',p,i)
