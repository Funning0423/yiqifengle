# Blender 侧挂灯：socket.lantern = hand.L（她的右手）局部 glTF 坐标 SOCK；灯默认竖直下垂（钟摆静止位，Cocos 程序摆），LMODE=rigid 时刚性跟手
import bpy,os,json,numpy as np
from mathutils import Matrix,Vector
SOCK=json.loads(os.environ.get('SOCK','[0.010,0.080,0.006]'))
A=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
HAND_BIND=None
LT=0.0
def _bind(glbpath):
    import struct
    raw=open(glbpath,'rb').read();JL=struct.unpack('<I',raw[12:16])[0];j=json.loads(raw[20:20+JL]);o=20+JL;b=raw[o+8:]
    sk=j['skins'][0];a=j['accessors'][sk['inverseBindMatrices']];bv=j['bufferViews'][a['bufferView']]
    IB=np.frombuffer(b,np.float32,count=a['count']*16,offset=bv.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,4,4).transpose(0,2,1)
    names=[j['nodes'][i]['name'] for i in sk['joints']];return Matrix(np.linalg.inv(IB[names.index('hand.L')]).tolist())
def attach_lantern(arm,propglb,charglb=None):
    global LROOT,BB,CORR
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=propglb);new=[o for o in bpy.data.objects if o not in before]
    LROOT=[o for o in new if o.name.startswith('prop_lantern')][0]
    charglb=charglb or os.environ.get('CHARGLB')
    BB=A@_bind(charglb)@A.inverted()
    b=arm.data.bones['hand.L'];CORR=(arm.matrix_world@b.matrix_local).inverted()@BB
    place_lantern(arm);return new
def socket_world(arm):
    pb=arm.pose.bones['hand.L'];Jw=arm.matrix_world@pb.matrix@CORR
    return Jw,Jw@(A@Vector(SOCK))
def place_lantern(arm):
    Jw,p=socket_world(arm)
    if os.environ.get('LMODE','hang')=='rigid':
        R=(Jw.to_3x3()@BB.to_3x3().inverted()).to_4x4()
    elif os.environ.get('LMODE')=='hinge':   # v3b：握把刚性跟 socket.lantern（含固定局部旋转 SOCK_ROT，Blender prop 局部 wxyz），灯身绕握把轴（局部 Y）摆 HINGE 度（整体刚体近似）
        from mathutils import Quaternion
        QS=Quaternion(json.loads(os.environ.get('SOCK_ROT','[0.9301698,0.3636083,0.0507265,0.0]'))).to_matrix()
        R=(Jw.to_3x3()@BB.to_3x3().inverted()@QS).to_4x4();h=float(os.environ.get('HINGE','0'))
        if h: import math;R=R@Matrix.Rotation(math.radians(h),4,'Y')
    else:
        R=Matrix.Identity(4)
        sw=float(os.environ.get('LSWING','0'))
        if sw:
            import math
            H=arm.matrix_world@arm.pose.bones['hips'].matrix;fw=H.to_3x3()@Vector((0,0,1));fw.z=0
            yaw=math.atan2(fw.x,-fw.y) if fw.length>1e-6 else 0.0
            ang=math.radians(sw)*math.sin(2*math.pi*LT/float(os.environ.get('LPERIOD','1.0')))
            Rz=Matrix.Rotation(yaw,4,'Z');R=Rz@Matrix.Rotation(ang,4,'X')@Rz.inverted()
    LROOT.matrix_world=Matrix.Translation(p)@R
