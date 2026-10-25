#!/usr/bin/env python3
"""Generates stances.json (transition stance/path data, scene/b19-transition-spaces) from d9423886 code constants
(code-constants.cjs) + the design numbers below. Pure offline; no Blender, no engine.
Frames: island = island-local (= sail-journey world; island root at origin, SAIL_I6 is used as world there);
meadow = env_meadow / transit_landing local; skycity = env_skycity local; lake = lakeside-local;
boat = transport_sailboat root (sailboat.glb root, placeBoat: waterline, +z bow, -x starboard, +x port);
basket = transport_balloon root (woven floor board top = y 0, door A wall +z, door B wall -z (b19 basket-door2); NOTE stand_point sits at y 0.1).
yawDeg everywhere = atan2(dx,dz) in that frame (Cocos setRotationFromEuler(0,yaw,0) facing +z at 0)."""
import json,math,subprocess,os,sys
HERE=os.path.dirname(os.path.abspath(__file__))
cc=json.loads(subprocess.check_output(['node',os.path.join(HERE,'code-constants.cjs')]))
def r(v,n=3):return [round(float(x),n) for x in v]
def yaw(a,b):return round(math.degrees(math.atan2(b[0]-a[0],b[2]-a[2])),2)
def plen(p):return sum(math.dist(p[i-1],p[i]) for i in range(1,len(p)))
def rotY(deg,p):c,s=math.cos(math.radians(deg)),math.sin(math.radians(deg));return [c*p[0]+s*p[2],p[1],-s*p[0]+c*p[2]]
def xf(root,yawDeg,p):q=rotY(yawDeg,p);return [root[0]+q[0],root[1]+q[1],root[2]+q[2]]
WALK=1.2;EXIT=cc['lake']['K']['exitWalkMps'];CLIP={'walk_start':1.9333,'walk_stop_bodyL':1.4667,'walk_loop':1.4333,'sit_down':1.2,'stand_up':1.2667,'door_reach':2.0,'walk_start_stepdown':1.7333,'walk_turn_180':1.5,'walk_turn_90_bodyL':1.5,'walk_turn_90_bodyR':1.4667,'idle_breathing_loop':1.8,'sit_hold':2.0}
K=cc['lake']['K']
def walkS(L,mps=WALK):return round(L/mps+0.6,2)  # planner: walk_start entry + walk_stop exit adds ~0.6 s over cruise at 1.2 m/s
# ---------- shared basket set (meadow launch, skycity landing, skycity→lake launch, lake landing) ----------
DOOR={'pivotNode':'basket_door','leafNode':'basket_door_leaf','hingeBasket':[0.4,0,0.84],'leafRadiusM':0.82,'openDeg':K['doorOpenDeg'],'openS':K['doorOpenS'],'closeS':0.8,
 'axis':'basket_door local Y, +deg opens OUTWARD (leaf free end sweeps from (-0.4,0.84..1.01) to about (0.64,1.61) basket-local, i.e. toward +z/+x)'}
# b19 basket-door2 (GGbot/产品总监 2026-10-25): two doors. Board through door A (+z), walk straight in (heading -z), sit_down
# backwards 0.494 m -> seated facing door B (-z). Arrive: stand_up seat -> P0 (forward 0.494 m, still facing -z), door_reach door B,
# step down / walk out through door B. No turn anywhere in the basket. The door-B exit set is the exact 180° mirror of the old
# door-A exit set (seat (.032,0,-.099) / exitStartLocal (.03,0,.395)), so with basket yaw +180 every old exit point stays put in the world.
DOOR_B={'pivotNode':'basket_door_b','leafNode':'basket_door_leaf_b','hingeBasket':[-0.4,0,-0.84],'leafRadiusM':0.82,'openDeg':K['doorOpenDeg'],'openS':K['doorOpenS'],'closeS':0.8,
 'axis':'basket_door_b local Y (node yaw 180 about the basket origin, quaternion (0,1,0,0)), +deg opens OUTWARD exactly like basket_door: leaf free end sweeps from (0.4,-0.84..-1.01) to about (-0.64,-1.61) basket-local, i.e. toward -z/-x',
 'opens':'outward','mesh':'basket_door_leaf (shared, 0 new bytes)'}
DOOR['opens']='outward'
BASKET={'outside':[-0.16,0,1.75],'doorOut':[-0.072,0,1.25],'threshold':[0.0,0,0.84],'P0':[-0.03,0,-0.395],'seat':[-0.032,0,0.099],'seatYawDeg':180.0,
 'thresholdB':[0.0,0,-0.84],'doorOutB':[0.0,0,-1.25],'stepdownEndB':[-0.03,0,-1.552],'exitYawDeg':180.0,
 'note':'board door A: outside -> doorOut -> threshold -> P0 one line (bend at the threshold 11.4°), sit_down backwards P0 -> seat (0.494 m), seated yaw 180 (facing door B). '
        'Exit door B: stand_up seat -> P0 (= exitStartLocalB, the 180° mirror of LAKESIDE_BALLOON_LANDING.exitStartLocal (.03,0,.395)), door_reach basket_door_b, walk_start_stepdown 1.157 m along -z through thresholdB/doorOutB. No walk_turn_180.'}
BASKET['outsideYawDeg']=yaw(BASKET['outside'],BASKET['threshold'])
def basket_in(root,byaw,ground):
    o=xf(root,byaw,BASKET['outside']);o[1]=ground
    pts=[('basket_outside',o,'walkable')]+[(n,xf(root,byaw,BASKET[k]),'basket') for n,k in [('basket_door_out','doorOut'),('basket_threshold','threshold'),('basket_P0','P0')]]
    pts[1][1][1]=ground  # door_out is still on the ground in front of the door
    return pts
def tl(rows):
    t=0;out=[]
    for name,dur,clip,note in rows:out.append({'beat':name,'t0':round(t,2),'t1':round(t+dur,2),'s':round(dur,2),'clip':clip,'note':note});t+=dur
    return out,round(t,2)
segs={}
# ================= 1. island: last level (I4) -> dock -> board the boat (sit) =================
S=cc['sail'];b0=S['boat0'];byaw=math.degrees(b0['yawRad']);broot=b0['pos']
DOCK={'node':'island_dock','deck':{'node':'island_dock_deck','x':[-2.5,-1.1],'z':[8.9,14.4],'topY':-0.18},'ramp':{'node':'island_dock_ramp','x':[-1.7,-1.1],'z':[8.2,8.9],'topY':[0.0,-0.18],'skirt':'side boards down to the sand on the west edge (sand falls to -0.26)'},
 'piles':'island_dock_piles','bollards':['island_dock_bollard_a','island_dock_bollard_b'],'parent':'region_island scene root (island-local), resident in the island package, procedural (runtime mesh, island palette material, no texture)'}
GW={'hinge':'sail_gangway_hinge','plank':'sail_gangway','steps':['sail_gangway_step'],'parent':'transport_sailboat',
 'hingeBoat':{'stbd':[-0.70,0.56,0.15],'port':[0.70,0.56,0.15]},'plankLenM':0.75,'plankWidthM':0.5,'plankTopAboveHingeM':0.04,
 'deployDeg':{'island_stbd':14.0,'meadow_port':-20.0},'stowed':'flat on the cockpit sole along +z (code transform, no clip)',
 'stepTopBoat':[0,0.33,0.15],'stepBoxBoat':{'x':[-0.2,0.2],'z':[0.0,0.3],'top':0.33},'grabLine':'rig has a thin grab line at x ±0.40, y 0.45–0.55, z -1.55..0.75; her foot passes ~5 cm under its top while stepping rail→step (step-over). Option: open a 0.5 m gap in it at z -0.1..0.4 when modelling (sailboat.glb, −~8 tris).'}
boat_stbd=[('boat_plank_dock',[-1.30,0.77,0.15]),('boat_rail_stbd',[-0.70,0.60,0.15]),('boat_step',[-0.12,0.33,0.15]),('boat_sole',[0,0.06,-0.04]),('boat_sit_stand',[0,0.06,-0.15])]
I4=[n for n in cc['nodes']['island']['nodes'] if n['key']=='I4'][0]['at']
edge=[e for e in cc['nodes']['island']['edges'] if e['a']=='I4' and e['b']=='I6'][0]['path']
I6new=[-1.5,-0.18,9.3]
approach=[p for p in edge if p[2]<=7.3+1e-6][:13]  # I4 ... (0.5,0.002,7.3): existing baked edge, unchanged
approach+= [[-0.5,0.0,7.7]]
nodewalk=approach+[[-1.4,0.0,8.2],[-1.45,-0.18,8.9],I6new]
dockb=xf(broot,byaw,boat_stbd[0][1])
a1=[I6new,[-1.5,-0.18,11.6],r(dockb)]
pts1=[{'id':'I4','frame':'island','at':I4,'surface':'walkable:island','existing':True}]+[{'id':f'nodewalk_{i:02d}','frame':'island','at':r(p),'existing':i<12,'surface':'walkable:island' if p[2]<8.15 else ('dock_ramp' if p[2]<8.89 else 'dock')} for i,p in enumerate(nodewalk[1:])]
pts1+=[{'id':'dock_mid','frame':'island','at':a1[1],'surface':'dock'},{'id':'dock_board','frame':'island','at':a1[2],'surface':'gangway','boatLocal':boat_stbd[0][1]}]
pts1+=[{'id':n,'frame':'boat','parent':'transport_sailboat','at':p,'surface':'boat','regionAt':r(xf(broot,byaw,p))} for n,p in boat_stbd[1:]]
board=[a1[2]]+[xf(broot,byaw,p) for _,p in boat_stbd[1:]]
L1n=plen(nodewalk);L1a=plen(a1);L1b=plen(board)
t1,T1=tl([('node walk I4 -> new I6 on the dock (RegionNodeProgress departure walk, visible, dock resident)',walkS(L1n),'walk_start/walk_loop/walk_stop_bodyL',f'{L1n:.2f} m @1.2 m/s'),
 ('A1 I6 -> dock_board (gangway foot); gangway already down (deploy 0.6 s overlaps)',walkS(L1a),'walk_start/walk_loop/walk_turn_90_bodyL',f'{L1a:.2f} m'),
 ('A2 gangway -> rail -> inboard step -> sole -> sit stand point',round(L1b/0.9+0.4,2),'walk_loop (0.9 m/s on the plank/steps) -> walk_stop_bodyL',f'{L1b:.2f} m, two 0.27 m steps down inside'),
 ('A2 sit',CLIP['sit_down'],'sit_down -> sit_hold','seated root = seated_root_anchor (0,0.06,-0.55) boat-local, yaw 0 (bow)')])
segs['1_island_board']={'title':'小岛最后一关(I4) → 码头 → 走上船坐下','frames':['island','boat'],
 'boatAtBerth':{'pos':r(broot),'yawDeg':round(byaw,3),'source':'sailVehicle(t=0) on d9423886'},
 'stances':{'I6_new':{'frame':'island','at':I6new,'yawDeg':0.0},'dock_board':{'frame':'island','at':r(dockb),'yawDeg':round(90+byaw,2)},'seated':{'frame':'boat','parent':'transport_sailboat','at':[0,0.06,-0.55],'yawDeg':0.0,'node':'seated_root_anchor'}},
 'path':pts1,'timeline':t1,'totalS':T1,'nodes':{'dock':DOCK,'gangway':GW}}
# ================= 2. meadow landing: stand -> gangway -> landing_jetty -> first level (M1) =================
mr=S['meadowRoot'];be=S['boatEnd']
def boat2meadow(p):  # boat at berth (world yaw 0) seen from the meadow root rotated 180
    w=xf(be['pos'],math.degrees(be['yawRad']),p);return [mr[0]-w[0],w[1]-mr[1],mr[2]-w[2]]
boat_port=[('boat_seated',[0,0.06,-0.55]),('boat_stood_P',[0,0.06,-0.056]),('boat_step',[0.12,0.33,0.15]),('boat_rail_port',[0.70,0.60,0.15]),('boat_plank_jetty',[1.30,0.35,0.15])]
pts2=[{'id':n,'frame':'boat','parent':'transport_sailboat','at':p,'surface':'boat' if n!='boat_plank_jetty' else 'gangway','regionAt':r(boat2meadow(p))} for n,p in boat_port]
walk=S['landingWalk'];arr=[S['landingStep']]+walk[1:]+[S['M0'],S['M1']]
pts2+=[{'id':'landing_step','frame':'meadow','at':S['landingStep'],'surface':'jetty'}]+[{'id':f'landing_walk_{i:02d}','frame':'meadow','at':p,'surface':'jetty' if p[2]>=23.0 else 'walkable:meadow'} for i,p in enumerate(walk) if i>0]
pts2+=[{'id':'M0_sail','frame':'meadow','at':S['M0'],'surface':'walkable:meadow'},{'id':'M1','frame':'meadow','at':S['M1'],'surface':'walkable:meadow'}]
off=[boat2meadow(p) for _,p in boat_port[1:]]+[S['landingStep']]
L2o=plen(off);L2a=plen(arr)
t2,T2=tl([('A4 docked hold (boat still)',2.0,'sit_hold',''),('A5 stand',CLIP['stand_up'],'stand_up (hard cut from sit_hold, root seat -> P 0.494 m fwd)','stopEngineStates before (GGbot P0-b)'),
 ('A5 sole -> inboard step -> rail -> gangway -> landing_step',round(L2o/0.9+0.6,2),'walk_turn_90_bodyL -> walk_loop 0.9 m/s -> (no stop, continues)',f'{L2o:.2f} m; plank -20°'),
 ('A6 jetty -> M0 -> M1 (existing arrival walk, landing_walk_00..06)',round(L2a/WALK,2),'walk_loop -> walk_stop_bodyL',f'{L2a:.2f} m (SAIL arrival budget 12 s)')])
segs['2_meadow_landing']={'title':'靠岸 → 站起 → 走下踏板到 landing_jetty → 草原第一关(M1)','frames':['boat','meadow'],
 'boatAtBerth':{'meadowPos':r(boat2meadow([0,0,0])),'meadowYawDeg':180.0,'source':'sailVehicle(S-e end) + sailMeadowRoot (yaw 180)'},
 'stances':{'seated':{'frame':'boat','at':[0,0.06,-0.55],'yawDeg':0.0},'stood':{'frame':'boat','at':[0,0.06,-0.056],'yawDeg':0.0},'landing_step':{'frame':'meadow','at':S['landingStep'],'yawDeg':yaw(S['landingStep'],walk[1])}},
 'path':pts2,'timeline':t2,'totalS':T2,'nodes':{'gangway':GW,'jetty':'landing_jetty (transit_landing.glb, existing)'}}
# ================= 3. meadow last level (M4) -> balloon -> door -> in -> sit =================
MB=[3.6,6.6,-23.4];MBY=-16.0;  # door A turned 16° toward the yard gate: gate -> yard_in -> outside -> door A with 10° / 0° bends (b19 door2)
g3=6.493  # basket root y = max lawn under footprint 6.57 + 0.03 board
M4=[n for n in cc['nodes']['meadow']['nodes'] if n['key']=='M4'][0]['at']
inb=basket_in(MB,MBY,6.494)
STOOL={'node':'balloon_step_stool','frame':'meadow','basketLocal':{'x':[-0.25,0.25],'z':[0.9,1.2]},'topY':6.55,'parent':'meadow scene root (stays after lift-off), procedural ≈ 12 tris','why':'lawn at the door 6.494 vs basket floor 6.60 (lawn under the footprint slopes 6.52–6.60): two 5 cm steps instead of one 11 cm'}
stoolP=xf(MB,MBY,[0,0,1.05]);stoolP[1]=STOOL['topY']
p3=[M4,[3.0,6.322,-20.4],[2.6,6.341,-20.8],[2.74,6.370,-21.31]]+[p for _,p,_ in inb[:2]]+[stoolP]+[p for _,p,_ in inb[2:]]
pts3=[{'id':'M4','frame':'meadow','at':M4,'surface':'walkable:meadow'},{'id':'m4_m6_01','frame':'meadow','at':[3.0,6.322,-20.4],'surface':'walkable:meadow'},{'id':'yard_gate','frame':'meadow','at':[2.6,6.341,-20.8],'surface':'walkable:meadow'},{'id':'yard_in','frame':'meadow','at':[2.74,6.370,-21.31],'surface':'walkable:meadow'}]
pts3+=[{'id':n,'frame':'meadow','at':r(p),'surface':'walkable:meadow' if s=='walkable' else ('ground' if n=='basket_door_out' else 'basket'),**({'basketLocal':BASKET[{'basket_door_out':'doorOut','basket_threshold':'threshold','basket_P0':'P0'}[n]],'parent':'transport_balloon'} if n!='basket_outside' else {'basketLocal':BASKET['outside']})} for n,p,s in inb]
pts3.insert(6,{'id':'balloon_step_stool','frame':'meadow','at':r(stoolP),'surface':'stool','basketLocal':[0,0.0,1.05]})
pts3+=[{'id':'basket_seat','frame':'basket','parent':'transport_balloon','at':BASKET['seat'],'surface':'basket','regionAt':r(xf(MB,MBY,BASKET['seat']))}]
L3w=plen(p3[:5]);L3i=plen(p3[4:])
def basket_seq(walkInL):
    return [('door_reach at basket_outside (door contact 0.333 s, leaf opens +100° in 0.8 s, walk may start at 1.8 s)',K['walkStartAfterReachS'],'door_reach','door: '+DOOR['pivotNode']),
     ('walk in through door A: outside -> door_out -> threshold -> P0, one line, facing the seat direction (no turn in the basket)',round(walkInL/EXIT+0.9,2),'walk_start -> walk_loop 0.8 m/s -> walk_stop_bodyL',f'{walkInL:.2f} m'),
     ('sit backwards (root P0 -> seat 0.494 m toward door A); door A closes 0.8 s meanwhile',CLIP['sit_down'],'sit_down -> sit_hold','seated = basket (-0.032,0,0.099) yaw 180, facing door B')]
t3,T3=tl([('B1a M4 -> basket_outside (balloon parked here since the M4 level started; burner/inflate B2 may overlap)',walkS(L3w),'walk_start/walk_loop/walk_stop_bodyL',f'{L3w:.2f} m')]+basket_seq(L3i))
segs['3_meadow_balloon_in']={'title':'草原最后一关(M4) → 走到热气球 → 开篮门 → 进篮坐下','frames':['meadow','basket'],
 'balloon':{'frame':'meadow','root':MB,'yawDeg':MBY,'requested':[4.6,6.56,-24.2],'why_moved':'(4.6,-24.2) 草甸局部：篮身压进 wind_bell_frame（x≥4.67,z≥-23.65），气囊进到风车叶片扫掠盘（z≈-27, 半径 6.2）。(3.6,-23.4) 是离它最近、篮身+气囊净空 ≥0.6 m、草坪高差 ≤0.04 m 的点（偏 1.28 m）。','flightKey0Old':cc['balloon']['flight0']['pos'],'note':'首段飞行关键帧（起点由 (12,6.52,-23.8) 改到这里）归运镜bot'},
 'stances':{'basket_outside':{'frame':'meadow','at':r(inb[0][1]),'yawDeg':round(BASKET['outsideYawDeg']+MBY,2)},'P0':{'frame':'basket','at':BASKET['P0'],'yawDeg':180.0},'seated':{'frame':'basket','at':BASKET['seat'],'yawDeg':180.0}},
 'path':pts3,'stool':STOOL,'timeline':t3,'totalS':T3,'door':DOOR,'doors':{'board':DOOR,'exit':DOOR_B},'basket':BASKET}
# ================= 4. skycity landing -> door -> step down -> walk out =================
SL_=cc['balloon']['landSkyLocal'];SY0=cc['balloon']['landYawSkyDeg'];SY=round(SY0+180,3)  # door B now faces where door A faced
DECKTOP=-0.02;SB=[SL_[0],DECKTOP+0.03,SL_[2]]
P0s=xf(SB,SY,BASKET['P0']);fw=rotY(SY,[0,0,-1])
sd=[P0s[0]+fw[0]*cc['stepdown']['forwardEnd'],DECKTOP,P0s[2]+fw[2]*cc['stepdown']['forwardEnd']]
edgeB=xf(SB,SY,[-0.03,DECKTOP-SB[1],-2.3]);edgeB[1]=DECKTOP
off4=[sd,edgeB,[5.25,-0.084,40.6],[5.4,-0.087,37.0]]
S0S1=[e for e in cc['nodes']['skycity']['edges'] if e['a']=='S0'][0]['path']
pts4=[{'id':'basket_seat','frame':'basket','parent':'transport_balloon','at':BASKET['seat'],'surface':'basket','regionAt':r(xf(SB,SY,BASKET['seat']))},{'id':'basket_P0','frame':'basket','parent':'transport_balloon','at':BASKET['P0'],'surface':'basket','regionAt':r(P0s)},{'id':'basket_threshold_B','frame':'basket','parent':'transport_balloon','at':BASKET['thresholdB'],'surface':'basket','regionAt':r(xf(SB,SY,BASKET['thresholdB']))},
 {'id':'stepdown_end','frame':'skycity','at':r(sd),'surface':'deck'},{'id':'deck_front','frame':'skycity','at':r(edgeB),'surface':'deck'},{'id':'S0_new','frame':'skycity','at':[5.25,-0.084,40.6],'surface':'walkable:skycity'},
 {'id':'S0S1_join','frame':'skycity','at':[5.4,-0.087,37.0],'surface':'walkable:skycity'}]
L4=plen(off4[1:]);L4b=math.dist(sd[::2],edgeB[::2])
def basket_out(walkL):
    return [('B4 touchdown hold (seated)',1.5,'sit_hold',''),('stand',CLIP['stand_up'],'stand_up (seat -> P0 0.494 m toward door B, stopEngineStates each tick)','LAKESIDE_STANDUP; P0 = exitStartLocalB (-0.03,0,-0.395)'),
     ('idle before door B (already facing it: seated yaw 180)',K['exitIdleS'],'idle_breathing_loop','exitIdleS'),('door_reach door B (contact 0.333 s, leaf +100° outward in 0.8 s); hard cut at 1.8 s',K['walkStartAfterReachS'],'door_reach','basket_door_b'),
     ('step down through door B (1.157 m fwd along basket -z, -0.03..-0.036 m)',CLIP['walk_start_stepdown'],'walk_start_stepdown -> walk_loop @0.453 s','LAKESIDE_STEPDOWN'),
     ('walk out to the level path',round(walkL/EXIT+CLIP['walk_stop_bodyL']*0.6,2),'walk_loop 0.8 m/s -> walk_stop_bodyL',f'{walkL:.2f} m')]
t4,T4=tl(basket_out(L4b+L4))
segs['4_skycity_balloon_out']={'title':'天空之城停稳 → 开篮门 → 走下来(→S1)','frames':['basket','skycity'],
 'balloon':{'frame':'skycity','root':r(SB),'yawDeg':SY,'flightEndSkyLocal':SL_,'deltaY':round(SB[1]-SL_[1],3),'landYawOldDeg':SY0,'note':'落点 = 现 S0 / flight 末键；篮 yaw 改为旧值+180（门 B 朝原门 A 的方向 = S1 方向，出口点世界坐标不变）；落点 y 抬 +0.11 m 站到停靠台上（运镜bot 改末键 y 或 GGbot 加偏移）'},
 'deck':{'node':'sky_mooring_deck','planks':'sky_mooring_deck_planks','posts':['sky_mooring_post_l','sky_mooring_post_r'],'rope':'sky_mooring_rope','frame':'skycity','center':r(xf(SB,SY,[0,0,-0.5])),'yawDeg':SY,'sizeBasketLocal':{'x':[-1.3,1.3],'z':[-2.3,1.3]},'frontEdgeZ':-2.3,'topY':DECKTOP,'edgeBevelM':0.05,'parent':'region_skycity scene root, procedural (skycity palette material)','postsBasketLocal':[[1.15,0,0.9],[-1.15,0,0.9]],'note':'same deck in the world as before; basket-local numbers mirrored because the basket yaw turned 180'},
 'stances':{'seated':{'frame':'basket','at':BASKET['seat'],'yawDeg':180.0},'P0':{'frame':'skycity','at':r(P0s),'yawDeg':round(SY+180-360 if SY+180>180 else SY+180,3)},'S0_new':{'frame':'skycity','at':[5.25,-0.084,40.6],'yawDeg':yaw([5.25,0,40.6],[5.4,0,37.0])}},
 'path':pts4,'timeline':t4,'totalS':T4,'door':DOOR_B,'doors':{'board':DOOR,'exit':DOOR_B},'basket':BASKET,'joinsEdge':'S0->S1 at (5.4,-0.087,37.0)'}
# ================= 5a. skycity finale (S6) -> balloon at the island edge -> in -> sit =================
S6=[n for n in cc['nodes']['skycity']['nodes'] if n['key']=='S6'][0]['at']
G5=0.03;LBXZ=[-14.8,-38.8]  # option C alternate (产品总监 2026-10-25 10:37): park/lift gap 1.49 m
# no turn inside the basket: she walks in facing the seat direction (basket -z), sits backwards 0.494 m (sit_down root travel);
# seated facing the back wall (basket yaw 180 local). Door_reach from a stand outside the outward door sweep, on the line
# outside -> threshold -> Q, so after the door she walks one straight line in (no turn at the door).
BK5={'outside':BASKET['outside'],'threshold':BASKET['threshold'],'Q':BASKET['P0'],'seat':BASKET['seat'],'seatYawDeg':180.0}  # = shared two-door set (Q = P0)
BK5['outsideYawDeg']=yaw(BK5['outside'],BK5['threshold'])
VIA5=[-11.6,0.03,-35.3]  # passes north-west of a 0.5 m grass-card tuft at (-11.26..-10.7, -36.3..-35.73); 24° bend mid-walk
LBY=0.0
for _ in range(20):  # basket yaw so the S6 approach arrives on the outside->threshold heading (turn spread over the straight approach = 0)
    _o=xf([LBXZ[0],0,LBXZ[1]],LBY,BK5['outside']);LBY=round((yaw(VIA5,_o)-BK5['outsideYawDeg']+180)%360-180,3)
LB=[LBXZ[0],0.09,LBXZ[1]]
o5=xf(LB,LBY,BK5['outside']);o5[1]=G5
W5=[[S6[0]+(VIA5[0]-S6[0])*k/4,G5,S6[2]+(VIA5[2]-S6[2])*k/4] for k in range(1,4)]+[VIA5]
in5=[('basket_threshold',xf(LB,LBY,BK5['threshold'])),('basket_Q',xf(LB,LBY,BK5['Q']))]
p5=[S6]+W5+[o5]+[p for _,p in in5]
pts5=[{'id':'S6','frame':'skycity','at':S6,'surface':'walkable:skycity'}]+[{'id':f's6_walk_{i+1:02d}','frame':'skycity','at':r(q),'surface':'walkable:skycity'} for i,q in enumerate(W5)]
pts5+=[{'id':'basket_outside','frame':'skycity','at':r(o5),'surface':'walkable:skycity','basketLocal':BK5['outside']}]
pts5+=[{'id':n,'frame':'skycity','at':r(q),'surface':'basket','basketLocal':BK5[n.split('_')[1]]} for n,q in in5]
pts5+=[{'id':'basket_seat','frame':'basket','parent':'transport_balloon','at':BK5['seat'],'surface':'basket','regionAt':r(xf(LB,LBY,BK5['seat']))}]
L5w=plen(p5[:6]);L5i=plen(p5[5:])
STOOL5={'node':'balloon_step_stool','frame':'skycity','basketLocal':{'x':[-0.25,0.25],'z':[0.9,1.2]},'topY':0.06,'parent':'region_skycity scene root (stays after lift-off), same procedural stool as seg3','why':'6 cm floor step (ground 0.03 -> basket floor 0.09)'}
t5,T5=tl([('S6 -> basket_outside (one straight line, already on the door heading)',walkS(L5w),'walk_start/walk_loop/walk_stop_bodyL',f'{L5w:.2f} m @1.2 m/s (NodeWalker.WALK_SPEED_MPS)'),
 ('door_reach at basket_outside (contact 0.333 s, leaf +100° outward in 0.8 s; walk may start at 1.8 s)',K['walkStartAfterReachS'],'door_reach','door: '+DOOR['pivotNode']),
 ('walk in: outside -> threshold -> Q, straight, facing the seat direction (no turn in the basket)',round(L5i/EXIT+0.9,2),'walk_start -> walk_loop 0.8 m/s -> walk_stop_bodyL',f'{L5i:.2f} m'),
 ('sit backwards (root Q -> seat 0.494 m toward the door), door closes 0.8 s meanwhile; ignition overlaps this beat',CLIP['sit_down'],'sit_down -> sit_hold','seated = basket (-0.032,0,0.099) yaw 180 (facing door B / lake heading)')])
lakeYawAtMoor=round((LBY+cc['lake']['skyYawDeg']-cc['lake']['yawDeg'])%360,2)
segs['5a_skycity_balloon_in']={'title':'天空之城最后一关(S6) → 走到球篮(C, 11 m 外) → 开篮门 → 进篮坐下','frames':['skycity','basket'],
 'balloon':{'frame':'skycity','root':LB,'yawDeg':LBY,'candidate':'C','rejected':{'C_nearest':{'root':[-14.8,0.08,-37.8],'parkGapM':0.606,'why':'gap margin only 0.1 m on a 1 m grid'},'C1':{'root':[0.7,0.027,-29.8],'parkGapM':-0.36,'hit':'env_sky_static_palette 144-tri root arch (S6 west, 15 m x ~5 m, y 2.8-10.2, palette cell root/moss)'},'C2':{'root':[2.7,0.03,-38.3],'parkGapM':-0.02}},'liftDirDeg':150,'parkGapM':1.485,'liftGapM':1.485,'oldLaunchSky':cc['lake']['launchSky'],'oldLaunchLake':K['launchLocal'],'lakeYawAtMoorDeg':lakeYawAtMoor,'lakeYawAtTouchdownDeg':round(cc['lake']['moored']['doorYawDeg']-cc['lake']['yawDeg'],2),
  'why':'选 C（巨根是主体，不动模型）；产品总监定备选点 (-14.8,-38.8)：停放间隙 1.49 m。篮 yaw 让 S6 来路、门外站位、门槛、篮内 Q 点在一条直线上，篮内不转身，倒坐进座位（面朝篮后壁）。',
  'liftoff':'运镜bot 设计关键帧，tools/transition-spaces/check-lift-clearance.cjs 校验',
  'parkedClearance':{'minGapM':1.485,'status':'OK','hit':'env_sky_static_palette (S6-west root arch, far end)','hitPointSky':[-12.832,8.436,-35.144]}},
 'liftSuggested':(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lift5-suggested.json'))) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)),'lift5-suggested.json')) else None),
 'mooring':{'posts':['sky_mooring_post_l','sky_mooring_post_r'],'postsBasketLocal':[[-1.15,0,-0.9],[1.15,0,-0.9]],'rope':'sky_mooring_rope','stool':STOOL5,'reuse':'seg3/seg4 procedural code (no deck: basket stands on the floor)','parent':'region_skycity scene root (posts/rope/stool stay after lift-off; rope detaches at ignition)'},
 'stances':{'basket_outside':{'frame':'skycity','at':r(o5),'yawDeg':round(BK5['outsideYawDeg']+LBY,2)},'Q':{'frame':'basket','at':BK5['Q'],'yawDeg':180.0},'seated':{'frame':'basket','at':BK5['seat'],'yawDeg':180.0}},
 'path':pts5,'timeline':t5,'totalS':T5,'door':DOOR,'doors':{'board':DOOR,'exit':DOOR_B},'basket':BK5}
# ================= 5b. lake touchdown -> door -> walk out (existing b15/b18 code, unchanged) =================
mo=cc['lake']['moored'];lyaw0=round(mo['doorYawDeg']-cc['lake']['yawDeg'],3);lyaw=round(lyaw0+180-360 if lyaw0+180>180 else lyaw0+180,3)  # door B faces the old door-A heading
pts6=[{'id':'basket_seat','frame':'basket','parent':'transport_balloon','at':BASKET['seat'],'surface':'basket','regionAt':r(xf(mo['mooringLake'],lyaw,BASKET['seat']))},{'id':'basket_P0','frame':'lake','at':mo['startLake'],'surface':'basket','basketLocal':BASKET['P0'],'check':r(xf(mo['mooringLake'],lyaw,BASKET['P0']))},{'id':'basket_threshold_B','frame':'lake','at':r(xf(mo['mooringLake'],lyaw,BASKET['thresholdB'])),'surface':'basket','basketLocal':BASKET['thresholdB']},{'id':'basket_door_out_B','frame':'lake','at':r(xf(mo['mooringLake'],lyaw,BASKET['doorOutB'])),'surface':'step','basketLocal':BASKET['doorOutB']}]+[{'id':f'v4_{i:02d}','frame':'lake','at':p,'surface':'walkable:lakeside'} for i,p in enumerate(mo['walkLake'][1:]) if i%5==0 or i==len(mo['walkLake'])-2]
_bo=basket_out(mo['length']-cc['stepdown']['forwardEnd'])[:-1];t6,T6=tl(_bo+[('walk out (path v4 to L1)',round(mo['walkS']-cc['stepdown']['forwardEnd']/EXIT,2),'walk_loop 0.8 m/s -> walk_stop_bodyL','moored.walkS from code')])
segs['5b_lake_balloon_out']={'title':'湖边停稳 → 站起 → 开门 B → 走下来（复用 RegionJourneyAdapter.ts:287-383 的路径；篮 yaw +180、门 B）','frames':['basket','lake'],
 'balloon':{'frame':'lake','root':mo['mooringLake'],'yawDeg':lyaw,'yawOldDeg':lyaw0,'source':'lakesideBalloonMooring (d9423886); yaw +180 so door B sits where door A was'},
 'stances':{'seated':{'frame':'basket','at':BASKET['seat'],'yawDeg':180.0},'P0':{'frame':'lake','at':mo['startLake'],'yawDeg':lyaw0},'end':{'frame':'lake','at':mo['walkLake'][-1],'yawDeg':yaw(mo['walkLake'][-2],mo['walkLake'][-1])}},
 'path':pts6,'timeline':t6,'totalS':T6,'door':DOOR_B,'doors':{'board':DOOR,'exit':DOOR_B},'basket':BASKET}
WC={
 '1_island_board':[{'kind':'add-floor','region':'island','what':'island_dock_deck x -2.5..-1.1, z 8.8..14.4, y -0.18 + island_dock_ramp x -1.9..-1.1, z 7.8..8.8, y 0.0→-0.18','how':'bake-region-walkable: island floor regex += island_dock (needs the dock in the bake source; or a scripted add-box pass, ≈ 0.3 KB)'},
  {'kind':'move-node','region':'island','node':'I6','from':[-1.9,-0.597,10.1],'to':I6new,'faceDeg':0,'why':'old I6 is under the new deck (deck covers x -2.5..-1.1, z 8.8..14.4)'},
  {'kind':'reroute-edge','region':'island','edge':'I4-I6','tail':[[0.5,0.002,7.3],[-0.5,0.0,7.7],[-1.5,0.0,7.9],[-1.5,-0.18,8.8],I6new]},
  {'kind':'reroute-edge','region':'island','edge':'I5-I6','tail':[[-1.7,0.021,6.9],[-1.5,0.0,7.9],[-1.5,-0.18,8.8],I6new]},
  {'kind':'hide','what':'transport_sail/transit_sea_props transit_pier (SailArt.ts:318-319) when island_dock exists — same footprint, island_dock is the resident one'}],
 '2_meadow_landing':[{'kind':'none','why':'jetty stays a scripted path (not in the meadow bake), unchanged; optional: add jetty top (x 0.2..1.8, z 23..31.2, y 0.75) for explore taps'}],
 '3_meadow_balloon_in':[{'kind':'add-obstacle','region':'meadow','what':'parked basket footprint circle r 1.1 at (3.6,-23.4) + door sweep','when':'from the M4 level start (preload) until lift-off'},
  {'kind':'reroute-edge','region':'meadow','edge':'M4-M6','path':[[3.0,5.84,-16.4],[3.0,6.322,-20.4],[2.6,6.341,-20.8],[1.8,6.45,-23.0],[0.2,6.505,-25.6]]},
  {'kind':'reroute-edge','region':'meadow','edge':'M5-M6','path':[[6.6,6.472,-21.2],[4.6,6.44,-20.8],[2.6,6.29,-20.4],[2.6,6.341,-20.8],[1.8,6.45,-23.0],[0.2,6.505,-25.6]],'why':'old (6.6,-22.8)→(5.4,-24)→(1.8,-24) runs through the parked basket; the yard east of it is fenced, so M5 goes round through the gate (RegionWalkable.walkPath agrees)'}],
 '4_skycity_balloon_out':[{'kind':'add-floor','region':'skycity','what':'sky_mooring_deck top -0.02 (basket-local x -1.3..1.3, z -1.3..2.3 around the landing)'},
  {'kind':'add-obstacle','region':'skycity','what':'moored basket circle r 1.1 at (5.4,43.8) while the balloon stays tied'},
  {'kind':'move-node','region':'skycity','node':'S0','from':[5.4,-0.111,43.8],'to':[5.25,-0.084,40.6],'why':'old S0 is inside the basket'},
  {'kind':'regen','what':'gen-skycity-lens-occluders (deck < 1.8 m: no proxy; basket/envelope are not in the proxy) → 运镜bot 重跑 p0drag13 W2'}],
 '5a_skycity_balloon_in':[{'kind':'obstacle','region':'skycity','what':'moored basket at (-14.8,-37.8) r 1.1 + posts, from the S6 level start until lift-off','why':'basket stands on the S6 terrace floor; explore taps must not walk through it'}],
 '5b_lake_balloon_out':[{'kind':'none','why':'existing b18 path v4'}]}
for k,v in WC.items():segs[k]['walkableChanges']=v
budget={'meadowToSky':{'capS':43.5,'flightS':30.0,'basketInS':round(sum(b['s'] for b in t3[1:]),2),'inflateS':3.0,'touchdownS':1.5,'basketOutToStepdownS':round(sum(b['s'] for b in t4[1:5]),2),'walkOutS':t4[5]['s'],'approachWalkS':t3[0]['s']}}
B=budget['meadowToSky'];B['sumNoApproach']=round(B['flightS']+B['basketInS']+B['inflateS']+B['touchdownS']+B['basketOutToStepdownS']+B['walkOutS'],2)
B['sumInflateOverlapped_walkOutUnderBoardBlend']=round(B['flightS']+B['basketInS']+B['touchdownS']+B['basketOutToStepdownS'],2)
# b19 door2 budgets (no in-basket turn anywhere). Caps: 产品总监 skycity→lake 50 s (lift-off inside the 8 s visible flight);
# GGbot TransitionStaging.ts TRANSITION_RETIME.caps (ca37373a) meadowToSkycity 50, skycityToLakeside 40 (stale vs the product 50).
_b3=sum(b['s'] for b in t3);_b4=sum(b['s'] for b in t4);_b5a=sum(b['s'] for b in t5);_b5b=sum(b['s'] for b in t6)
budget['meadowToSky_ggbotTimeline']={'capS':50.0,'capSource':'GGbot TransitionStaging.ts TRANSITION_RETIME.caps.meadowToSkycity (ca37373a)','seg3S':round(_b3,2),'inflateRemainderS':round(max(0,3.0-_b3),2),'rideS':24.0,
 'seg4S_ggbot':round(_b4-1.5-0.5+1.0,2),'note':'GGbot timeline: settle inside the ride, pause 0, stepDown+1.0; seg4 here = stand 1.27 + door 1.8 + stepDown 1.73+1.0 + walk 7.48','totalS':round(_b3+max(0,3.0-_b3)+24.0+_b4-1.5-0.5+1.0,2),'savedByNoTurnS':1.5}
budget['skyToLake']={'capS':50.0,'capSource':'产品总监 2026-10-25 (lift-off counted inside the visible flight)','seg5aS':round(_b5a,2),'inflate':'overlapped with the S6 walk (GGbot dc81f5e6: last 3 s of the walk)','visibleFlightInclLiftS':8.0,'seg5bS':round(_b5b,2),
 'totalS':round(_b5a+8.0+_b5b,2),'totalS_ggbotStyle_liftOnTop':round(_b5a+5.0+8.0+_b5b-0.5,2),'savedByNoTurnS':1.5,'walkMps':1.2,'walkMpsSource':'NodeWalker.ts WALK_SPEED_MPS'}
doc={'schema':'qf.transition-stances/1','branch':'scene/b19-basket-door2','base':'ggbot/cand-b18-stage d9423886','generator':'tools/transition-spaces/gen-stances.py',
 'frames':{'island':'island-local = sail-journey world (island root at origin)','meadow':'env_meadow local (transit_landing identity child)','skycity':'env_skycity local (CW_JSON root in world)','lake':'lakeside local (lakesideJourney root, yaw 180 from world)','boat':'transport_sailboat root; +z bow, -x starboard, +x port; waterline y 0','basket':'transport_balloon root; floor board top y 0; door A wall +z (basket_door), door B wall -z (basket_door_b); stand_point = (0,0.1,0)'},
 'yaw':'deg, atan2(dx,dz) in the stated frame','clips':CLIP,'segments':segs,'budget':budget,
 'package':{'remainingB':24641536-23913002,'dockAndGangway':'procedural at runtime (utils.createMesh) ≈ 500 tris, ≈ 5–7 KB code, 0 glb/texture; as glb it would be ≈ 35 KB (70 B/tri)','skyDeck':'procedural ≈ 200 tris, ≈ 2–3 KB code','walkableData':'≈ +0.5 KB'}}
out=os.path.join(HERE,'stances.json');json.dump(doc,open(out,'w'),ensure_ascii=False,indent=1);print(out)
