import sys; exec(open('/tmp/vbw/common.py').read())
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=sys.argv[-2])
A=json.load(open(sys.argv[-1])); best=9
for asp in (9/19.5,9/16,3/4,1.0,16/9,2.2):
    b=board_cam_aspect(asp)
    for k in ('env_sky_static_foliage_cards','env_sky_static_palette'):
        for p in A[k]['pos']:
            pr=project(b,p,asp)
            if pr: best=min(best,max(abs(pr[0]),abs(pr[1])))
print('MARGIN min NDC of any added vertex in board cams =',best)
