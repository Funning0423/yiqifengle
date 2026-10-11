# 《咦，起风了》(c) 弹窗与界面定稿 —— Blender 4.5 headless: model + render all popup sprites, chest (closed/open) + GLB.
# Same recipe as (b) build_board.py / T9 ui-props: one M_env_palette material, UVs collapsed to palette swatches,
# angle-limited bevel + shade_smooth_by_angle, Cycles, sky 0.55 + sun 2.35 from upper-left-front.
# Run: blender -b --factory-startup -P build_popups.py -- <outdir> [samples] [only1,only2]
import bpy, bmesh, math, sys, os, json, random
from mathutils import Vector, Matrix
argv=sys.argv[sys.argv.index('--')+1:]
OUT=argv[0]; SAMPLES=int(argv[1]) if len(argv)>1 else 64; ONLY=set(argv[2].split(',')) if len(argv)>2 and argv[2] else None
HERE=os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE,'palette_helpers.py')).read())   # TEX, SW, MAT, finish/prism/rrect/xform/box/cyl/ico/uvs/tube/sweep/star_profile/deform/join
SW.update({k:sw(*v) for k,v in dict(btnTeal=(50,9),lamp=(182,13),coral=(150,6),moon=(200,12),sun=(150,13),
  # (b) v2 light-wood swatches (frames / bases step back, focal items stay saturated)
  rimL=(100,5),baseL=(60,5),lipL=(80,5),pegL=(80,5),pegTopL=(120,5),tileL1=(85,4),tileL2=(105,4)).items()})
def focus_mat():
    m=MAT.copy(); m.name='M_env_palette_piece'; b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value=0.36; b.inputs['Specular IOR Level'].default_value=0.7; return m
PMAT=focus_mat()
def focus(ob):
    for i in range(len(ob.data.materials)):
        if ob.data.materials[i]==MAT: ob.data.materials[i]=PMAT
    return ob
T9='/workspace/yiqifengle/work/grokbot/ui-props/glb-preview'
ASSETS={}
def reg(ob,kind): ASSETS[ob.name]=(ob,kind); return ob
def solidify(o,th,sw_):
    md=o.modifiers.new('sol','SOLIDIFY'); md.thickness=th
    dg=bpy.context.evaluated_depsgraph_get(); nm=bpy.data.meshes.new_from_object(o.evaluated_get(dg)); o.modifiers.clear(); o.data=nm
    for l in o.data.uv_layers[0].data: l.uv=SW[sw_]
    o.data.materials.clear(); o.data.materials.append(MAT); return o
def lathe(prof,seg,sw_,bev=0.0):
    bm=bmesh.new(); rings=[]
    for (r,z) in prof: rings.append([bm.verts.new((r*math.cos(2*math.pi*k/seg),r*math.sin(2*math.pi*k/seg),z)) for k in range(seg)])
    for i in range(len(rings)-1):
        for k in range(seg): k2=(k+1)%seg; bm.faces.new((rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k]))
    bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-4); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    return finish(bm,'lathe',sw_,bev)

# ================= 1. PANEL FRAME (top-down, 9-slice) =================
def panel_frame(name='panel_frame',pegs=True):
    P=[]; inner=5.0; rC=0.46
    P.append(finish(xform(prism(rrect(inner+0.86,inner+0.86,rC+0.2,5),0.16),(0,0,0.0),[('X',90)]),'base','baseL',0.04,2))
    P.append(finish(xform(prism(rrect(inner+0.10,inner+0.10,rC*0.75,5),0.06),(0,0,0.10),[('X',90)]),'paper','cream15',0.02,1))
    path=rrect(inner+0.34,inner+0.34,rC,7)
    prof=[(-0.20,0.0),(0.26,0.0),(0.31,0.13),(0.28,0.30),(0.18,0.39),(-0.10,0.39),(-0.19,0.32),(-0.21,0.16)]
    P.append(finish(sweep(path,prof),'rim','rimL',0.02,1,30))
    P.append(finish(sweep([(x*0.995,z*0.995) for x,z in rrect(inner+0.06,inner+0.06,rC*0.75,7)],[(-0.025,0.10),(0.025,0.10),(0.025,0.16),(-0.025,0.16)]),'lip','lipL'))
    c=(inner+0.34)/2+0.03
    for sx,sy in (((-1,1),(1,1),(1,-1),(-1,-1)) if pegs else ()):
        P.append(finish(xform(cyl(0.15,0.15,0.09,10),(sx*c,sy*c,0.42)),'peg','pegL',0.03,2,40))
        P.append(finish(xform(cyl(0.09,0.09,0.03,10),(sx*c,sy*c,0.47)),'pegtop','pegTopL',0.01))
    return join(P,name,34)
reg(panel_frame(),'frame'); reg(panel_frame('panel_frame_clean',False),'frame')

# ================= 2. TITLE PLANK (3-slice) =================
def title_plank(name='title_plank',ropes=True):
    P=[]; W,H=3.0,0.92
    P.append(finish(xform(prism(rrect(W,H,0.30,4),0.14),(0,0,0)),'board','rimL',0.03,2))
    P.append(finish(xform(prism(rrect(W-0.24,H-0.22,0.21,4),0.05),(0,-0.085,0)),'panel','plaster',0.02))
    for x in ((-W/2+0.15,W/2-0.15) if ropes else ()):
        P.append(finish(xform(cyl(0.045,0.045,0.03,8),(x,-0.075,0),[('X',90)]),'nail','pegL',0.008))
    # two rope ties up (hang from the frame) – sand cord
    for x in ((-W/2+0.42,W/2-0.42) if ropes else ()):
        P.append(finish(tube([(x,0.0,H/2-0.04),(x+0.02,0.01,H/2+0.12),(x,0.0,H/2+0.26)],0.035,5),'rope','acornl'))
        P.append(finish(xform(ico(0.06,1),(x,-0.02,H/2+0.02),scale=(1.2,1,0.8)),'knot','acorn'))
    return join(P,name,40)
reg(title_plank(),'plank'); reg(title_plank('title_plank_clean',False),'plank')

# ================= 3. BUTTONS =================
def pill_button(name,face):
    P=[]; W,H=3.0,0.80
    P.append(finish(xform(prism(rrect(W,H,H/2-0.001,6),0.18),(0,0,0)),'rim','rimL',0.04,2,40))
    P.append(finish(xform(prism(rrect(W-0.16,H-0.16,(H-0.16)/2-0.001,6),0.05),(0,-0.105,0.0)),'face',face,0.025,2,40))
    return join(P,name,40)
reg(pill_button('btn_primary','btnTeal'),'button'); reg(pill_button('btn_secondary','plaster'),'button')
def btn_close():
    P=[]
    P.append(finish(xform(cyl(0.5,0.5,0.16,16),(0,0,0),[('X',90)]),'disc','rimL',0.045,2,40))
    P.append(finish(xform(cyl(0.40,0.40,0.03,16),(0,-0.085,0),[('X',90)]),'face','plaster',0.012))
    for a in (45,-45):
        P.append(finish(xform(box(0.12,0.08,0.46),(0,-0.12,0),[('Y',a)]),'bar','floor3',0.035,2))
    ob=join(P,'btn_close',40); ob.data.transform(Matrix.Translation((0,0,0.5))); return ob
reg(btn_close(),'ui')

# ================= 4. ICON TILES (coaster + carved object, like (b) tools) =================
def coaster(R=0.5):
    return [finish(xform(cyl(R,R*0.96,0.16,16),(0,0,0.08)),'cd','rimL',0.04,2,40),
            finish(xform(cyl(R*0.84,R*0.84,0.03,16),(0,0,0.17)),'ct','tileL1',0.012,1,40)]
def import_t9(name,height):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(T9,name+'.glb'))
    new=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    for o in [o for o in bpy.data.objects if o not in before and o.type!='MESH']: bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        mw=o.matrix_world.copy(); o.parent=None; o.matrix_world=mw
        o.select_set(True)
    bpy.context.view_layer.objects.active=new[0]
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    if len(new)>1: bpy.ops.object.join()
    ob=bpy.context.active_object
    zs=[v.co.z for v in ob.data.vertices]; s=height/(max(zs)-min(zs))
    ob.data.transform(Matrix.Scale(s,4)); ob.data.transform(Matrix.Translation((0,0,-min(zs)*s)))
    for mt in ob.data.materials:
        if mt and mt.node_tree:
            for n in mt.node_tree.nodes:
                if n.type=='TEX_IMAGE': n.interpolation='Closest'
    return ob
def m_lighthouse():
    P=[]
    P.append(lathe([(0.0,0.0),(0.17,0.0),(0.165,0.06),(0.13,0.50),(0.0,0.50)],10,'plaster'))
    for z in (0.12,0.30): P.append(finish(xform(cyl(0.162-z*0.075,0.152-z*0.075,0.07,10),(0,0,z)),'band','roof',0.0))
    P.append(finish(xform(cyl(0.16,0.16,0.04,10),(0,0,0.52)),'deck','darkwood',0.01))
    P.append(finish(xform(cyl(0.085,0.085,0.12,8),(0,0,0.60)),'lamp','lamp',0.0))
    P.append(finish(xform(cyl(0.12,0.0,0.14,8),(0,0,0.73)),'roof','roof',0.0))
    P.append(finish(xform(box(0.06,0.02,0.09),(0,-0.15,0.22)),'door','blue',0.005))
    o=join(P,'lh',30); return o
def m_swirl():
    # 重来 = 回旋的风：teal wind loop with arrowhead
    pts=[]; N=26
    for i in range(N+1):
        t=i/N; a=math.radians(200-300*t); r=0.22+0.05*t
        pts.append((r*math.cos(a),-0.02,0.42+r*math.sin(a)))
    P=[finish(tube(pts,0.045,6,rfn=lambda t:0.55+0.45*t),'loop','teal2')]
    end=Vector(pts[-1]); prev=Vector(pts[-3]); d=(end-prev).normalized()
    ar=prism([(0,0.13),(0.16,0.0),(0,-0.13)],0.07)
    ang=math.degrees(math.atan2(d.z,d.x))
    xform(ar,(0,0,0),[('Y',-ang)]); xform(ar,(end.x,end.y,end.z))
    P.append(finish(ar,'arrow','teal2',0.012))
    # two little cream wind lines
    for z,dx in ((0.30,0.0),(0.25,0.08)):
        P.append(finish(tube([(-0.12+dx,-0.06,z),(0.02+dx,-0.07,z+0.02),(0.12+dx,-0.06,z)],0.018,4),'wl','plaster'))
    return join(P,'swirl',30)
def tile(name,inner):
    P=coaster()+inner; return join(P,name,40)
# coaster icons (pause panel: 重来 / 行囊 / 设置 ; 回到小岛 uses the lighthouse on the secondary button)
def place(o,z=0.18,s=1.0,rotz=0):
    o.data.transform(Matrix.Rotation(math.radians(rotz),4,'Z')); o.data.transform(Matrix.Scale(s,4)); o.data.transform(Matrix.Translation((0,0,z))); return o
reg(tile('tile_restart',[place(m_swirl(),0.0,1.0)]),'tile')
reg(tile('tile_bag',[place(import_t9('ui_satchel',0.56),0.18,1.0,-12)]),'tile')
reg(tile('tile_settings',[place(import_t9('ui_compass',0.62),0.18,1.0,-10)]),'tile')

# ================= 5. SMALL ICONS (settings rows, buttons) =================
def i_note():
    P=[]
    for (x,z) in ((-0.17,0.16),(0.17,0.24)):
        P.append(finish(xform(uvs(0.11,10,6),(x,0,z),scale=(1.25,0.7,0.9),rot=[('Y',-20)]),'head','darkwood'))
        P.append(finish(xform(box(0.045,0.05,0.48),(x+0.115,0,z+0.24)),'stem','darkwood',0.012))
    P.append(finish(xform(box(0.40,0.06,0.09),(0.115,0,0.68),[('Y',-11)]),'beam','darkwood',0.02))
    P.append(finish(xform(prism([(0,0),(0.09,0.12),(0.05,0.26),(0,0.3),(-0.05,0.26),(-0.09,0.12)],0.03),(-0.02,-0.03,0.62),[('Y',-50)]),'lf','leaf',0.01))
    return join(P,'icon_music',35)
def i_conch():
    # 音效 = 小手鼓：木圈 + 奶油鼓面朝镜头 + 两枚金铃片
    P=[]
    P.append(finish(xform(cyl(0.30,0.30,0.14,14),(0,0,0),[('X',90)]),'ring','wood',0.03,2,40))
    P.append(finish(xform(cyl(0.255,0.255,0.02,14),(0,-0.075,0),[('X',90)]),'head','plaster',0.008))
    for a in (200,340):
        r=math.radians(a); P.append(finish(xform(cyl(0.065,0.065,0.03,8),(0.31*math.cos(r),-0.02,0.31*math.sin(r)),[('Y',-a),('X',90)]),'jing','gold',0.008))
    for k in range(6):
        r=math.radians(30+60*k); P.append(finish(xform(ico(0.025,0),(0.30*math.cos(r),-0.075,0.30*math.sin(r))),'tack','darkwood'))
    P.append(finish(xform(cyl(0.30,0.30,0.04,14),(0,0.07,0),[('X',90)]),'band','roof',0.01))
    o=join(P,'icon_sfx_d',35); o.data.transform(Matrix.Rotation(math.radians(-52),4,'X')); o.data.transform(Matrix.Scale(0.95,4))
    st=finish(tube([(0.42,-0.05,0.30),(0.05,-0.20,0.02)],0.03,6),'stick','wood'); bl=finish(xform(ico(0.06,1),(0.05,-0.20,0.02)),'ball','plaster')
    o=join([o,st,bl],'icon_sfx',35); o.data.transform(Matrix.Translation((0,0,0.40))); return o
def i_vibe():
    P=[]
    P.append(finish(xform(prism(rrect(0.34,0.56,0.08,3),0.08),(0,0,0.36)),'body','wood',0.025,2))
    P.append(finish(xform(prism(rrect(0.25,0.44,0.05,3),0.03),(0,-0.045,0.37)),'face','plaster',0.01))
    for sgn in (-1,1):
        for k,r in enumerate((0.27,0.36)):
            pts=[(sgn*r*math.cos(math.radians(a)),-0.02,0.36+r*math.sin(math.radians(a))) for a in range(-35,36,10)]
            P.append(finish(tube(pts,0.025,5),'arc','teal2'))
    return join(P,'icon_vibe',35)
def i_sun():
    P=[finish(xform(cyl(0.2,0.2,0.08,10),(0,0,0.38),[('X',90)]),'disc','gold',0.03,2,40)]
    for k in range(8):
        a=math.radians(22.5+45*k); r=0.31
        tri=prism([(-0.06,0),(0.06,0),(0,0.13)],0.06); xform(tri,(0,0,0),[('Y',-(math.degrees(a)-90))]); xform(tri,(r*math.cos(a)*0.95,0,0.38+r*math.sin(a)*0.95))
        P.append(finish(tri,'ray','orange',0.01))
    return join(P,'icon_sun',35)
def i_moon():
    pts=[]
    for k in range(13):
        a=math.radians(60+240*k/12); pts.append((0.30*math.cos(a),0.30*math.sin(a)))
    for k in range(12,-1,-1):
        a=math.radians(80+200*k/12); pts.append((0.10+0.23*math.cos(a),0.06+0.23*math.sin(a)))
    P=[finish(xform(prism(pts,0.09),(0,0,0.38)),'cres','gold2',0.02,2,40)]
    for (x,z,s) in ((0.24,0.62,0.05),(0.30,0.40,0.035)):
        P.append(finish(xform(prism(star_profile(4,s,s*0.4),0.03),(x,-0.02,z)),'st','lamp'))
    return join(P,'icon_moon',35)
def i_pinwheel():
    P=[]; R=0.30; cols=[('orange','roof'),('blue2','blued'),('plaster','cream'),('teal','teal2')]
    for k in range(4):
        a=math.radians(45+90*k); b=a+math.radians(90)
        c=Vector((0,0,0)); p1=Vector((R*math.cos(a),0,R*math.sin(a))); p2=Vector((R*0.72*math.cos(b-0.35),0,R*0.72*math.sin(b-0.35)))
        tip=Vector((R*0.95*math.cos(a+0.45),-0.09,R*0.95*math.sin(a+0.45)))
        bm=bmesh.new(); v=[bm.verts.new(x) for x in (c,p1,tip)]; bm.faces.new(v); P.append(solidify(finish(bm,'bl',cols[k][0]),0.015,cols[k][0]))
        bm=bmesh.new(); v=[bm.verts.new(x) for x in (c,tip,p2)]; bm.faces.new(v); P.append(solidify(finish(bm,'bd',cols[k][1]),0.015,cols[k][1]))
    for o in P: o.data.transform(Matrix.Translation((0,0,0.52)))
    P.append(finish(xform(cyl(0.035,0.035,0.05,8),(0,-0.03,0.52),[('X',90)]),'pin','plaster'))
    P.append(finish(xform(cyl(0.025,0.025,0.52,6),(0,0.03,0.26)),'stick','wood'))
    return join(P,'icon_motion',25)
for f in (i_note,i_conch,i_vibe,i_sun,i_moon,i_pinwheel): reg(f(),'icon')
reg(place(m_lighthouse(),0.0,1.15),'icon'); ASSETS['icon_home']=ASSETS.pop('lh'); ASSETS['icon_home'][0].name='icon_home'
ab=import_t9('ui_notebook',0.66); ab.name='icon_about'; reg(ab,'icon')
cont=prism([(-0.16,0.0),(0.22,0.25),(-0.16,0.5)],0.08); o=finish(xform(cont,(0,0,0.13)),'play','plaster',0.03,2,40); o.name='icon_play'; reg(o,'icon')

# ================= 6. TOGGLE =================
def toggle_track(name,face):
    P=[]; W,H=1.30,0.62
    P.append(finish(xform(prism(rrect(W,H,H/2-0.001,6),0.12),(0,0,0)),'rim','baseL',0.03,2,40))
    P.append(finish(xform(prism(rrect(W-0.12,H-0.12,(H-0.12)/2-0.001,6),0.04),(0,-0.06,0)),'face',face,0.015,1,40))
    return join(P,name,40)
reg(toggle_track('toggle_on','teal2'),'toggle'); reg(toggle_track('toggle_off','w5b'),'toggle')
def toggle_knob():
    P=[finish(xform(cyl(0.25,0.25,0.12,14),(0,-0.10,0),[('X',90)]),'k','rimL',0.04,2,40),
       finish(xform(cyl(0.19,0.19,0.03,14),(0,-0.17,0),[('X',90)]),'kf','plaster',0.012)]
    return join(P,'toggle_knob',40)
reg(toggle_knob(),'toggle')

# ================= 7. STARS =================
def star(name,sw_top,sw_side,h=0.16):
    prof=star_profile(5,0.46,0.20)
    bm=bmesh.new(); top=[];bot=[]
    for (x,z) in prof: top.append(bm.verts.new((x,-h/2,z))); bot.append(bm.verts.new((x,h/2,z)))
    apex=bm.verts.new((0,-h/2-0.13,0)); back=bm.verts.new((0,h/2,0))
    n=len(prof)
    for i in range(n):
        j=(i+1)%n; bm.faces.new((top[i],top[j],apex)); bm.faces.new((bot[j],bot[i],back)); bm.faces.new((top[j],top[i],bot[i],bot[j]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    o=finish(bm,name+'_f',sw_top,0.012,1,20)
    o.data.transform(Matrix.Translation((0,0,0.5)))
    return o
s=star('star_full','gold',None); s.name='star_full'; reg(focus(s),'star')
s=star('star_empty','w5b',None,0.10); s.name='star_empty'; reg(s,'star')

# ================= 8. REGION SEAL (地区印记) =================
def seal(name,region):
    # 地区印记：同一枚木圆章 + 奶油章面 + 地区色细圈 + 地区图案；顶上麻绳小环
    P=[]; ring={'tide':'teal2','meadow':'leafl','sky':'slate'}[region]
    P.append(finish(xform(cyl(0.48,0.48,0.14,18),(0,0,0),[('X',90)]),'d','wood',0.04,2,40))
    P.append(finish(xform(cyl(0.39,0.39,0.03,18),(0,-0.08,0),[('X',90)]),'f','plaster',0.012))
    P.append(finish(tube([(0.345*math.cos(2*math.pi*k/28),-0.10,0.345*math.sin(2*math.pi*k/28)) for k in range(28)],0.016,4,closed=True),'ring',ring))
    if region=='tide':
        for k,(z,sw_) in enumerate(((0.05,'teal2'),(-0.07,'teal'))):
            pts=[(-0.26+0.52*i/16,-0.11,z+0.045*math.sin(i/16*2*math.pi*1.5)) for i in range(17)]
            P.append(finish(tube(pts,0.035,5),'wave',sw_))
        P.append(finish(xform(prism(star_profile(4,0.05,0.02),0.03),(0.16,-0.12,0.19)),'spark','gold'))
    elif region=='meadow':
        # 小山坡 + 三片草叶 + 一朵小白花
        hill=[(x*0.27,-0.20+0.10*math.cos(x*math.pi/2)) for x in [i/8*2-1 for i in range(9)]]+[(0.27,-0.24),(-0.27,-0.24)]
        P.append(finish(xform(prism(hill,0.04),(0,-0.11,0)),'hill','leaf',0.01))
        for (x,ang,h,sw_) in ((-0.15,18,0.26,'leafd'),(-0.08,-6,0.32,'leaf'),(0.15,-20,0.24,'leafl')):
            bl=prism([(-0.03,0),(0.03,0),(0.005,h)],0.03); xform(bl,(0,0,0),[('Y',ang)]); xform(bl,(x,-0.13,-0.14))
            P.append(finish(bl,'blade',sw_,0.006))
        for k in range(5):
            a_=math.radians(90+72*k); pet=uvs(0.055,8,5); xform(pet,(0,0,0),scale=(0.8,0.4,1.2)); xform(pet,(0,0,0.06),[('Y',-(math.degrees(a_)-90))]); xform(pet,(0.09,-0.14,0.10))
            P.append(finish(pet,'petal','white'))
        P.append(finish(xform(ico(0.035,1),(0.09,-0.16,0.10)),'ctr','gold'))
    else:
        # 一朵云 + 一颗小星
        for (x,z,r) in ((-0.10,0.0,0.11),(0.03,0.05,0.14),(0.15,-0.01,0.10),(0.0,-0.05,0.12)):
            P.append(finish(xform(ico(r,1),(x,-0.12,z-0.04),scale=(1,0.45,0.85)),'cloud','plaster'))
        P.append(finish(xform(box(0.40,0.04,0.03),(0.02,-0.12,-0.14)),'under','slate',0.012))
        P.append(finish(xform(prism(star_profile(5,0.08,0.035),0.035),(-0.17,-0.13,0.19)),'star','gold',0.008))
        P.append(finish(xform(prism(star_profile(4,0.04,0.015),0.02),(0.20,-0.13,0.20)),'spark','gold2'))
    P.append(finish(tube([(0.075*math.cos(2*math.pi*k/14),0,0.56+0.075*math.sin(2*math.pi*k/14)) for k in range(14)],0.022,5,closed=True),'loop','acornl'))
    P.append(finish(xform(ico(0.05,1),(0,-0.01,0.48),scale=(1.2,1,0.8)),'knot','acorn'))
    o=join(P,name,35); o.data.transform(Matrix.Translation((0,0,0.5))); return o
for nm,rg in (('reward_seal_tide','tide'),('reward_seal_meadow','meadow'),('reward_seal_sky','sky')): reg(focus(seal(nm,rg)),'seal')

# ================= 9. CHEST (closed / open) =================
CW,CD,CH=1.60,1.04,0.80; HINGE=Vector((0,CD/2,CH))
def chest_body():
    # hollow body: 3 plank courses × 4 walls (thickness T), lighter rim caps show the wall thickness at the mouth,
    # inner lining in 3 bands getting darker toward the bottom, a solid floor slab, and a heap of coins + gems inside.
    P=[]; T=0.09
    P.append(finish(xform(box(CW+0.08,CD+0.08,0.10),(0,0,0.05)),'foot','darkwood',0.03,2))
    hs=(CH-0.10)/3
    for i,sw_ in enumerate(('wood','floor3','wood')):
        zc=0.10+hs*(i+0.5); hh=hs-0.018
        for y in (-CD/2+T/2,CD/2-T/2): P.append(finish(xform(box(CW,T,hh),(0,y,zc)),'plankFB',sw_,0.025,1))
        for x in (-CW/2+T/2,CW/2-T/2): P.append(finish(xform(box(T,CD-2*T+0.002,hh),(x,0,zc)),'plankLR',sw_,0.025,1))
    # rim caps (wall thickness, lighter)
    for y in (-CD/2+T/2,CD/2-T/2): P.append(finish(xform(box(CW+0.01,T+0.01,0.03),(0,y,CH-0.005)),'cap','acornl',0.012,1))
    for x in (-CW/2+T/2,CW/2-T/2): P.append(finish(xform(box(T+0.01,CD-2*T,0.03),(x,0,CH-0.005)),'cap','acornl',0.012,1))
    # inner lining bands: top → bottom darker
    zf=0.20; bands=[('floor3',CH-0.02,CH-0.21),('floor',CH-0.21,CH-0.40),('darkwood',CH-0.40,zf)]
    for sw_,zt,zb in bands:
        h=zt-zb; zc=(zt+zb)/2
        for sy in (-1,1): P.append(finish(xform(box(CW-2*T-0.004,0.012,h),(0,sy*(CD/2-T-0.006),zc)),'lin',sw_))
        for sx in (-1,1): P.append(finish(xform(box(0.012,CD-2*T-0.004,h),(sx*(CW/2-T-0.006),0,zc)),'lin',sw_))
    # floor slab (volume)
    P.append(finish(xform(box(CW-2*T-0.02,CD-2*T-0.02,0.10),(0,0,0.15)),'floor','cap',0.02,1))
    # contents: coin heap + gems + little star
    rnd=random.Random(11)
    for k in range(40):
        r=rnd.random()**0.6*0.42; a=rnd.random()*2*math.pi
        x=r*math.cos(a)*1.25; y=r*math.sin(a)*0.75; z=zf+0.04+0.36*(1-min(1,r/0.42)**1.6)+rnd.random()*0.02
        c=finish(xform(cyl(0.08,0.08,0.024,8),(0,0,0),[('X',rnd.uniform(-28,28)),('Y',rnd.uniform(-28,28))]),'coin',rnd.choice(['gold','gold','gold2','lamp']))
        c.data.transform(Matrix.Translation((x,y,z))); P.append(c)
    for (x,y,z,r) in ((-0.30,0.05,0.46,0.07),(0.26,-0.06,0.45,0.06),(0.02,0.18,0.58,0.05)):
        P.append(finish(xform(ico(r,1),(x,y,z),scale=(1,1,1.3)),'gem','teal3'))
    st=prism(star_profile(5,0.15,0.065),0.05); xform(st,(0,0,0),[('X',60),('Z',-15)]); xform(st,(0.14,0.06,0.66))
    P.append(finish(st,'star','gold',0.012,1))
    for x in (-CW/2+0.30,CW/2-0.30):
        P.append(finish(xform(box(0.16,0.03,CH-0.06),(x,-CD/2-0.015,0.06+(CH-0.06)/2)),'strapF','darkwood',0.012,1))
        P.append(finish(xform(box(0.16,0.03,CH-0.06),(x,CD/2+0.015,0.06+(CH-0.06)/2)),'strapB','darkwood',0.012,1))
        for z in (0.26,0.58): P.append(finish(xform(ico(0.035,1),(x,-CD/2-0.035,z)),'rivet','gold'))
    for sx in (-1,1):
        for sy in (-1,1):
            P.append(finish(xform(box(0.10,0.10,CH-0.04),(sx*(CW/2-0.01),sy*(CD/2-0.01),0.02+(CH-0.04)/2)),'corner','gold2',0.02,1))
    P.append(finish(xform(prism(rrect(0.26,0.22,0.06,2),0.05),(0,-CD/2-0.03,CH-0.10)),'clasp','gold',0.015,1))
    P.append(finish(xform(cyl(0.025,0.025,0.03,6),(0,-CD/2-0.06,CH-0.12),[('X',90)]),'key','darkwood'))
    return join(P,'chest_body',34)
def chest_lid():
    P=[]; R=CD/2+0.02; seg=7
    prof=[(R*math.cos(math.radians(180*k/seg)),R*math.sin(math.radians(180*k/seg))*0.78) for k in range(seg+1)]
    lid=prism(prof,CW); xform(lid,(0,0,0),[('Z',90)]); xform(lid,(0,0,CH))
    P.append(finish(lid,'lid','wood',0.03,2,30))
    # lid plank seams: thin floor3 bands
    for k in (2,5):
        a0=math.radians(180*k/seg); 
    for x in (-CW/2+0.30,CW/2-0.30):
        outer=[((R+0.035)*math.cos(math.radians(180*k/seg)),(R+0.035)*math.sin(math.radians(180*k/seg))*0.78+0.0) for k in range(seg+1)]
        inner=[(R*0.97*math.cos(math.radians(180*k/seg)),R*0.97*math.sin(math.radians(180*k/seg))*0.78) for k in range(seg,-1,-1)]
        st=prism(outer+inner,0.16); xform(st,(0,0,0),[('Z',90)]); xform(st,(x,0,CH))
        P.append(finish(st,'lstrap','darkwood',0.015,1))
    P.append(finish(xform(box(CW-0.10,CD-0.06,0.012),(0,0,CH-0.004)),'lidlin','floor2'))
    P.append(finish(xform(box(CW+0.04,0.07,0.08),(0,-CD/2-0.01,CH+0.04)),'lip','darkwood',0.02,1))
    P.append(finish(xform(box(CW+0.04,0.07,0.08),(0,CD/2+0.01,CH+0.04)),'lip2','darkwood',0.02,1))
    # clasp tongue + teal gem
    P.append(finish(xform(prism(rrect(0.20,0.26,0.07,2),0.05),(0,-CD/2-0.05,CH+0.04)),'tongue','gold',0.015,1))
    P.append(finish(xform(ico(0.055,1),(0,-CD/2-0.09,CH+0.07),scale=(1,0.6,1)),'gem','teal3'))
    # tiny leaf sprig on top (island touch)
    P.append(finish(xform(prism([(0,0),(0.09,0.12),(0.05,0.26),(0,0.3),(-0.05,0.26),(-0.09,0.12)],0.03),(0.42,-0.05,CH+R*0.78-0.01),[('X',-70),('Z',25)]),'lf','leaf',0.01))
    ob=join(P,'chest_lid',34)
    ob.data.transform(Matrix.Translation(-HINGE)); ob.location=HINGE
    return ob

# ======================= round 2 (首次获得 / 行囊 / 还没存上 / 灯塔目标格) =======================
def beacon_lighthouse():
    # 灯塔目标格上的小灯塔：白身 + 两道红环 + 深木平台 + 亮着的灯室（lamp 发光行）+ 小石基
    P=[]
    P.append(finish(xform(cyl(0.24,0.27,0.08,9),(0,0,0.04)),'rock','slate',0.02,1))
    P.append(lathe([(0.0,0.08),(0.17,0.08),(0.165,0.14),(0.12,0.62),(0.0,0.62)],10,'plaster'))
    rz=lambda z:0.17-(z-0.08)*(0.05/0.54)+0.012
    for z in (0.24,0.44): P.append(finish(xform(cyl(rz(z-0.045),rz(z+0.045),0.09,10),(0,0,z)),'band','red6',0.0))
    P.append(finish(xform(cyl(0.165,0.165,0.04,10),(0,0,0.64)),'deck','darkwood',0.01))
    for k in range(8):
        a=2*math.pi*k/8; P.append(finish(xform(cyl(0.012,0.012,0.09,4),(0.15*math.cos(a),0.15*math.sin(a),0.70)),'rail','darkwood'))
    P.append(finish(xform(cyl(0.095,0.095,0.14,8),(0,0,0.73)),'lamp','lamp',0.0))
    P.append(finish(xform(cyl(0.13,0.0,0.15,8),(0,0,0.875)),'roof','red6',0.01))
    P.append(finish(xform(ico(0.03,1),(0,0,0.96)),'tip','gold'))
    P.append(finish(xform(box(0.07,0.02,0.11),(0,-0.17,0.17)),'door','blue',0.005))
    return join(P,'beacon_lighthouse',30)
reg(focus(beacon_lighthouse()),'beacon')
def beacon_ring():
    # 目标格的灯座框：金色圆角方框（管）+ 四角四颗 lamp 灯珠；俯视和格子同一机位
    P=[]; hw=0.47; r=0.14; pts=[]
    for (cx,cy,a0) in ((hw-r,hw-r,0),(-(hw-r),hw-r,90),(-(hw-r),-(hw-r),180),(hw-r,-(hw-r),270)):
        for k in range(7): a=math.radians(a0+90*k/6); pts.append((cx+r*math.cos(a),cy+r*math.sin(a),0.05))
    P.append(finish(tube(pts,0.028,6,closed=True),'rim','gold2'))
    for (x,y) in ((hw-0.06,hw-0.06),(-(hw-0.06),hw-0.06),(-(hw-0.06),-(hw-0.06)),(hw-0.06,-(hw-0.06))):
        P.append(finish(xform(ico(0.05,1),(x,y,0.07)),'bead','lamp'))
    return join(P,'beacon_ring',30)
reg(focus(beacon_ring()),'ring')
def icon_lock():
    P=[]
    P.append(finish(xform(box(0.40,0.16,0.32),(0,0,0.20)),'body','gold2',0.04,2))
    sh=[(0.12*math.cos(math.radians(a)),0,0.36+0.14*math.sin(math.radians(a))) for a in range(0,181,15)]
    P.append(finish(tube(sh,0.035,6),'shackle','grey'))
    P.append(finish(xform(cyl(0.035,0.035,0.03,8),(0,-0.085,0.24),[('X',90)]),'hole','darkwood'))
    P.append(finish(xform(box(0.03,0.03,0.08),(0,-0.085,0.17)),'slot','darkwood'))
    return join(P,'icon_lock',30)
reg(place(icon_lock(),0.0,1.0),'icon'); ASSETS['icon_lock']=ASSETS.pop(list(ASSETS)[-1]); ASSETS['icon_lock'][0].name='icon_lock'
def icon_charm():
    # 装扮：一枚青色缎带蝴蝶结（两片有厚度的泪滴形结耳 + 两条飘带 + 结心）
    P=[]
    for sx in (-1,1):
        prof=[(sx*(0.03+0.20*(1-math.cos(math.radians(a)))/2),0.11*math.sin(math.radians(a))) for a in range(0,360,24)]
        if sx<0: prof=prof[::-1]
        e=prism(prof,0.07); xform(e,(0,0,0),[('Y',sx*-12)]); xform(e,(0,0.035,0.42)); P.append(finish(e,'ear','teal2',0.02,2))
        tl=prism([(0,0),(sx*0.05,0.0),(sx*0.14,-0.20),(sx*0.10,-0.22),(sx*0.07,-0.17),(sx*0.03,-0.22)] if sx>0 else [(0,0),(sx*0.03,-0.22),(sx*0.07,-0.17),(sx*0.10,-0.22),(sx*0.14,-0.20),(sx*0.05,0.0)],0.05)
        xform(tl,(0,0.06,0.39)); P.append(finish(tl,'tail','teal',0.012,1))
    P.append(finish(xform(ico(0.065,1),(0,-0.02,0.42),scale=(1,0.8,1.1)),'knot','teal3'))
    return join(P,'icon_charm',30)
reg(place(icon_charm(),0.0,1.0),'icon'); ASSETS['icon_charm']=ASSETS.pop(list(ASSETS)[-1]); ASSETS['icon_charm'][0].name='icon_charm'
# ---- 地区道具（行囊用；(b) 只有星光/风语铃/潮汐瓶，这三件按 (b) tool 的做法补：同一款木托 + 雕件，同一机位和焦点灯光）
def grow(ob,f,z0=0.19):
    ob.data.transform(Matrix.Translation((0,0,z0))@Matrix.Scale(f,4)@Matrix.Translation((0,0,-z0)))
def tcoaster(n):
    return [finish(xform(cyl(0.5,0.48,0.16,16),(0,0,0.08)),n+'_d','rimL',0.04,2,40),finish(xform(cyl(0.42,0.42,0.03,16),(0,0,0.17)),n+'_t','tileL1',0.012,1,40)]
def scallop(r=0.13,sw_='coral'):
    # 小扇贝：扇形厚片 + 5 道放射棱 + 两只铰合耳
    prof=[(0,0)]+[(r*math.cos(math.radians(a)),r*math.sin(math.radians(a))) for a in range(20,161,14)]
    P=[finish(prism(prof,0.035),'sc',sw_,0.01,1)]
    for a in range(35,150,28):
        P.append(finish(tube([(0.02*math.cos(math.radians(a)),-0.02,0.02*math.sin(math.radians(a))),(r*0.92*math.cos(math.radians(a)),-0.02,r*0.92*math.sin(math.radians(a)))],0.008,4),'rb',sw_))
    P.append(finish(xform(box(0.09,0.03,0.035),(0,0,0.0)),'ear',sw_,0.006))
    return join(P,'scallop',30)
def tool_tidenet():
    # 潮汐网 v2：短柄小抄网。木圈口朝上微微前倾，网兜是真镂空的网眼（bmesh wireframe），往下垂成袋；
    # 兜里一枚珊瑚色扇贝 + 一枚青色海螺从网口探出来；网圈上系一只红白浮漂；短木柄斜插在木托上。
    P=tcoaster('tn'); R=0.25; cx,cz=-0.03,0.70
    # 网兜：口在 z=0，往下垂，底部略偏前（重量往前坠）
    prof=[(R,0.0),(R*0.97,-0.08),(R*0.86,-0.17),(R*0.66,-0.25),(R*0.40,-0.31),(R*0.12,-0.34)]
    seg=12; bm=bmesh.new(); rings=[]
    for i,(r,z) in enumerate(prof):
        sag=-0.10*(i/(len(prof)-1))**1.5
        rings.append([bm.verts.new((r*math.cos(2*math.pi*k/seg),r*math.sin(2*math.pi*k/seg)+sag,z)) for k in range(seg)])
    for i in range(len(rings)-1):
        for k in range(seg): k2=(k+1)%seg; bm.faces.new((rings[i][k],rings[i][k2],rings[i+1][k2],rings[i+1][k]))
    bot=bm.verts.new((0,-0.05,-0.355))
    for k in range(seg): bm.faces.new((rings[-1][k],rings[-1][(k+1)%seg],bot))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bmesh.ops.wireframe(bm,faces=list(bm.faces),thickness=0.016,use_replace=True,use_boundary=True,use_even_offset=True)
    net=finish(bm,'net','cream',0.0)
    hoop=finish(tube([(R*math.cos(math.radians(a)),R*math.sin(math.radians(a)),0.0) for a in range(0,361,20)],0.028,6,closed=True),'hoop','wood')
    fl=[finish(xform(ico(0.055,2),(0,0,0),scale=(1,1,1.15)),'fl','red6'),finish(xform(cyl(0.057,0.057,0.03,10),(0,0,0.0)),'flb','plaster',0.0)]
    for o_ in fl: o_.data.transform(Matrix.Translation((-R*0.70,-R*0.70,0.0)))
    grp=join([net,hoop]+fl,'tmp_n',30)
    # 网侧躺在木托上：网口朝前（朝镜头）略仰，网兜往后下方垂到木托上
    hx,hz=-0.08,0.19+R*0.93
    grp.data.transform(Matrix.Rotation(math.radians(74),4,'X')); grp.data.transform(Matrix.Rotation(math.radians(-42),4,'Z')); grp.data.transform(Matrix.Translation((hx,-0.06,hz)))
    sc=scallop(0.12,'coral'); sc.data.transform(Matrix.Rotation(math.radians(-18),4,'X')); sc.data.transform(Matrix.Rotation(math.radians(10),4,'Y')); sc.data.transform(Matrix.Rotation(math.radians(-30),4,'Z')); sc.data.transform(Matrix.Translation((hx-0.01,0.02,hz-0.09)))
    cone=lathe([(0.0,0.0),(0.05,0.02),(0.06,0.06),(0.045,0.11),(0.025,0.16),(0.0,0.20)],8,'teal2',0.0)
    cone.data.transform(Matrix.Rotation(math.radians(-60),4,'Y')); cone.data.transform(Matrix.Translation((hx+0.05,0.07,hz-0.16)))
    # 短木柄：从网圈右侧往右后方斜躺到木托上，末端一颗圆把手
    p0=Vector((hx+R*0.70,-0.06-R*0.62,hz-0.06)); p1=Vector((0.42,-0.16,0.24))
    hd=finish(tube([tuple(p0),tuple(p0.lerp(p1,0.5)+Vector((0,0,0.01))),tuple(p1)],0.032,6),'handle','darkwood')
    cap=finish(xform(ico(0.048,1),tuple(p1+Vector((0.02,0.015,0.0)))),'knob','acornl')
    grp=join([grp,sc,cone],'tmp_n2',30)
    return join(P+[grp,hd,cap],'tool_tidenet',35)
def tool_sunseed():
    # 日光籽 v2：一颗饱满的葵花籽（尖头泪滴形，深浅相间的纵纹），顶上冒出一根弯芽和两片子叶；
    # 背后立一枚小太阳（金色圆盘 + 一圈三角光芒），一眼读成「太阳 + 种子」。
    P=tcoaster('ss')
    # 背后的太阳
    sun=[finish(xform(cyl(0.21,0.21,0.04,16),(0,0,0),[('X',90)]),'disc','sun',0.012,1)]
    for k in range(12):
        a=math.radians(30*k); ry=prism([(-0.045,0.0),(0.045,0.0),(0.0,0.11)],0.03); xform(ry,(0,0,0),[('Y',-math.degrees(a)+90)]); xform(ry,(0.25*math.cos(a),0,0.25*math.sin(a)))
        sun.append(finish(ry,'ray','gold',0.004))
    sg=join(sun,'tmp_sun',30); sg.data.transform(Matrix.Translation((0.0,0.16,0.70)))
    # 种子：泪滴 lathe，压扁成杏仁形
    prof=[(0.0,0.0),(0.04,0.04),(0.09,0.12),(0.13,0.22),(0.14,0.30),(0.12,0.36),(0.07,0.395),(0.0,0.41)]
    seed=lathe(prof,10,'ink',0.0); seed.data.transform(Matrix.Scale(1.0,4)); seed.data.transform(Matrix.Diagonal((1.0,0.62,1.0,1.0)))
    st=[]
    for xo in (-0.07,0.0,0.07):
        pts=[]
        for t in range(0,9):
            z=0.05+0.33*t/8
            for (r0,z0),(r1,z1) in zip(prof,prof[1:]):
                if z0<=z<=z1: rr=(r0+(r1-r0)*(z-z0)/(z1-z0))*1.0; break
            x=xo*(rr/0.14); y=-0.62*math.sqrt(max(0,rr*rr-x*x))-0.006
            pts.append((x,y,z))
        st.append(finish(tube(pts,0.011,4),'stripe','cream'))
    sd=join([seed]+st,'tmp_seed',30); sd.data.transform(Matrix.Rotation(math.radians(-12),4,'Z')); sd.data.transform(Matrix.Scale(1.18,4)); sd.data.transform(Matrix.Rotation(math.radians(8),4,'Y')); sd.data.transform(Matrix.Translation((0.0,-0.02,0.19)))
    peg=finish(xform(cyl(0.20,0.24,0.06,12),(0,-0.0,0.21),scale=(1,0.8,1)),'soil','floor',0.02,1)
    # 芽 + 子叶
    tx_,tz_=0.48*math.sin(math.radians(8)),0.19+0.48*math.cos(math.radians(8))
    sp=finish(tube([(tx_,-0.03,tz_-0.02),(tx_-0.01,-0.04,tz_+0.08),(tx_+0.03,-0.05,tz_+0.15),(tx_+0.08,-0.05,tz_+0.17)],0.018,5),'sprout','leafl')
    lv=[]
    for sx,ang in ((-1,25),(1,-15)):
        lf=prism([(0,0),(sx*0.06,0.035),(sx*0.14,0.03),(sx*0.17,0.0),(sx*0.11,-0.025),(sx*0.05,-0.02)] if sx>0 else [(0,0),(sx*0.05,-0.02),(sx*0.11,-0.025),(sx*0.17,0.0),(sx*0.14,0.03),(sx*0.06,0.035)],0.022)
        xform(lf,(0,0,0),[('Y',ang)]); xform(lf,(tx_+0.07,-0.05,tz_+0.17)); lv.append(finish(lf,'leaf','leaf',0.006,1))
    return join(P+[sg,sd,peg,sp]+lv,'tool_sunseed',35)
def tool_starshears():
    # 星剪 v2：一把正面摆放、张开成 X 的剪刀：两片长刃（浅灰金属 + 刃口亮线）向上张开，
    # 过轴心延伸到下面两只大金色指环；轴心是一颗金星螺丝，一片刃尖上挂一颗小星光。立在木托的短木桩上。
    P=tcoaster('sh'); px,pz=0.0,0.50; S=[]
    for sx in (-1,1):
        a=math.radians(19)*sx; dx,dz=math.sin(a),math.cos(a)
        L=0.46; w0=0.06
        bl=prism([(-w0*0.5,0.0),(w0*0.5,0.0),(w0*0.42,L*0.55),(0.006,L),(-w0*0.25,L*0.8)] if sx>0 else [(-w0*0.5,0.0),(w0*0.5,0.0),(w0*0.25,L*0.8),(-0.006,L),(-w0*0.42,L*0.55)],0.03)
        xform(bl,(0,0,0),[('Y',math.degrees(a))]); xform(bl,(px,-0.02*sx,pz)); S.append(finish(bl,'blade','grey',0.006,1))
        edge=finish(tube([(px+dx*0.04-sx*0.0,-0.02*sx-0.017,pz+dz*0.04),(px+dx*(L*0.95),-0.02*sx-0.017,pz+dz*(L*0.95))],0.006,4),'edge','white')
        S.append(edge)
        # 柄 + 指环（在轴心另一侧，同一直线）
        hx,hz=px-dx*0.18-sx*0.075,pz-dz*0.18
        S.append(finish(tube([(px,-0.02*sx,pz),(px-dx*0.08-sx*0.03,-0.02*sx,pz-dz*0.09),(hx+sx*0.05,-0.02*sx,hz+0.05)],0.026,6),'shank','gold2'))
        ring=[(hx+0.095*math.cos(math.radians(t)),-0.02*sx,hz+0.075*math.sin(math.radians(t))) for t in range(0,361,24)]
        S.append(finish(tube(ring,0.026,6,closed=True),'ring','gold2'))
    st=prism(star_profile(5,0.065,0.028),0.05); S.append(finish(xform(st,(px,-0.06,pz)),'pivot','gold',0.008,1))
    sp=prism(star_profile(4,0.05,0.016),0.02); S.append(finish(xform(sp,(px+math.sin(math.radians(19))*0.50,-0.05,pz+math.cos(math.radians(19))*0.50)),'spark','lamp',0.0))
    sh=join(S,'tmp_s',30); piv=Vector((0,0,0.38))
    sh.data.transform(Matrix.Translation(piv)@Matrix.Rotation(math.radians(-8),4,'Z')@Matrix.Rotation(math.radians(-6),4,'X')@Matrix.Translation(-piv))
    return join(P+[sh],'tool_starshears',35)
for f in (tool_tidenet,tool_sunseed,tool_starshears): reg(focus(f()),'tool')

# ---- round 2: 卡片框 / 道具格（9 宫格，俯视，和弹窗框同一套浅木边）+ 章节路牌（3 宫格，T9 路牌形：右端箭头）
def card_frame(name,face,rim_h=0.26):
    P=[]; inner=2.4; rC=0.30
    P.append(finish(xform(prism(rrect(inner+0.40,inner+0.40,rC+0.12,5),0.10),(0,0,0.0),[('X',90)]),'base','baseL',0.03,2))
    P.append(finish(xform(prism(rrect(inner+0.04,inner+0.04,rC*0.8,5),0.05),(0,0,0.06),[('X',90)]),'paper',face,0.015,1))
    path=rrect(inner+0.16,inner+0.16,rC,7)
    prof=[(-0.10,0.0),(0.12,0.0),(0.15,0.07),(0.13,rim_h*0.75),(0.08,rim_h),(-0.05,rim_h),(-0.09,rim_h*0.8),(-0.11,0.08)]
    P.append(finish(sweep(path,prof),'rim','rimL',0.015,1,30))
    return join(P,name,34)
reg(card_frame('card_frame','plaster'),'frame2'); reg(card_frame('slot_frame','tileL1',0.18),'frame2')
def sign_plank(name='sign_plank',nails=True):
    P=[]; W,H=4.2,1.30; tip=0.42
    prof=[(-W/2+0.25,-H/2),(W/2-tip,-H/2),(W/2,0.0),(W/2-tip,H/2),(-W/2+0.25,H/2),(-W/2,H/2-0.25),(-W/2,-H/2+0.25)]
    P.append(finish(xform(prism(prof,0.16),(0,0,0)),'board','rimL',0.035,2))
    ip=[(-W/2+0.30,-H/2+0.13),(W/2-tip-0.06,-H/2+0.13),(W/2-0.16,0.0),(W/2-tip-0.06,H/2-0.13),(-W/2+0.30,H/2-0.13),(-W/2+0.13,H/2-0.30),(-W/2+0.13,-H/2+0.30)]
    P.append(finish(xform(prism(ip,0.05),(0,-0.095,0)),'panel','plaster',0.02))
    for (x,z) in (((-W/2+0.22,H/2-0.22),(-W/2+0.22,-H/2+0.22)) if nails else ()):
        P.append(finish(xform(cyl(0.05,0.05,0.03,8),(x,-0.13,z),[('X',90)]),'nail','pegL',0.008))
    return join(P,name,40)
reg(sign_plank(),'sign'); reg(sign_plank('sign_plank_clean',False),'sign')

CB=focus(chest_body()); CL=focus(chest_lid()); CL.parent=CB
sc0=bpy.context.scene; sc0.render.fps=30; sc0.frame_start=0; sc0.frame_end=15
OPEN_DEG=-118.0
ANIM=[(0,0.0),(9,-126.0),(12,-114.0),(15,OPEN_DEG)]      # 0 s → 0.30 s overshoot −126° → 0.40 s −114° → 0.50 s rest −118°
CL.rotation_mode='XYZ'; CL.animation_data_create(); act=bpy.data.actions.new('chest_open'); CL.animation_data.action=act
for f,deg in ANIM:
    CL.rotation_euler=(math.radians(deg),0,0); CL.keyframe_insert('rotation_euler',index=0,frame=f)
fc=[c for c in (act.fcurves if hasattr(act,'fcurves') else []) ]
for c in fc:
    for kp in c.keyframe_points: kp.interpolation='BEZIER'; kp.handle_left_type=kp.handle_right_type='AUTO_CLAMPED'
    c.keyframe_points[0].easing='EASE_OUT'
CL.rotation_euler=(0,0,0); sc0.frame_set(0)
reg(CB,'chest')
# export GLB (body + child lid with hinge origin). Draco, no embedded image (rebind M_env_palette in Cocos) + preview GLB
os.makedirs(os.path.join(OUT,'glb'),exist_ok=True)
bpy.ops.object.select_all(action='DESELECT'); CB.select_set(True); CL.select_set(True)
common=dict(export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_texcoords=True,export_normals=True,
            export_yup=True,export_cameras=False,export_lights=False,export_animations=False)
common['export_animations']=True; common['export_frame_range']=True; common['export_anim_single_armature']=False
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'glb','result_chest.glb'),export_image_format='NONE',export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=10,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12,**common)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'glb','result_chest_preview.glb'),export_image_format='AUTO',export_draco_mesh_compression_enable=False,**common)

# ================= 10. CURRENT chest (ResultChestGeometry.ts) for comparison only =================
def current_chest():
    s=open('/workspace/yiqifengle/work/棋盘UI美术bot/creator-build-project/assets/scripts/ResultChestGeometry.ts').read()
    D=json.loads(s[s.index('{'):s.rindex('}')+1]); objs={}
    for gi,g in enumerate(D['meshes']):
        mc=D['materials'][g['material']]['color']
        m=bpy.data.materials.get('cur_'+g['material']) or bpy.data.materials.new('cur_'+g['material'])
        m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(mc[0]**2.2,mc[1]**2.2,mc[2]**2.2,1)
        b.inputs['Metallic'].default_value=0.6 if D['materials'][g['material']].get('metal') else 0.0; b.inputs['Roughness'].default_value=0.5
        p=g['positions']; V=[(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]; I=g['indices']; F=[(I[i],I[i+1],I[i+2]) for i in range(0,len(I),3)]
        me=bpy.data.meshes.new('cur%d'%gi); me.from_pydata(V,[],F); me.update(); me.materials.append(m)
        o=bpy.data.objects.new('cur%d'%gi,me); bpy.context.collection.objects.link(o); objs.setdefault(g['part'],[]).append(o)
    return objs,D
CUR,CURD=current_chest()
cur_parts=[o for v in CUR.values() for o in v]

# ======================= render =======================
sc=bpy.context.scene
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=SAMPLES; sc.cycles.use_denoising=True
sc.render.film_transparent=True; sc.render.image_settings.file_format='PNG'; sc.render.image_settings.color_mode='RGBA'
sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'
w=bpy.data.worlds.new('sky'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']; bg.inputs['Color'].default_value=(0.62,0.80,0.95,1); bg.inputs['Strength'].default_value=0.55
sd=bpy.data.lights.new('sun','SUN'); sd.energy=2.35; sd.angle=math.radians(8); sd.color=(1.0,0.97,0.92)
sun=bpy.data.objects.new('sun',sd); sc.collection.objects.link(sun)
sun.rotation_euler=Vector((0.55,0.6,-0.75)).normalized().to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('cam'); cd.type='ORTHO'; cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
# ---- (b) v2 focus lighting for focal objects (chest / stars / reward seal), copied from b-board/src/build_board.py v2:
#  key sun 3.5 light-linked to the focus collection, sky 0.22, overhead soft sun (0.8, 26°), weak cool rim (1.1); material roughness .36.
#  Wood UI pieces (frame / plank / buttons / toggles / tiles) keep the T9 light (sky .55 + sun 2.35).
FOCUS=('chest','star','seal','beacon','ring','tool')
ild=bpy.data.lights.new('inner','POINT'); ild.energy=14; ild.shadow_soft_size=0.25; ild.color=(1.0,0.82,0.52)
inner=bpy.data.objects.new('inner',ild); sc.collection.objects.link(inner); inner.location=(0,0,0.62)
focusC=bpy.data.collections.new('focus_props'); sc.collection.children.link(focusC)
for name,(ob,kind) in ASSETS.items():
    if kind in FOCUS: focusC.objects.link(ob)
focusC.objects.link(CL)
td=bpy.data.lights.new('top','SUN'); td.energy=0.8; td.angle=math.radians(26)
top=bpy.data.objects.new('top',td); sc.collection.objects.link(top); top.rotation_euler=Vector((0.08,0.18,-1)).normalized().to_track_quat('-Z','Y').to_euler()
rd=bpy.data.lights.new('rim','SUN'); rd.energy=1.1; rd.angle=math.radians(12); rd.color=(0.88,0.94,1.0)
rim=bpy.data.objects.new('rim',rd); sc.collection.objects.link(rim); rim.rotation_euler=Vector((-0.45,-0.75,-0.5)).normalized().to_track_quat('-Z','Y').to_euler()
for L_ in (sun,rim): L_.light_linking.receiver_collection=focusC
CAMS={ # kind: (elev, azim, ortho_scale(width), resx, resy, centre z)
 'frame':(90,0,6.40,640,640,0.2),
 'frame2':(90,0,3.00,400,400,0.1),
 'sign':(6,0,4.50,900,300,0.0),
 'plank':(6,0,3.30,660,300,0.06),
 'button':(16,0,3.24,648,210,0.0),
 'ui':(14,18,1.25,160,160,0.5),
 'tile':(38,0,1.25,224,224,0.42),
 'icon':(22,0,1.0,160,160,0.40),
 'toggle':(18,0,1.50,240,140,0.0),
 'star':(26,0,1.10,200,200,0.50),
 'seal':(22,0,1.30,224,240,0.56),
 'chest':(40,-24,3.10,640,680,0.85),
 'beacon':(26,0,1.10,240,240,0.48),
 'tool':(38,0,1.25,192,192,0.42),
 'ring':(72,0,1.16,320,320,0.05),
}
os.makedirs(os.path.join(OUT,'raw'),exist_ok=True)
jobs=[(n,ob,k,None) for n,(ob,k) in ASSETS.items()]
jobs.append(('chest_open',CB,'chest','open')); jobs.append(('chest_open_closeup',CB,'chest','openxl'))
for f in range(0,16,3): jobs.append(('chest_anim_f%02d'%f,CB,'chest','f%d'%f))
jobs.append(('chest_current_closed',None,'chest','cur0')); jobs.append(('chest_current_open',None,'chest','cur1'))
meta={}
allobs=[o for o in bpy.data.objects if o.type=='MESH']
for name,ob,kind,mode in jobs:
    if ONLY and name not in ONLY: continue
    show=set()
    if ob is not None: show.add(ob)
    if kind=='chest' and (mode in (None,'open','openxl') or (mode and mode.startswith('f'))): show.add(CL); sc.frame_set(15 if mode in ('open','openxl') else (int(mode[1:]) if mode and mode.startswith('f') else 0))
    if mode and mode.startswith('cur'):
        show=set(cur_parts); ang=CURD['openDegrees']*(1 if mode=='cur1' else 0)
        hz=CURD['hinge']; hv=Vector((hz[0],-hz[2],hz[1]))
        for o in CUR.get('lid',[]): o.matrix_world=Matrix.Translation(hv)@Matrix.Rotation(math.radians(ang),4,'X')
    for o in allobs: o.hide_render=(o not in show)
    el,az,osc,rx,ry,cz=CAMS[kind]
    isf=kind in FOCUS and not (mode and mode.startswith('cur'))
    inner.hide_render=not (kind=='chest' and mode is not None and not mode.startswith('cur') and mode!='f0')
    top.hide_render=not isf; rim.hide_render=not isf
    sun.light_linking.receiver_collection=focusC if isf else None
    bg.inputs['Strength'].default_value=0.22 if isf else 0.55; sd.energy=3.5 if isf else 2.35
    if mode and mode.startswith('cur'): osc=3.6; cz=0.75
    if mode=='openxl': rx,ry=1200,1275
    d=Vector((math.sin(math.radians(az))*math.cos(math.radians(el)),-math.cos(math.radians(el))*math.cos(math.radians(az)),math.sin(math.radians(el))))
    c=Vector((0,0,cz)); cam.location=c+d*20
    up=Vector((0,1,0)) if el>=89 else Vector((0,0,1))
    cam.rotation_euler=(-d).to_track_quat('-Z','Y').to_euler() if el<89 else (0,0,0)
    cd.ortho_scale=osc; cd.sensor_fit='HORIZONTAL'
    sc.render.resolution_x=rx; sc.render.resolution_y=ry
    sc.render.filepath=os.path.join(OUT,'raw',name+'.png')
    bpy.ops.render.render(write_still=True)
    meta[name]={'kind':kind,'cam':CAMS[kind],'tris':(sum(len(p.vertices)-2 for p in ob.data.polygons) if ob else 0)+(sum(len(p.vertices)-2 for p in CL.data.polygons) if kind=='chest' and ob else 0)}
json.dump(meta,open(os.path.join(OUT,'raw','meta.json'),'w'),indent=1)
sc.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'popup_props.blend'),compress=True)
print('DONE',len(meta))
