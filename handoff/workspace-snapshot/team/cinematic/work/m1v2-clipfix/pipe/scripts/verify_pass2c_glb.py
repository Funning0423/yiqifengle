"""Independent check of the pass2c interim GLB: raw glTF (weights per vertex, morph owners, root scale) + Blender reimport (height, bones)."""
import bpy,sys,json,struct,numpy as np
G=sys.argv[sys.argv.index('--')+1]; OUT=sys.argv[sys.argv.index('--')+2]
b=open(G,'rb').read(); n=struct.unpack('<I',b[12:16])[0]; g=json.loads(b[20:20+n]); bin_off=20+n+8
def acc(i):
    a=g['accessors'][i]
    if 'bufferView' not in a:
        nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]; out=np.zeros((a['count'],nc))
        sp=a.get('sparse')
        if sp:
            ib=g['bufferViews'][sp['indices']['bufferView']]; ict={5123:'u2',5121:'u1',5125:'u4'}[sp['indices']['componentType']]
            idx=np.frombuffer(b,dtype=ict,count=sp['count'],offset=bin_off+ib.get('byteOffset',0)+sp['indices'].get('byteOffset',0))
            vb=g['bufferViews'][sp['values']['bufferView']]
            val=np.frombuffer(b,dtype='f4',count=sp['count']*nc,offset=bin_off+vb.get('byteOffset',0)+sp['values'].get('byteOffset',0)).reshape(-1,nc)
            out[idx]=val
        return out
    bv=g['bufferViews'][a['bufferView']]; ct={5126:'f4',5123:'u2',5121:'u1',5125:'u4'}[a['componentType']]
    nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]; off=bin_off+bv.get('byteOffset',0)+a.get('byteOffset',0)
    st=bv.get('byteStride',0); itemsz=np.dtype(ct).itemsize*nc
    if st and st!=itemsz:
        raw=np.frombuffer(b,dtype='u1',count=st*a['count'],offset=off).reshape(a['count'],st)[:,:itemsz].copy().view(ct).reshape(a['count'],nc)
    else: raw=np.frombuffer(b,dtype=ct,count=a['count']*nc,offset=off).reshape(a['count'],nc)
    if a.get('normalized'): raw=raw/ (255.0 if ct=='u1' else 65535.0)
    return raw
R={'nodes_root':[nd for nd in g['nodes'] if nd.get('name') in ('root',)],'top_nodes':[g['nodes'][i].get('name') for i in g['scenes'][0]['nodes']]}
R['top_node_xforms']={g['nodes'][i].get('name'):{k:g['nodes'][i].get(k) for k in ('translation','rotation','scale')} for i in g['scenes'][0]['nodes']}
R['meshes']={}
for m in g['meshes']:
    pr=m['primitives'][0]; d={'targetNames':m.get('extras',{}).get('targetNames'),'n_targets':len(pr.get('targets',[]))}
    if 'WEIGHTS_0' in pr['attributes']:
        w=acc(pr['attributes']['WEIGHTS_0']); nz=(w>1e-6).sum(1); d['max_nonzero_weights']=int(nz.max()); d['has_WEIGHTS_1']='WEIGHTS_1' in pr['attributes']
        d['weight_sum_min']=float(w.sum(1).min()); d['weight_sum_max']=float(w.sum(1).max())
    if d['targetNames'] and 'sit_corrective' in d['targetNames']:
        t=pr['targets'][d['targetNames'].index('sit_corrective')]; dp=acc(t['POSITION']); mag=np.linalg.norm(dp,axis=1)
        d['sit_corrective_delta_max_mm']=float(mag.max()*1000); d['sit_corrective_verts_moved_gt_0.1mm']=int((mag>1e-4).sum())
    R['meshes'][m['name']]=d
R['skins']=[len(s['joints']) for s in g['skins']]; R['animations']=[a['name'] for a in g.get('animations',[])]
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=G); bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get(); zmax=-1;zmin=9
for o in bpy.data.objects:
    if o.type=='MESH' and not o.name.startswith('Icosphere'):
        R.setdefault('mesh_objs',[]).append(o.name); oe=o.evaluated_get(dg); me=oe.to_mesh(); co=np.array([oe.matrix_world@v.co for v in me.vertices]); zmax=max(zmax,co[:,2].max()); zmin=min(zmin,co[:,2].min()); oe.to_mesh_clear()
R['reimport_height_m']=zmax; R['reimport_zmin_m']=zmin
R['armatures']=[(o.name,len(o.data.bones),list(o.matrix_world.to_scale())) for o in bpy.data.objects if o.type=='ARMATURE']
json.dump(R,open(OUT,'w'),indent=1,default=str); print('VDONE')
