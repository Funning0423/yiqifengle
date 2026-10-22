import bpy,bmesh,numpy as np,os,math
T=int(os.environ['TARGET'])
S=np.load('sea_src.npz');vis=np.load('vis2.npz')['env_sky_cloudsea_soft']
# order check vs imported
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='env_sky_cloudsea_soft.glb');im=bpy.data.objects['env_sky_cloudsea_soft'].data
bc=np.array([tuple(p.center) for p in im.polygons]);P=S['P'];F=S['F']
dc=P[F].mean(1);dcb=np.stack([dc[:,0],-dc[:,2],dc[:,1]],1)
print('ORDER maxdiff',np.abs(bc-dcb).max())
me=bpy.data.meshes.new('s');me.from_pydata(P.tolist(),[],F.tolist())
ca=me.color_attributes.new('Color','BYTE_COLOR','POINT')
for i,c in enumerate(S['C']/255.0):ca.data[i].color_srgb=tuple(c)  # bytes are sRGB-encoded storage
na=me.attributes.new('onrm','FLOAT_VECTOR','POINT');na.data.foreach_set('vector',S['N'].astype('f4').ravel())
o=bpy.data.objects.new('s',me);bpy.context.scene.collection.objects.link(o)
bm=bmesh.new();bm.from_mesh(me);bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[f for f in bm.faces if not vis[f.index]],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
bm.to_mesh(me);print('after vis',len(me.polygons))
# protect: boundary verts + high-curvature (silhouette) verts
vg=o.vertex_groups.new(name='protect');bm=bmesh.new();bm.from_mesh(me)
prot=[];
for v in bm.verts:
  w=0.0
  if v.is_boundary:w=1.0
  else:
    ns=[f.normal for f in v.link_faces];mx=max((a.angle(b,0) for a in ns for b in ns),default=0)
    w=min(1.0,mx/math.radians(35))
  r=math.hypot(v.co.x+6,v.co.z+16)
  w=max(w,min(1.0,max(0.0,(220-r)/160)))
  prot.append(w)
for i,w in enumerate(prot):
  if w>0:vg.add([i],w,'REPLACE')
r=T/len(me.polygons)
md=o.modifiers.new('d','DECIMATE');md.decimate_type='COLLAPSE';md.ratio=r;md.vertex_group='protect';md.vertex_group_factor=10.0;md.use_collapse_triangulate=True
dg=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(dg).to_mesh()
print('after dec',len(ev.polygons))
ev.calc_loop_triangles() if hasattr(ev,'calc_loop_triangles') else None
Pn=np.array([tuple(v.co) for v in ev.vertices]);Fn=np.array([tuple(p.vertices) for p in ev.polygons])
Nn=np.zeros(len(ev.vertices)*3,'f4');ev.attributes['onrm'].data.foreach_get('vector',Nn);Nn=Nn.reshape(-1,3);Nn/=np.linalg.norm(Nn,axis=1,keepdims=True)+1e-9
cn=ev.color_attributes['Color'];Cn=np.array([tuple(cn.data[i].color_srgb) for i in range(len(ev.vertices))])
np.savez(os.environ.get('OUT','sea_new.npz'),P=Pn,N=Nn,F=Fn,C=np.clip(np.round(Cn*255),0,255).astype('u1'),UV=np.repeat(S['UV'][:1],len(Pn),0))
# original normals smooth check
on=S['N'];print('orig normal sample',on[:2])
