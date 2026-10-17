import bpy,sys,math,mathutils,json
argv=sys.argv[sys.argv.index('--')+1:];CHAR,CHAIR,TAG=argv[:3]
sys.argv=['x','--',CHAR,CHAIR,'/tmp/_m','rig'];
exec(open(sys.argv[0] if False else '%s/tools/render.py'%argv[3]).read().split("arm=[o for o")[0])
arm=[o for o in chn if o.type=='ARMATURE']
dg=bpy.context.evaluated_depsgraph_get()
res={}
stool=[o for o in stn if o.type=='MESH'][0]
for clip in ['sit_hold','idle_breathing_loop']:
  act=bpy.data.actions.get(clip)
  for a in arm: a.animation_data_create();a.animation_data.action=act
  for fr in [0.0,0.5,1.0] if clip=='sit_hold' else [0.5]:
    r=act.frame_range;f=int(r[0]+(r[1]-r[0])*fr);sc.frame_set(f);dg=bpy.context.evaluated_depsgraph_get()
    se=stool.evaluated_get(dg);sm=se.to_mesh();SW=stool.matrix_world
    sv=[SW@v.co for v in sm.vertices];top=max(v.z for v in sv);cx=sum(v.x for v in sv)/len(sv);cy=sum(v.y for v in sv)/len(sv)
    R=0.1615*1.2
    out={}
    for o in chn:
      if o.type!='MESH':continue
      e=o.evaluated_get(dg);m=e.to_mesh();M=o.matrix_world
      P=[M@v.co for v in m.vertices];inside=[p for p in P if math.hypot(p.x-cx,p.y-cy)<R*0.9]
      if inside:
        mn=min(p.z for p in inside);below=sum(1 for p in inside if p.z<top-0.002)
        out[o.name]=dict(minZ_over_seat_minus_seatTop_mm=round((mn-top)*1000,1),verts_below_seat_top=below)
      out[o.name+'_minZ_mm']=round(min(p.z for p in P)*1000,1)
      e.to_mesh_clear()
    res[f'{clip}@{fr}']=dict(seatTopZ_mm=round(top*1000,1),meshes=out)
print('MEASURE',TAG,json.dumps(res))
