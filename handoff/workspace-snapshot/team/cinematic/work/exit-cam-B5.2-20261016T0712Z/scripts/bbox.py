import bpy,json,math
exec(open('/tmp/b52/pose_still.py').read().split("O=bpy.data.objects;S=bpy.context.scene")[0].replace("A=json.loads(open(sys.argv[sys.argv.index('--')+1]).read());",""))
bpy.context.view_layer.update()
out={}
for o in bpy.data.objects:
  if o.type!='MESH': continue
  if any(k in o.name for k in ('lighthouse_ext','palm','signpost','island_main','hut','house')) or o in propobjs:
    pts=[o.matrix_world@__import__('mathutils').Vector(c) for c in o.bound_box]
    out[o.name]=[[min(p.x for p in pts),min(p.z for p in pts),min(-p.y for p in pts)],[max(p.x for p in pts),max(p.z for p in pts),max(-p.y for p in pts)]]
json.dump(out,open('/tmp/b52/bbox.json','w'),indent=0);print('BB',len(out))
