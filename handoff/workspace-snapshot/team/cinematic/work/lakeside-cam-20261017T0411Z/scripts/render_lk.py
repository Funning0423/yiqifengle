# Blender preview of the lakeside journey/landing/board cameras. Lakeside = art/regions/lakeside/blend/lakeside_r5h3.blend
# (the source of the region_lakeside GLBs + transforms), placed as LakesideCameraLayout does (yaw 180, root from the plan);
# island = static_seat_preview/room/room_no_original_chair.glb + 2 palms (IslandPropsLayout) at the world origin;
# her = repo character GLB, walk_loop phase from distance; rainbow bridge = 7 strips on the route like rainbowBridge().
# World frame: Cocos (x,y,z) -> Blender (x,-z,y). Resumable: existing frames are skipped.
import bpy,json,sys,math,os
from mathutils import Vector,Matrix,Euler
argv=sys.argv[sys.argv.index('--')+1:];A=dict(zip(argv[0::2],argv[1::2]))
plan=json.load(open(A['plan']));W,H=int(A['W']),int(A['H']);mode=A.get('mode','journey');out=A['out'];os.makedirs(out,exist_ok=True)
WT='/workspace/wechat-game/work/wt-lk/creator-build-project/assets/bundles/'
B=lambda p:Vector((p[0],-p[2],p[1]))
sc=bpy.context.scene
SKIP=set(json.load(open(os.path.dirname(os.path.abspath(A['plan']))+'/skip_names.json')))  # the live lease drops 3D pieces / contact shadows / ripple rings / frame (2D board draws them)
for ob in sc.objects:
    if ob.name.startswith('FX_fog') or ob.name.startswith('FX_ripple') or ob.name in SKIP:ob.hide_render=True
# lakeside root
roots=[o for o in sc.objects if o.parent is None]
lk=bpy.data.objects.new('LK_ROOT',None);sc.collection.objects.link(lk)
for o in roots:
    if o.type=='CAMERA':continue
    o.parent=lk
lk.location=B(plan['root']);lk.rotation_euler=(0,0,math.radians(plan['yawDeg']))
def imp(path,name,loc=(0,0,0),yaw=0,scale=1):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=path);new=[o for o in bpy.data.objects if o not in before]
    e=bpy.data.objects.new(name,None);sc.collection.objects.link(e)
    for o in new:
        if o.parent is None:o.parent=e
    e.location=B(loc);e.rotation_euler=(0,0,math.radians(yaw));e.scale=(scale,scale,scale);return e,new
if mode=='journey':
    imp(WT+'static_seat_preview/room/room_no_original_chair.glb','ISLAND')
    imp(WT+'region_island/ui-props/beach_palm_tall.glb','PALM_T',(-0.5,-0.3,9),200,.9)
    imp(WT+'region_island/ui-props/beach_palm_short.glb','PALM_S',(7,-0.36,7.4),180,1)
    her,hnew=imp(WT+'region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb','HER')
    arm=[o for o in hnew if o.type=='ARMATURE'][0]
    act=bpy.data.actions.get('walk_loop') or [a for a in bpy.data.actions if a.name.startswith('walk_loop')][0]
    arm.animation_data_create();arm.animation_data.action=act
    for tr in arm.animation_data.nla_tracks:arm.animation_data.nla_tracks.remove(tr)
    f0,f1=act.frame_range
    # rainbow bridge strips
    P=plan['path'];cum=[0]
    for i in range(1,len(P)):cum.append(cum[-1]+math.dist(P[i-1],P[i]))
    br=[p for p,c in zip(P,cum) if plan['bridgeStart']-1e-6<=c<=plan['bridgeEnd']+1e-6]
    cols=['#e88c92','#efaf83','#f3d990','#a5d6ac','#8ccbd5','#9aaee0','#c3a4df'];w=2.1
    for band,col in enumerate(cols):
        verts=[];faces=[]
        for i,p in enumerate(br):
            a=br[max(0,i-1)];b=br[min(len(br)-1,i+1)];dx=b[0]-a[0];dz=b[2]-a[2];L=math.hypot(dx,dz) or 1
            for side in (band/7-.5,(band+1)/7-.5):verts.append(B((p[0]+dz/L*side*w,p[1]-.015,p[2]-dx/L*side*w)))
            if i:j=i*2;faces.append((j-2,j-1,j+1,j))
        me=bpy.data.meshes.new('RB%d'%band);me.from_pydata(verts,[],faces);ob=bpy.data.objects.new('RB%d'%band,me);sc.collection.objects.link(ob)
        m=bpy.data.materials.new('RBm%d'%band);m.use_nodes=True;bs=m.node_tree.nodes['Principled BSDF'];h=col.lstrip('#');rgb=[(int(h[k:k+2],16)/255)**2.2 for k in (0,2,4)]
        bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.9;ob.data.materials.append(m)
    # open sea under the island/bridge gap (preview only), at the lakeside lake level
    bpy.ops.mesh.primitive_plane_add(size=400,location=(0,-40,-0.62));sea=bpy.context.object;lm=bpy.data.materials.get('M_LK_lake') or next((m for m in bpy.data.materials if 'lake' in m.name.lower()),None)
    if lm:sea.data.materials.append(lm)
cam=bpy.data.cameras.new('PREV');cam.sensor_fit='VERTICAL';co=bpy.data.objects.new('PREV',cam);sc.collection.objects.link(co);sc.camera=co;cam.clip_start=.1;cam.clip_end=1000
sc.render.resolution_x=W;sc.render.resolution_y=H;sc.render.resolution_percentage=100
e=sc.eevee
# preview speed: Cocos uses no volumetrics/raytracing (COCOS_HANDOFF §7), so those are off here as well
for k,v in (('taa_render_samples',int(A.get('samples','8'))),('use_raytracing',A.get('rt','1')=='1'),('use_volumetric_shadows',False),('volumetric_samples',8),('volumetric_tile_size','16'),('shadow_resolution_scale',.5),('use_fast_gi',False)):
    try:setattr(e,k,v)
    except Exception as ex:print('eevee',k,ex)
def setcam(p,t,fov):
    co.location=B(p);d=(B(t)-B(p)).normalized();co.rotation_euler=d.to_track_quat('-Z','Y').to_euler();cam.angle_y=math.radians(fov)
if mode=='journey':
    var=A['variant'];a,b,st=[int(x) for x in A.get('frames','0:100000:1').split(':')]
    for fr in plan['frames'][a:b:st]:
        fn=os.path.join(out,'f%05d.png'%fr['i'])
        if os.path.exists(fn) and os.path.getsize(fn)>0:continue
        her.location=B(fr['root']);her.rotation_euler=(0,0,fr['yaw'])
        cyc=1.43*0.7;ph=(fr['s']/cyc)%1.0 if fr['walking'] else 0.0
        sc.frame_set(int(round(f0+ph*(f1-f0))))
        if not fr['walking']:
            idle=bpy.data.actions.get('idle_breathing_loop')
            if idle:arm.animation_data.action=idle;sc.frame_set(int(idle.frame_range[0]))
        c=fr['cams'][var];setcam(c['p'],c['t'],c['fov'])
        if 'pose' in A:  # still override: world pose plan['board'][size][kind] (boardWorld / landing / fallbackEnd), her as in this frame
            sz,kd=A['pose'].split(':');z=plan['board'][sz][kd];setcam(z['position'],z['target'],z.get('fovVerticalDeg',48))
        sc.render.filepath=fn+'.tmp.png';bpy.ops.render.render(write_still=True);os.replace(fn+'.tmp.png',fn)
else:
    # board stills (lakeside alone, local frame = world with root at origin is NOT used: root applied, so convert poses)
    bp=plan['board'][A['size']];kind=A['kind']
    def L2W(p):
        x,y,z=p;c=math.cos(math.radians(plan['yawDeg']));s=math.sin(math.radians(plan['yawDeg']));r=plan['root'];return [c*x+s*z+r[0],y+r[1],-s*x+c*z+r[2]]
    if kind=='new':pz=bp['new'];setcam(L2W(pz['position']),L2W(pz['target']),pz['fovVerticalDeg'])
    else:
        h=bp['handoff'];p=h['position'];f=h['forward'];setcam(L2W(p),L2W([p[0]+f[0]*8,p[1]+f[1]*8,p[2]+f[2]*8]),h['fovVerticalDeg'])
    sc.render.filepath=os.path.join(out,A['name']);bpy.ops.render.render(write_still=True)
