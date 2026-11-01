exec(open('/workspace/yiqifengle/previews/角色动画bot/sit-drape-stool/pelvis_lift/common.py').read())
setclip('sit_hold'); place('sit_hold', 0)
print('BONES', json.dumps({b.name: [round(x, 4) for x in list(b.rotation_quaternion) + list(b.location) + list(b.scale)] for b in arm.pose.bones if b.name.startswith(('skirt', 'hips', 'root'))}))
