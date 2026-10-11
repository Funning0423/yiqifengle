# blender -b --python render_eval.py -- <hy|r2|glb:path> <outdir> <shots.json>
import bpy, sys, os, json
sys.path.insert(0,os.path.dirname(__file__)); import common as C
a=sys.argv[sys.argv.index('--')+1:]; M,O,S=a[0],a[1],a[2]; os.makedirs(O,exist_ok=True)
sc,sun,cam=C.reset()
if M=='hy': C.load_hy()
elif M=='r2': C.load_r2()
elif M.startswith('glbhy:'): C.load_hy(M[6:])
for s in json.load(open(S)): C.shoot(sc,sun,cam,s,os.path.join(O,s['name']+'.png'))
print('DONE',M)
