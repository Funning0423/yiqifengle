#!/usr/bin/env python3
"""Top + side view per segment (offline matplotlib): existing mesh edges (grey), RegionWalkable cells (green), planned
dock/ramp/deck/gangway (blue dashed), basket/door sweep/envelope (orange), her path (red) with stance ids."""
import json,gzip,os,sys,subprocess,math,numpy as np
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
plt.rcParams['font.family']=['Noto Sans CJK SC','Noto Serif CJK SC','Noto Serif CJK JP','DejaVu Sans']
from matplotlib.collections import LineCollection
H=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,H);import glbread
OUT=sys.argv[1] if len(sys.argv)>1 else os.path.join(H,'renders');os.makedirs(OUT,exist_ok=True)
J=json.load(open(os.path.join(H,'stances.json')));S=J['segments'];B=os.path.join(H,'../../creator-build-project/assets/bundles/')
def fx(n):
    d=json.load(gzip.open(os.path.join(H,'fixtures',n+'.json.gz'),'rt'));return np.concatenate([np.array(v).reshape(-1,3,3) for v in d.values()])
REG={'island':fx('island'),'meadow':np.concatenate([fx('meadow_n'),fx('meadow_s')]),'skycity':np.concatenate([fx('sky_s0'),fx('sky_s6')])}
def rotY(deg,P):c,s=math.cos(math.radians(deg)),math.sin(math.radians(deg));P=np.asarray(P,float);return np.stack([c*P[...,0]+s*P[...,2],P[...,1],-s*P[...,0]+c*P[...,2]],-1)
def xfT(T,root,yaw):return rotY(yaw,T)+np.array(root)
boat=glbread.GLB(B+'transport_sail/sailboat.glb');BOAT=np.concatenate([boat.tris(boat.idx(n)) for n in ['hull','seat_bench']])
bal=glbread.GLB(B+'region_transit_balloon/transport_balloon.glb');BASK=bal.tris(bal.idx('balloon_basket'));LEAF=bal.tris(bal.idx('basket_door_leaf'))
lan=glbread.GLB(B+'transport_sail/transit_landing.glb');JET=lan.tris(lan.idx('landing_jetty'))
def walk_cells(region,box):
    js=f"const {{load}}=require('{H}/../region-nodes/load.cjs');const RW=load('region/RegionWalkable.ts');const g=RW.walkGrid('{region}');const o=[];const [x0,z0,x1,z1]={json.dumps(box)};for(let gz=0;gz<g.H;gz++)for(let gx=0;gx<g.W;gx++){{const x=g.x0+(gx+.5)*g.c,z=g.z0+(gz+.5)*g.c;if(x<x0||x>x1||z<z0||z>z1)continue;const y=g.h[gz*g.W+gx];if(!Number.isNaN(y))o.push([+x.toFixed(2),+y.toFixed(2),+z.toFixed(2)]);}}console.log(JSON.stringify({{c:g.c,o}}));"
    d=json.loads(subprocess.check_output(['node','-e',js]));return d['c'],np.array(d['o']).reshape(-1,3)
def P(p):return p.get('regionAt') or p['at']
def draw(seg,region,box,extra,side_axis,fname,title,lat=1.6,ylim=None):
    pts=np.array([P(p) for p in seg['path'] if p['frame']!='basket' or p.get('regionAt')]);ids=[p['id'] for p in seg['path'] if p['frame']!='basket' or p.get('regionAt')]
    T=REG[region];x0,x1,z0,z1=box
    m=(T[:,:,0].max(1)>=x0)&(T[:,:,0].min(1)<=x1)&(T[:,:,2].max(1)>=z0)&(T[:,:,2].min(1)<=z1);T=T[m]
    c,W=walk_cells(region,[x0,z0,x1,z1]) if region!='lake' else (0.4,np.zeros((0,3)))
    fig,ax=plt.subplots(figsize=(9,9))
    segs=np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]]);ax.add_collection(LineCollection(segs[:,:,[0,2]],colors='#9a9a9a',linewidths=.25))
    if len(W):ax.scatter(W[:,0],W[:,2],s=(c*55)**2/4,c='#7fd27f',marker='s',alpha=.35,lw=0,label='RegionWalkable cells')
    for e in extra:e(ax,'top')
    ax.plot(pts[:,0],pts[:,2],'-o',c='red',ms=3,lw=1.4,label='her path')
    for i,(p,n) in enumerate(zip(pts,ids)):
        if i%1==0:ax.annotate(n,(p[0],p[2]),fontsize=6,xytext=(3,3),textcoords='offset points')
    ax.set_xlim(x0,x1);ax.set_ylim(z1,z0);ax.set_aspect('equal');ax.set_xlabel(f'{region} x (m)');ax.set_ylabel(f'{region} z (m)');ax.set_title(title+' — 俯视 top (x→, z↓)',fontsize=10);ax.legend(fontsize=7,loc='lower right');ax.grid(alpha=.2)
    fig.savefig(os.path.join(OUT,fname+'_top.png'),dpi=130,bbox_inches='tight');plt.close(fig)
    # side: horizontal axis = side_axis, keep tris within lat of the path
    a=0 if side_axis=='x' else 2;o=2-a
    fig,ax=plt.subplots(figsize=(11,5))
    near=np.zeros(len(T),bool)
    for p in pts:near|=np.abs(T[:,:,o].mean(1)-p[o])<lat
    near&=(T[:,:,a].max(1)>=min(pts[:,a])-2)&(T[:,:,a].min(1)<=max(pts[:,a])+2)
    Tn=T[near];segs=np.concatenate([Tn[:,[0,1]],Tn[:,[1,2]],Tn[:,[2,0]]]);ax.add_collection(LineCollection(segs[:,:,[a,1]],colors='#9a9a9a',linewidths=.25))
    for e in extra:e(ax,'side',a)
    ax.plot(pts[:,a],pts[:,1],'-o',c='red',ms=3,lw=1.4)
    for p,n in zip(pts,ids):ax.annotate(n,(p[a],p[1]),fontsize=6,xytext=(2,4),textcoords='offset points',rotation=30)
    lo,hi=pts[:,a].min()-1.5,pts[:,a].max()+1.5;ax.set_xlim(lo,hi);ax.set_ylim(*(ylim or (pts[:,1].min()-0.8,pts[:,1].max()+2.2)));ax.set_aspect('equal');ax.grid(alpha=.2)
    ax.set_xlabel(f'{region} {side_axis} (m)');ax.set_ylabel('y (m)');ax.set_title(title+f' — 侧视 side ({side_axis}–y, scenery within ±{lat} m of the path; foot y on the red line)',fontsize=10)
    fig.savefig(os.path.join(OUT,fname+'_side.png'),dpi=130,bbox_inches='tight');plt.close(fig)
def meshE(T,col,lab=None,lw=.5):
    def f(ax,view,a=0):
        if view=='top':ax.add_collection(LineCollection(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]])[:,:,[0,2]],colors=col,linewidths=lw,label=lab))
        else:ax.add_collection(LineCollection(np.concatenate([T[:,[0,1]],T[:,[1,2]],T[:,[2,0]]])[:,:,[a,1]],colors=col,linewidths=lw,label=lab))
    return f
def boxE(x,z,y,col='#1f5fd6',lab=None):
    def f(ax,view,a=0):
        if view=='top':ax.plot([x[0],x[1],x[1],x[0],x[0]],[z[0],z[0],z[1],z[1],z[0]],'--',c=col,lw=1.2,label=lab)
        else:
            r=x if a==0 else z;yy=y if isinstance(y,(list,tuple)) else [y,y]
            ax.plot([r[0],r[1]] if a==2 else [r[0],r[1]],[yy[0],yy[1]],'--',c=col,lw=2,label=lab)
    return f
def polyE(poly,y,col='#1f5fd6',lab=None):
    poly=np.array(poly)
    def f(ax,view,a=0):
        if view=='top':q=np.vstack([poly,poly[:1]]);ax.plot(q[:,0],q[:,2],'--',c=col,lw=1.2,label=lab)
        else:ax.plot([poly[:,a].min(),poly[:,a].max()],[y,y],'--',c=col,lw=2,label=lab)
    return f
def circE(c,r,col,lab=None,ls='-',y=None):
    def f(ax,view,a=0):
        if view=='top':t=np.linspace(0,6.29,80);ax.plot(c[0]+r*np.cos(t),c[2]+r*np.sin(t),ls,c=col,lw=1,label=lab)
    return f
def balloonE(root,yaw,openDeg=100,env=True):
    out=[meshE(xfT(BASK,root,yaw),'#e08a00','basket (glb)'),meshE(xfT(LEAF,root,yaw),'#c05000')]
    hinge=np.array([.4,0,.84]);lf=LEAF-np.array([.4,0,.84]);lo=rotY(openDeg,lf)+hinge;out.append(meshE(xfT(lo,root,yaw),'#ff3c00','door leaf open +100°',.7))
    def sweep(ax,view,a=0):
        if view!='top':return
        t=np.radians(np.linspace(0,openDeg,30));arc=[]
        for th in t:q=rotY(math.degrees(th),np.array([[-0.8,0,0.1]]))[0]+hinge;arc.append(xfT(q[None],root,yaw)[0])
        arc=np.array(arc);h=xfT(hinge[None],root,yaw)[0];ax.fill(np.r_[h[0],arc[:,0]],np.r_[h[2],arc[:,2]],color='#ffb37a',alpha=.35,label='door sweep')
    out.append(sweep)
    if env:out.append(circE(root,2.95,'#e08a00','envelope max r 2.95 (y +5.5…+7.5)','--'))
    return out
def dockE(seg):
    D=seg['nodes']['dock'];return [boxE(D['deck']['x'],D['deck']['z'],D['deck']['topY'],lab='island_dock_deck (planned)'),boxE(D['ramp']['x'],D['ramp']['z'],D['ramp']['topY'],'#5f8fff','island_dock_ramp (planned)')]
# 1
s=S['1_island_board'];b=s['boatAtBerth']
gw=np.array([[-1.30,0.77,0.15],[-0.70,0.60,0.15]]);gwI=xfT(gw,b['pos'],b['yawDeg'])
def gwE(P_):
    def f(ax,view,a=0):
        if view=='top':ax.plot(P_[:,0],P_[:,2],c='#1f5fd6',lw=6,alpha=.5,label='sail_gangway (planned, deployed)')
        else:ax.plot(P_[:,a],P_[:,1],c='#1f5fd6',lw=3,alpha=.6)
    return f
st=np.array([[-0.2,0.33,0.0],[0.2,0.33,0.0],[0.2,0.33,0.3],[-0.2,0.33,0.3]])
draw(s,'island',[-4,4,3,15],dockE(s)+[meshE(xfT(BOAT,b['pos'],b['yawDeg']),'#3070a0','sailboat hull/bench (glb, at berth)'),gwE(gwI),polyE(xfT(st,b['pos'],b['yawDeg']),b['pos'][1]+.33,'#5f8fff','sail_gangway_step')],'z','seg1_island_board','段1 小岛→码头→上船',lat=1.2)
# side view across the gangway (x–y at z≈12.25) too
s1x={**s,'path':[p for p in s['path'] if p['id'] in('dock_mid','dock_board') or p['frame']=='boat']}
draw(s1x,'island',[-3.5,1.5,10.5,13.5],dockE(s)+[meshE(xfT(BOAT,b['pos'],b['yawDeg']),'#3070a0','hull'),gwE(gwI)],'x','seg1b_gangway','段1 踏板横剖',lat=.5,ylim=(-1.2,1.6))
# 2
s=S['2_meadow_landing'];mr=J['segments']['2_meadow_landing']['boatAtBerth']['meadowPos']
gw2=np.array([[1.30,0.35,0.15],[0.70,0.60,0.15]]);gwM=rotY(180,gw2)+np.array(mr)
draw(s,'meadow',[-1.5,4.5,10,32],[meshE(JET,'#3c64b4','landing_jetty (glb)'),meshE(rotY(180,BOAT)+np.array(mr),'#3070a0','sailboat (at landing_berth)'),gwE(gwM)],'z','seg2_meadow_landing','段2 靠岸→下踏板→M1',lat=1.2)
s2x={**s,'path':[p for p in s['path'] if p['frame']=='boat' or p['id'] in('landing_step','landing_walk_01')]}
draw(s2x,'meadow',[0,4,29,31.5],[meshE(JET,'#3c64b4','landing_jetty'),meshE(rotY(180,BOAT)+np.array(mr),'#3070a0','hull'),gwE(gwM)],'x','seg2b_gangway','段2 踏板横剖',lat=.5,ylim=(0,2.2))
# 3
s=S['3_meadow_balloon_in'];bl=s['balloon']
req=s['balloon']['requested']
draw(s,'meadow',[-1,8,-27.5,-15.5],balloonE(bl['root'],bl['yawDeg'])+[circE(req,0.94,'#8a00c0','requested (4.6,-24.2): basket hits wind_bell_frame',':')]+[ (lambda c:(lambda ax,view,a=0:ax.plot([p[0] for p in c['path']],[p[2] for p in c['path']],':',c='#2a7a2a',lw=1.2,label='reroute '+c['edge']) if view=='top' else None))(c) for c in s['walkableChanges'] if c['kind']=='reroute-edge'],'z','seg3_meadow_balloon_in','段3 草原M4→进篮',lat=1.5)
# 4
s=S['4_skycity_balloon_out'];bl=s['balloon'];dk=s['deck']
dpoly=xfT(np.array([[dk['sizeBasketLocal']['x'][0],0,dk['sizeBasketLocal']['z'][0]],[dk['sizeBasketLocal']['x'][1],0,dk['sizeBasketLocal']['z'][0]],[dk['sizeBasketLocal']['x'][1],0,dk['sizeBasketLocal']['z'][1]],[dk['sizeBasketLocal']['x'][0],0,dk['sizeBasketLocal']['z'][1]]]),bl['root'],bl['yawDeg']);dpoly[:,1]=dk['topY']
draw(s,'skycity',[1.5,9.5,35.5,47],balloonE(bl['root'],bl['yawDeg'])+[polyE(dpoly,dk['topY'],lab='sky_mooring_deck (planned, top -0.02)')],'z','seg4_skycity_balloon_out','段4 天空城落地→出篮→S1',lat=1.5)
# 5a
s=S['5a_skycity_balloon_in'];bl=s['balloon']
pc=bl.get('parkedClearance',{});hp=pc.get('hitPointSky')
draw(s,'skycity',[-4,5,-33,-25],balloonE(bl['root'],bl['yawDeg'])+([circE(hp,0.25,'#ff0000',f"min gap {pc['minGapM']} m ({pc['hit']}, y {hp[1]})",'-')] if hp else []),'z','seg5a_skycity_balloon_in','段5a 天空城S6→C1进篮（红=最小间隙点）',lat=1.5)
# 5b (lake: no region crop; basket + path only)
s=S['5b_lake_balloon_out'];bl=s['balloon']
REG['lake']=np.zeros((0,3,3))
draw(s,'lake',[1,12,22,28],balloonE(bl['root'],bl['yawDeg'],env=False),'x','seg5b_lake_balloon_out','段5b 湖边落地→出篮（现有 b18 v4）',lat=2,ylim=(0,2.5))
print('renders ->',OUT)
