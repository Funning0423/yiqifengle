"""Independent actual-art kinematic branch. Does not claim cloth/contact acceptance."""
import bpy,json,gzip,math,hashlib,numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
BASE=Path('/workspace/shared/grok-takeover/character');OUT=BASE/'actual_motion_branch'/'REALSCENE-FULLCHAIN-R24';OUT.mkdir(exist_ok=True)
ASSET=Path('/workspace/shared/grok-takeover/assets/candidate-firstslice-v0.1/combined_editable_m.blend')
D=json.load(gzip.open(BASE/'base/runtime-editable-source.json.gz'));MP=json.loads((BASE/'split_mapping.json').read_text());names=D['boneNames'];P={n:np.array(v['head']) for n,v in D['restBones'].items()};T={n:np.array(v['tail']) for n,v in D['restBones'].items()}
C=np.array([[1,0,0],[0,0,-1],[0,1,0]]);CM=Matrix(C.tolist()).to_4x4();K=1.0611643605259733;FPS=30;END=33.;I=np.eye(3)
scene=bpy.context.scene;rig=bpy.data.objects['B_RIG_22_original_bones']
with bpy.data.libraries.load(str(ASSET),link=False) as (src,dst):dst.objects=list(src.objects)
world=bpy.data.collections.new('ACTUAL_COMBINED_ART_UNCHANGED');scene.collection.children.link(world)
for o in dst.objects:
 if o:world.objects.link(o)
for o in world.objects:
 if o.name.startswith('col_') or o.get('preview_only',False):o.hide_render=True
bpy.context.view_layer.update()
original_environment={o.name:{'matrix_world':[list(q) for q in o.matrix_world],'parent':o.parent.name if o.parent else None,'vertices':len(o.data.vertices) if o.type=='MESH' else None} for o in world.objects}
leaf=bpy.data.objects['env_lighthouse_door'];handle=bpy.data.objects['door_handle'];leaf.animation_data_clear();hinge=np.array([.7202203273773193,0,0]);handle0=np.array([-.4300000071525574,1.1287000179290771,-.042399998754262924])
def ry(a):c,s=math.cos(a),math.sin(a);return np.array([[c,0,s],[0,1,0],[-s,0,c]])
def rx(a):c,s=math.cos(a),math.sin(a);return np.array([[1,0,0],[0,c,-s],[0,s,c]])
def smooth(u):u=float(np.clip(u,0,1));return u*u*(3-2*u)
def mix(a,b,u):return np.asarray(a)*(1-u)+np.asarray(b)*u
def ramp(u,r=.12):
 u=float(np.clip(u,0,1))
 if u<r:return .5*u*u/(r*(1-r))
 if u>1-r:return 1-.5*(1-u)**2/(r*(1-r))
 return (u-r/2)/(1-r)
def facing(v):return math.atan2(v[0],v[2])
def unroll(a,ref):return ref+(a-ref+math.pi)%(2*math.pi)-math.pi
CHAIR=np.array([.4203000068664551,0,-4.2133002281188965]);YAW=-2.;YR0=ry(YAW);ROOT_SEAT=CHAIR+YR0@np.array([0,0,-.06*K+.05]);STAGE=CHAIR+YR0@np.array([0,0,.48]);STOP=np.array([-.212,0,-.45]);OUTSIDE=np.array([-.212,0,1.65]);WALK_YAW=facing(STOP-STAGE)
OPEN=math.radians(86.4)
def door_angle(t):return OPEN*smooth((t-10)/1.5)*(1-smooth((t-18.5)/3))
def hworld(t):return hinge+ry(door_angle(t))@(handle0-hinge)
def close_root(t):
 a=door_angle(t);v=hworld(t)+ry(a)@np.array([.22,0,-.40]);v[1]=0;return v
CLOSE_START=close_root(18.5);CLOSE_END=close_root(21.5);RETURN_YAW=facing(CLOSE_START-OUTSIDE);HOME_YAW=unroll(facing(STAGE-CLOSE_END),0)
YAW_END=unroll(YAW,HOME_YAW)
coherent=BASE/'actual_motion_branch'/'REALSCENE-COHERENT-LOWER-R1';reference=np.load(coherent/'pose_matrices.npz');reference_times=reference['times'];reference_rows=json.loads((coherent/'pose_metrics.json').read_text())
def path(t):
 if t<=4.5:
  return np.array([np.interp(t,reference_times,reference['root_game_m'][:,j]) for j in range(3)]),float(np.interp(t,reference_times,reference['root_yaw']))
 if t<=9:return mix(STAGE,STOP,ramp((t-4.5)/4.5)),WALK_YAW
 if t<=11.5:return STOP.copy(),WALK_YAW*(1-smooth((t-9)/.5))
 if t<=14:return mix(STOP,OUTSIDE,ramp((t-11.5)/2.5)),0.
 if t<=14.3:return OUTSIDE.copy(),0.
 if t<=16:return OUTSIDE.copy(),RETURN_YAW*smooth((t-14.3)/1.7)
 if t<=17.5:return mix(OUTSIDE,CLOSE_START,ramp((t-16)/1.5)),RETURN_YAW
 if t<=18.5:return CLOSE_START.copy(),RETURN_YAW+(OPEN-RETURN_YAW)*smooth((t-17.5)/1.)
 if t<=21.5:return close_root(t),door_angle(t)
 if t<=23.2:return CLOSE_END.copy(),HOME_YAW*smooth((t-21.5)/1.7)
 if t<=27.7:return mix(CLOSE_END,STAGE,ramp((t-23.2)/4.5)),HOME_YAW
 if t<=29.2:return STAGE.copy(),HOME_YAW+(YAW_END-HOME_YAW)*smooth((t-27.7)/1.5)
 tt=max(0.,32.2-t);return np.array([np.interp(tt,reference_times,reference['root_game_m'][:,j]) for j in range(3)]),YAW_END

source=np.array(D['positions']);sem=[o.get('semanticPart','') for o in D['origins']];ids_for=lambda labels:sorted({v for fi,label in enumerate(sem) if label in labels for v in D['faces'][fi]});SHOE={side:source[ids_for(['shoe'+side])]-P['foot.'+side] for side in ['L','R']};ANKLE=.07665681182112909*K+.0005
import sys
sys.path.insert(0,str(BASE/'actual_motion_branch'/'full_chain_preparation'));from actual_scene_support import ActualFloor
from sole_support_fit import fit_sole
SOLE={s:SHOE[s][(SHOE[s]+P['foot.'+s])[:,1]<((SHOE[s]+P['foot.'+s])[:,1].min()+.0015)] for s in ['L','R']}
floor=ActualFloor();lastpivot=json.loads((BASE/'actual_motion_branch'/'REALSCENE-PIVOT-GATE-R5'/'pose_metrics.json').read_text())[-1];INITIAL_FEET={side:np.array(lastpivot['feet'][side]['world_m']) for side in ['L','R']};curpos={side:p.copy() for side,p in INITIAL_FEET.items()};curyaw={side:lastpivot['feet'][side]['yaw'] for side in curpos};currot={s:ry(curyaw[s]) for s in curpos}
blocks=[{'tag':'walk_to_door','a':4.5,'b':9.,'n':11,'kind':'walk'},{'tag':'exit','a':11.5,'b':14.,'n':8,'kind':'walk'},{'tag':'turn_return','a':14.3,'b':16.,'n':3,'kind':'turn'},{'tag':'return_approach','a':16.,'b':17.5,'n':4,'kind':'walk'},{'tag':'turn_to_handle','a':17.5,'b':18.5,'n':2,'kind':'turn'},{'tag':'close_follow','a':18.5,'b':21.5,'n':8,'kind':'close'},{'tag':'turn_to_chair','a':21.5,'b':23.2,'n':3,'kind':'turn'},{'tag':'walk_to_chair','a':23.2,'b':27.7,'n':11,'kind':'walk'},{'tag':'turn_to_sit','a':27.7,'b':29.2,'n':3,'kind':'turn'}]
windows=[];nextside='L'
for block in blocks:
 a,b,n=block['a'],block['b'],block['n'];duration=b-a
 if block['kind']=='turn':
  nextside='L' if path(b)[1]-path(a)[1]>=0 else 'R';intervals=[(a+duration*(.10+.30*j),a+duration*(.30+.30*j)) for j in range(n)] if n==3 else [(a+duration*(.12+.45*j),a+duration*(.43+.45*j)) for j in range(n)]
 else:
  dt=(duration-.16)/(n-.12);intervals=[(a+.08+j*dt,a+.08+(j+.84)*dt) for j in range(n)]
 
 if block['tag']=='close_follow':intervals=intervals[:4]+[(20.021624365482232,20.46),(20.50,20.80),(20.84,21.10),(21.14,21.42)]
 block['windows']=[]
 for j,(start,end) in enumerate(intervals):
  q={'start':start,'end':end,'side':nextside,'tag':block['tag'],'kind':block['kind'],'block_a':a,'block_b':b,'index':j};windows.append(q);block['windows'].append(q);nextside='R' if nextside=='L' else 'L'
leafverts=np.array([C.T@v.co for v in leaf.data.vertices]);leaf_minz=float(leafverts[:,2].min());leaf_minx=float(leafverts[:,0].min());leaf_maxx=float(leafverts[:,0].max())
def shoe_project(side,pos,yaw,t,margin=.009):
 rr=ry(door_angle(t));local=((SHOE[side]*K)@ry(yaw).T+pos-hinge)@rr
 if local[:,0].max()>=leaf_minx-.02 and local[:,0].min()<=leaf_maxx+.02:
  depth=float(local[:,2].max()-leaf_minz+margin)
  if depth>0:pos=pos-rr[:,2]*depth
 return pos
steps={side:[] for side in curpos};floor_plants=[];heel_pivots=[]
shoeR_ids=ids_for(['shoeR']);low=[vi for vi in shoeR_ids if source[vi,1]<min(source[v,1] for v in shoeR_ids)+.0006 and any(names[bi]=='foot.R' and weight>.999 for bi,weight in D['skin'][vi])];heel_id=min(low,key=lambda vi:source[vi,2]);heel_rel=source[heel_id]-P['foot.R']
for block in blocks:
 block['initial_positions']={side:p.copy() for side,p in curpos.items()};block['initial_yaws']=curyaw.copy();qs=block['windows'];a,b=block['a'],block['b'];root0,yaw0=path(a);root1,yaw1=path(b)
 if block['tag']=='turn_to_chair':
  lift=next(q['start'] for q in qs if q['side']=='R');anchor=curpos['R']+ry(curyaw['R'])@(K*heel_rel);heel_pivots.append({'side':'R','start':a,'end':lift,'world_heel_game_m':anchor.copy(),'yaw_initial':curyaw['R'],'body_yaw_initial':yaw0,'yaw_end':curyaw['R']+.90*(path(lift)[1]-yaw0),'source_heel_vertex_id':heel_id,'forefoot_pitch_peak_degrees':1.2})
 for j,q in enumerate(qs):
  side=q['side'];sign=-1 if side=='L' else 1;en=q['end'];
  if block['tag']=='turn_to_chair' and side=='R' and j==1:
   ev=heel_pivots[-1];curpos[side]=ev['world_heel_game_m']-ry(ev['yaw_end'])@(K*heel_rel);curyaw[side]=ev['yaw_end']
  last=not any(z['side']==side for z in qs[j+1:]);nextlift=next((z['start'] for z in windows if z['start']>en and z['side']==side),33.)
  if block['kind']=='turn':
   width=.095 if last else .10+.040*max(0,min(1,(abs(yaw1-yaw0)-math.radians(112))/math.radians(68)));refyaw=yaw1 if last else path(min(b,en+.167*(b-a)))[1];end=root1+ry(refyaw)@np.array([sign*width,ANKLE,.015 if not last else 0]);fy=(path(en)[1] if j==0 else refyaw)+sign*.070
   if block['tag']=='turn_to_sit' and last:end=CHAIR+YR0@np.array([sign*.065*K,ANKLE,.40]);fy=YAW_END
  else:
   nxt=next((z['start'] for z in qs[j+1:] if z['side']==side),b);look=.5*(path(en)[0]+path(nxt)[0]);fy=path(min(b,.5*(en+nxt)))[1]+sign*.070;end=look+ry(fy-sign*.070)@np.array([sign*.095,ANKLE,0])
  
  if (block['tag']=='exit' and j==0) or (block['tag']=='close_follow' and j==4):
   front=float(((SHOE[side]*K)@ry(fy).T)[:,2].max());end[2]=min(end[2],-.040-front-.004)
  if block['tag']=='exit' and j==2:end[2]=min(end[2],.630-float(((SHOE[side]*K)@ry(fy).T)[:,2].max())-.006)
  if block['tag']=='exit' and j==3:end[2]=max(end[2],.710-float(((SHOE[side]*K)@ry(fy).T)[:,2].min())+.006)
  if block['tag']=='turn_to_handle' and j==0:
   end=root1+ry(path(en)[1])@np.array([sign*.12,ANKLE,0]);end[2]=max(end[2],.710-float(((SHOE[side]*K)@ry(fy).T)[:,2].min())+.008)
  if block['tag']=='close_follow' and j==0:
   fy=math.radians(100);end[0]=max(end[0],.205-float(((SHOE[side]*K)@ry(fy).T)[:,0].min())+.006);end[2]=.675
  before=end.copy()
  if block['tag'] in ('turn_to_handle','close_follow'):
   for iteration in range(8):
    for tt in np.linspace(max(18.5,en),min(21.5,nextlift),21):end=shoe_project(side,end,fy,tt)
  end,newrot,support_fit=fit_sole(floor,end,fy,SOLE[side],K,P['foot.'+side][1]);ground=float(end[1]-ANKLE);ids=support_fit['support_triangle_indices'];q.update(rotation_a=currot[side].copy(),rotation_b=newrot.copy(),support_fit=support_fit,a=curpos[side].copy(),b=end.copy(),yaw_a=curyaw[side],yaw_b=fy,ground_a=curpos[side][1]-ANKLE,ground_b=ground,next_lift=nextlift);steps[side].append(q);curpos[side]=end.copy();curyaw[side]=fy;currot[side]=newrot;floor_plants.append({'tag':block['tag'],'side':side,'time':en,'ground_height_m':ground,'support_triangles':ids,'door_halfspace_shift_m':float(np.linalg.norm(end-before)),'support_fit':support_fit})
 block['final_positions']={side:p.copy() for side,p in curpos.items()};block['final_yaws']=curyaw.copy()

def foot_target(side,t):
 pos=INITIAL_FEET[side].copy();fy=lastpivot['feet'][side]['yaw'];contact=True;active=None;ground=pos[1]-ANKLE
 for q in steps[side]:
  st,en=q['start'],q['end']
  if t<st:break
  if t>=en:pos=q['b'].copy();fy=q['yaw_b'];ground=q['ground_b'];continue
  u=(t-st)/(en-st);r=smooth(u)
  if q['tag']=='exit' and q['index'] in [2,4]:r=smooth((u-.15)/.85)
  if (q['tag']=='close_follow' and q['index']==4) or (q['tag']=='exit' and q['index']==3):r=smooth(u/.82)
  ground=float(mix(q['ground_a'],q['ground_b'],r));fy=float(mix(q['yaw_a'],q['yaw_b'],r));sign=-1 if side=='L' else 1
  if q['kind']=='turn':
   ro,yo=path(st);rt,yt=path(en);root,yaw=path(t);la=ry(yo).T@(q['a']-ro);lb=ry(yt).T@(q['b']-rt);local=mix(la,lb,r);local[0]+=sign*.035*math.sin(math.pi*u)**2;pos=root+ry(yaw)@local
  else:
   pos=mix(q['a'],q['b'],r);extra=sign*.008-(.050 if q['tag']=='walk_to_door' and q['index']==1 and side=='R' else 0);pos+=ry(path(t)[1])@np.array([(extra+(.060 if q['tag']=='walk_to_chair' and q['index']==9 and side=='L' else 0)+(sign*.035 if q['tag']=='close_follow' and q['index']==3 else 0))*math.sin(math.pi*u)**2,0,0])
  pos[1]=ANKLE+ground+(.045 if q['kind']=='turn' else .055)*math.sin(math.pi*u)**2;
  if q['tag']=='exit' and q['index']==3:pos[1]+=.012*math.sin(math.pi*float(np.clip((u-.5)/.5,0,1)))**2
  contact=u<1e-8;active=q;break
 for ev in heel_pivots:
  if side==ev['side'] and ev['start']<=t<=ev['end']:
   u=(t-ev['start'])/(ev['end']-ev['start']);fy=ev['yaw_initial']+.90*(path(t)[1]-ev['body_yaw_initial']);pitch=math.radians(1.2)*math.sin(math.pi*u)**2;pos=ev['world_heel_game_m']-(ry(fy)@rx(-pitch))@(K*heel_rel);contact=True;active=None;ground=0.
 return pos,fy,contact,active,ground
def foot_world_rotation(side,t,fy):
 for ev in heel_pivots:
  if side==ev['side'] and ev['start']<=t<=ev['end']:
   u=(t-ev['start'])/(ev['end']-ev['start']);return ry(fy)@rx(-math.radians(1.2)*math.sin(math.pi*u)**2)
 rotation=ry(lastpivot['feet'][side]['yaw'])
 for q in steps[side]:
  if t<q['start']:break
  if t>=q['end']:rotation=q['rotation_b'];continue
  u=smooth((t-q['start'])/(q['end']-q['start']));rotation=np.array(Matrix(q['rotation_a'].tolist()).to_quaternion().slerp(Matrix(q['rotation_b'].tolist()).to_quaternion(),u).normalized().to_matrix());break
 return rotation
# End-state comfort is solved once per clip, not by forcing maximum reach per frame.
L1=np.linalg.norm(T['thigh.L']-P['thigh.L']);L2=np.linalg.norm(T['shin.L']-P['shin.L']);E10=L1*L1+L2*L2+2*L1*L2*math.cos(math.radians(10))
def neutral(root,yaw,feet):
 local={side:ry(yaw).T@(p-root)/K for side,p in feet.items()};hip=(local['L']+local['R'])*.5;heights=[]
 for side,ankle in local.items():
  horizontal=(ankle-hip-P['thigh.'+side]+P['hips'])[[0,2]];heights.append(ankle[1]+math.sqrt(max(.001,E10-float(horizontal@horizontal))))
 hip[1]=min(heights);return hip
previous=None
for block in blocks:
 if previous is None:block['hip_start']=np.array(lastpivot['hip_local_source'])
 else:
  prevroot,prevyaw=path(previous['b']);root,yaw=path(block['a']);block['hip_start']=ry(yaw).T@(prevroot+ry(prevyaw)@(K*previous['hip_end'])-root)/K
 block['hip_end']=neutral(*path(block['b']),block['final_positions'])
 if block['tag']=='turn_to_sit':block['hip_end']=np.array([0,.9913763819697393,0])
 previous=block

def hip_pose(t):
 preceding=None
 for block in blocks:
  if t<block['a']:break
  if t>block['b']:preceding=block;continue
  a,b=block['a'],block['b'];u=(t-a)/(b-a);root,yaw=path(t);base=mix(block['hip_start'],block['hip_end'],smooth(u));left=foot_target('L',t);right=foot_target('R',t);ground=.5*(left[4]+right[4])/K
  if block['kind']=='walk':
   qs=block['windows'];dt=qs[1]['start']-qs[0]['start'] if len(qs)>1 else b-a;doublemid=.5*(qs[0]['end']+qs[1]['start']);amp=smooth((t-a)/.5)*(1-smooth((t-(b-.5))/.5));
   if block['tag'] in ['walk_to_door','walk_to_chair']:
    base[[0,2]]=block['hip_start'][[0,2]]*(1-smooth((t-a)/.5))+block['hip_end'][[0,2]]*smooth((t-(b-.5))/.5);drop=.028;power=4
   elif block['tag']=='return_approach':drop=.026;power=4
   else:drop=.033;power=8
   base[1]=float(base[1]-amp*(drop-((drop-.003)*math.sin(math.pi*(t-doublemid)/dt)**power)));base[0]+=-.018/K*math.cos(math.pi*(t-(doublemid+dt*.5))/dt)*amp
   return base
  # Support-foot pressure transfer follows fixed actual foot stance, with smooth double-support transitions.
  qs=block['windows'];start_world=root+ry(yaw)@(K*block['hip_start']);start_world[1]=0;endroot,endyaw=path(b);end_world=endroot+ry(endyaw)@(K*block['hip_end']);end_world[1]=0;keys=[(a,start_world)]
  for q in qs:
   support='R' if q['side']=='L' else 'L'
   for tt in [q['start'],q['end']]:
    fp,fy,ct,active,g=foot_target(support,tt);p=fp+ry(fy)@np.array([0,0,.040]);p[1]=0;keys.append((tt,p))
  keys.append((b,end_world));keys.sort(key=lambda q:q[0]);world=start_world
  for (ta,pa),(tb,pb) in zip(keys,keys[1:]):
   if ta<=t<=tb:world=mix(pa,pb,smooth((t-ta)/(tb-ta)));break
  reference_world=root+ry(yaw)@(K*base);reference_world[1]=0
  if block['kind']=='close':
   center=(left[0]+right[0])*.5;center[1]=0;world=mix(center,world,.20);drop=.014
  else:world=mix(reference_world,world,.80);drop=.016
  local=ry(yaw).T@(world-root)/K;base[[0,2]]=local[[0,2]];first_lift=qs[0]['start']-a;last_land=b-qs[-1]['end'];base[1]-=drop*smooth((t-a)/max(.08,first_lift))*(1-smooth((t-qs[-1]['end'])/max(.08,last_land)))+.004*math.sin(math.pi*u)**2
  if block['tag']=='close_follow':base[1]-=.010*math.sin(math.pi*float(np.clip((t-20.25)/.5,0,1)))**2
  return base
 if preceding is not None:
  rp,yp=path(preceding['b']);root,yaw=path(t);return ry(yaw).T@(rp+ry(yp)@(K*preceding['hip_end'])-root)/K
 return np.array([0,.9939,0])
# Interior ring and actual right hand hull: find a real near-facing triangle and place the extremal fingertip surface there.
components=json.loads((OUT/'door_components.json').read_text());ringcomp=[q for q in components if q['n']==64 and q['mean'][1]>0][0];ringids=set(ringcomp['ids']);ringface=[list(p.vertices) for p in leaf.data.polygons if all(i in ringids for i in p.vertices)];ringtree=BVHTree.FromPolygons([Vector(q) for q in leafverts],ringface,all_triangles=False)
raylocal=handle0-hinge+np.array([0,0,-.25]);hit,no,fi,dd=ringtree.ray_cast(Vector(raylocal),Vector((0,0,1)),.4);assert hit is not None
contact_local=np.array(hit);contact_surface0=hinge+contact_local
handids=ids_for(['handL']);handrel=source[handids]-P['hand.L'];HANDDIR=np.array([0,-.10,1.]);HANDDIR/=np.linalg.norm(HANDDIR)
def rotation_between(a,b):return np.array(Vector(a).rotation_difference(Vector(b)).normalized().to_matrix())
RH=rotation_between(T['hand.L']-P['hand.L'],HANDDIR);hh=handrel@RH.T;support_i=int(hh[:,2].argmax());support_local=hh[support_i]
def grip_pose(t,root,yaw):
 a=door_angle(t);rot=ry(a)@RH;contact=hinge+ry(a)@contact_local-ry(a)[:,2]*.001;wristworld=contact-ry(a)@(support_local*K);wrist=ry(yaw).T@(wristworld-root)/K;rotation=ry(yaw).T@rot
 return wrist,rotation,contact

def twojoint(h,e,l1,l2,pole):
 delta=e-h;dist=np.linalg.norm(delta);axis=delta/max(dist,1e-9);dc=np.clip(dist,abs(l1-l2)+1e-7,l1+l2-1e-7);q=np.array(pole)-axis*np.dot(pole,axis);q/=max(np.linalg.norm(q),1e-9);d=(l1*l1-l2*l2+dc*dc)/(2*dc);return h+axis*d+q*math.sqrt(max(0,l1*l1-d*d)),float(max(0,dist-l1-l2))

# Gated rise-only arm and head references; integration remains a new pose candidate.
ARM_REFERENCE=BASE/'arm_release_gate/EARLY_TORSO_PLANE_R9/pose_matrices.npz';AR=np.load(ARM_REFERENCE);AR_TIMES=(AR['frames']-11)/30.;AR_NAMES=list(AR['bone_names']);HEAD_REFERENCE=BASE/'actual_motion_branch/REALSCENE-HEAD-GAZE-GATE-R1/pose_matrices.npz';HR=np.load(HEAD_REFERENCE)
def sample_arm_reference(time):
 time=float(np.clip(time,0,3));good=np.where(AR['frames']>=11)[0];idx=int(np.searchsorted(AR_TIMES[good],time));i=int(good[max(0,min(len(good)-1,idx-1))]);j=int(good[min(len(good)-1,idx)])
 if abs(AR_TIMES[j]-time)<1e-8:return {n:AR['matrices'][j,AR_NAMES.index(n)].copy() for n in names}
 u=(time-AR_TIMES[i])/max(1e-9,AR_TIMES[j]-AR_TIMES[i]);result={}
 for n in names:
  a=AR['matrices'][i,AR_NAMES.index(n)];b=AR['matrices'][j,AR_NAMES.index(n)];r=np.array(Matrix(a[:3,:3].tolist()).to_quaternion().slerp(Matrix(b[:3,:3].tolist()).to_quaternion(),u).normalized().to_matrix());h=mix(a[:3,:3]@P[n]+a[:3,3],b[:3,:3]@P[n]+b[:3,3],u);m=np.eye(4);m[:3,:3]=r;m[:3,3]=h-r@P[n];result[n]=m
 return result
REF=sample_arm_reference(3.);refpoint=lambda n:REF[n][:3,:3]@P[n]+REF[n][:3,3];REF_HIP=refpoint('hips')
def walking_arm_offset(t,side):
 for block in blocks:
  if block['kind']=='walk' and block['a']<t<block['b']:
   qs=block['windows'];dt=qs[1]['start']-qs[0]['start'];start=next(q['start'] for q in qs if q['side']=='L');amp=smooth((t-block['a'])/.3)*(1-smooth((t-(block['b']-.3))/.3));phase=math.sin(math.pi*(t-start)/dt);return np.array([0,.008*amp*phase**2,(-1 if side=='L' else 1)*.045*amp*phase])
 return np.zeros(3)

def depth(n):p=D['restBones'][n]['parent'];return 0 if p is None else 1+depth(p)
ordered=sorted(names,key=depth);ctrl=bpy.data.objects.new('B_METRE_CONTROLLER_REFERENCE_candidate',None);scene.collection.objects.link(ctrl);ctrl.scale=(K,)*3
for ob in [rig]+[bpy.data.objects[n] for n in MP]:ob.parent=ctrl
rig.animation_data_clear();rows=[];poses=[];roots=[];contact_windows=[(10.,10.20),(18.5,21.5)];times=sorted({round(i/60,10) for i in range(1981)}|{round(18.5+i/120,10) for i in range(361)}|{round(11.5+i/120,10) for i in range(301)}|{round(t,10) for q in windows for t in [q['start'],q['end']]});rise_cache=reference['matrices'][:181]
SMOOTHED_HIPS=np.load(OUT/'smoothed_world_hips.npz');TURN_SPANS=[(3,4.5),(14.3,16),(17.5,18.5),(18.5,21.5),(21.5,23.2),(27.7,29.2)]
def relaxed_turn_hip(t,root,yaw,original):
 if not any(a<t<b for a,b in TURN_SPANS):return original
 world=np.array([np.interp(t,SMOOTHED_HIPS['times'],SMOOTHED_HIPS['world'][:,j]) for j in range(3)]);return ry(yaw).T@(world-root)/K
for ti,t in enumerate(times):
 root,yaw=path(t);YR=ry(yaw);M={};H={};J={};reach={};feetrow={};hip=relaxed_turn_hip(t,root,yaw,hip_pose(t));gcontact=None;grip=0.
 def bone(n,h,r):
  m=np.eye(4);m[:3,:3]=r;m[:3,3]=h-r@P[n];M[n]=m;H[n]=h;J[n]=h+r@(T[n]-P[n])
 cached=t<=4.5 or t>=29.2
 if cached:
  tt=t if t<=4.5 else max(0.,32.2-t);idx=round(tt*60);matrix=reference['matrices'][idx] if t<=4.5 else rise_cache[idx]
  for n,m in zip(names,matrix):M[n]=m;H[n]=m[:3,:3]@P[n]+m[:3,3];J[n]=m[:3,:3]@T[n]+m[:3,3]
  reach={k:0. for k in ['leg.L','leg.R','arm.L','arm.R']}
  if 3<t<4.5:
   old=H['hips'].copy();hip=relaxed_turn_hip(t,root,yaw,old);delta=hip-old
   for n in names:
    if n=='root' or n.startswith(('thigh.','shin.','foot.')):continue
    bone(n,H[n]+delta,M[n][:3,:3])
   for side in ['L','R']:
    a=H['foot.'+side].copy();fr=M['foot.'+side][:3,:3].copy();h=hip+P['thigh.'+side]-P['hips'];fy=math.atan2(fr[0,2],fr[2,2]);k,over=twojoint(h,a,L1,L2,ry(fy)@np.array([0,0,1]));reach['leg.'+side]=over;bone('thigh.'+side,h,rotation_between(T['thigh.'+side]-P['thigh.'+side],k-h));bone('shin.'+side,k,rotation_between(T['shin.'+side]-P['shin.'+side],a-k));bone('foot.'+side,a,fr)
 else:
  bone('root',P['root'],I);bone('hips',hip,I);reach_lean=math.radians(20)*smooth((t-9)/.7)*(1-smooth((t-10.35)/.4)) if t<11.5 else 0.;RB=rx(reach_lean)
  torso_origin=hip+(I-RB)@(P['spine']-P['hips'])
  for n in ['spine','chest','neck','head']:bone(n,torso_origin+RB@(P[n]-P['hips']),RB)
  for side in ['L','R']:
   fw,fy,ct,active,ground=foot_target(side,t);h=hip+P['thigh.'+side]-P['hips'];a=YR.T@(fw-root)/K;k,over=twojoint(h,a,L1,L2,ry(fy-yaw)@np.array([0,0,1]));reach['leg.'+side]=over;bone('thigh.'+side,h,rotation_between(T['thigh.'+side]-P['thigh.'+side],k-h));bone('shin.'+side,k,rotation_between(T['shin.'+side]-P['shin.'+side],a-k));bone('foot.'+side,a,YR.T@foot_world_rotation(side,t,fy))
  for side in ['L','R']:
   sign=-1 if side=='L' else 1;h=torso_origin+RB@(P['upper_arm.'+side]-P['hips']);target=torso_origin+RB@(refpoint('hand.'+side)-REF_HIP+walking_arm_offset(t,side));handr=RB@REF['hand.'+side][:3,:3]
   if side=='L':
    grip=smooth((t-9)/1)*(1-smooth((t-10.2)/.35)) if t<12 else smooth((t-17.5)/1)*(1-smooth((t-21.5)/.45))
    if grip>0:
     wrist,griprot,gcontact=grip_pose(t,root,yaw);target=mix(target,wrist,grip);handr=np.array(Matrix(handr.tolist()).to_quaternion().slerp(Matrix(griprot.tolist()).to_quaternion(),grip).normalized().to_matrix())
   if side=='L' and 21.5<t<23.2:target+=np.array([.05,.04,-.04])*math.sin(math.pi*(t-21.5)/1.7)**2
   el,over=twojoint(h,target,np.linalg.norm(T['upper_arm.'+side]-P['upper_arm.'+side]),np.linalg.norm(T['forearm.'+side]-P['forearm.'+side]),RB@(refpoint('forearm.'+side)-refpoint('upper_arm.'+side)));reach['arm.'+side]=over;upref=RB@REF['upper_arm.'+side][:3,:3];foref=RB@REF['forearm.'+side][:3,:3];bone('upper_arm.'+side,h,rotation_between(upref@(T['upper_arm.'+side]-P['upper_arm.'+side]),el-h)@upref);bone('forearm.'+side,el,rotation_between(foref@(T['forearm.'+side]-P['forearm.'+side]),target-el)@foref);bone('hand.'+side,target,handr)
  for n in ['skirt.front','skirt.left','skirt.back','skirt.right']:bone(n,hip+P[n]-P['hips'],I)
 if cached:
  ar=sample_arm_reference(min(tt,3.));arpoint=lambda n:ar[n][:3,:3]@P[n]+ar[n][:3,3]
  for side in ['L','R']:
   n='upper_arm.'+side;h=H[n].copy();delta=h-arpoint(n);target=arpoint('hand.'+side)+delta;el,over=twojoint(h,target,np.linalg.norm(T[n]-P[n]),np.linalg.norm(T['forearm.'+side]-P['forearm.'+side]),arpoint('forearm.'+side)-arpoint(n));reach['arm.'+side]=over;ur=ar[n][:3,:3];fr=ar['forearm.'+side][:3,:3];bone(n,h,rotation_between(ur@(T[n]-P[n]),el-h)@ur);bone('forearm.'+side,el,rotation_between(fr@(T['forearm.'+side]-P['forearm.'+side]),target-el)@fr);bone('hand.'+side,target,ar['hand.'+side][:3,:3])
  if tt<=3:
   hi=int(np.argmin(abs(HR['times']-tt)))
   for n in ['neck','head']:
    m=HR['matrices'][hi,list(HR['bone_names']).index(n)];M[n]=m;H[n]=m[:3,:3]@P[n]+m[:3,3];J[n]=m[:3,:3]@T[n]+m[:3,3]
 for side in ['L','R']:
  fp=root+YR@(K*H['foot.'+side]);feetrow[side]={'world_m':fp.tolist(),'yaw':float(yaw+math.atan2(M['foot.'+side][0,2],M['foot.'+side][2,2])),'support':foot_target(side,t)[2] if not cached else None}
 desired={};frame=1+t*30
 for n in ordered:
  desired[n]=CM@Matrix(M[n].tolist())@CM.inverted()@rig.data.bones[n].matrix_local;parent=D['restBones'][n]['parent'];local=desired[parent]@rig.data.bones[parent].matrix_local.inverted()@rig.data.bones[n].matrix_local if parent else rig.data.bones[n].matrix_local;pb=rig.pose.bones[n];pb.matrix_basis=local.inverted()@desired[n];pb.rotation_mode='QUATERNION'
  for prop in ['location','rotation_quaternion','scale']:pb.keyframe_insert(prop,frame=frame)
 ctrl.location=C@root;ctrl.rotation_euler=(0,0,yaw);ctrl.keyframe_insert('location',frame=frame);ctrl.keyframe_insert('rotation_euler',frame=frame);leaf.rotation_euler[2]=door_angle(t);leaf.keyframe_insert('rotation_euler',frame=frame)
 knees={side:math.degrees(math.acos(np.clip(np.dot(J['thigh.'+side]-H['thigh.'+side],J['shin.'+side]-H['shin.'+side])/(np.linalg.norm(J['thigh.'+side]-H['thigh.'+side])*np.linalg.norm(J['shin.'+side]-H['shin.'+side])),-1,1))) for side in ['L','R']};rows.append({'frame':frame,'time':t,'root_world_game_m':root.tolist(),'yaw':yaw,'hip_local_source':H['hips'].tolist(),'feet':feetrow,'knee_flexion_deg':knees,'reach_overrun_source':reach,'door_angle_rad':door_angle(t),'placeholder_right_hand_grip':grip});poses.append(np.stack([M[n] for n in names]));roots.append({'frame':frame,'time':t,'position_game_m':root.tolist(),'yaw':yaw})
 if ti%240==0:print('FULL_R24_KEY',t,flush=True)
for ob in [rig,ctrl,leaf]:
 for fc in ob.animation_data.action.fcurves:
  for key in fc.keyframe_points:key.interpolation='LINEAR'
scene.frame_start=1;scene.frame_end=991;scene.render.fps=30;scene.frame_set(1);scene['status']='FULL ROUTE INTEGRATED POSE PREPARATION. Rise arm R9 and head counter R1 are merged; complete-route upper-body and garment gates remain unresolved. Rejected BALANCED contour is NOT applied.'
blend=OUT/'B_ACTUAL_FULL_CHAIN_POSE_PREP_v24.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True);sha=hashlib.sha256(blend.read_bytes()).hexdigest();contract={'branch':'REALSCENE-FULLCHAIN-R24','status':scene['status'],'blend_sha256':sha,'duration':33,'pose_bake_hz':60,'close_interval_bake_hz':120,'exit_interval_bake_hz':120,'arm_reference':str(ARM_REFERENCE),'head_reference':str(HEAD_REFERENCE),'exact_events_keyed':True,'keyed_poses':len(rows),'final_chair_turn_degrees':math.degrees(YAW_END-HOME_YAW),'max_reach_overrun_source':max(max(r['reach_overrun_source'].values()) for r in rows),'reach_failure_times':[r['time'] for r in rows if max(r['reach_overrun_source'].values())>1e-6],'arm_and_garment_status':'Rise R9 arm and head R1 references merged as new kinematics; full-route arms, cuffs, sleeves and original garments remain unaccepted. No cuff R1 or rejected contour integrated.','remaining_gates':['All new turns, full shoe/leaf future-stance contact, exact actual inside/outside support, full source body-self and garment contacts.','Dense interpolation/contact and joint tests before any promotion.','Tempo review and runtime import/performance.']};(OUT/'assembly_contract.json').write_text(json.dumps(contract,indent=2));(OUT/'pose_metrics.json').write_text(json.dumps(rows,indent=2));(OUT/'root_reference_curve.json').write_text(json.dumps(roots,indent=2));np.savez_compressed(OUT/'pose_matrices.npz',matrices=np.stack(poses),frames=[r['frame'] for r in rows],times=times,bone_names=names);(OUT/'floor_plant_plan.json').write_text(json.dumps(floor_plants,indent=2));(OUT/'foot_support_plan.json').write_text(json.dumps({side:[{k:(v.tolist() if isinstance(v,np.ndarray) else v) for k,v in q.items()} for q in qs] for side,qs in steps.items()},indent=2));print('FULL_R24_SAVED',json.dumps(contract),flush=True)

(OUT/'clip_ranges.json').write_text(json.dumps([{'name':n,'start_seconds':a,'end_seconds':b,'frame_start':1+a*30,'frame_end':1+b*30} for n,a,b in [('seated_tuck_rise',0,3),('anatomical_left_turn',3,4.5),('walk_to_door',4.5,9),('reach_real_ring',9,10),('open_real_leaf',10,11.5),('exit',11.5,14),('outside_pause',14,14.3),('turn_return',14.3,16),('return_to_ring',16,17.5),('turn_reach_close',17.5,18.5),('close_real_leaf',18.5,21.5),('turn_to_chair',21.5,23.2),('walk_to_chair',23.2,27.7),('turn_to_sit',27.7,29.2),('sit_down',29.2,32.2),('seated_hold',32.2,33)]],indent=2))

(OUT/'heel_pivot_events.json').write_text(json.dumps([{k:(v.tolist() if isinstance(v,np.ndarray) else v) for k,v in event.items()} for event in heel_pivots],indent=2))
