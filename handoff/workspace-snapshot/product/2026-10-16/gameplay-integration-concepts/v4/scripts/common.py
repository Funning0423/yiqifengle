# v4 通用：v3 同款镜头（55° 俯角，竖直 FOV 61.93°，屏幕方格反投影），棋盘下沿抬到 10%
# 用法：blender -b -P <scene>.py -- <SCENE> <outdir>
import os,sys,json
HERE=os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE,'helpers.py')).read())     # bpy/基础形状/棋子; SCENE, OUT(=outdir)
OUTD=OUT
sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=64
try:
    sc.eevee.use_shadows=True; sc.eevee.shadow_ray_count=2; sc.eevee.shadow_step_count=8
except Exception: pass
PITCH=55; CAMH=12.0
cd=bpy.data.cameras.new('c'); cd.lens=30; cd.sensor_width=36; cd.sensor_fit='AUTO'; cd.clip_end=900
cam=bpy.data.objects.new('CAM_board',cd); sc.collection.objects.link(cam); sc.camera=cam
cam.location=(0,0,CAMH); cam.rotation_euler=(R(90-PITCH),0,0); bpy.context.view_layer.update()
TV=math.tan(math.atan(18/30)); TH=TV*720/1280
X0,CW=0.06,0.88/7
Y0=0.10; CH=CW*720/1280
PLANE=[Vector((0,0,0)),Vector((0,0,1))]
CAMC=cam.matrix_world.translation.copy()
def ray(u,v):
    d=cam.matrix_world.to_3x3()@Vector(((u-.5)*2*TH,(v-.5)*2*TV,-1)); return d.normalized()
def at_screen(u,v,dist): return CAMC+ray(u,v)*dist
def P(a,b):
    d=ray(X0+a*CW,Y0+b*CH); p0,n=PLANE
    t=n.dot(p0-CAMC)/n.dot(d); return CAMC+d*t
def NRM(): return PLANE[1].normalized()
def basis():
    n=NRM(); xa=(P(7,3.5)-P(0,3.5)).normalized(); ya=n.cross(xa); return xa,ya,n
def M_at(c,s,rotz=0):
    xa,ya,n=basis(); m=Matrix((xa,ya,n)).transposed().to_4x4()
    return Matrix.Translation(c)@m@Matrix.Rotation(rotz,4,'Z')@Matrix.Diagonal((s,s,s,1))
class Grab:
    def __enter__(s): s.n=set(bpy.data.objects.keys()); return s
    def __exit__(s,*a): s.objs=[o for o in bpy.data.objects if o.name not in s.n]
def place(fn,M):
    with Grab() as g: fn()
    bpy.context.view_layer.update()
    for o in g.objs:
        if o.parent is None: o.matrix_world=M@o.matrix_world
    return g.objs
def mesh_obj(vs,fs,c,name='m',**k):
    me=bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in vs],[],fs); me.validate()
    o=bpy.data.objects.new(name,me); sc.collection.objects.link(o); return put(o,c,**k)
def quad(pts,c,th=0.0,**k):
    n=NRM(); m=len(pts)
    vs=[p for p in pts]+([p-n*th for p in pts] if th>0 else [])
    fs=[list(range(m))]
    if th>0: fs+=[list(range(m,2*m))[::-1]]+[[i,(i+1)%m,m+(i+1)%m,m+i][::-1] for i in range(m)]
    return mesh_obj(vs,fs,c,'q',**k)
def cellpoly(pts_ab,lift=0.0): n=NRM(); return [P(a,b)+n*lift for a,b in pts_ab]
def cell_pts(i,j,g=0.05,lift=0.0): return cellpoly([(i+g,j+g),(i+1-g,j+g),(i+1-g,j+1-g),(i+g,j+1-g)],lift)
def rrect(a0,b0,a1,b1,r,k=4):
    pts=[]
    for cx,cy,s0 in ((a1-r,b0+r,-90),(a1-r,b1-r,0),(a0+r,b1-r,90),(a0+r,b0+r,180)):
        for q in range(k+1):
            a=R(s0+90*q/k); pts.append((cx+math.cos(a)*r,cy+math.sin(a)*r))
    return pts
def cw(i,j): return (P(i+1,j+.5)-P(i,j+.5)).length
def smooth(o):
    for p in o.data.polygons: p.use_smooth=True
    return o
def sun_dir(d,energy,c,ang=4,shadow=True):
    L=bpy.data.lights.new('s','SUN'); L.energy=energy; L.color=c; L.angle=R(ang); L.use_shadow=shadow
    o=bpy.data.objects.new('sun',L); sc.collection.objects.link(o)
    o.rotation_euler=Vector(d).normalized().to_track_quat('-Z','Y').to_euler(); return o
def seg(a,b,r,c,v=10,r2=None,**k):   # 两点之间的圆柱/锥
    a=Vector(a); b=Vector(b); d=b-a; o=cyl(tuple((a+b)/2),r,d.length,c,v=v,r2=r2,**k)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
# ---------------- 分组标记 ----------------
PIECES=[]; FX=[]; CELLS={}
def tag(objs,lst,prefix):
    for o in objs: o.name=prefix+o.name; lst.append(o)
def add_piece(fn,i,j,scale=1.0,lift=0.02,rotz=0.0,fx=False):
    s=cw(i,j)*scale; objs=place(fn, M_at(P(i+.5,j+.5)+NRM()*lift*cw(i,j),s,rotz))
    tag(objs, FX if fx else PIECES, 'FX_' if fx else 'PC_'); return objs
def ring(i,j,z=0.06):
    s=cw(i,j); objs=place(lambda: torus((0,0,0),.47,.045,(1,0.95,0.7),e=5),M_at(P(i+.5,j+.5)+NRM()*z*s,s)); tag(objs,FX,'FX_')
def fx(objs): tag(objs if isinstance(objs,list) else [objs],FX,'FX_')
# ---------------- 测量 ----------------
from bpy_extras.object_utils import world_to_camera_view as w2c
def px(p):
    q=w2c(sc,cam,p); return (q.x*720,(1-q.y)*1280)
def cells_json(path,lift=0.0):
    n=NRM(); out=[]
    for j in range(7):
        for i in range(7):
            cs=[px(P(a,b)+n*lift) for a,b in ((i,j),(i+1,j),(i+1,j+1),(i,j+1))]
            w=((cs[1][0]-cs[0][0])+(cs[2][0]-cs[3][0]))/2; h=((cs[0][1]-cs[3][1])+(cs[1][1]-cs[2][1]))/2
            out.append({'i':i,'j':j,'corners':cs,'w':round(w,1),'h':round(h,1)})
    json.dump(out,open(path,'w'),indent=0); return out
def tris(only=None):
    dg=bpy.context.evaluated_depsgraph_get(); t=0
    for o in sc.objects:
        if o.type=='MESH' and not o.hide_render and (only is None or only(o)):
            e=o.evaluated_get(dg); m=e.to_mesh(); m.calc_loop_triangles(); t+=len(m.loop_triangles); e.to_mesh_clear()
    return t
def occlusion_check(lift=0.06):
    """从镜头向每格中心 60% 区域的 9 个点打射线；先撞到非 CELL_/PC_ 物体 = 被遮。"""
    dg=bpy.context.evaluated_depsgraph_get(); n=NRM(); bad=[]
    for i in range(7):
        for j in range(7):
            for du in (-.3,0,.3):
                for dv in (-.3,0,.3):
                    t=P(i+.5+du,j+.5+dv)+n*lift*cw(i,j); d=(t-CAMC); L=d.length
                    hit,loc,nor,idx,ob,mx=sc.ray_cast(dg,CAMC,d.normalized(),distance=L+0.5)
                    if hit and (loc-CAMC).length<L-0.02 and not (ob.name.startswith('CELL_') or ob.name.startswith('PC_') or ob.name.startswith('FX_')):
                        bad.append((i,j,du,dv,ob.name))
    return bad
def render(path,camobj=None,res=(720,1280)):
    sc.camera=camobj or cam; sc.render.resolution_x,sc.render.resolution_y=res
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
def closeup(name,tgt,off,lens=32):
    c2=bpy.data.cameras.new('c2'); c2.lens=lens; c2.sensor_width=36
    co=bpy.data.objects.new('CLOSE_'+name,c2); sc.collection.objects.link(co)
    co.location=tgt+Vector(off); co.rotation_euler=(tgt-co.location).to_track_quat('-Z','Y').to_euler()
    render(os.path.join(OUTD,'raw_close_%s.png'%name),co,(720,720))
def set_hidden(lst,h):
    for o in lst: o.hide_render=h; o.hide_viewport=h
def finish(closeups):
    """主图 → 遮棋图 → 近景 → 测量写 metrics。"""
    M={}
    cells=cells_json(os.path.join(OUTD,'cells.json'))
    ws=[c['w'] for c in cells]; hs=[c['h'] for c in cells]
    M['cell_w_min_max']=(min(ws),max(ws)); M['cell_h_min_max']=(min(hs),max(hs))
    M['tris_total']=tris(); M['tris_pieces_fx']=tris(lambda o:o.name.startswith(('PC_','FX_'))); M['tris_scene']=M['tris_total']-M['tris_pieces_fx']
    print('METRICS_PRE',M,flush=True)
    render(os.path.join(OUTD,'raw_main.png'))
    set_hidden(PIECES+FX,True); bpy.context.view_layer.update()
    M['occluded_samples']=occlusion_check()
    render(os.path.join(OUTD,'raw_mask.png'))
    set_hidden(PIECES+FX,False)
    for nm,tgt,off in closeups: closeup(nm,tgt,off)
    sc.camera=cam
    # 包体上界：整场景（含棋子，无 instancing）导出 GLB
    try:
        for o in sc.objects: o.select_set(o.type=='MESH' and not o.name.startswith('FX_'))
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUTD,'_pkg_estimate.glb'),export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_normals=True,export_texcoords=False)
        M['glb_raw_bytes']=os.path.getsize(os.path.join(OUTD,'_pkg_estimate.glb'))
    except Exception as e: M['glb_err']=str(e)
    json.dump(M,open(os.path.join(OUTD,'metrics.json'),'w'),indent=1,default=str)
    print('METRICS',M,flush=True); print('DONE_SCENE',SCENE,flush=True)
