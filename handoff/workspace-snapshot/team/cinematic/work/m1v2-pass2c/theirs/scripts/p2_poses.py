import bpy, math
from mathutils import Matrix, Vector
POSES={'sit': [('root', 'T', (0, 0, -0.629)), ('thigh.L', 'X', -100.2), ('thigh.R', 'X', -100.2), ('shin.L', 'X', 100.2), ('shin.R', 'X', 100.2), ('foot.L', 'X', 0), ('foot.R', 'X', 0), ('spine', 'X', -4), ('skirt.back', 'X', -18), ('skirt.back.low', 'X', -104), ('skirt.front', 'X', -98), ('skirt.front.low', 'X', 76), ('skirt.left', 'X', -68), ('skirt.left', 'Y', -22), ('skirt.left.low', 'X', 0), ('skirt.left.low', 'Y', 22), ('skirt.right', 'X', -68), ('skirt.right', 'Y', 22), ('skirt.right.low', 'X', 0), ('skirt.right.low', 'Y', -22), ('upper_arm.L', 'X', -38), ('upper_arm.L', 'Y', -16), ('forearm.L', 'X', -23.5), ('forearm.L', 'Z', 0.5), ('hand.L', 'X', 0.0), ('hand.L', 'Z', 12.0), ('upper_arm.R', 'X', -38), ('upper_arm.R', 'Y', 16), ('forearm.R', 'X', -23.5), ('forearm.R', 'Z', -0.5), ('hand.R', 'X', 0.0), ('hand.R', 'Z', -12.0)], 'walk': [('thigh.L', 'X', -24), ('thigh.R', 'X', 18), ('shin.L', 'X', 6), ('shin.R', 'X', 32), ('upper_arm.L', 'X', 14), ('upper_arm.R', 'X', -14), ('forearm.L', 'X', -6), ('forearm.R', 'X', -14), ('skirt.front', 'X', -9), ('skirt.back', 'X', 21), ('skirt.left', 'X', -7), ('skirt.right', 'X', 7), ('skirt.front.low', 'X', 0), ('skirt.left.low', 'X', 0), ('skirt.right.low', 'X', 0), ('skirt.back.low', 'X', 0), ('forearm.L', 'Y', 5), ('forearm.R', 'Y', -5), ('skirt.back.low', 'X', 14), ('skirt.back', 'X', 4)], 'sit_pass2': [('root', 'T', (0, 0, -0.555)), ('thigh.L', 'X', -88), ('thigh.R', 'X', -88), ('shin.L', 'X', 86), ('shin.R', 'X', 86), ('foot.L', 'X', 0), ('foot.R', 'X', 0), ('spine', 'X', -4), ('skirt.back', 'X', 55), ('skirt.back.low', 'X', -45), ('skirt.front', 'X', -59), ('skirt.front.low', 'X', 76), ('skirt.left', 'X', 0), ('skirt.left', 'Y', 55), ('skirt.left.low', 'Y', -45), ('skirt.right', 'X', 0), ('skirt.right', 'Y', -55), ('skirt.right.low', 'Y', 45), ('upper_arm.L', 'X', -26), ('upper_arm.R', 'X', -26), ('upper_arm.L', 'Y', -28), ('upper_arm.R', 'Y', 28), ('forearm.L', 'X', -44), ('forearm.R', 'X', -44), ('forearm.L', 'Z', -25), ('forearm.R', 'Z', 25)]}
# pass2c: sit refit to the REAL game chair (seat top 0.38 m): root -0.629 m (6 mm room for the dress under the thighs), thighs -100.2 / shins +100.2 (feet stay on the floor)
SHAPEKEY_FOR_POSE={'sit':'sit_corrective'}  # pass2b: cloth-drape corrective morph, weight 1 in sit

def set_pose_shapekeys(name):
    want=SHAPEKEY_FOR_POSE.get(name)
    for ob in bpy.data.objects:
        if ob.type=="MESH" and ob.data.shape_keys:
            for kb in ob.data.shape_keys.key_blocks:
                if kb.name in SHAPEKEY_FOR_POSE.values(): kb.value = 1.0 if kb.name==want else 0.0
    bpy.context.view_layer.update()
def apply_pose(arm, name):
    vl=bpy.context.view_layer
    for item in POSES[name]:
        bn,ax,val=item; pb=arm.pose.bones.get(bn)
        if pb is None: continue
        vl.update()
        M=pb.matrix.copy()
        if ax=="T":
            pb.matrix=Matrix.Translation(Vector(val)/arm.matrix_world.to_scale()[0])@M
        else:
            h=M.to_translation()
            R=Matrix.Translation(h)@Matrix.Rotation(math.radians(val),4,ax)@Matrix.Translation(-h)
            pb.matrix=R@M
    vl.update()
    set_pose_shapekeys(name)

