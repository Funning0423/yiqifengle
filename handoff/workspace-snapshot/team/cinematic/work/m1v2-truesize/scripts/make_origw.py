"""Evidence variant: same animated scene, but character meshes get the ORIGINAL (un-limited, un-normalised) pass2b weights
copied by vertex index from the source blend. Output: scene/cine_m1_anim_origw.blend (never exported)."""
import bpy,sys,os
W='/workspace/wechat-game/team/cinematic/work/m1v2-truesize/'
SRC=os.environ.get('CHAR_BLEND',W+'src/R5G2_PASS2C_TRUESIZE_grokbot2_SOURCE.blend')
bpy.ops.wm.open_mainfile(filepath=W+'scene/cine_m1_anim.blend')
names=['B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2','G2_HAIR_BOB_R5G2']
with bpy.data.libraries.load(SRC,link=False) as (src,dst): dst.objects=[n for n in src.objects if n in names]
rep={}
for so in dst.objects:
    if so is None: continue
    n=so.name.split('.')[0]; to=bpy.data.objects[n]
    assert len(so.data.vertices)==len(to.data.vertices),n
    gidx={g.index:g.name for g in so.vertex_groups}; mx=0; changed=0
    for g in to.vertex_groups: g.remove(range(len(to.data.vertices)))
    for v in so.data.vertices:
        mx=max(mx,len(v.groups))
        for g in v.groups:
            nm=gidx[g.group]; tg=to.vertex_groups.get(nm) or to.vertex_groups.new(name=nm); tg.add([v.index],g.weight,'REPLACE')
    rep[n]=dict(max_influences_original=mx)
    bpy.data.objects.remove(so)
print('ORIGW',rep)
bpy.ops.wm.save_as_mainfile(filepath=W+'scene/cine_m1_anim_origw.blend')
