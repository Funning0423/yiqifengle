"""v3 cs step 3: write solved knot coords into the m1_cNN shape keys of dress/apron (bones, schedule, sit_corrective, bow untouched).
usage: blender -b --python write_knots.py -- <in.blend> <knots.npz> <out.blend>"""
import bpy, sys, numpy as np
a=sys.argv[sys.argv.index('--')+1:]; inb,kn,outb=a[:3]
bpy.ops.wm.open_mainfile(filepath=inb); Z=np.load(kn); n=0
for key in Z.files:
    on,k=key.split('__'); me=bpy.data.objects[on].data; kb=me.shape_keys.key_blocks[k]; kb.data.foreach_set('co',Z[key].astype(np.float64).ravel()); n+=1
for on in ('G2_DRESS_R5G2','G2_APRON_R5G2'): bpy.data.objects[on].data.update()
bpy.ops.wm.save_as_mainfile(filepath=outb); print('WK keys written',n)
