import bpy, math, sys, mathutils
argv=sys.argv[sys.argv.index('--')+1:]; angles=[float(a) for a in argv[0].split(',')]; outdir=argv[1]
A='/workspace/wechat-game/yiqifengle-result/creator-build-project/assets/bundles/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=A+'static_seat_preview/room/room_no_original_chair.glb')
pal=None
for m in bpy.data.materials:
    if 'palette' in m.name.lower() and m.node_tree and any(n.type=='TEX_IMAGE' for n in m.node_tree.nodes): pal=m; break
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=A+'board_art/chest/result_chest.glb')
print('palette', pal.name if pal else None, [(o.name, o.parent.name if o.parent else None, o.type) for o in bpy.data.objects])
for o in bpy.data.objects:
    if o.type=='MESH' and pal:
        o.data.materials.clear(); o.data.materials.append(pal)
for o in bpy.data.objects: o.animation_data_clear()
lid=bpy.data.objects.get('chest_lid')
rest=None
if lid:
    lid.rotation_mode='QUATERNION'; rest=lid.rotation_quaternion.copy()
# camera: cocos target (0,0.9,-0.35) -> blender (0,0.35,0.9); pitch 40 down, distance 5.9 along +z(cocos)= -y(blender)
p=math.radians(40); t=mathutils.Vector((0,0.35,0.9)); d=5.9
pos=mathutils.Vector((0, 0.35 - d*math.cos(p), 0.9 + d*math.sin(p)))
cam=bpy.data.cameras.new('c'); cam.angle_y=math.radians(30); cam.sensor_fit='VERTICAL'
co=bpy.data.objects.new('c',cam); bpy.context.scene.collection.objects.link(co); co.location=pos
co.rotation_euler=(t-pos).to_track_quat('-Z','Y').to_euler(); bpy.context.scene.camera=co
for name,loc,e in [('k',(-1.6,-2.6,3.2),1500),('f',(2.2,-2.2,1.6),700),('g',(0,0,0.95),60)]:
    l=bpy.data.lights.new(name,'POINT'); l.energy=e; lo=bpy.data.objects.new(name,l); lo.location=loc; bpy.context.scene.collection.objects.link(lo)
w=bpy.data.worlds.new('w'); bpy.context.scene.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[1].default_value=1.2
s=bpy.context.scene; s.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
s.render.resolution_x=s.render.resolution_y=512; s.render.film_transparent=True; s.view_settings.view_transform='Standard'
for i,a in enumerate(angles):
    if lid: lid.rotation_quaternion = rest @ mathutils.Quaternion((1,0,0), math.radians(a))
    s.render.filepath='%s/lid_%02d.png'%(outdir,i); bpy.ops.render.render(write_still=True)
