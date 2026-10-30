#!/usr/bin/env python3
"""Read-only toggle-frame gate for the coast root / sail route.
  python3 aabb_gate.py build   <coast_meshes.json> <coast_layout.json> > coast_aabbs.json     (world AABBs, island scene_root frame)
  python3 aabb_gate.py check   <aabbs.json> --pos x y z --target x y z --vfov 45 --aspect 0.462 [--near 0.1 --far 400]
check prints, for every AABB, ON (intersects the view frustum) or off; exit code 1 if anything is ON.
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
         'coast_terrain' if e['mesh']=='terrain' else None)
    pts=inst_box(e)
    for k in ([key] if key else [])+(['region_coast_root'] if key!='coast_clouds' else []):groups.setdefault(k,[]).extend(pts)
  for k,pts in groups.items():
    boxes[k]={'min':[round(min(p[i] for p in pts),2) for i in range(3)],'max':[round(max(p[i] for p in pts),2) for i in range(3)]}
  # island-side route boxes (runtime-built nodes; ESTIMATES from TransportLeg / RegionJourneyLayout constants)
  boxes['SailArt (sail route: sailboat, transit_sea, transit_sea_props, transit_river_mouth, transit_landing) [estimate]']={'min':[-6.0,-1.5,6.0],'max':[3.0,7.0,82.0]}
  boxes['bridge travel segment island->meadow (RegionJourneyLayout meadowOffset +Z 24) [estimate]']={'min':[-2.0,-0.5,3.0],'max':[2.5,2.5,32.0]}
  return boxes
def check(boxes,pos,tgt,vfov,aspect,near,far):
  f=[tgt[i]-pos[i] for i in range(3)];l=math.sqrt(sum(v*v for v in f));f=[v/l for v in f]
  up=(0,1,0);r=[f[1]*up[2]-f[2]*up[1],f[2]*up[0]-f[0]*up[2],f[0]*up[1]-f[1]*up[0]];rl=math.sqrt(sum(v*v for v in r));r=[v/rl for v in r]
  u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]]
  th=math.tan(math.radians(vfov)/2);tw=th*aspect;anyon=False
  for k,b in boxes.items():
    cs=[(x,y,z) for x in (b['min'][0],b['max'][0]) for y in (b['min'][1],b['max'][1]) for z in (b['min'][2],b['max'][2])]
    loc=[]
    for c in cs:
      d=[c[i]-pos[i] for i in range(3)];loc.append((sum(d[i]*r[i] for i in range(3)),sum(d[i]*u[i] for i in range(3)),sum(d[i]*f[i] for i in range(3))))
    planes=[lambda X,Y,Z:Z-near,lambda X,Y,Z:far-Z,lambda X,Y,Z:Z*tw-X,lambda X,Y,Z:Z*tw+X,lambda X,Y,Z:Z*th-Y,lambda X,Y,Z:Z*th+Y]
    on=all(any(pf(*p)>=0 for p in loc) for pf in planes);anyon|=on
    print(('ON ' if on else 'off'),k,b['min'],b['max'])
  return anyon
if __name__=='__main__':
  a=sys.argv
  if a[1]=='build':print(json.dumps(build(a[2],a[3]),indent=1,ensure_ascii=False))
  else:
    def arg(n,c=1,d=None):
      if n in a:i=a.index(n);v=[float(x) for x in a[i+1:i+1+c]];return v if c>1 else v[0]
      return d
    sys.exit(1 if check(load(a[2]),arg('--pos',3),arg('--target',3),arg('--vfov',1,45),arg('--aspect',1,0.462),arg('--near',1,0.1),arg('--far',1,400)) else 0)
