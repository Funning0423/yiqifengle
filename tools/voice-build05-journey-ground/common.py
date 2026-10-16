import bpy, math, mathutils, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
def g2b(v): return Vector((v[0], -v[2], v[1]))
def b2g(v): return [v[0], v[2], -v[1]]
def ry(v, deg):  # Cocos/glTF yaw about +Y
    t=math.radians(deg); c,s=math.cos(t),math.sin(t)
    return [v[0]*c+v[2]*s, v[1], -v[0]*s+v[2]*c]
YAW=215
def anchor_g(name): return b2g(bpy.data.objects[name].matrix_world.translation)
def route_local():
    end=anchor_g('anchor_cloudbridge_end'); start=anchor_g('anchor_cloudbridge_start')
    off=ry([0,12,24],-YAW); edge=[end[i]-off[i] for i in range(3)]
    pts=[]
    for i in range(33):
        t=i/32; pts.append([edge[k]+(end[k]-edge[k])*t+(math.sin(math.pi*t)*2 if k==1 else 0) for k in range(3)])
    L=math.dist(start,end); t=min(1,2.4/L); pts.append([end[k]+(start[k]-end[k])*t for k in range(3)])
    return pts
def sample(path,d):
    for a,b in zip(path,path[1:]):
        l=math.dist(a,b)
        if d<=l: t=d/l if l else 0; return [a[k]+(b[k]-a[k])*t for k in range(3)]
        d-=l
    return path[-1]
def length(path): return sum(math.dist(a,b) for a,b in zip(path,path[1:]))
def ground_bvh():
    o=bpy.data.objects['env_sky_static_palette']; dg=bpy.context.evaluated_depsgraph_get()
    return BVHTree.FromObject(o,dg), o
def lifted(p,bvh):
    """foot on top of terrain if route is buried (stand-in for GGbot clearance fix)"""
    b=g2b(p); hit=bvh.ray_cast(b+Vector((0,0,30)),Vector((0,0,-1)),60)
    if hit[0] is not None and hit[0].z>b.z and hit[1].z>0.5: b.z=hit[0].z
    return b2g(b)
def journey_cam(p):
    po=ry([3.6,3.4,-6.2],-YAW); to=ry([0,1.05,.8],-YAW)
    return [p[k]+po[k] for k in range(3)], [p[k]+to[k] for k in range(3)], 48
def board_cam():
    a=anchor_g('anchor_spawn_girl'); b=anchor_g('anchor_starcourt_center')
    c=[(a[0]+b[0])/2,(a[1]+b[1])/2+1,(a[2]+b[2])/2]
    span=math.dist(a,b); r=max(6,span*.65+2); fov=55; asp=9/19.5
    half=math.atan(math.tan(fov*math.pi/360)*min(1,asp)); d=r/math.sin(half)*1.12; n=math.hypot(.3,.55,1.3)
    return [c[0]+d*.3/n,c[1]+d*.55/n,c[2]+d*1.3/n], c, fov
def lifted(p,bvh,maxlift=1.5):
    b=g2b(p); hit=bvh.ray_cast(b+Vector((0,0,maxlift)),Vector((0,0,-1)),maxlift+0.01)
    if hit[0] is not None and hit[0].z>b.z and hit[1].z>0.5: b.z=hit[0].z
    return b2g(b)
def board_cam_aspect(asp):
    a=anchor_g('anchor_spawn_girl'); b=anchor_g('anchor_starcourt_center')
    c=[(a[0]+b[0])/2,(a[1]+b[1])/2+1,(a[2]+b[2])/2]
    span=math.dist(a,b); r=max(6,span*.65+2); fov=55
    half=math.atan(math.tan(fov*math.pi/360)*min(1,asp)); d=r/math.sin(half)*1.12; n=math.hypot(.3,.55,1.3)
    return [c[0]+d*.3/n,c[1]+d*.55/n,c[2]+d*1.3/n], c, fov
def project(cam,v,asp):
    C,T,fov=cam; C=Vector(C);f=(Vector(T)-C).normalized(); r=f.cross(Vector((0,1,0))).normalized(); u=r.cross(f)
    d=Vector(v)-C; z=d.dot(f)
    if z<=0.05: return None
    t=math.tan(math.radians(fov)/2); return (d.dot(r)/(z*t*asp), d.dot(u)/(z*t), z)
LATE_BACKS=[0,1.5,3,4.5,6]
