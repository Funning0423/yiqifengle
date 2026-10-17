import bpy, math
from mathutils import Matrix, Vector
POSES={'sit': [('root', 'T', (0, 0, -0.555)), ('thigh.L', 'X', -88), ('thigh.R', 'X', -88), ('shin.L', 'X', 86), ('shin.R', 'X', 86), ('foot.L', 'X', 0), ('foot.R', 'X', 0), ('spine', 'X', -4), ('skirt.back', 'X', 55), ('skirt.back.low', 'X', -45), ('skirt.front', 'X', -59), ('skirt.front.low', 'X', 76), ('skirt.left', 'X', 0), ('skirt.left', 'Y', 55), ('skirt.left.low', 'Y', -45), ('skirt.right', 'X', 0), ('skirt.right', 'Y', -55), ('skirt.right.low', 'Y', 45), ('upper_arm.L', 'X', -26), ('upper_arm.R', 'X', -26), ('upper_arm.L', 'Y', -28), ('upper_arm.R', 'Y', 28), ('forearm.L', 'X', -44), ('forearm.R', 'X', -44), ('forearm.L', 'Z', -25), ('forearm.R', 'Z', 25)], 'walk': [('thigh.L', 'X', -24), ('thigh.R', 'X', 18), ('shin.L', 'X', 6), ('shin.R', 'X', 32), ('upper_arm.L', 'X', 14), ('upper_arm.R', 'X', -14), ('forearm.L', 'X', -6), ('forearm.R', 'X', -14), ('skirt.front', 'X', -9), ('skirt.back', 'X', 21), ('skirt.left', 'X', -7), ('skirt.right', 'X', 7), ('skirt.front.low', 'X', 0), ('skirt.left.low', 'X', 0), ('skirt.right.low', 'X', 0), ('skirt.back.low', 'X', 0)]}
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
