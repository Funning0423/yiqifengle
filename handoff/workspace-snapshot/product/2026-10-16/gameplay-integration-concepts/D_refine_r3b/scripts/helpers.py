# 玩法融合方案集 v2   blender -b -P gic2.py -- <scene> <out.png>
import bpy, math, random, sys
from mathutils import Vector, Euler, Matrix
from bpy_extras.object_utils import world_to_camera_view as w2c
argv=sys.argv[sys.argv.index('--')+1:]; SCENE,OUT=argv[0],argv[1]
random.seed(11); R=math.radians
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=48
sc.render.resolution_x=720; sc.render.resolution_y=1280; sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'
try: sc.view_settings.look='AgX - Punchy'
except Exception: pass
MATS={}
def mat(c,e=0.0,rough=0.75,a=1.0):
    k=(tuple(round(x,3) for x in c),e,rough,a)
    if k in MATS: return MATS[k]
    m=bpy.data.materials.new('m%d'%len(MATS)); m.use_nodes=True
    b=m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value=(*c,1); b.inputs['Roughness'].default_value=rough
    if e>0: b.inputs['Emission Color'].default_value=(*c,1); b.inputs['Emission Strength'].default_value=e
    if a<1:
        b.inputs['Alpha'].default_value=a
        try: m.surface_render_method='BLENDED'
        except Exception: pass
    MATS[k]=m; return m
def put(o,c,e=0,rough=0.75,a=1):
    o.data.materials.append(mat(c,e,rough,a))
    for p in o.data.polygons: p.use_smooth=False
    return o
def box(loc,s,c,rot=(0,0,0),bevel=0,seg=2,**k):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rot); o=bpy.context.object; o.scale=s
    if bevel:
        bpy.ops.object.transform_apply(scale=True); m=o.modifiers.new('b','BEVEL'); m.width=bevel; m.segments=seg
    return put(o,c,**k)
def cyl(loc,rad,d,c,v=8,rot=(0,0,0),r2=None,**k):
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=rad,depth=d,location=loc,rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=rad,radius2=r2,depth=d,location=loc,rotation=rot)
    return put(bpy.context.object,c,**k)
def ico(loc,rad,c,sub=1,s=(1,1,1),rot=(0,0,0),**k):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=rad,location=loc,rotation=rot); o=bpy.context.object; o.scale=s
    return put(o,c,**k)
def torus(loc,R1,r1,c,rot=(0,0,0),**k):
    bpy.ops.mesh.primitive_torus_add(major_radius=R1,minor_radius=r1,location=loc,rotation=rot,major_segments=16,minor_segments=6); return put(bpy.context.object,c,**k)
def poly(pts,loc,c,th=0.06,rot=(0,0,0),s=1.0,**k):
    me=bpy.data.meshes.new('p'); n=len(pts)
    vs=[(x*s,y*s,-th/2) for x,y in pts]+[(x*s,y*s,th/2) for x,y in pts]
    fs=[list(range(n))[::-1],list(range(n,2*n))]+[[i,(i+1)%n,n+(i+1)%n,n+i] for i in range(n)]
    me.from_pydata(vs,[],fs); o=bpy.data.objects.new('p',me); sc.collection.objects.link(o)
    o.location=loc; o.rotation_euler=rot; return put(o,c,**k)
def star_pts(Ro=0.38,ri=0.17,n=5): return [((Ro if i%2==0 else ri)*math.sin(i*math.pi/n),(Ro if i%2==0 else ri)*math.cos(i*math.pi/n)) for i in range(2*n)]
def sky(cols,strength=0.8):
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; N=nt.nodes
    bg=N['Background']; tc=N.new('ShaderNodeTexCoord'); sp=N.new('ShaderNodeSeparateXYZ'); mr=N.new('ShaderNodeMapRange'); cr=N.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'],sp.inputs[0]); nt.links.new(sp.outputs[2],mr.inputs[0]); mr.inputs[1].default_value=-0.6; mr.inputs[2].default_value=0.8
    nt.links.new(mr.outputs[0],cr.inputs[0]); nt.links.new(cr.outputs[0],bg.inputs[0]); e=cr.color_ramp
    e.elements[0].position=cols[0][0]; e.elements[0].color=(*cols[0][1],1); e.elements[1].position=cols[-1][0]; e.elements[1].color=(*cols[-1][1],1)
    for p,c in cols[1:-1]: e.elements.new(p).color=(*c,1)
    bg.inputs[1].default_value=strength
def sun(rot,energy,c,ang=4):
    d=bpy.data.lights.new('s','SUN'); d.energy=energy; d.color=c; d.angle=R(ang)
    o=bpy.data.objects.new('s',d); sc.collection.objects.link(o); o.rotation_euler=[R(a) for a in rot]
def point(loc,energy,c,r=0.5):
    d=bpy.data.lights.new('p','POINT'); d.energy=energy; d.color=c; d.shadow_soft_size=r
    o=bpy.data.objects.new('p',d); sc.collection.objects.link(o); o.location=loc
ORANGE=[(0.95,0.32,0.04),(0.85,0.1,0.04),(1.0,0.62,0.05),(0.7,0.06,0.05),(0.95,0.45,0.08)]
# ------------- pieces (local z-up, centred at loc, footprint ~0.8*s) -------------
def piece(kind,loc,s=1.0):
    x,y,z=loc; S=s
    if kind=='leaf':
        poly([(0,.42),(.15,.22),(.38,.25),(.25,.05),(.33,-.18),(.09,-.13),(0,-.4),(-.09,-.13),(-.33,-.18),(-.25,.05),(-.38,.25),(-.15,.22)],(x,y,z+.06*S),(0.9,0.12,0.04),th=.1*S,s=S)
    elif kind=='acorn': ico((x,y-.04*S,z+.2*S),.26*S,(0.75,0.42,0.12),s=(1,1,.85)); cyl((x,y+.14*S,z+.2*S),.27*S,.14*S,(0.38,0.2,0.07),rot=(R(90),0,0),r2=.18*S)
    elif kind=='mush': cyl((x,y-.1*S,z+.1*S),.1*S,.2*S,(0.97,0.92,0.8)); ico((x,y+.05*S,z+.2*S),.36*S,(0.92,0.1,0.1),s=(1,1,.5)); [ico((x+dx*S,y+dy*S,z+.36*S),.05*S,(1,1,1)) for dx,dy in((.1,.05),(-.12,.12),(.02,-.12))]
    elif kind=='cone':
        for k in range(4): cyl((x,y,z+(.1+k*.13)*S),(.3-k*.06)*S,.14*S,(0.5-k*.04,0.26,0.08),v=7,r2=(.22-k*.05)*S)
    elif kind=='chest': ico((x,y,z+.2*S),.32*S,(0.5,0.18,0.06),s=(1,.85,.62),sub=2,rough=.35); ico((x,y+.15*S,z+.3*S),.12*S,(0.85,0.75,0.55),s=(1,.6,.4))
    elif kind=='ticket': box((x,y,z+.07*S),(.72*S,.46*S,.1*S),(1.0,0.75,0.08),bevel=.04*S); box((x+.18*S,y,z+.13*S),(.05*S,.4*S,.02*S),(0.75,0.25,0.1))
    elif kind=='star': poly(star_pts(),(x,y,z+.1*S),(1.0,0.75,0.15),th=.16*S,s=S,e=1.6)
    elif kind=='moon':
        pts=[(math.cos(a)*.38,math.sin(a)*.38) for a in [R(d) for d in range(-120,121,20)]]+[(math.cos(a)*.24+.14,math.sin(a)*.3) for a in [R(d) for d in range(110,-111,-20)]]
        poly(pts,(x,y,z+.1*S),(1.0,0.92,0.55),th=.16*S,s=S,e=1.0)
    elif kind=='comet': ico((x+.15*S,y+.15*S,z+.18*S),.17*S,(0.55,0.95,1.0),e=2); poly([(0,.12),(-.42,-.36),(.12,0)],(x+.1*S,y+.1*S,z+.12*S),(0.3,0.75,1.0),th=.06*S,s=S,e=1.2)
    elif kind=='planet': ico((x,y,z+.22*S),.24*S,(0.95,0.4,0.55),sub=2,rough=.4); cyl((x,y,z+.2*S),.4*S,.03*S,(1,0.7,0.3),v=16)
    elif kind=='scope': cyl((x,y,z+.15*S),.12*S,.62*S,(0.4,0.3,0.85),rot=(R(90),0,R(35)),r2=.07*S); cyl((x,y,z+.06*S),.2*S,.08*S,(0.75,0.6,0.25))
    elif kind=='book': box((x+.03*S,y,z+.07*S),(.52*S,.6*S,.12*S),(0.98,0.95,0.85)); box((x,y,z+.15*S),(.58*S,.66*S,.04*S),(0.1,0.6,0.45)); poly(star_pts(.12,.05),(x,y,z+.18*S),(1,0.8,0.2),th=.02,s=S)
    elif kind=='cloud':
        for dx,dz,r in ((-.17,.17,.18),(.17,.17,.18),(0,.27,.24)): ico((x+dx*S,y,z+dz*S),r*S,(1,0.98,1),sub=2)
    elif kind=='dawn': ico((x,y,z+.22*S),.3*S,(1.0,0.45,0.15),sub=1,e=.8,rough=.3)
    elif kind=='crane':
        poly([(-.42,0),(0,.12),(.42,0),(0,-.08)],(x,y,z+.2*S),(1,1,1),th=.04*S,s=S); poly([(0,0),(.14,0),(0,.36)],(x,y,z+.14*S),(0.95,0.3,0.35),th=.04*S,s=S,rot=(R(90),0,0))
    elif kind=='feather': ico((x,y,z+.12*S),.38*S,(0.1,0.7,0.85),s=(.35,1,.25),rot=(0,0,R(30)))
    elif kind=='whistle': cyl((x,y,z+.18*S),.15*S,.5*S,(1.0,0.78,0.1),rot=(0,R(90),R(20)),v=10,rough=.3); torus((x-.25*S,y-.1*S,z+.18*S),.08*S,.025*S,(0.6,0.4,0.2))
    elif kind=='pinebranch':
        cyl((x,y,z+.1*S),.03*S,.7*S,(0.4,0.25,0.12),rot=(R(90),0,R(20)))
        for k in range(3): ico((x+(k-1)*.12*S,y+(k-1)*.2*S,z+.18*S),.18*S,(0.1,0.5,0.25),s=(1.4,1,.5))
    elif kind=='jar': cyl((x,y,z+.25*S),.22*S,.5*S,(0.75,0.95,0.9),v=10,a=.4,rough=.1); cyl((x,y,z+.53*S),.16*S,.07*S,(0.6,0.35,0.15)); ico((x,y,z+.28*S),.13*S,(1,0.8,0.15),e=8)
    elif kind=='dand': cyl((x,y,z+.12*S),.025*S,.24*S,(0.3,0.6,0.25)); ico((x,y,z+.36*S),.3*S,(0.98,0.98,0.95),sub=2,e=.3)
    elif kind=='env': box((x,y,z+.06*S),(.66*S,.46*S,.08*S),(0.98,0.93,0.8),bevel=.03*S); poly([(-.33,.23),(.33,.23),(0,-.04)],(x,y,z+.11*S),(0.9,0.3,0.25),th=.01,s=S); ico((x,y+.0,z+.12*S),.07*S,(0.8,0.1,0.15))
    elif kind=='scarf': torus((x,y,z+.12*S),.22*S,.1*S,(1.0,0.75,0.05)); box((x+.15*S,y-.25*S,z+.06*S),(.14*S,.32*S,.06*S),(1.0,0.75,0.05),rot=(0,0,.4))
    elif kind=='strawb': ico((x,y,z+.22*S),.27*S,(0.95,0.12,0.18),s=(1,1,1.15),rough=.35); ico((x,y,z+.48*S),.13*S,(0.2,0.65,0.2),s=(1.3,1.3,.4))
    elif kind=='sandw': box((x,y,z+.1*S),(.64*S,.64*S,.08*S),(0.95,0.8,0.5),rot=(0,0,R(45)),bevel=.03*S); box((x,y,z+.16*S),(.6*S,.6*S,.05*S),(0.4,0.75,0.25),rot=(0,0,R(45))); box((x,y,z+.22*S),(.64*S,.64*S,.08*S),(0.95,0.8,0.5),rot=(0,0,R(45)),bevel=.03*S)
    elif kind=='plane': poly([(0,.42),(.34,-.3),(0,-.14),(-.34,-.3)],(x,y,z+.12*S),(0.3,0.6,1.0),th=.05*S,s=S)
    elif kind=='ribbon':
        torus((x-.12*S,y,z+.1*S),.13*S,.06*S,(0.95,0.2,0.6),rot=(0,R(90),0)); torus((x+.12*S,y,z+.1*S),.13*S,.06*S,(0.95,0.2,0.6),rot=(0,R(90),0)); ico((x,y,z+.1*S),.08*S,(0.95,0.2,0.6))
    elif kind=='bell': cyl((x,y,z+.2*S),.3*S,.4*S,(1.0,0.72,0.15),v=10,r2=.12*S,rough=.25); ico((x,y,z+.42*S),.07*S,(0.8,0.5,0.1))
    elif kind=='fish': ico((x,y,z+.18*S),.3*S,(0.1,0.65,0.95),s=(1,.5,.5)); poly([(0,0),(.22,.18),(.22,-.18)],(x+.28*S,y,z+.18*S),(0.1,0.5,0.9),th=.05*S,s=S)
    elif kind=='balloon': ico((x,y,z+.3*S),.27*S,(0.95,0.35,0.15),sub=2,s=(1,1,1.1)); box((x,y,z+.03*S),(.14*S,.14*S,.1*S),(0.55,0.35,0.15))
    elif kind=='kitebadge': poly([(0,.42),(.3,.06),(0,-.38),(-.3,.06)],(x,y,z+.08*S),(0.95,0.15,0.25),th=.09*S,s=S); poly([(0,.42),(.3,.06),(0,.06)],(x,y,z+.13*S),(1,0.8,0.1),th=.01,s=S)

def tree_round(x,y,s,col,z0=0):
    cyl((x,y,z0+1.0*s),.14*s,2*s,(0.35,0.18,0.08),v=5)
    for k in range(3): ico((x+random.uniform(-.5,.5)*s,y+random.uniform(-.3,.3)*s,z0+(2.1+k*.55)*s),random.uniform(.75,1.05)*s,col,sub=1)
def tree_cone(x,y,s,col,snow=False,z0=0):
    cyl((x,y,z0+.4*s),.12*s,.8*s,(0.3,0.16,0.07),v=5)
    for k in range(3):
        cyl((x,y,z0+(1.0+k*.75)*s),(1.0-k*.25)*s,1.1*s,col,v=7,r2=0.05*s)
        if snow: cyl((x,y,z0+(1.33+k*.75)*s),(0.55-k*.15)*s,.48*s,(0.88,0.93,1.0),v=7,r2=0.04*s)
def mountain(x,y,rad,h,col,cap=None):
    cyl((x,y,h/2),rad,h,col,v=7,r2=rad*0.12)
    if cap: cyl((x,y,h*0.82),rad*0.3,h*0.36,cap,v=7,r2=rad*0.04)
