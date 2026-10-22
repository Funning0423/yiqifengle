# 新程序摆（铰链式）：握把（grip）刚性跟 socket.lantern（=跟手），握把相对手掌转动恒为 0；
# 只有提环以下的灯身（lantern.body 去掉握把 + lantern.core）绕握把轴（prop 局部 glTF X? 见下）作 1 自由度摆动，软限幅 ±8°，挂点不变。
# 在 attach_lantern 之后 exec。覆盖全局 Pend / place。
import bpy,bmesh,math,numpy as np
from mathutils import Matrix,Vector
def _split_grip():
    body=[o for o in LOBJ if o.name.startswith('lantern.body')][0]
    g=body.copy();g.data=body.data.copy();g.name='lantern.grip';bpy.context.scene.collection.objects.link(g)
    def keep(o,want_grip):
        bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table()
        isg=lambda f:all(v.co.z>-0.006 for v in f.verts)
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if isg(f)!=want_grip],context='FACES')
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS');bm.to_mesh(o.data);bm.free()
    keep(g,True);keep(body,False)
    H=bpy.data.objects.new('lantern.hinge',None);bpy.context.scene.collection.objects.link(H);H.parent=LROOT;H.matrix_parent_inverse=Matrix.Identity(4);H.matrix_basis=Matrix.Identity(4)
    g.parent=LROOT;g.matrix_parent_inverse=Matrix.Identity(4);g.matrix_basis=Matrix.Identity(4)
    for o in LOBJ:
        if o.type=='MESH':o.parent=H;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=Matrix.Identity(4)
    LOBJ.append(g);LOBJ.append(H);return g,H
GRIP,HINGE=_split_grip();LM=[o for o in LOBJ if o.type=='MESH']
AXIS_LOCAL=Vector((0,1,0))   # Blender 局部 Y = 握把圆柱轴（glTF 局部 -Z，即 socket 局部前后向）
PEN=json.loads(os.environ.get('PEN','{"L":0.098,"zeta":0.8,"amax_deg":8,"acc_lp":0.35}'))
from mathutils import Quaternion
QS=Quaternion(json.loads(os.environ.get('SOCK_ROT','[1,0,0,0]'))).to_matrix()   # socket.lantern 相对手骨的固定旋转（Blender prop 局部）
def grip_rot():
    Jw,p=socket_world(arm);return (Jw.to_3x3()@BB.to_3x3().inverted()@QS),p
class Pend:
    def __init__(s):s.th=0.0;s.w=0.0;s.p=None;s.pv=None;s.a=None;s.d0=None;s.psi_v=0.0;s.init=False
    def step(s,Rg,p):
        a=(Rg@AXIS_LOCAL).normalized();d0=(Rg@Vector((0,0,-1))).normalized();t0=a.cross(d0)
        L=PEN['L'];w=math.sqrt(9.81/L);z=PEN['zeta'];G=Vector((0,0,-9.81))
        if not s.init:   # 首帧：取重力平衡角
            s.th=math.atan2(G.dot(t0),G.dot(d0));s.init=True;s.p=p.copy();s.d0=d0;return s._out()
        dpsi=math.atan2(a.dot(s.d0.cross(d0)),s.d0.dot(d0));s.d0=d0;psv=dpsi*30;psa=(psv-s.psi_v)*30 if s.pv is not None else 0.0;s.psi_v=psv
        vel=(p-s.p)*30;s.p=p.copy()
        if s.pv is None:s.pv=vel;s.th-=dpsi;return s._out()
        a0=(vel-s.pv)*30;s.pv=vel;s.a=a0 if s.a is None else s.a+(a0-s.a)*PEN['acc_lp']
        ge=G-s.a;s.th-=dpsi   # 铰链框架随手转：相对角先扣掉框架转角（灯身惯性保持世界朝向）
        dt=1/300
        for _ in range(10):
            d=math.cos(s.th)*d0+math.sin(s.th)*t0;tt=a.cross(d)
            acc_=ge.dot(tt)/L-2*z*w*s.w;s.w+=acc_*dt;s.th+=s.w*dt
        return s._out()
    def _out(s):
        am=math.radians(PEN['amax_deg']);return am*math.tanh(s.th/am)
LAST={};SETTLE=[0.0]   # lantern_settle 曲线值（0=自由摆，1=手稳住灯身、铰链角收为 0；取放灯接触前后用）
def place(pen):
    Rg,p=grip_rot();th=pen.step(Rg,p) if pen else 0.0
    if pen and SETTLE[0]>0:k=SETTLE[0];pen.th*=(1-k);pen.w*=(1-k);th=pen._out()
    LROOT.matrix_world=Matrix.Translation(p)@Rg.to_4x4();HINGE.matrix_basis=Matrix.Rotation(th,4,AXIS_LOCAL);bpy.context.view_layer.update()
    _a=(Rg@AXIS_LOCAL).normalized();_d0=(Rg@Vector((0,0,-1))).normalized();_G=Vector((0,0,-1));LAST['th_eq_deg']=round(math.degrees(math.atan2(_G.dot(_a.cross(_d0)),_G.dot(_d0))),2)
    # 握把相对手掌的转动（度）：grip 世界旋转 vs 手骨世界旋转×固定绑定偏移
    Jw,_=socket_world(arm);rel=(Jw.to_3x3()@BB.to_3x3().inverted()@QS).inverted()@GRIP.matrix_world.to_3x3();LAST["up_in_grip"]=[round(x,5) for x in Rg.inverted()@Vector((0,0,1))]
    LAST['grip_rel_deg']=round(math.degrees(rel.to_quaternion().angle),4)
    up=Rg@Vector((0,0,1));LAST['grip_tilt_deg']=round(math.degrees(math.acos(max(-1,min(1,up.z)))),2)
    dvec=HINGE.matrix_world.to_3x3()@Vector((0,0,-1));LAST['body_tilt_deg']=round(math.degrees(math.acos(max(-1,min(1,-dvec.z)))),2)
    return math.degrees(th)
if os.environ.get('PFORCE'):   # 压力测试：铰链角每帧取 ±amax 中更靠近身体（髋中心）的一侧
    _place_n=place
    def place(pen):
        Rg,p=grip_rot();best=None
        for s_ in (1,-1):
            th=s_*math.radians(PEN['amax_deg']);LROOT.matrix_world=Matrix.Translation(p)@Rg.to_4x4();HINGE.matrix_basis=Matrix.Rotation(th,4,AXIS_LOCAL);bpy.context.view_layer.update()
            c=HINGE.matrix_world@Vector((0,0,-0.1));d=(c-(arm.matrix_world@arm.pose.bones['hips'].head)).length
            if best is None or d<best[0]:best=(d,th)
        HINGE.matrix_basis=Matrix.Rotation(best[1],4,AXIS_LOCAL);bpy.context.view_layer.update();LAST['grip_rel_deg']=0.0;return math.degrees(best[1])
