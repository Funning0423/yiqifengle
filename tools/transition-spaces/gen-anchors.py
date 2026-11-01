#!/usr/bin/env python3
"""b19: stances.json -> world anchors in 运镜bot's qf-transition-cam/1 (cine/transitions-continuous 079552bf) + lens occluder boxes.
World = the region journey world (island root at origin = sail world; meadow = sailMeadowRoot yaw 180; skycity = CW_JSON).
Camera keys are kept verbatim from transition-anchors.placeholder.json (运镜bot owns them); this adds `anchors` per segment.
Usage: python3 gen-anchors.py <placeholder.json>   (git show 079552bf:tools/transitions-continuous/transition-anchors.placeholder.json)"""
import json,math,os,runpy,sys,io,contextlib
H=os.path.dirname(os.path.abspath(__file__));R=os.path.normpath(H+'/../..')
with contextlib.redirect_stdout(io.StringIO()):g=runpy.run_path(H+'/gen-stances.py')
S,rotY=g['S'],g['rotY'];st=json.load(open(H+'/stances.json'));SG=st['segments']
CW=(241.165081,[59.06373,18.818369,117.212135]);MR=S['meadowRoot']
def r(p):return [round(v,3) for v in p]
def xf(root,yaw,p):q=rotY(yaw,p);return [root[0]+q[0],root[1]+q[1],root[2]+q[2]]
CC=g['cc'];FR={'island':(0.0,[0,0,0]),'meadow':(180.0,MR),'skycity':CW,'lake':(float(CC['lake']['yawDeg']),CC['lake']['root'])}
def W(frame,p,parent=None):
    if frame in FR:y,o=FR[frame];return xf(o,y,p)
    pf,py,pp=parent;q=xf(pp,py,p);return W(pf,q)
def Wyaw(frame,yaw,parent=None):
    if frame in FR:return (FR[frame][0]+yaw+180)%360-180
    return Wyaw(parent[0],parent[1]+yaw)
s1,s2,s3,s4=(SG[k] for k in ['1_island_board','2_meadow_landing','3_meadow_balloon_in','4_skycity_balloon_out'])
boat0=('island',s1['boatAtBerth']['yawDeg'],s1['boatAtBerth']['pos'])
be=s2['boatAtBerth'];boatM=('meadow',be['meadowYawDeg']+0.0,be['meadowPos'])
# boat at meadow berth: boatEnd yaw from sail code, if present
if 'yawRad' in S['boatEnd']:boatM=('meadow',180.0+math.degrees(S['boatEnd']['yawRad'])*0+0.0,be['meadowPos'])
ball3=('meadow',s3['balloon']['yawDeg'],s3['balloon']['root']);ball4=('skycity',s4['balloon']['yawDeg'],s4['balloon']['root'])
def pose(par):return {'pos':r(W(par[0],par[2])),'yawDeg':round(Wyaw(par[0],par[1]),3)}
def path(seg,par):
    out=[]
    for p in seg['path']:
        q=W(p['frame'],p['at'],par if p['frame'] in('boat','basket') else None)
        out.append({'id':p['id'],'pos':r(q),**({'moving':p['frame']} if p['frame'] in('boat','basket') else {})})
    return out
def pt(frame,p,yaw=None,par=None):
    d={'pos':r(W(frame,p,par))}
    if yaw is not None:d['yawDeg']=round(Wyaw(frame,yaw,par),2)
    return d
def sub(pth,a,b):
    ids=[p['id'] for p in pth];return pth[ids.index(a):ids.index(b)+1]
def tl(seg):return [{'clip':t['clip'],'s':t['s']} for t in seg['timeline']]
p1=path(s1,boat0);p2=path(s2,boatM);p3=path(s3,ball3);p4=path(s4,ball4)
GW=s1['nodes']['gangway'];bk=s3['basket'];door=s3['doors']['board'];doorB=s3['doors']['exit']
def DI(d,par,role):  # door block for 运镜bot / GGbot (b19 basket-door2)
    return {'role':role,'pivotNode':d['pivotNode'],'leafNode':d['leafNode'],'hinge':P('basket',d['hingeBasket'],None,par),'hingeBasket':d['hingeBasket'],'opens':'outward','openDeg':d['openDeg'],
            'rotation':'pivot local +Y by +openDeg (same sign for both doors; basket_door_b pivot is pre-rotated yaw 180)','openS':d['openS'],'closeS':d['closeS'],'leafRadiusM':d['leafRadiusM'],'axis':d['axis']}
def DOORS(par,use):return {'A':DI(door,par,'board (enter)' if use in('board','both') else 'stays shut'),'B':DI(doorB,par,'exit (walk out)' if use in('exit','both') else 'stays shut')}
def plank(par,side,deg):
    h=GW['hingeBoat'][side];sgn=-1 if side=='stbd' else 1
    end=[h[0]+sgn*GW['plankLenM']*math.cos(math.radians(abs(deg))),h[1]+GW['plankTopAboveHingeM']-math.copysign(1,deg)*GW['plankLenM']*math.sin(math.radians(abs(deg)))*(-1 if side=='stbd' else 1),h[2]]
    return {'hinge':pt(par[0],h,None,par)|{},'start':pt('boat',[h[0],h[1]+GW['plankTopAboveHingeM'],h[2]],None,par),'end':pt('boat',end,None,par),'deployDeg':deg,'node':'sail_gangway','hingeNode':'sail_gangway_hinge'}
def fixb(d,par):  # boat/basket frame points
    return d
def P(frame,p,yaw=None,par=None):return pt(frame,p,yaw,par)
A={}
A['A1-dock-walk']={'note':'小岛最后一关 I4 停点 → 码头端点（dock_board）','I4':P('island',s1['path'][0]['at']),'I6_new':P('island',s1['stances']['I6_new']['at'],0.0),
 'dockEnd':P('island',s1['stances']['dock_board']['at'],s1['stances']['dock_board']['yawDeg']),'path':sub(p1,'I4','dock_board'),'walkMps':1.2,'seconds':round(15.61+3.04,2),'timeline':tl(s1)[:2]}
gw1={'hinge':P('boat',GW['hingeBoat']['stbd'],None,boat0),'start':P('island',s1['stances']['dock_board']['at']),'end':P('boat',[-0.70,0.60,0.15],None,boat0),'deployDeg':GW['deployDeg']['island_stbd'],'node':'sail_gangway','hingeNode':'sail_gangway_hinge','parent':'transport_sailboat'}
A['A2-board']={'note':'踏板（码头端→船舷）→ 舱内踏阶 → 坐下；船坐标点按开船时（t=0 泊位）换算','gangway':gw1,'path':sub(p1,'dock_board','boat_sit_stand'),'walkMps':0.9,'seconds':round(2.32+1.2,2),'timeline':tl(s1)[2:],
 'seat':P('boat',[0,0.06,-0.55],0.0,boat0)|{'node':'seated_root_anchor'}}
A['A3-setoff']={'note':'开船时船的位姿（sailVehicle t=0）与坐姿','boatPose':pose(boat0),'seat':A['A2-board']['seat']}
gw2={'hinge':P('boat',GW['hingeBoat']['port'],None,boatM),'start':P('boat',[0.70,0.60,0.15],None,boatM),'end':P('boat',[1.30,0.35,0.15],None,boatM),'deployDeg':GW['deployDeg']['meadow_port'],'node':'sail_gangway','hingeNode':'sail_gangway_hinge','parent':'transport_sailboat'}
A['A4A5-arrive-disembark']={'note':'草原靠岸时船位姿；站起点；下踏板 → landing_jetty','boatPose':pose(boatM),'seated':P('boat',[0,0.06,-0.55],0.0,boatM),'standUp':P('boat',[0,0.06,-0.056],0.0,boatM),
 'gangway':gw2,'path':[q for q in p2 if q['id'] in [x['id'] for x in p2[:p2.index(next(z for z in p2 if z['id']=='landing_step'))+1]]],'walkMps':0.9,'seconds':round(2.0+1.27+2.69,2),'timeline':tl(s2)[:3]}
i=[q['id'] for q in p2].index('landing_step')
A['A6-meadow-first']={'note':'码头 → 草原第一关 M1','path':p2[i:],'firstStop':P('meadow',s2['path'][-1]['at'],None)|{'id':'M1'},'walkMps':1.2,'seconds':16.47,'timeline':tl(s2)[3:]}
# M1 yaw: direction of last leg
a,b=p2[-2]['pos'],p2[-1]['pos'];A['A6-meadow-first']['firstStop']['yawDeg']=round(math.degrees(math.atan2(b[0]-a[0],b[2]-a[2])),2)
A['B1-basket-in']={'note':'草原最后一关 M4 → 篮门前 → 开门 → 篮内坐下（篮已停在新起飞点）','balloonPose':pose(ball3),'M4':P('meadow',s3['path'][0]['at']),
 'doorFront':P('basket',bk['outside'],bk['outsideYawDeg'],ball3),'hinge':P('basket',door['hingeBasket'],None,ball3)|{'pivotNode':door['pivotNode'],'leafNode':door['leafNode'],'openDeg':door['openDeg'],'openS':door['openS'],'closeS':door['closeS'],'leafRadiusM':door['leafRadiusM'],'opens':'outward'},
 'doors':DOORS(ball3,'board'),'threshold':P('basket',bk['threshold'],180.0,ball3),
 'inside':{'P0':P('basket',bk['P0'],180.0,ball3),'seat':P('basket',bk['seat'],180.0,ball3)|{'basketLocal':bk['seat'],'basketYawDeg':180.0},'note':'no turn: walks in through door A facing basket -z, sit_down backwards P0 -> seat (0.494 m); seated facing door B'},'path':p3,'walkMps':{'approach':1.2,'intoBasket':0.8},'seconds':s3['totalS'],'timeline':tl(s3)}
A['B2-ignite']={'note':'起飞前篮位姿（flight 首键改到这里，归运镜bot）；篮 yaw -16°（门 A 对着院门来路）','balloonPose':pose(ball3),'seat':A['B1-basket-in']['inside']['seat']}
A['B4B5-skycity-out']={'note':'天空之城着陆位姿（篮根 y 抬到停靠台；篮 yaw = 旧末键 yaw +180，门 B 在原门 A 位置）→ 站起 P0 → 开门 B → 门槛 B → 下台阶第一步 → 新 S0 → 接 S0–S1','balloonPose':pose(ball4),'balloonYawOldDeg':round(Wyaw('skycity',s4['balloon']['landYawOldDeg']),3),'seat':P('basket',bk['seat'],180.0,ball4)|{'basketLocal':bk['seat']},'doors':DOORS(ball4,'exit'),'thresholdB':P('basket',bk['thresholdB'],None,ball4),'doorOutB':P('basket',bk['doorOutB'],None,ball4),'exitStartLocalB':bk['P0'],
 'exitDoor':P('skycity',s4['stances']['P0']['at'],s4['stances']['P0']['yawDeg']),'firstStepDown':P('skycity',[q for q in s4['path'] if q['id']=='stepdown_end'][0]['at']),
 'hinge':P('basket',doorB['hingeBasket'],None,ball4)|{'openDeg':doorB['openDeg'],'pivotNode':doorB['pivotNode']},'firstStop':P('skycity',s4['stances']['S0_new']['at'],s4['stances']['S0_new']['yawDeg'])|{'id':'S0'},
 'path':p4,'walkMps':0.8,'seconds':s4['totalS'],'timeline':tl(s4)}
s5,s6=SG['5a_skycity_balloon_in'],SG['5b_lake_balloon_out'];LIFTGAP=float(os.environ.get('LIFTGAP','nan'))
ball5=('skycity',s5['balloon']['yawDeg'],s5['balloon']['root']);ball6=('lake',s6['balloon']['yawDeg'],s6['balloon']['root'])
p5=path(s5,ball5);p6=path(s6,ball6)
A['C1-sky-basket-in']={'note':'T-02 最后一镜 S6 → 系泊点（选 C，S6 西南 18 m）篮门前 → 开门 → 篮内坐下。起飞关键帧归运镜bot（用 check-lift-clearance.cjs 校验 ≥0.5 m）；liftSuggested 只是参考','candidate':s5['balloon']['candidate'],
 'mooringPose':pose(ball5),'S6':P('skycity',s5['path'][0]['at']),'doorFront':P('basket',s5['basket']['outside'],s5['basket']['outsideYawDeg'],ball5),
 'hinge':P('basket',door['hingeBasket'],None,ball5)|{'pivotNode':door['pivotNode'],'leafNode':door['leafNode'],'openDeg':door['openDeg'],'openS':door['openS'],'closeS':door['closeS'],'opens':'outward'},
 'doors':DOORS(ball5,'board'),'threshold':P('basket',s5['basket']['threshold'],180.0,ball5),'inside':{'Q':P('basket',s5['basket']['Q'],180.0,ball5),'seat':P('basket',s5['basket']['seat'],180.0,ball5)|{'basketLocal':s5['basket']['seat']},'note':'no turn in the basket: walks in through door A facing the seat direction, sits backwards Q -> seat; seated facing door B (lake heading)'},'path':p5,'walkMps':{'approach':1.2,'intoBasket':0.8},'seconds':s5['totalS'],'timeline':tl(s5),
 'parkedClearance':s5['balloon']['parkedClearance'],
 'liftSuggested':({'note':s5['liftSuggested']['note'],'liftDirSkyDeg':s5['balloon']['liftDirDeg'],'minGapM':LIFTGAP,'keys':[{'t':k['t'],'pos':r(W('skycity',k['pos'])),'yawDeg':round(Wyaw('skycity',k['yaw']),2)} for k in s5['liftSuggested']['keys']]} if s5.get('liftSuggested') else None)}
A['C2-lakeside-out']={'note':'湖边着陆（篮 yaw = 旧 lakesideBalloonMooring yaw +180，门 B 在原门 A 位置）→ 站起（已面向门 B，不转身）→ 开门 B → 门槛 B → 下台阶 → 走到湖边关卡起点 L1（b18 路径 v4 不变）','touchdownPose':pose(ball6),'balloonYawOldDeg':round(Wyaw('lake',s6['balloon']['yawOldDeg']),3),'seat':P('basket',s5['basket']['seat'],180.0,ball6)|{'basketLocal':s5['basket']['seat']},
 'doors':DOORS(ball6,'exit'),'exitStartLocalB':bk['P0'],'thresholdB':P('basket',bk['thresholdB'],None,ball6),'doorOutB':P('basket',bk['doorOutB'],None,ball6)|{'note':'门外站位（下台阶途中，第一步落地前后）'},'firstStepDown':P('basket',bk['stepdownEndB'],None,ball6),
 'exitDoor':P('lake',s6['stances']['P0']['at'],s6['stances']['P0']['yawDeg']),'hinge':P('basket',doorB['hingeBasket'],None,ball6)|{'openDeg':doorB['openDeg'],'pivotNode':doorB['pivotNode']},
 'levelStart':P('lake',s6['stances']['end']['at'],s6['stances']['end']['yawDeg']),'path':p6,'walkMps':0.8,'seconds':s6['totalS'],'timeline':tl(s6)}
ph=json.load(open(sys.argv[1]));out={'format':'qf-transition-cam/1','note':'场景设计部 b19: anchors = world (region journey world: island root origin; meadow = sailMeadowRoot yaw180; skycity = CW_JSON). camera keys unchanged from placeholder (运镜bot). yaw = atan2(dx,dz) deg. source: tools/transition-spaces/stances.json via gen-anchors.py',
 'world':{'island':{'origin':[0,0,0],'yawDeg':0},'meadow':{'origin':r(MR),'yawDeg':180},'skycity':{'origin':CW[1],'yawDeg':CW[0]}},'segments':{}}
for k,v in ph['segments'].items():out['segments'][k]=dict(v)|{'anchors':A.get(k,{})}
json.dump(out,open(R+'/tools/transitions-continuous/transition-anchors.json','w'),ensure_ascii=False,indent=1)
# ---- occluders: SkycityLensOccluders row format [minX,minY,minZ,maxX,maxY,maxZ], world AABB of planned geometry ----
def box(frame,par,lo,hi):
    cs=[W(frame,[x,y,z],par) for x in(lo[0],hi[0]) for y in(lo[1],hi[1]) for z in(lo[2],hi[2])]
    return [round(min(c[i] for c in cs),2) for i in range(3)]+[round(max(c[i] for c in cs),2) for i in range(3)]
O={}
D=s1['nodes']['dock']
O['island_dock']=[box('island',None,[D['deck']['x'][0],-0.9,D['deck']['z'][0]],[D['deck']['x'][1],D['deck']['topY'],D['deck']['z'][1]]),box('island',None,[D['ramp']['x'][0],-0.3,D['ramp']['z'][0]],[D['ramp']['x'][1],0.0,D['ramp']['z'][1]])]
O['sail_gangway_island']=[box('boat',boat0,[-1.45,0.33,-0.1],[-0.70,0.62,0.40])];O['sail_gangway_meadow']=[box('boat',boatM,[0.70,0.31,-0.1],[1.45,0.62,0.40])]
BW=0.85;BH=1.01;T=0.06  # planned basket wall box (basket-local; refine from balloon glb triangles when modelled)
def basket(par):return [box('basket',par,[0.4,0,-BW],[BW,BH,-BW+T]),box('basket',par,[-BW,0,-BW],[-0.4,BH,-BW+T]),box('basket',par,[-BW,0,-BW],[-BW+T,BH,BW]),box('basket',par,[BW-T,0,-BW],[BW,BH,BW]),box('basket',par,[-BW,0,BW-T],[-0.4,BH,BW]),box('basket',par,[0.4,0,BW-T],[BW,BH,BW])]  # door openings x -0.4..0.4 in both the +z (A) and -z (B) walls
def leaf(par,deg,B=False):
    c,s=math.cos(math.radians(deg)),math.sin(math.radians(deg));h=door['hingeBasket'];e=[h[0]-0.8*c,0,h[2]+0.8*s]
    lo,hi=[min(h[0],e[0]),0,min(h[2],e[2])-0.03],[max(h[0],e[0]),BH,max(h[2],e[2])+0.03]
    if B:lo,hi=[-hi[0],0,-hi[2]],[-lo[0],BH,-lo[2]]  # basket_door_b = door A turned 180° about the basket origin
    return box('basket',par,lo,hi)
for n,par in [('meadow',ball3),('skycity',ball4),('skycity_5a',ball5),('lake',ball6)]:O['basket_'+n]=basket(par);O['basket_door_leaf_'+n]={'closed':leaf(par,0),'open100':leaf(par,100)};O['basket_door_leaf_b_'+n]={'closed':leaf(par,0,True),'open100':leaf(par,100,True)}
oc={'format':'lens-occluders/aabb-world','rowFormat':'[minX,minY,minZ,maxX,maxY,maxZ] world AABB (same row format as SKYCITY_LENS_OCCLUDERS)','planned':True,
 'note':'按计划尺寸生成（码头/踏板未建模；篮墙按 ±0.85 m×1.01 m 估）。建模后用实际三角形重新生成。用于 脸/胸可见 + 镜头离墙 1.1 m 测试。','boxes':O}
O['sky_mooring_5a']=[box('basket',ball5,[x-0.08,0,-0.98],[x+0.08,0.9,-0.82]) for x in(-1.15,1.15)]+[box('basket',ball5,[-0.25,-0.05,0.9],[0.25,0.03,1.2])]
# ---- b19 dock models: the dock / gangway / sky mooring rows from the real triangles (tools/dock-models/build_models.py = the exported glbs) ----
import numpy as np
sys.path.insert(0,R+'/tools/dock-models')
with contextlib.redirect_stdout(io.StringIO()):import build_models as BM
def tris_of(parts,names=None):
    out=[]
    for n,pp in parts.items():
        if pp.get('mesh') is None or (names and not any(k in n for k in names)):continue
        V,F,_=pp['mesh'].arrays();out.append(V[F.reshape(-1)])
    return np.concatenate(out)
def chunk_boxes(P,to_world,cell=0.6,ymin=None,ymax=None):
    # world AABBs of the real triangle corners, bucketed by xz cells (merged per cell), clipped to [ymin,ymax]
    keep=np.ones(len(P),bool)  # y limits in the model's own (region-local) frame
    if ymin is not None:keep&=P[:,1]>=ymin
    if ymax is not None:keep&=P[:,1]<=ymax
    Wp=np.array([to_world(v) for v in P[keep]]);B={}
    for q in Wp:
        k=(int(math.floor(q[0]/cell)),int(math.floor(q[2]/cell)));b=B.setdefault(k,[q.copy(),q.copy()]);b[0]=np.minimum(b[0],q);b[1]=np.maximum(b[1],q)
    return [[round(float(v),2) for v in list(b[0])+list(b[1])] for b in B.values() if (b[1]-b[0]).max()>0.02]
def slab(P,to_world,ylo,yhi):
    Wp=np.array([to_world(v) for v in P[(P[:,1]>=ylo)&(P[:,1]<=yhi)]])
    return [round(float(v),2) for v in list(Wp.min(0))+list(Wp.max(0))]
dp,_=BM.island_dock();Pd=tris_of(dp);toI=lambda v:W('island',list(v))
# deck + ramp slab (one row, the walking surface down to the joists) + everything standing above the deck in 0.6 m cells (posts, bollards, rail, coils)
O['island_dock']=[slab(Pd,toI,-0.45,-0.12)]+chunk_boxes(Pd,toI,0.6,ymin=-0.12)
gp,_=BM.sail_gangway();Pg=tris_of(gp)
def hinge(par,h,yaw,deg):
    def f(v):
        c,s_=math.cos(math.radians(deg)),math.sin(math.radians(deg));q=[c*v[0]-s_*v[1],s_*v[0]+c*v[1],v[2]];q=rotY(yaw,q);return W('boat',[h[0]+q[0],h[1]+q[1],h[2]+q[2]],par)
    return f
O['sail_gangway_island']=[slab(Pg,hinge(boat0,[-0.80,0.585,0.15],180.0,23.0),-9,9)];O['sail_gangway_meadow']=[slab(Pg,hinge(boatM,[0.80,0.585,0.15],0.0,-16.0),-9,9)]
sp_,_=BM.sky();toS=lambda v:W('skycity',list(v))
O['sky_mooring_deck']=[slab(tris_of(sp_,['sky_mooring_deck']),toS,-1,1)]+chunk_boxes(tris_of(sp_,['sky_mooring_posts']),toS,0.6)
O['sky_mooring_5a']=chunk_boxes(tris_of(sp_,['sky_mooring_5a_stakes']),toS,0.6)+[slab(tris_of(sp_,['balloon_step_stool_5a']),toS,-1,1)]
oc['planned']=False
oc['note']='码头/踏板/天空城停靠台/5a 桩与踏凳按实际三角形生成（tools/dock-models/build_models.py，与导出 glb 同源）；篮墙仍按 ±0.85 m×1.01 m 估。用于 脸/胸可见 + 镜头离墙 1.1 m 测试。'
json.dump(oc,open(R+'/tools/transitions-continuous/transition-occluders.json','w'),ensure_ascii=False,indent=1)
print('ok',len(json.dumps(out)),len(json.dumps(oc)))
