"""Per-frame bone world-matrix difference between this scene's clips and the v2g blend (skirt bones listed separately)."""
import bpy,sys,json,math
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-pass2c/scripts'); import clips
A_BLEND,B_BLEND,OUT=sys.argv[sys.argv.index('--')+1:][:3]
def grab(path):
    bpy.ops.wm.open_mainfile(filepath=path); a=bpy.data.objects['R5G2_RIG_22P4']; R={}
    for clip,n in clips.CLIPS.items():
        clips.activate(clip); rows=[]
        for f in range(n+1):
            bpy.context.scene.frame_set(f); rows.append({b.name:[list(r) for r in (a.matrix_world@b.matrix)] for b in a.pose.bones})
        R[clip]=rows
    return R
A=grab(A_BLEND); B=grab(B_BLEND)
from mathutils import Matrix
res={}
for clip in A:
    rows=[]
    for f,(ra,rb) in enumerate(zip(A[clip],B[clip])):
        worst={'body_pos_mm':(0,''),'body_rot_deg':(0,''),'skirt_rot_deg':(0,'')}
        for bn in ra:
            ma=Matrix(ra[bn]); mb=Matrix(rb[bn])
            dp=(ma.to_translation()-mb.to_translation()).length*1000; dr=math.degrees(ma.to_quaternion().rotation_difference(mb.to_quaternion()).angle)
            if bn.startswith('skirt'):
                if dr>worst['skirt_rot_deg'][0]: worst['skirt_rot_deg']=(round(dr,3),bn)
            else:
                if dp>worst['body_pos_mm'][0]: worst['body_pos_mm']=(round(dp,4),bn)
                if dr>worst['body_rot_deg'][0]: worst['body_rot_deg']=(round(dr,4),bn)
        rows.append(worst)
    res[clip]=rows
json.dump(res,open(OUT,'w'),indent=0)
for clip,rows in res.items():
    print('BD',clip,'max body pos mm',max(r['body_pos_mm'][0] for r in rows),'max body rot deg',max(r['body_rot_deg'][0] for r in rows),'max skirt rot',max(r['skirt_rot_deg'][0] for r in rows))
