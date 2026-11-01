import sys; exec(open('/tmp/w2/c2.py').read())
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=sys.argv[-2]); A=json.load(open(sys.argv[-1])); best=9
for a in BOARD_ASPECTS:
    b=board_cam_aspect(a)
    for k in ('env_sky_static_foliage_cards','env_sky_static_palette'):
        for p in A[k]['pos']:
            pr=project(b,p,a)
            if pr: best=min(best,max(abs(pr[0]),abs(pr[1])))
R=load_route(sys.argv[-3]); rp=[at(R,i*0.1) for i in range(461)]
cl=min(min(math.hypot(p[0]-r[0],p[2]-r[2]) for r in rp) for k in ('env_sky_static_foliage_cards','env_sky_static_palette') for p in A[k]['pos'][::1])
print('MARGIN board NDC',round(best,3),'min horiz vertex-route dist',round(cl,3))
