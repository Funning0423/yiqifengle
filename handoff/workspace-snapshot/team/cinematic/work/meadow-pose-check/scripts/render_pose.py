# render at exact pose (cocos coords in args), dome follows camera XZ like SkyFollowCamera. .blend never saved.
import bpy, json, sys, math
from mathutils import Vector
A=json.loads(sys.argv[sys.argv.index('--')+1])
S=bpy.context.scene; O=bpy.data.objects
def c2b(v): return Vector((v[0],-v[2],v[1]))
P=c2b(A['position']); T=c2b(A['target'])
O['meadow_sky_dome'].location.x=P.x; O['meadow_sky_dome'].location.y=P.y
S.render.engine='CYCLES'; S.cycles.device='CPU'; S.cycles.samples=A.get('samples',24); S.cycles.use_denoising=True; S.cycles.max_bounces=4
W,H=A['res']; S.render.resolution_x=W; S.render.resolution_y=H; S.render.resolution_percentage=100
cd=bpy.data.cameras.new('YJ'); cam=bpy.data.objects.new('YJ_CAM',cd); S.collection.objects.link(cam)
cd.sensor_fit='VERTICAL'; cd.sensor_height=24.0; cd.lens=12.0/math.tan(math.radians(A['fov'])/2); cd.clip_start=A.get('near',1.0); cd.clip_end=1000
cam.location=P; cam.rotation_mode='QUATERNION'; cam.rotation_quaternion=(T-P).normalized().to_track_quat('-Z','Y'); S.camera=cam
S.render.filepath=A['out']; S.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True); print("DONE",A['out'])
