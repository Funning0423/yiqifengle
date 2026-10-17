import bpy, json, sys
out={}
def sock_val(s):
    try:
        v=s.default_value
        try: return [round(x,4) for x in v]
        except TypeError: return round(v,4)
    except Exception: return None
def mat_info(m):
    d={'name':m.name,'blend_method':getattr(m,'blend_method',None),'surface_render_method':getattr(m,'surface_render_method',None),'nodes':[]}
    if m.use_nodes:
        for n in m.node_tree.nodes:
            nd={'type':n.bl_idname,'name':n.name,'label':n.label,'inputs':{}}
            for i in n.inputs:
                if i.is_linked:
                    l=i.links[0]; nd['inputs'][i.name]='<-'+l.from_node.name+'.'+l.from_socket.name
                else:
                    v=sock_val(i)
                    if v is not None: nd['inputs'][i.name]=v
            if n.bl_idname=='ShaderNodeValToRGB':
                nd['ramp']=[(round(e.position,4),[round(c,4) for c in e.color]) for e in n.color_ramp.elements]; nd['interp']=n.color_ramp.interpolation
            if n.bl_idname in('ShaderNodeVertexColor','ShaderNodeAttribute'):
                nd['layer']=getattr(n,'layer_name',None) or getattr(n,'attribute_name',None)
            if n.bl_idname=='ShaderNodeTexImage' and n.image: nd['image']=n.image.filepath; nd['interp']=n.interpolation; nd['colorspace']=n.image.colorspace_settings.name
            if n.bl_idname=='ShaderNodeMix': nd['blend_type']=n.blend_type; nd['data_type']=n.data_type
            if n.bl_idname=='ShaderNodeMath': nd['op']=n.operation
            d['nodes'].append(nd)
    return d
sc=bpy.context.scene
out['view']={'view_transform':sc.view_settings.view_transform,'look':sc.view_settings.look,'exposure':sc.view_settings.exposure,'gamma':sc.view_settings.gamma,'display':sc.display_settings.display_device,'engine':sc.render.engine,'res':[sc.render.resolution_x,sc.render.resolution_y]}
w=sc.world
if w and w.use_nodes: out['world']=mat_info(w)
cam=sc.camera; out['camera']={'name':cam.name,'loc':list(cam.matrix_world.translation),'rot':list(cam.matrix_world.to_euler()),'fov':cam.data.angle_y} if cam else None
out['lights']=[{'name':o.name,'type':o.data.type,'energy':o.data.energy,'color':list(o.data.color),'rot':list(o.matrix_world.to_euler()),'hide_render':o.hide_render} for o in sc.objects if o.type=='LIGHT']
keys=('lake','water','bridge','pavilion','pav')
objs={}
for o in bpy.data.objects:
    if o.type!='MESH': continue
    if not any(k in o.name.lower() or (o.data and k in o.data.name.lower()) for k in keys): continue
    me=o.data
    cols=[c.name for c in o.users_collection]
    vis = o.visible_get() if o.name in bpy.context.view_layer.objects else False
    info={'data':me.name,'collections':cols,'hide_render':o.hide_render,'hide_viewport':o.hide_viewport,'visible':vis,'loc':[round(x,3) for x in o.matrix_world.translation],'dims':[round(x,3) for x in o.dimensions],'mats':[s.material.name if s.material else None for s in o.material_slots],'color_attrs':[(a.name,a.domain,a.data_type) for a in me.color_attributes],'uv':[u.name for u in me.uv_layers],'tris':sum(len(p.vertices)-2 for p in me.polygons)}
    # per-material vertex colour stats
    if me.color_attributes:
        ca=me.color_attributes.active_color or me.color_attributes[0]
        from collections import Counter
        cnt=Counter()
        for p in me.polygons:
            for li in p.loop_indices:
                idx = li if ca.domain=='CORNER' else me.loops[li].vertex_index
                c=ca.data[idx].color
                cnt[(p.material_index,tuple(round(x,3) for x in c[:3]))]+=1
        info['vcol_top']=[(k[0],k[1],v) for k,v in cnt.most_common(14)]
    # UV palette lookup
    if me.uv_layers:
        from collections import Counter
        cu=Counter(); uv=me.uv_layers.active.data
        for p in me.polygons:
            u=uv[p.loop_indices[0]].uv; cu[(p.material_index,round(u[0],4),round(u[1],4))]+=1
        info['uv_top']=[(k,v) for k,v in cu.most_common(14)]
    objs[o.name]=info
out['objects']=objs
mats=set()
for i in objs.values(): mats.update(m for m in i['mats'] if m)
out['materials']={m:mat_info(bpy.data.materials[m]) for m in mats}
json.dump(out,open(sys.argv[sys.argv.index('--')+1],'w'),indent=1,default=str)
print('INSPECT_OK',len(objs),len(mats))
