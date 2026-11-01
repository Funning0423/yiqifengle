import bpy, math, json, csv
from mathutils import Vector
from mathutils.bvhtree import BVHTree
def g2b(v): return Vector((v[0], -v[2], v[1]))
def b2g(v): return [v[0], v[2], -v[1]]
CAM=dict(back=6.2,side=-3.0,up=5.0,look=1.05,lead=.8,fov=48,headM=3.0,fs=5,ff=3,fb=2.5,fu=1.5,fa=.5)  # JOURNEY_CAMERA @a373227
def load_route(path):
    """GGbot route CSV -> list of (d, phase, sky_local xyz). Re-runnable on any new CSV with same columns."""
    out=[]
    for r in csv.DictReader(open(path)):
        out.append((float(r['d_m']),r['phase'],[float(r['sky_local_x']),float(r['sky_local_y']),float(r['sky_local_z'])]))
    return out
def at(R,d):
    d=max(R[0][0],min(R[-1][0],d))
    for (d0,_,a),(d1,_,b) in zip(R,R[1:]):
        if d<=d1: t=(d-d0)/((d1-d0) or 1); return [a[k]+(b[k]-a[k])*t for k in range(3)]
    return R[-1][2]
def cam(R,d,focus=None):
    """RegionJourneyCore.journeyCamera @a373227 (post-blend), in sky-local space (rigid yaw only => same). focus = anchor_starcourt_center."""
    C=CAM; p=at(R,d); a=at(R,d-C['headM']); b=at(R,d+C['headM']); hx,hz=b[0]-a[0],b[2]-a[2]; h=math.hypot(hx,hz) or 1; hx,hz=hx/h,hz/h; sx,sz=hz,-hx
    pos=[p[0]-hx*C['back']+sx*C['side'],p[1]+C['up'],p[2]-hz*C['back']+sz*C['side']]
    tgt=[p[0]+hx*C['lead'],p[1]+C['look'],p[2]+hz*C['lead']]
    if focus is None and 'anchor_starcourt_center' in bpy.data.objects: focus=anchor_g('anchor_starcourt_center')
    left=R[-1][0]-d; v=min(1,max(0,(C['fs']-left)/(C['fs']-C['ff']))); w=v*v*(3-2*v)
    if focus and w>0:
        fx,fz=focus[0]-p[0],focus[2]-p[2]; fl=math.hypot(fx,fz) or 1; fp=[p[0]-fx/fl*C['fb'],p[1]+C['fu'],p[2]-fz/fl*C['fb']]
        pos=[pos[k]+(fp[k]-pos[k])*w for k in range(3)]
        def dr(q,o): x=[q[k]-o[k] for k in range(3)]; l=math.sqrt(sum(t*t for t in x)) or 1; return [t/l for t in x]
        df=dr(focus,fp); dc=dr([p[0],p[1]+C['look'],p[2]],fp); aim=dr([df[k]*C['fa']+dc[k]*(1-C['fa']) for k in range(3)],[0,0,0]); ft=[fp[k]+aim[k]*8 for k in range(3)]
        tgt=[tgt[k]+(ft[k]-tgt[k])*w for k in range(3)]
    return pos,tgt,C['fov']
def anchor_g(name): return b2g(bpy.data.objects[name].matrix_world.translation)
def board_cam_aspect(asp):
    a=anchor_g('anchor_spawn_girl'); b=anchor_g('anchor_starcourt_center')
    c=[(a[0]+b[0])/2,(a[1]+b[1])/2+1,(a[2]+b[2])/2]
    span=math.dist(a,b); r=max(6,span*.65+2); fov=55
    half=math.atan(math.tan(fov*math.pi/360)*min(1,asp)); d=r/math.sin(half)*1.12; n=math.hypot(.3,.55,1.3)
    return [c[0]+d*.3/n,c[1]+d*.55/n,c[2]+d*1.3/n], c, fov
def project(cm,v,asp):
    C,T,fov=cm; C=Vector(C);f=(Vector(T)-C).normalized(); r=f.cross(Vector((0,1,0))).normalized(); u=r.cross(f)
    dv=Vector(v)-C; z=dv.dot(f)
    if z<=0.05: return None
    t=math.tan(math.radians(fov)/2); return (dv.dot(r)/(z*t*asp), dv.dot(u)/(z*t), z)
BOARD_ASPECTS=(9/19.5,9/16,3/4,1.0,16/9,2.2)
