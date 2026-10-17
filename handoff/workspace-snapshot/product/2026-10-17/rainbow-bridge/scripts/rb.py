# 彩虹桥 concept + GLB sample.  blender -b -P rb.py -- <outdir> <shots(comma)|all> [samples]
import bpy, bmesh, math, random, sys, json, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
argv=sys.argv[sys.argv.index('--')+1:]; OUT=argv[0]; SHOTS=argv[1]; SAMPLES=int(argv[2]) if len(argv)>2 else 32
MEADOW='/workspace/wechat-game/work/wt-v2/creator-build-project/assets/bundles/region_meadow/env_meadow.glb'
random.seed(7); R=math.radians
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=SAMPLES
sc.render.resolution_x=720; sc.render.resolution_y=1280; sc.render.resolution_percentage=100
sc.view_settings.view_transform='Standard'   # game writes sRGB straight out (no tonemap)
sc.render.film_transparent=False
LOG={}
# ---------------- layout (Blender = glTF (x,-z,y)); meadow local, as in RegionJourneyAdapter (meadow yaw 180) -------
SPAWN=Vector((0,-20,1.1634941)); START=Vector((0,-44,1.1634941)); L=24.0; ARCH=2.0; W=2.1
def path(s,new=True):            # s = plan metres from bridge start
    t=max(0,min(1,s/L)); f=math.sin(math.pi*t)**2 if new else math.sin(math.pi*t)
    return Vector((START.x, START.y+L*t, START.z+ARCH*f))
def tangent(s,new=True):
    a=path(max(0,s-0.05),new); b=path(min(L,s+0.05),new); return (b-a).normalized()
def ss(e0,e1,x):
    t=max(0,min(1,(x-e0)/(e1-e0))); return t*t*(3-2*t)
# ---------------- import meadow ----------------
bpy.ops.import_scene.gltf(filepath=MEADOW)
meadow=[o for o in sc.objects]
for o in meadow:
    if o.name.startswith(('meadow_sky_dome','meadow_far_hills','CAM_')): o.hide_render=True; o.hide_viewport=True
    if o.type=='CAMERA': o.hide_render=True
ground_objs=[o for o in meadow if o.type=='MESH' and o.name.startswith(('meadow_terrain','meadow_path','meadow_river_bank','meadow_river'))]
# ---------------- island stand-in at the bridge start (island GLB is not in this repo) ----------------
def link(me,name):
    o=bpy.data.objects.new(name,me); sc.collection.objects.link(o); return o
MATS={}
def unlit(name,c,a=1.0,add=False):
    k=(name,tuple(c),a,add)
    if k in MATS: return MATS[k]
    m=bpy.data.materials.new(name); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; N.clear()
    o=N.new('ShaderNodeOutputMaterial'); e=N.new('ShaderNodeEmission'); e.inputs[0].default_value=(*c,1)
    geo=N.new('ShaderNodeNewGeometry'); dp=N.new('ShaderNodeVectorMath'); dp.operation='DOT_PRODUCT'; dp.inputs[1].default_value=(-0.35,-0.45,0.82)
    nt.links.new(geo.outputs['Normal'],dp.inputs[0]); mr=N.new('ShaderNodeMapRange'); mr.inputs[1].default_value=-1; mr.inputs[2].default_value=1; mr.inputs[3].default_value=0.62; mr.inputs[4].default_value=1.05
    nt.links.new(dp.outputs['Value'],mr.inputs[0]); mul=N.new('ShaderNodeMix'); mul.data_type='RGBA'; mul.blend_type='MULTIPLY'; mul.inputs[0].default_value=1
    mul.inputs[6].default_value=(*c,1); nt.links.new(mr.outputs[0],mul.inputs[7]); nt.links.new(mul.outputs[2],e.inputs[0])
    if a<1:
        t=N.new('ShaderNodeBsdfTransparent'); mx=N.new('ShaderNodeMixShader'); mx.inputs[0].default_value=a
        nt.links.new(t.outputs[0],mx.inputs[1]); nt.links.new(e.outputs[0],mx.inputs[2]); nt.links.new(mx.outputs[0],o.inputs[0]); m.surface_render_method='BLENDED'
    else: nt.links.new(e.outputs[0],o.inputs[0])
    MATS[k]=m; return m
def grid_mesh(name,cx,cy,rad,hfun,n=26):
    bm=bmesh.new(); vs={}
    for i in range(n+1):
        for j in range(n+1):
            x=cx+(i/n-.5)*2*rad; y=cy+(j/n-.5)*2*rad; vs[i,j]=bm.verts.new((x,y,hfun(x,y)))
    for i in range(n):
        for j in range(n): bm.faces.new((vs[i,j],vs[i+1,j],vs[i+1,j+1],vs[i,j+1]))
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); return me
IC=Vector((0.5,-47.6,0))
def island_h(x,y):
    r=math.hypot((x-IC.x)/1.0,(y-IC.y)/0.85); n=0.08*math.sin(x*2.1)*math.cos(y*1.7)
    return 1.13+n*ss(2,4,r) - 2.6*ss(4.2,7.5,r)
isl=link(grid_mesh('island_top',IC.x,IC.y,8.5,island_h,30),'island_standin'); isl.data.materials.append(unlit('isl_grass',(0.30,0.62,0.16)))
# sand ring + rocks + palm + bushes (stand-in for the island exit area seen in the recordings)
def ico(loc,r,c,s=(1,1,1),sub=1,name='ico',mat=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=r,location=loc); o=bpy.context.object; o.scale=s; o.name=name
    o.data.materials.append(mat or unlit('c%s'%str(c),c)); return o
for k in range(16):
    a=k/16*2*math.pi+random.uniform(-.1,.1); rr=random.uniform(4.6,5.6)
    p=(IC.x+math.cos(a)*rr, IC.y+math.sin(a)*rr*0.85, 0.2+random.uniform(-.2,.3))
    if abs(p[0])<1.8 and p[1]>-45: continue                       # keep the bridge throat clear
    ico(p,random.uniform(.5,1.0),(0.56,0.58,0.6),s=(1.2,1,0.8),name='rock')
for k in range(7):
    a=random.uniform(0,2*math.pi); rr=random.uniform(1.5,3.6); p=(IC.x+math.cos(a)*rr, IC.y+math.sin(a)*rr*.85)
    if abs(p[0])<1.7 and p[1]>-46.5: continue
    ico((p[0],p[1],island_h(*p)+.25),random.uniform(.35,.6),(0.14,0.45,0.15),s=(1,1,.8),name='bush')
bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.14,depth=5,location=(-2.4,-46,3.4),rotation=(R(-8),R(-12),0)); o=bpy.context.object; o.data.materials.append(unlit('trunk',(0.42,0.3,0.18)))
for k in range(7):
    a=k/7*2*math.pi; bpy.ops.mesh.primitive_cone_add(vertices=3,radius1=.35,radius2=0,depth=2.6,location=(-2.9+math.cos(a)*1.2,-46.3+math.sin(a)*1.2,5.6),rotation=(R(70)*math.sin(a),R(-70)*math.cos(a),a))
    bpy.context.object.data.materials.append(unlit('palm',(0.25,0.62,0.18)))
bpy.ops.mesh.primitive_plane_add(size=1,location=(0,-112,0.45)); sea=bpy.context.object; sea.scale=(400,176,1); sea.data.materials.append(unlit('sea',(0.12,0.68,0.82)))
ground_objs.append(isl)
# ---------------- ground BVH ----------------
dg=bpy.context.evaluated_depsgraph_get()
def bvh_of(objs):
    bm=bmesh.new()
    for o in objs:
        t=bmesh.new(); t.from_mesh(o.evaluated_get(dg).to_mesh()); t.transform(o.matrix_world); me=bpy.data.meshes.new('t'); t.to_mesh(me); bm.from_mesh(me); t.free()
    b=BVHTree.FromBMesh(bm); bm.free(); return b
GB=bvh_of(ground_objs); PB=bvh_of([o for o in ground_objs if o.name.startswith('meadow_path')])
def on_path(x,y):
    h=PB.ray_cast(Vector((x,y,60)),Vector((0,0,-1)))
    return h[0] is not None
def ground(x,y):
    hit=GB.ray_cast(Vector((x,y,60)),Vector((0,0,-1)))
    return hit[0].z if hit[0] else -99
# ---------------- night tint of imported (unlit) meadow materials ----------------
NIGHT_NODES=[]
def tint_all():
    """Night grade of everything that is not bridge light: multiply the colour feeding each shader (journey night ~ lit-night)."""
    for m in bpy.data.materials:
        if not m.use_nodes or m.get('tinted') or m.name.startswith(('M_rainbow','M_rb_')): continue
        m['tinted']=1; nt=m.node_tree
        for n in list(nt.nodes):
            if n.bl_idname not in ('ShaderNodeBsdfPrincipled','ShaderNodeEmission','ShaderNodeBackground','ShaderNodeBsdfDiffuse'): continue
            for nm in ('Base Color','Color','Emission Color'):
                if nm not in n.inputs: continue
                if nm=='Emission Color' and n.bl_idname=='ShaderNodeBsdfPrincipled' and not n.inputs[nm].is_linked: continue
                inp=n.inputs[nm]; mx=nt.nodes.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.label='NIGHT'; mx.inputs[0].default_value=0
                mx.inputs[7].default_value=(0.20,0.25,0.40,1)
                if inp.is_linked: src=inp.links[0].from_socket; nt.links.new(src,mx.inputs[6])
                else: mx.inputs[6].default_value=tuple(inp.default_value)
                nt.links.new(mx.outputs[2],inp); NIGHT_NODES.append(mx)
# ---------------- NEW BRIDGE mesh ----------------
END=2.8           # fade zone length (m) at each end
def stations():
    out=[];s=0.0
    while s<L-1e-6:
        out.append(s); d=min(s,L-s); s+= 0.2 if d<END+0.2 else 0.5
    out.append(L); return out
def section(s):
    d=min(s,L-s); k=ss(0.0,END,d)                       # 0 at the tips, 1 on the span
    th=max(0.012,0.24*ss(0.3,END+0.6,d)); w=W/2+0.22*(1-k); curb=0.075*ss(0.8,END,d); cw=0.11
    crown=0.03*k
    top=[]; NT=8
    for i in range(NT+1):
        u=-1+2*i/NT; top.append(((w-cw)*u, crown*(1-u*u), i/NT, 0.0, 1.0))      # (x, z, uvx, part, shade)
    ring=[]
    # left side going down/under, then across the top: build a closed loop  top(L->R) curbR side R bottom side L curbL
    ring+=top
    ring+=[(w-cw*0.6, curb, 1.0, .33, 1.15),(w, curb*0.85, 1.0, .33, 1.1),(w+0.03, -th*0.15, 0.0, .66, 0.92),(w-0.02,-th*0.75,1.0,.66,0.8),(w*0.55,-th,0.2,1.0,0.68),(0,-th*0.96,0.5,1.0,0.66),
           (-w*0.55,-th,0.8,1.0,0.68),(-w+0.02,-th*0.75,1.0,.66,0.8),(-w-0.03,-th*0.15,0.0,.66,0.92),(-w,curb*0.85,0.0,.33,1.1),(-w+cw*0.6,curb,0.0,.33,1.15)]
    return ring,k,th,w
def build_bridge(name,lift_tip=0.03):
    bm=bmesh.new(); uvl=bm.loops.layers.uv.new('UVMap'); col=bm.loops.layers.float_color.new('Col')
    rings=[];info=[]
    for s in stations():
        p=path(s); T=tangent(s); X=Vector((1,0,0)); Nn=X.cross(T).normalized()
        ring,k,th,w=section(s); d=min(s,L-s)
        lift=lift_tip*(1-ss(0.6,END,d))
        # end-zone ride: deck rides on the ground (+3 cm) where the path would put its underside into the grass
        g=ground(p.x,p.y); base=p+Vector((0,0,lift))
        need=g+0.012+th - base.z
        if need>0 and d<END+1.0: base.z+=need
        vs=[]
        for (x,z,uvx,part,shade) in ring: vs.append((bm.verts.new(base+X*x+Nn*z),uvx,part,shade))
        fade=ss(0.0,END,d)
        rings.append((vs,s,fade)); info.append(dict(s=round(s,2),ground=round(g,3),deck_top=round(base.z,3),under=round(base.z-th,3),clear=round(base.z-th-g,3),th=round(th,3)))
    n=len(rings[0][0])
    for a,b in zip(rings[:-1],rings[1:]):
        for i in range(n):
            j=(i+1)%n
            if i==8: continue                     # no face between top-right and curb? (keep closed: handled below)
            f=bm.faces.new((a[0][i][0],a[0][j][0],b[0][j][0],b[0][i][0]))
            for lp,(rv,ss_,fd) in zip(f.loops,[(a[0][i],a[1],a[2]),(a[0][j],a[1],a[2]),(b[0][j],b[1],b[2]),(b[0][i],b[1],b[2])]):
                v,uvx,part,shade=rv; lp[uvl].uv=(uvx,ss_); lp[col]=(part,shade,fd,1.0)
        i=8; j=9
        f=bm.faces.new((a[0][i][0],a[0][j][0],b[0][j][0],b[0][i][0]))
        for lp,(rv,ss_,fd) in zip(f.loops,[(a[0][i],a[1],a[2]),(a[0][j],a[1],a[2]),(b[0][j],b[1],b[2]),(b[0][i],b[1],b[2])]):
            v,uvx,part,shade=rv; lp[uvl].uv=(uvx,ss_); lp[col]=(.33,1.1,fd,1.0)
    bm.normal_update()
    # orient outward (loop order): flip if top normal points down
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o=link(me,name)
    if o.data.polygons[0].normal.z<0:
        bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.flip_normals(); bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
    return o,info
# ---------------- bridge material (Blender mirror of rainbow-bridge.effect) ----------------
BAND=[(0.95,0.30,0.38),(1.0,0.56,0.22),(1.0,0.84,0.30),(0.42,0.84,0.45),(0.26,0.78,0.90),(0.38,0.52,0.98),(0.70,0.42,0.92)]
def srgb2lin(c): return tuple(((x+0.055)/1.055)**2.4 if x>0.04045 else x/12.92 for x in c)
PARAMS={}
def bridge_material(name):
    m=bpy.data.materials.new(name); m.use_nodes=True; m.surface_render_method='BLENDED'; m.use_backface_culling=True
    nt=m.node_tree; N=nt.nodes; N.clear(); Lk=nt.links.new
    def node(t,**kw):
        n=N.new(t)
        for k,v in kw.items(): setattr(n,k,v)
        return n
    def math_(op,a,b=None,clamp=False):
        n=node('ShaderNodeMath',operation=op); n.use_clamp=clamp
        for i,x in enumerate([a,b]):
            if x is None: continue
            if isinstance(x,(int,float)): n.inputs[i].default_value=x
            else: Lk(x,n.inputs[i])
        return n.outputs[0]
    def sstep(e0,e1,x):
        n=node('ShaderNodeMapRange',interpolation_type='SMOOTHSTEP'); n.inputs[1].default_value=e0; n.inputs[2].default_value=e1; Lk(x,n.inputs[0]); return n.outputs[0]
    uv=node('ShaderNodeUVMap',uv_map='UVMap'); sp=node('ShaderNodeSeparateXYZ'); Lk(uv.outputs[0],sp.inputs[0])
    U=sp.outputs[0]; S=sp.outputs[1]
    ca=node('ShaderNodeVertexColor',layer_name='Col'); sc_=node('ShaderNodeSeparateColor'); Lk(ca.outputs[0],sc_.inputs[0])
    PART=sc_.outputs[0]; SHADE=sc_.outputs[1]; FADE=sc_.outputs[2]
    ramp=node('ShaderNodeValToRGB'); e=ramp.color_ramp; e.interpolation='EASE'
    e.elements[0].position=0.0; e.elements[0].color=(*srgb2lin(BAND[0]),1); e.elements[1].position=1.0; e.elements[1].color=(*srgb2lin(BAND[6]),1)
    for i in range(1,6): e.elements.new(i/6).color=(*srgb2lin(BAND[i]),1)
    Lk(U,ramp.inputs[0])
    # params as Value nodes so the script can switch day/night
    def val(k,v): n=node('ShaderNodeValue'); n.outputs[0].default_value=v; n.label=k; PARAMS.setdefault(k,[]).append(n); return n.outputs[0]
    EMIT=val('emit',1.0); ALPHA=val('alpha',0.86); FLOWP=val('flow',0.0); SEAMK=val('seam',0.35); NIGHT=val('night',0.0)
    is_curb=sstep(0.2,0.3,PART); not_top=is_curb
    is_bottom=sstep(0.8,0.95,PART)
    band=ramp.outputs[0]
    # curb: band lifted to near white-gold
    curbc=node('ShaderNodeMix',data_type='RGBA'); Lk(band,curbc.inputs[6]); curbc.inputs[7].default_value=(1.0,0.93,0.75,1); curbc.inputs[0].default_value=0.62
    c1=node('ShaderNodeMix',data_type='RGBA'); Lk(math_('MULTIPLY',is_curb,math_('SUBTRACT',1.0,sstep(0.6,0.7,PART))),c1.inputs[0]); Lk(band,c1.inputs[6]); Lk(curbc.outputs[2],c1.inputs[7])
    # bottom: deeper violet
    botc=node('ShaderNodeMix',data_type='RGBA',blend_type='MULTIPLY'); botc.inputs[0].default_value=1; Lk(band,botc.inputs[6]); botc.inputs[7].default_value=(0.55,0.5,0.85,1)
    c2=node('ShaderNodeMix',data_type='RGBA'); Lk(is_bottom,c2.inputs[0]); Lk(c1.outputs[2],c2.inputs[6]); Lk(botc.outputs[2],c2.inputs[7])
    # facet light: shade * (0.8 + 0.28*max(0,N.L))
    geo=node('ShaderNodeNewGeometry'); dp=node('ShaderNodeVectorMath',operation='DOT_PRODUCT'); dp.inputs[1].default_value=(-0.35,-0.45,0.82); Lk(geo.outputs['Normal'],dp.inputs[0])
    lit=math_('ADD',0.8,math_('MULTIPLY',math_('MAXIMUM',dp.outputs['Value'],0.0),0.28)); lit=math_('MULTIPLY',lit,SHADE)
    shaded=node('ShaderNodeMix',data_type='RGBA',blend_type='MULTIPLY'); shaded.inputs[0].default_value=1; Lk(c2.outputs[2],shaded.inputs[6])
    litc=node('ShaderNodeCombineColor'); [Lk(lit,litc.inputs[i]) for i in range(3)]; Lk(litc.outputs[0],shaded.inputs[7])
    # top-only details: light seams every 1.2 m, a soft flowing streak (UV scroll), sparkle grains
    top=math_('SUBTRACT',1.0,sstep(0.1,0.2,PART))
    fr=math_('FRACT',math_('DIVIDE',S,1.2)); dseam=math_('MINIMUM',fr,math_('SUBTRACT',1.0,fr))
    seam=math_('MULTIPLY',math_('SUBTRACT',1.0,sstep(0.012,0.035,dseam)),top)
    # seam is a hairline only across the inner 80 % of the width
    seam=math_('MULTIPLY',seam,math_('MULTIPLY',sstep(0.04,0.1,U),math_('SUBTRACT',1.0,sstep(0.9,0.96,U))))
    ff=math_('FRACT',math_('DIVIDE',math_('SUBTRACT',S,FLOWP),7.0))
    streak=math_('MULTIPLY',sstep(0.0,0.12,ff),math_('SUBTRACT',1.0,sstep(0.12,0.42,ff)))
    cmb=node('ShaderNodeCombineXYZ'); Lk(math_('MULTIPLY',U,2.1),cmb.inputs[0]); Lk(S,cmb.inputs[1])
    noi=node('ShaderNodeTexVoronoi'); noi.inputs['Scale'].default_value=9.0; Lk(cmb.outputs[0],noi.inputs['Vector'])
    spark=math_('MULTIPLY',math_('SUBTRACT',1.0,sstep(0.035,0.07,noi.outputs['Distance'])),math_('MULTIPLY',top,0.55))
    glow=math_('ADD',math_('ADD',math_('MULTIPLY',seam,SEAMK),math_('MULTIPLY',streak,math_('ADD',0.22,math_('MULTIPLY',NIGHT,0.25)))),spark)
    addw=node('ShaderNodeMix',data_type='RGBA',blend_type='ADD'); Lk(glow,addw.inputs[0]); Lk(shaded.outputs[2],addw.inputs[6]); addw.inputs[7].default_value=(1.0,0.97,0.9,1)
    em=node('ShaderNodeEmission'); Lk(addw.outputs[2],em.inputs[0]); Lk(EMIT,em.inputs[1])
    # alpha: part alpha * end dissolve. Dissolve cells (≈ petal-sized, 0.28 m) drop out by their random value as FADE -> 0
    pa=math_('SUBTRACT',ALPHA,math_('MULTIPLY',is_curb,-0.08)); pa=math_('SUBTRACT',pa,math_('MULTIPLY',is_bottom,0.18))
    vor=node('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value=3.6; Lk(cmb.outputs[0],vor.inputs['Vector'])
    rnd=node('ShaderNodeSeparateColor'); Lk(vor.outputs['Color'],rnd.inputs[0])
    keep=sstep(0.0,0.08,math_('SUBTRACT',math_('MULTIPLY',FADE,1.35),rnd.outputs[0]))
    # cells also shrink into rounded petals (distance to cell centre) while dissolving
    shrink=math_('SUBTRACT',1.0,sstep(0.36,0.5,math_('ADD',vor.outputs['Distance'],math_('MULTIPLY',math_('SUBTRACT',1.0,FADE),0.3))))
    shrink=math_('MAXIMUM',shrink,sstep(0.85,1.0,FADE))
    a=math_('MULTIPLY',math_('MULTIPLY',pa,keep),math_('MULTIPLY',shrink,sstep(0.0,0.12,FADE)))
    tr=node('ShaderNodeBsdfTransparent'); mx=node('ShaderNodeMixShader'); Lk(a,mx.inputs[0]); Lk(tr.outputs[0],mx.inputs[1]); Lk(em.outputs[0],mx.inputs[2])
    out=node('ShaderNodeOutputMaterial'); Lk(mx.outputs[0],out.inputs[0])
    return m
def additive_material(name,color=None,use_attr=True):
    m=bpy.data.materials.new(name); m.use_nodes=True; m.surface_render_method='BLENDED'; nt=m.node_tree; N=nt.nodes; N.clear(); Lk=nt.links.new
    out=N.new('ShaderNodeOutputMaterial'); ad=N.new('ShaderNodeAddShader'); tr=N.new('ShaderNodeBsdfTransparent'); em=N.new('ShaderNodeEmission')
    Lk(tr.outputs[0],ad.inputs[0]); Lk(em.outputs[0],ad.inputs[1]); Lk(ad.outputs[0],out.inputs[0])
    v=N.new('ShaderNodeValue'); v.label='halo'; v.outputs[0].default_value=1.0; PARAMS.setdefault('halo_'+name,[]).append(v)
    if use_attr:
        ca=N.new('ShaderNodeVertexColor'); ca.layer_name='Col'; mul=N.new('ShaderNodeMath'); mul.operation='MULTIPLY'
        Lk(ca.outputs['Alpha'],mul.inputs[0]); Lk(v.outputs[0],mul.inputs[1]); Lk(ca.outputs[0],em.inputs[0]); Lk(mul.outputs[0],em.inputs[1])
    else:
        em.inputs[0].default_value=(*color,1); Lk(v.outputs[0],em.inputs[1])
    return m
BRM=bridge_material('M_rainbow_bridge')
bridge,binfo=build_bridge('rainbow_bridge_deck')
bridge.data.materials.append(BRM)
for p in bridge.data.polygons: p.use_smooth=False
LOG['bridge_tris']=sum(len(p.vertices)-2 for p in bridge.data.polygons); LOG['bridge_verts']=len(bridge.data.vertices); LOG['bridge_rings']=len(stations())
LOG['clearance']=binfo
# ---------------- end caps: ground halo (conforming grid), petals on the grass, rainbow flowers ----------------
def hue_at(u):
    u=max(0,min(1,u))*6; i=min(5,int(u)); f=u-i; a=BAND[i]; b=BAND[i+1]; return tuple(a[k]+(b[k]-a[k])*f for k in range(3))
def end_cap(name,tip,dirv):
    """tip: bridge end point on the ground; dirv: horizontal unit vector pointing from the bridge OUT onto the land."""
    side=Vector((dirv.y,-dirv.x,0)); bm=bmesh.new(); col=bm.loops.layers.float_color.new('Col'); NX,NY=8,6; vs={}
    for i in range(NX+1):
        for j in range(NY+1):
            a=-1.6+3.9*i/NX; b=(j/NY-.5)*2*1.75                        # along -1.6 (under the bridge) .. +2.3 m onto the land
            p=tip+dirv*a+side*b; z=ground(p.x,p.y)+0.025
            r=math.hypot(max(0,a-0.2)/2.1 if a>0.2 else (0.2-a)/1.6, b/1.75); al=(1-ss(0.15,1.0,r))
            vs[i,j]=(bm.verts.new((p.x,p.y,z)),hue_at(0.5-b/2.4),al)
    for i in range(NX):
        for j in range(NY):
            q=[vs[i,j],vs[i+1,j],vs[i+1,j+1],vs[i,j+1]]; f=bm.faces.new([x[0] for x in q])
            for lp,x in zip(f.loops,q): lp[col]=(*x[1],x[2]*0.55)
    zs=[v.co.z for v in bm.verts]; LOG.setdefault('halo_z',{})[name]=[round(min(zs),3),round(max(zs),3),round(tip.z,3)]
    me=bpy.data.meshes.new(name+'_halo'); bm.to_mesh(me); bm.free(); halo=link(me,name+'_halo'); halo.data.materials.append(additive_material('M_rb_halo'))
    # petals lying on the grass + small rainbow flowers (static, merged = 1 mesh)
    bm=bmesh.new(); col=bm.loops.layers.float_color.new('Col'); np_=0; nf=0
    def petal(c,center,size,rot,tilt=0.0,lift=0.012):
        pts=[(0,1),(0.55,0.55),(0.5,-0.2),(0,-0.75),(-0.5,-0.2),(-0.55,0.55)]
        ca,sa=math.cos(rot),math.sin(rot); vv=[]
        for x,y in pts:
            x*=size*0.6;y*=size
            vv.append(bm.verts.new((center.x+x*ca-y*sa, center.y+x*sa+y*ca, center.z+lift+tilt*y)))
        f=bm.faces.new(vv)
        for lp in f.loops: lp[col]=(*c,1.0)
    for k in range(34):
        a=random.uniform(-1.2,2.3); b=random.gauss(0,0.75)*(0.6+0.25*max(0,a))
        p=tip+dirv*a+side*b; p=Vector((p.x,p.y,ground(p.x,p.y))); u=0.5-b/2.4
        if a<-0.2 and abs(b)<1.0: p.z=max(p.z,0)                         # under the dissolving deck: still on the ground
        petal(hue_at(u+random.uniform(-.12,.12)),p,random.uniform(.05,.085),random.uniform(0,6.3),tilt=random.uniform(-.25,.25)); np_+=1
    for k in range(11):
        a=random.uniform(0.3,2.2); b=random.choice([-1,1])*random.uniform(0.9,1.8)
        p=tip+dirv*a+side*b
        if on_path(p.x,p.y): continue
        g=ground(p.x,p.y); h=random.uniform(.10,.18); c=hue_at(random.random())
        # stem: thin triangle prism (3 tris)
        s0=bm.verts.new((p.x-.008,p.y,g-0.01)); s1=bm.verts.new((p.x+.008,p.y,g-0.01)); s2=bm.verts.new((p.x,p.y,g+h))
        f=bm.faces.new((s0,s1,s2)); [lp.__setitem__(col,(0.2,0.55,0.18,1)) for lp in f.loops]
        s3=bm.verts.new((p.x,p.y-.008,g-0.01)); s4=bm.verts.new((p.x,p.y+.008,g-0.01)); f=bm.faces.new((s3,s4,s2)); [lp.__setitem__(col,(0.2,0.55,0.18,1)) for lp in f.loops]
        top=Vector((p.x,p.y,g+h))
        for q in range(5):
            r=q/5*2*math.pi; petal(c,top+Vector((math.cos(r)*.035,math.sin(r)*.035,0)),.045,r-math.pi/2,tilt=0.35,lift=0)
        cv=[bm.verts.new((top.x+math.cos(q/5*6.283)*.018,top.y+math.sin(q/5*6.283)*.018,top.z+.012)) for q in range(5)]
        f=bm.faces.new(cv); [lp.__setitem__(col,(1.0,0.92,0.55,1)) for lp in f.loops]; nf+=1
    me=bpy.data.meshes.new(name+'_petals'); bm.to_mesh(me); bm.free(); pet=link(me,name+'_petals')
    m=bpy.data.materials.new('M_rb_petal'); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; N.clear()
    o_=N.new('ShaderNodeOutputMaterial'); e=N.new('ShaderNodeEmission'); ca=N.new('ShaderNodeVertexColor'); ca.layer_name='Col'; v=N.new('ShaderNodeValue'); v.label='petal'; v.outputs[0].default_value=1.0; PARAMS.setdefault('petal',[]).append(v)
    nt.links.new(ca.outputs[0],e.inputs[0]); nt.links.new(v.outputs[0],e.inputs[1]); nt.links.new(e.outputs[0],o_.inputs[0]); pet.data.materials.append(m)
    return halo,pet,np_,nf
tipE=path(L)+Vector((0,0,0)); tipS=path(0)
haloE,petE,npE,nfE=end_cap('rb_end',Vector((tipE.x,tipE.y-0.3,tipE.z)),Vector((0,1,0)))
haloS,petS,npS,nfS=end_cap('rb_start',Vector((tipS.x,tipS.y+0.3,tipS.z)),Vector((0,-1,0)))
LOG['endcap']={'halo_tris':len(haloE.data.polygons)*2,'petal_mesh_tris':sum(len(p.vertices)-2 for p in petE.data.polygons),'ground_petals':npE,'flowers':nfE}
# ---------------- runtime particle stand-ins (what the ParticleSystem will show in a single frame) ----------------
MOTE=additive_material('M_rb_mote',(1.0,0.85,0.55),use_attr=False)
PF=bpy.data.materials.new('M_rb_fall'); PF.use_nodes=True
def particles(tip,dirv,tag):
    side=Vector((dirv.y,-dirv.x,0)); objs=[]
    for k in range(20):                     # light motes: drift up from the last 2.5 m of deck and the halo
        a=random.uniform(-2.5,1.0); b=random.uniform(-1.2,1.2); p=tip+dirv*a+side*b
        z=max(ground(p.x,p.y),path(max(0,min(L,(p.y-START.y))) ).z if a<0 else ground(p.x,p.y))+random.uniform(.15,1.5)
        o=ico((p.x,p.y,z),random.uniform(.010,.02),(1,1,1),sub=2,name='mote_'+tag,mat=MOTE); objs.append(o)
    for k in range(14):                     # petals falling off the dissolving edge
        a=random.uniform(-2.2,0.6); b=random.uniform(-1.1,1.1); p=tip+dirv*a+side*b; g=ground(p.x,p.y)
        z=g+random.uniform(.08,.9); c=hue_at(0.5-b/2.4)
        bpy.ops.mesh.primitive_circle_add(vertices=6,radius=.05,fill_type='NGON',location=(p.x,p.y,z),rotation=(random.uniform(0,3),random.uniform(0,3),random.uniform(0,3)))
        o=bpy.context.object; o.scale=(0.6,1,1); o.data.materials.append(unlit('fall%d'%int(c[0]*10+c[1]*3),c,a=0.92)); o.name='fall_'+tag; objs.append(o)
    return objs
PARTS=particles(Vector((tipE.x,tipE.y,tipE.z)),Vector((0,1,0)),'E')+particles(Vector((tipS.x,tipS.y,tipS.z)),Vector((0,-1,0)),'S')
# edge motes along the curbs
for k in range(26):
    s=random.uniform(2.5,L-2.5); p=path(s); sd=random.choice([-1,1])
    PARTS.append(ico((sd*random.uniform(1.0,1.5),p.y,p.z+random.uniform(-.3,.9)),random.uniform(.010,.018),(1,1,1),sub=2,name='mote_edge',mat=MOTE))
NEW=[bridge,haloE,petE,haloS,petS]+PARTS
for o in NEW: o.visible_shadow=False
# ---------------- CURRENT bridge (RegionJourneyAdapter.rainbowBridge: 7 flat strips, lit standard, sin arch) ----------------
CUR=[]
cols=['#e88c92','#efaf83','#f3d990','#a5d6ac','#8ccbd5','#9aaee0','#c3a4df']
for band,hx in enumerate(cols):
    c=srgb2lin(tuple(int(hx[i:i+2],16)/255 for i in (1,3,5)))
    bm=bmesh.new(); prev=None
    for i in range(33):
        s=L*i/32; p=path(s,new=False)-Vector((0,0,0.015))
        v=[bm.verts.new((p.x+(band/7-.5)*W,p.y,p.z)),bm.verts.new((p.x+((band+1)/7-.5)*W,p.y,p.z))]
        if prev: bm.faces.new((prev[0],prev[1],v[1],v[0]))
        prev=v
    me=bpy.data.meshes.new('cur%d'%band); bm.to_mesh(me); bm.free(); o=link(me,'RainbowBridgeStrip%d'%band)
    m=bpy.data.materials.new('cur%d'%band); m.use_nodes=True; b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=(*c,1); b.inputs['Roughness'].default_value=.9
    o.data.materials.append(m); CUR.append(o)
sunD=bpy.data.lights.new('sun','SUN'); sunD.energy=3.2; sunO=bpy.data.objects.new('sun',sunD); sc.collection.objects.link(sunO); sunO.rotation_euler=(R(40),R(-20),R(30))
# ---------------- character stand-in (阿芳 silhouette: yellow dress, straw hat) ----------------
def heroine(p,yaw=0.0):
    objs=[]
    def add(o): objs.append(o); return o
    bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=.34,radius2=.12,depth=.78,location=(p.x,p.y,p.z+.55)); add(bpy.context.object).data.materials.append(unlit('dress',(1.0,0.86,0.12)))
    bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.11,depth=.32,location=(p.x,p.y,p.z+1.07)); add(bpy.context.object).data.materials.append(unlit('dress',(1.0,0.86,0.12)))
    for sx in (-.08,.08):
        bpy.ops.mesh.primitive_cylinder_add(vertices=5,radius=.035,depth=.2,location=(p.x+sx,p.y,p.z+.1)); add(bpy.context.object).data.materials.append(unlit('skin',(0.96,0.8,0.68)))
    add(ico((p.x,p.y,p.z+1.36),.13,(0.96,0.8,0.68),sub=2,name='head'))
    add(ico((p.x,p.y+.03,p.z+1.38),.135,(0.25,0.15,0.1),sub=2,s=(1,1,.95),name='hair'))
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.27,depth=.025,location=(p.x,p.y,p.z+1.47)); add(bpy.context.object).data.materials.append(unlit('hat',(0.85,0.7,0.42)))
    bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=.13,depth=.12,location=(p.x,p.y,p.z+1.53)); add(bpy.context.object).data.materials.append(unlit('hat',(0.85,0.7,0.42)))
    return objs
# ---------------- world (day / night) ----------------
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; nt=w.node_tree; Nw=nt.nodes
bg=Nw['Background']; tc=Nw.new('ShaderNodeTexCoord'); sp=Nw.new('ShaderNodeSeparateXYZ'); ramp=Nw.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Generated'],sp.inputs[0]); zz=Nw.new('ShaderNodeMapRange'); zz.inputs[1].default_value=-1; zz.inputs[2].default_value=1; nt.links.new(sp.outputs[2],zz.inputs[0]); nt.links.new(zz.outputs[0],ramp.inputs[0])
star=Nw.new('ShaderNodeTexVoronoi'); star.inputs['Scale'].default_value=260; nt.links.new(tc.outputs['Generated'],star.inputs['Vector'])
smr=Nw.new('ShaderNodeMapRange'); smr.inputs[1].default_value=0.06; smr.inputs[2].default_value=0.0; nt.links.new(star.outputs['Distance'],smr.inputs[0])
sm=Nw.new('ShaderNodeMath'); sm.operation='MULTIPLY'; nt.links.new(smr.outputs[0],sm.inputs[0]); STAR=sm.inputs[1]
add=Nw.new('ShaderNodeMix'); add.data_type='RGBA'; add.blend_type='ADD'; nt.links.new(sm.outputs[0],add.inputs[0]); nt.links.new(ramp.outputs[0],add.inputs[6]); add.inputs[7].default_value=(1,1,1,1)
nt.links.new(add.outputs[2],bg.inputs[0])
def set_sky(stops,stars):
    e=ramp.color_ramp
    while len(e.elements)>2: e.elements.remove(e.elements[-1])
    e.elements[0].position=stops[0][0]; e.elements[0].color=(*srgb2lin(stops[0][1]),1); e.elements[1].position=stops[-1][0]; e.elements[1].color=(*srgb2lin(stops[-1][1]),1)
    for p,c in stops[1:-1]: e.elements.new(p).color=(*srgb2lin(c),1)
    STAR.default_value=stars
def mode(night):
    tint_all()
    for n in NIGHT_NODES: n.inputs[0].default_value=1.0 if night else 0.0
    sunD.energy=0.9 if night else 3.2; sunD.color=(0.6,0.7,1.0) if night else (1,0.97,0.92)
    if night: set_sky([(0.45,(0.06,0.09,0.22)),(0.52,(0.10,0.15,0.33)),(0.75,(0.04,0.06,0.17)),(1.0,(0.02,0.03,0.10))],0.9)
    else: set_sky([(0.45,(0.62,0.86,0.95)),(0.52,(0.52,0.80,0.96)),(0.75,(0.24,0.58,0.92)),(1.0,(0.13,0.42,0.86))],0.0)
    P=lambda k,v:[setattr(n.outputs[0],'default_value',v) for n in PARAMS.get(k,[])]
    P('emit',1.45 if night else 1.0); P('alpha',0.80 if night else 0.88); P('seam',0.55 if night else 0.32); P('night',1.0 if night else 0.0)
    P('halo_M_rb_halo',1.1 if night else 0.32); P('halo_M_rb_mote',4.0 if night else 1.6); P('petal',1.15 if night else 0.95)
def show(objs,on):
    for o in objs: o.hide_render=not on
# ---------------- cameras ----------------
cam_d=bpy.data.cameras.new('cam'); cam_d.sensor_fit='VERTICAL'; cam=bpy.data.objects.new('cam',cam_d); sc.collection.objects.link(cam); sc.camera=cam
cam_d.clip_start=0.05; cam_d.clip_end=600
def look(pos,tgt,fov=48):
    cam.location=pos; d=(Vector(tgt)-Vector(pos)); cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler(); cam_d.angle_y=R(fov)
def lens(s,new=True):   # RegionJourneyCore JOURNEY_CAMERA: back 6.6, side -2.4 (her right), up 3.4, lead 1.2, look 2.4, fov 48
    p=path(s,new); h=Vector((0,1,0)); right=Vector((1,0,0))
    look(p-h*6.6+right*2.4+Vector((0,0,3.4)), p+h*1.2+Vector((0,0,2.4)),48)
HER=[]
def place_her(s,new=True):
    global HER
    for o in HER: bpy.data.objects.remove(o,do_unlink=True)
    p=path(s,new)
    if new:
        d=min(s,L-s)
        if d<END+1: p=p+Vector((0,0,0.03*(1-ss(0.6,END,d))))
    HER=heroine(p)
def render(name):
    sc.render.filepath=os.path.join(OUT,name+'.png'); bpy.ops.render.render(write_still=True); print('RENDERED',name,flush=True)
SH={
 'cur_day_lens':   lambda:(show(NEW,0),show(CUR,1),mode(0),place_her(7,False),lens(7,False)),
 'new_day_lens':   lambda:(show(NEW,1),show(CUR,0),mode(0),place_her(7),lens(7)),
 'new_night_lens': lambda:(show(NEW,1),show(CUR,0),mode(1),place_her(7),lens(7)),
 'cur_day_land':   lambda:(show(NEW,0),show(CUR,1),mode(0),place_her(20.8,False),lens(20.8,False)),
 'new_day_land':   lambda:(show(NEW,1),show(CUR,0),mode(0),place_her(20.8),lens(20.8)),
 'new_night_land': lambda:(show(NEW,1),show(CUR,0),mode(1),place_her(20.8),lens(20.8)),
 'close_end_day':  lambda:(show(NEW,1),show(CUR,0),mode(0),place_her(-50),look((-2.0,-16.4,3.3),(0.1,-21.6,1.15),46)),
 'close_end_night':lambda:(show(NEW,1),show(CUR,0),mode(1),place_her(-50),look((-2.0,-16.4,3.3),(0.1,-21.6,1.15),46)),
 'cur_close_end':  lambda:(show(NEW,0),show(CUR,1),mode(0),place_her(-50),look((-2.0,-16.4,3.3),(0.1,-21.6,1.15),46)),
 'close_start_day':lambda:(show(NEW,1),show(CUR,0),mode(0),place_her(-50),look((2.4,-49.2,3.5),(0.0,-42.4,1.2),46)),
 'close_start_night':lambda:(show(NEW,1),show(CUR,0),mode(1),place_her(-50),look((2.4,-49.2,3.5),(0.0,-42.4,1.2),46)),
 'qa_seam_end':    lambda:(show(NEW,1),show(CUR,0),mode(0),place_her(-50),look((-1.4,-18.9,1.55),(0.1,-21.4,1.2),42)),
 'qa_side_span':   lambda:(show(NEW,1),show(CUR,0),mode(0),place_her(-50),look((9.5,-32,1.6),(0,-32,2.2),50)),
 'qa_under':       lambda:(show(NEW,1),show(CUR,0),mode(0),place_her(-50),look((2.2,-35.5,0.9),(0,-31,2.6),55)),
}
def place_none(): pass
_old=place_her
def place_her(s,new=True):
    if s<0:
        global HER
        for o in HER: bpy.data.objects.remove(o,do_unlink=True)
        HER=[]; return
    _old(s,new)
order=(list(SH)+['export']) if SHOTS=='all' else SHOTS.split(',')
os.makedirs(OUT,exist_ok=True)
if 'export' in order:
    order.remove('export')
    ex=os.path.join(OUT,'..','export'); os.makedirs(ex,exist_ok=True)
    for objs,fn in (([bridge],'rb_deck_sample.glb'),([haloE,petE],'rb_endcap_meadow.glb'),([haloS,petS],'rb_endcap_island.glb')):
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.hide_render=False; o.hide_viewport=False; o.select_set(True)
            ca=o.data.color_attributes
            if 'Col' in ca: ca.active_color=ca['Col']; ca.render_color_index=ca.active_color_index
        kw=dict(filepath=os.path.join(ex,fn),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='PLACEHOLDER',export_normals=(fn=='rb_deck_sample.glb'))
        for extra in (dict(export_vertex_color='ACTIVE',export_all_vertex_colors=False),dict(export_vertex_color='ACTIVE'),dict(export_colors=True),{}):
            try: bpy.ops.export_scene.gltf(**kw,**extra); break
            except TypeError as e: print('gltf kw retry',e)
        LOG.setdefault('glb',{})[fn]=os.path.getsize(os.path.join(ex,fn))
for k in order:
    SH[k](); render(k)
json.dump(LOG,open(os.path.join(OUT,'..','qa','blender_log_%s.json'%('all' if SHOTS=='all' else str(abs(hash(SHOTS))%10000))),'w'),indent=1)
print('ALLDONE',json.dumps({k:v for k,v in LOG.items() if k!='clearance'}),flush=True)
