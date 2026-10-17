import bpy, json, sys, math, mathutils, numpy as np
cfg=json.load(open(sys.argv[sys.argv.index('--')+1])); out=sys.argv[sys.argv.index('--')+2]; do_render=sys.argv[sys.argv.index('--')+3]=='1'
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def cc(v): return mathutils.Vector((v[0],-v[2],v[1]))
def imp(p):
    b=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=p); return [o for o in bpy.data.objects if o not in b]
for o in imp(cfg['island']):
    if any(h in o.name for h in cfg['hide']): o.hide_render=True; o.hide_set(True); o.hide_viewport=True
def place(it,name):
    objs=imp(it['glb']); E=bpy.data.objects.new(name,None); sc.collection.objects.link(E)
    for r in [o for o in objs if o.parent is None]: r.parent=E
    if 'mcc' in it:
        Cc=mathutils.Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1))); E.matrix_world=Cc@mathutils.Matrix(it['mcc'])@Cc.inverted(); return objs
    E.location=cc(it['pos']); E.rotation_euler=(0,0,math.radians(it.get('yaw',0))); s=it.get('scale',1); E.scale=(s,s,s); return objs
for it in cfg['props']: place(it,it['name'])
if cfg.get('legs'):
    L=cfg['legs']
    for o in [o for o in bpy.data.objects if o.type=='MESH' and o.parent and (o.parent.name=='signpost' or (o.parent.parent and o.parent.parent.name=='signpost'))]:
        o.data=o.data.copy(); n=0
        for v in o.data.vertices:
            if v.co.z<L['bottomBandM'] and v.co.x<L['splitX']: v.co.z-=L['leftExtendLocal']; n+=1
        print('LEGS',o.name,n)
for ch in cfg['chars']: place(ch,'char')
# backing plate (candidate B): a flat quad in front of the panel, same as the runtime Graphics rect
if cfg.get('plate'):
    st=cfg['plateStyle']; V=[tuple(cc(p)) for p in cfg['plate']]; me=bpy.data.meshes.new('plate'); me.from_pydata(V,[],[(0,1,2,3)]); me.update()
    ob=bpy.data.objects.new('signplate',me); sc.collection.objects.link(ob)
    m=bpy.data.materials.new('plate'); m.use_nodes=True; nt=m.node_tree; nt.nodes.clear(); o=nt.nodes.new('ShaderNodeOutputMaterial'); e=nt.nodes.new('ShaderNodeEmission')
    h=st['fill'].lstrip('#'); e.inputs[0].default_value=tuple(((int(h[i:i+2],16)/255)**2.2) for i in (0,2,4))+(1,); e.inputs[1].default_value=1.0; nt.links.new(e.outputs[0],o.inputs[0]); me.materials.append(m)
c=cfg['camera']; cam=bpy.data.cameras.new('cam'); cam.sensor_fit='VERTICAL'; cam.angle_y=math.radians(c['fov']); cam.clip_start=.05; cam.clip_end=1000
co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); sc.camera=co
qx,qy,qz,qw=c['quat']; Rcc=mathutils.Quaternion((qw,qx,qy,qz)).to_matrix()
Cm=mathutils.Matrix(((1,0,0),(0,0,-1),(0,1,0))); co.matrix_world=mathutils.Matrix.Translation(cc(c['pos']))@(Cm@Rcc).to_4x4()
W,H=cfg['res']; sc.render.resolution_x,sc.render.resolution_y=W,H; sc.render.resolution_percentage=100
bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get()
def root(o):
    n=o
    while n.parent and n.parent.name!='scene_root': n=n.parent
    if n.parent is None or n.name=='scene_root': return n.name.split('.')[0]
    return n.name.split('.')[0]
names=[]; idx={}
def rid(n):
    if n not in idx: idx[n]=len(names); names.append(n)
    return idx[n]
cam_pos=co.matrix_world.translation; Mr=co.matrix_world.to_3x3(); ty=math.tan(cam.angle_y/2); tx=ty*W/H
ids=np.full((H,W),-1,np.int16); behind=np.full((H,W),-1,np.int16)
for y in range(H):
    for x in range(W):
        d=Mr@mathutils.Vector(((2*(x+.5)/W-1)*tx,(1-2*(y+.5)/H)*ty,-1)); d.normalize()
        hit,loc,n,i,ob,_=sc.ray_cast(dg,cam_pos,d)
        if hit:
            r=root(ob); 
            if ob.name=='signplate': r='signpost'
            ids[y,x]=rid(r)
            if r=='signpost':
                p=loc+d*0.001
                for _ in range(12):
                    h2,l2,_,_,o2,_=sc.ray_cast(dg,p,d)
                    if not h2: break
                    r2=root(o2) if o2.name!='signplate' else 'signpost'
                    if r2!='signpost': behind[y,x]=rid(r2); break
                    p=l2+d*0.001
                # also record what is behind by object name for door
rid('env_lighthouse_door'); rid('env_lighthouse_ext')
np.save(out+'_ids.npy',ids); np.save(out+'_behind.npy',behind)
# feet ground
sign=bpy.data.objects['signpost']; signobjs=[o for o in bpy.data.objects if root(o)=='signpost']
for o in signobjs: o.hide_set(True)
bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get()
feet=[]
for f in cfg['feet']:
    p=cc(f)+mathutils.Vector((0,0,3)); h,l,_,_,ob,_=sc.ray_cast(dg,p,mathutils.Vector((0,0,-1)))
    feet.append({'foot_y':f[1],'ground_y':l.z if h else None,'ground_obj':ob.name if h else None})
for o in signobjs: o.hide_set(False)
bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get()
# min distance sign mesh verts -> camera
dmin=1e9
for o in signobjs:
    if o.type!='MESH': continue
    me=o.evaluated_get(dg).to_mesh(); mw=o.matrix_world
    for v in me.vertices: dmin=min(dmin,((mw@v.co)-cam_pos).length)
    o.evaluated_get(dg).to_mesh_clear()
# project text quad
def proj(p):
    v=Mr.transposed()@(cc(p)-cam_pos); return [((v.x/-v.z)/tx+1)/2*W,(1-(v.y/-v.z)/ty)/2*H]
json.dump({'names':names,'feet':feet,'sign_cam_min_m':dmin,'text_px':[proj(p) for p in cfg['text']['quad']],'plate_px':[proj(p) for p in cfg['plate']] if cfg.get('plate') else None},open(out+'_meta.json','w'))
if do_render:
    sun=bpy.data.lights.new('sun','SUN'); sun.energy=3.2; sun.color=(1,.97,.92); so=bpy.data.objects.new('sun',sun); sc.collection.objects.link(so)
    so.rotation_euler=(math.radians(50),0,math.radians(-35)); sun.angle=math.radians(8)
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(.55,.7,.8,1); bg.inputs[1].default_value=.9

    if cfg.get('night'):
        sun.energy=0.55; sun.color=(.62,.72,1.0); bg.inputs[0].default_value=(.035,.06,.14,1); bg.inputs[1].default_value=.55
        def tint(mn,k):
            m=bpy.data.materials.get(mn)
            if not m or not m.use_nodes: return
            nt=m.node_tree; bs=[n for n in nt.nodes if n.type in ('BSDF_PRINCIPLED','EMISSION','BACKGROUND')]
            for b in bs:
                inp=b.inputs[0]; mix=nt.nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1
                mix.inputs[2].default_value=k+(1,)
                if inp.is_linked: nt.links.new(inp.links[0].from_socket,mix.inputs[1])
                else: mix.inputs[1].default_value=inp.default_value
                nt.links.new(mix.outputs[0],inp)
        for mn,k in [('M_env_sky',(.16,.24,.45)),('M_env_cloud',(.55,.6,.8)),('M_env_sea',(.22,.3,.5)),('M_env_sea_foam',(.5,.55,.7))]: tint(mn,k)
        def emit(mn,col,st):
            m=bpy.data.materials.get(mn)
            if not m: return
            for b in m.node_tree.nodes:
                if b.type=='BSDF_PRINCIPLED': b.inputs['Emission Color'].default_value=col+(1,); b.inputs['Emission Strength'].default_value=st
        emit('M_env_window_view_unlit',(1,.72,.35),3.0); emit('M_signpost_lamp',(1,.62,.25),6.0)
        lg=[o for o in bpy.data.objects if o.name.startswith('lamp_glass')]
        for o in lg:
            pl=bpy.data.lights.new('lampL','POINT'); pl.energy=6*cfg['sign']['scale']; pl.color=(1,.65,.3); pl.shadow_soft_size=.05
            po=bpy.data.objects.new('lampL',pl); sc.collection.objects.link(po); po.location=o.matrix_world.translation+mathutils.Vector((0,-0.12,0))
        for nm in ('env_lighthouse','lighthouse'):
            pass
        top=[o for o in bpy.data.objects if 'lighthouse' in o.name.lower() and o.type=='MESH']
        if top:
            zs=max((o.matrix_world@mathutils.Vector(c)).z for o in top for c in o.bound_box); o=top[0]
            ctr=sum(((o.matrix_world@mathutils.Vector(c)) for c in o.bound_box),mathutils.Vector())/8
            pl=bpy.data.lights.new('lh','POINT'); pl.energy=40; pl.color=(1,.75,.4); po=bpy.data.objects.new('lh',pl); sc.collection.objects.link(po); po.location=(ctr.x,ctr.y,zs-0.9)
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=int(cfg.get('samples',32)); sc.cycles.use_denoising=True; sc.render.threads_mode='FIXED'; sc.render.threads=2
    sc.view_settings.view_transform='Standard'; sc.render.filepath=out+'_raw.png'; bpy.ops.render.render(write_still=True)
print('DONE',out)
