#!/usr/bin/env python3
"""Read-only toggle-frame gate for the coast root / sail route.
  python3 aabb_gate.py build   <coast_meshes.json> <coast_layout.json> > coast_aabbs.json     (world AABBs, island scene_root frame)
  python3 aabb_gate.py check   <aabbs.json> --pos x y z --target x y z --vfov 45 --aspect 0.462 [--near 0.1 --far 400]
                               [--fov-mode auto|vertical|fitwidth] [--screens all]
check prints, for every AABB, ON (intersects the view frustum) or off; exit code 1 if anything toggled is ON.
region_coast_root is an "envelope" (union of its child boxes) and is printed but decided by the children.
Boxes with "toggled": false (permanent island props, e.g. island_dock) are printed as 'perm' and never fail the gate.
FOV: the engine's portrait camera is fit-width (holds the horizontal FOV of aspect 0.62), so on portrait screens the
effective vertical half-angle is tan(vfov/2)*max(1, 0.62/aspect). --fov-mode auto (default) uses that when aspect < 0.62,
plain vertical otherwise. --screens all runs the 7 WeChat screen sizes and fails if any screen sees a toggled box.
Frustum test is conservative (box vs 6 planes): 'off' is guaranteed off-screen; 'ON' may rarely be a corner false positive."""
import json,math,sys
def load(p):return json.load(open(p))
def world_of(pl,p):   # coast local (Y-up) -> island scene_root world, rotY(yaw) then translate
  a=math.radians(pl['yaw_deg']);c,s=math.cos(a),math.sin(a);x,y,z=p
  return (c*x+s*z+pl['position'][0], y+pl['position'][1], -s*x+c*z+pl['position'][2])
def build(meshes,layout):
  M=load(meshes);L=load(layout);pl=L['placement'];boxes={}
  lb={}
  for n,m in M.items():
    P=m['positions'];xs,ys,zs=P[0::3],P[1::3],P[2::3];lb[n]=(min(xs),max(xs),min(ys),max(ys),min(zs),max(zs))
  def inst_box(e):
    b=lb[e['mesh']];s=e['s'];r=e['rz'];c,sn=math.cos(r),math.sin(r);out=[]
    for x in b[0:2]:
      for y in b[2:4]:
        for z in b[4:6]:
          X,Z=c*x+sn*z,-sn*x+c*z;out.append(world_of(pl,(e['p'][0]+X*s,e['p'][1]+y*s,e['p'][2]+Z*s)))
    return out
  groups={}
  for e in L['layout']:
    if e['mesh'] not in lb:continue
    key=('coast_clouds' if e['mesh']=='reuse_cloud' else 'coast_headland' if e['mesh']=='headland' else
         'coast_beacon_post' if e['mesh'] in ('beacon_post','beacon_lamp') else 'coast_palms' if e['mesh'].startswith('reuse_palm') else
         'coast_terrain' if e['mesh']=='terrain' else 'coast_dressing')   # dressing = board, pieces, rocks, props, flora, steps
    pts=inst_box(e)
    for k in ([key] if key else [])+(['region_coast_root'] if key!='coast_clouds' else []):groups.setdefault(k,[]).extend(pts)
  for k,pts in groups.items():
    boxes[k]={'min':[round(min(p[i] for p in pts),2) for i in range(3)],'max':[round(max(p[i] for p in pts),2) for i in range(3)]}
  boxes['region_coast_root']['envelope']=True   # union of the coast child boxes; gate decides on the children (union box corners give false ONs)
  # island-side route boxes: real bounds computed by GGbot from 8c98bbfe glb + transform chain (team/ggbot/outbox/20261030-sail-bridge-bounds)
  G='GGbot computed 8c98bbfe (glb x node chain)'
  boxes['SailArt sail_boat_whole_route (sailboat incl. sail_gangway_hinge>sail_gangway)']={'min':[-5.851,-1.361,9.538],'max':[1.366,3.85,50.843],'source':G,'toggled':True}
  boxes['SailArt near props (rocks, foam strips/rings, buoys)']={'min':[-9.78,-1.46,9.091],'max':[9.167,0.95,53.62],'source':G,'toggled':True}
  boxes['SailArt wake_trail envelope (departure only, speed>0.35 m/s)']={'min':[-5.25,-0.86,-4.80],'max':[5.15,-0.86,46.6],'source':'GGbot derived from SAIL_WAKE constants (envelope, not mesh)','toggled':True,'departure_only':True}
  boxes['island_dock (permanent island prop, not toggled)']={'min':[-2.575,-2.35,8.045],'max':[-0.753,0.44,14.45],'source':G,'toggled':False}
  # the old bridge box is dropped: island->meadow is always sail mode (RegionJourneyAdapter.ts:100), bridge mode builds no mesh
  return boxes
SCREENS=[(390,844),(414,896),(360,780),(375,667),(320,568),(390,520),(768,1024)]
def half_v(vfov,aspect,mode='auto'):
  t=math.tan(math.radians(vfov)/2)
  if mode=='fitwidth' or (mode=='auto' and aspect<0.62):t*=max(1.0,0.62/aspect)
  return t
def check(boxes,pos,tgt,vfov,aspect,near,far,mode='auto',quiet=False,skip=()):
  f=[tgt[i]-pos[i] for i in range(3)];l=math.sqrt(sum(v*v for v in f));f=[v/l for v in f]
  up=(0,1,0);r=[f[1]*up[2]-f[2]*up[1],f[2]*up[0]-f[0]*up[2],f[0]*up[1]-f[1]*up[0]];rl=math.sqrt(sum(v*v for v in r));r=[v/rl for v in r]
  u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]]
  th=half_v(vfov,aspect,mode);tw=th*aspect;anyon=False;res={}
  for k,b in boxes.items():
    cs=[(x,y,z) for x in (b['min'][0],b['max'][0]) for y in (b['min'][1],b['max'][1]) for z in (b['min'][2],b['max'][2])]
    loc=[]
    for c in cs:
      d=[c[i]-pos[i] for i in range(3)];loc.append((sum(d[i]*r[i] for i in range(3)),sum(d[i]*u[i] for i in range(3)),sum(d[i]*f[i] for i in range(3))))
    planes=[lambda X,Y,Z:Z-near,lambda X,Y,Z:far-Z,lambda X,Y,Z:Z*tw-X,lambda X,Y,Z:Z*tw+X,lambda X,Y,Z:Z*th-Y,lambda X,Y,Z:Z*th+Y]
    on=all(any(pf(*p)>=0 for p in loc) for pf in planes);perm=b.get('toggled',True) is False or b.get('envelope') or k in skip
    if not perm:anyon|=on
    res[k]=on
    if not quiet:print(('perm' if perm else 'ON ' if on else 'off'),('(on)' if perm and on else ''),k,b['min'],b['max'])
  return (anyon,res) if quiet else anyon
if __name__=='__main__':
  a=sys.argv
  if a[1]=='build':print(json.dumps(build(a[2],a[3]),indent=1,ensure_ascii=False))
  else:
    def arg(n,c=1,d=None):
      if n in a:i=a.index(n);v=[float(x) for x in a[i+1:i+1+c]];return v if c>1 else v[0]
      return d
    mode=a[a.index('--fov-mode')+1] if '--fov-mode' in a else 'auto'
    B=load(a[2]);P,T,V,N_,F_=arg('--pos',3),arg('--target',3),arg('--vfov',1,45),arg('--near',1,0.1),arg('--far',1,400)
    if '--screens' in a:
      bad=False
      for (w,h) in SCREENS:print('== %dx%d'%(w,h));bad|=check(B,P,T,V,w/h,N_,F_,mode)
      sys.exit(1 if bad else 0)
    sys.exit(1 if check(B,P,T,V,arg('--aspect',1,0.462),N_,F_,mode) else 0)
