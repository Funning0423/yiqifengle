# r6 湖畔：在 b-board/src/build_board.py（T9 ui-props 做法：单一 M_env_palette 共享色板、UV 塌缩到色块、按角度倒角、Cycles、A 套木件灯光）
# 上派生：①湖畔托盘 tray_lake + 格子底座 tile_a_lake / tile_b_lake（只换色块，造型/倒角/灯光不变）；②湖畔专属障碍「睡莲叶盖」3 个状态。
# 不新增贴图，全部色块都在 env_palette_256.png 里。
# blender -b --factory-startup -P build_lakeside.py -- OUTDIR [samples]
import sys,os
HUE_TRAY=float(os.environ.get('HUE_TRAY','0.17'));SAT_TRAY=float(os.environ.get('SAT_TRAY','0.42'));VAL_TRAY=float(os.environ.get('VAL_TRAY','1.06'))
HUE_TILE=float(os.environ.get('HUE_TILE','0.25'));SAT_TILE=float(os.environ.get('SAT_TILE','0.35'));VAL_TILE=float(os.environ.get('VAL_TILE','1.02'))
SRC='/workspace/yiqifengle/work/棋盘UI美术bot/art-src/board-ui/b-board/src/build_board.py'
s=open(SRC).read()
# 1) 湖畔色块（行, x）：托盘外框 = 湖青漆木（第 9 行青色渐变的浅端），板条 = 更浅的青，圆榫 = 栈桥暖木（第 8 行），格子 = 暮色湖面的浅雾紫 / 奶白
LAKE_SW="""
 rimK=(232,9),baseK=(212,9),lipK=(250,9),floorK=(250,9),floorK2=(244,9),floorK3=(255,9),pegK=(196,8),pegTopK=(232,8),tileK1=(234,12),tileK2=(252,12),
 padD=(4,2),padM=(30,2),padL=(90,2),padRim=(20,2),bud=(236,6),water=(250,9),glint=(160,4),budIn=(200,13),stamen=(140,13),drop=(250,9),ring=(232,9),
"""
s=s.replace(" grey=(250,15),"," grey=(250,15),"+LAKE_SW,1)
# 2) 托盘/格子：复制 tray() 源码，只把 L 色块换成 K 色块
i0=s.index('def tray():'); i1=s.index("reg(tray(),'trayframe')")
tray_src=s[i0:i1]
lake=tray_src.replace('def tray():','def tray_lake():')
# v2（Funning 原则：木框浅、窄、暗部少、往后退；去角钉）：沿用草原浅木色块，整体用 tint 材质往灰绿/湖青偏、降饱和；边框截面收窄约 40%、压低
i_p=lake.index('    # corner pegs'); i_r=lake.index("    return join(P,'tray',34)")
lake=lake[:i_p]+lake[i_r:]
lake=lake.replace("OUTW=inner+0.62","OUTW=inner+0.40")
lake=lake.replace("prof=[(-0.24,0.0),(0.28,0.0),(0.34,0.14),(0.31,0.34),(0.20,0.44),(-0.12,0.44),(-0.22,0.36),(-0.25,0.18)]",
                  "prof=[(-0.14,0.0),(0.16,0.0),(0.20,0.10),(0.18,0.24),(0.12,0.30),(-0.07,0.30),(-0.13,0.25),(-0.15,0.12)]")
lake=lake.replace("rrect(inner+0.30,inner+0.30,rC,6)","rrect(inner+0.18,inner+0.18,rC,6)")
lake=lake.replace("join(P,'tray',34)","tint(join(P,'tray_lake',34),TRAY_T)")
LILY=r'''

def tint_mat(name,hue,sat,val):
    m=MAT.copy(); m.name=name; nt=m.node_tree; t=[n for n in nt.nodes if n.type=='TEX_IMAGE'][0]
    b=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'][0]; h=nt.nodes.new('ShaderNodeHueSaturation')
    h.inputs['Hue'].default_value=hue; h.inputs['Saturation'].default_value=sat; h.inputs['Value'].default_value=val
    nt.links.new(t.outputs['Color'],h.inputs['Color']); nt.links.new(h.outputs['Color'],b.inputs['Base Color']); return m
def tint(o,m):
    o.data.materials.clear(); o.data.materials.append(m); return o
TRAY_T=tint_mat('M_env_palette_lake_tray',0.5+HUE_TRAY,SAT_TRAY,VAL_TRAY)
TILE_T=tint_mat('M_env_palette_lake_tile',0.5+HUE_TILE,SAT_TILE,VAL_TILE)
reg(tint(tile('tile_a_lake','tileL2'),TILE_T),'tile'); reg(tint(tile('tile_b_lake','tileL1'),TILE_T),'tile')
reg(tray_lake(),'trayframe')
# ---- 湖畔专属障碍：睡莲叶盖（2 层）。整格盖住棋子，旁边消除一次掉一层；平放在格子上，用 A 套木件灯光，不进焦点灯光组 ----
def lily_pad(R=0.42,notch=28,seg=40,z=0.112,th=0.022,rot=0):
    pts=[]
    a0=math.radians(90+notch/2+rot); a1=math.radians(90-notch/2+360+rot)
    for k in range(seg+1):
        a=a0+(a1-a0)*k/seg; rr=R*(1+0.025*math.sin(a*7))
        pts.append((rr*math.cos(a),rr*math.sin(a)))
    pts.append((0.02*math.cos(math.radians(90+rot)),0.02*math.sin(math.radians(90+rot))))
    bm=prism(pts,th); xform(bm,(0,0,0),[('X',90)])
    for v in bm.verts:
        d=math.hypot(v.co.x,v.co.y); v.co.z+= z + 0.012*(1-(d/R)**2)   # 中间微微鼓起，边缘贴水
    return bm
def veins(R=0.39,rot=0,sw='padL',notch=28):
    out=[]
    for k in range(9):
        a=math.radians(90+notch/2+8+ (360-notch-16)*k/8 + rot)
        p=[(0.03*math.cos(a)*t*10, 0.03*math.sin(a)*t*10, 0.0) for t in (0,)]
        pts=[((R*t)*math.cos(a),(R*t)*math.sin(a),0.112+0.012*(1-t*t)+0.024) for t in (0.08,0.35,0.65,0.92)]
        out.append(finish(tube(pts,0.006,4),'vein',sw))
    return out
def lily_bud(x=0.10,y=-0.08,S=1.05):
    P=[]
    for k in range(6):   # 白睡莲：6 片尖瓣半开，金色花心
        a=math.radians(60*k+15)
        pet=prism([(0,0),(0.07*S,0.06*S),(0.05*S,0.17*S),(0,0.21*S),(-0.05*S,0.17*S),(-0.07*S,0.06*S)],0.03)
        xform(pet,(0,0,0),[('X',90),('X',-62),('Z',math.degrees(a)-90)])
        xform(pet,(x+0.04*math.cos(a),y+0.04*math.sin(a),0.17))
        P.append(finish(pet,'petal','bud',0.006))
    P.append(finish(xform(ico(0.075,1),(x,y,0.24),scale=(1,1,0.7)),'core','budIn'))
    for k in range(7):
        a=math.radians(360*k/7); P.append(finish(xform(ico(0.018,0),(x+0.07*math.cos(a),y+0.07*math.sin(a),0.27)),'st','stamen'))
    return P
def water_ring():   # 叶缘外一圈浅水（贴格子面，几乎没厚度）
    ring=[(0.455*math.cos(math.radians(a)),0.455*math.sin(math.radians(a))) for a in range(0,360,9)]
    return [finish(sweep(ring,[(-0.035,0.0),(0.035,0.0),(0.035,0.008),(-0.035,0.008)]),'water','water',0.0)] if False else [finish(xform(sweep(ring,[(-0.035,0.0),(0.035,0.0),(0.035,0.008),(-0.035,0.008)]),(0,0,0.108)),'water','water',0.0)]
def glint_arc():   # 叶面左上一道水面高光弧
    arc=[(0.33*math.cos(math.radians(a)),0.33*math.sin(math.radians(a))) for a in range(120,200,8)]
    return [finish(xform(sweep(arc,[(-0.012,0.0),(0.012,0.0),(0.012,0.006),(-0.012,0.006)],closed=False),(0,0,0.148)),'glint','glint',0.0)]
def obstacle_lily(state):
    P=[]
    if state=='full':    # 2 层：完整的叶 + 一朵白睡莲
        P+=water_ring(); P.append(finish(lily_pad(),'pad','padM',0.006,1,40)); P+=veins(); P+=glint_arc()
    elif state=='hit':   # 1 层：叶子被掀起一角、撕开一道口，花没了，叶面挂两颗水珠
        P+=water_ring(); bm=lily_pad(R=0.41,notch=64,rot=-35); P.append(finish(bm,'pad','padD',0.006,1,40)); P+=veins(R=0.42,rot=-35,sw='padM',notch=64)
        for (x,y,r) in ((0.10,-0.06,0.045),(-0.16,0.12,0.033)):
            P.append(finish(xform(uvs(r,8,6),(x,y,0.19),scale=(1,1,0.75)),'drop','drop',0.0))
    else:                # 消除：叶子沉下去，只剩两圈涟漪 + 一小片漂叶（特效帧，0.3 s 内淡出）
        for k,(r,t) in enumerate(((0.30,0.022),(0.44,0.016))):
            ring=[(r*math.cos(math.radians(a)),r*math.sin(math.radians(a))) for a in range(0,360,12)]
            P.append(finish(sweep(ring,[(-t,0.0),(t,0.0),(t,0.02),(-t,0.02)]),'ring','ring',0.0))
        P.append(finish(lily_pad(R=0.14,notch=40,z=0.06,rot=60),'chip','padL',0.006))
    o=join(P,'obstacle_lily_'+state,40)
    for v in o.data.vertices:
        if v.co.z<-1: v.co.z=0
    return o
for st in ('full','hit','clear'): reg(obstacle_lily(st),'tile')
'''
s=s.replace("reg(tray(),'trayframe')","reg(tray(),'trayframe')\n"+lake+LILY,1)
exec(compile(s,'build_lakeside','exec'))
