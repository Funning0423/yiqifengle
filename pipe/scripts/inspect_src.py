import bpy,json,collections
out={}
for o in bpy.data.objects:
    d={'type':o.type,'scale':list(o.scale),'loc':[round(x,4) for x in o.location],'parent':o.parent.name if o.parent else None}
    if o.type=='MESH':
        me=o.data; d['verts']=len(me.vertices)
        d['sk']=[k.name for k in me.shape_keys.key_blocks][:5]+(['...%d'%len(me.shape_keys.key_blocks)] if me.shape_keys else []) if me.shape_keys else None
        arm=[m.object.name for m in o.modifiers if m.type=='ARMATURE' and m.object]
        d['mods']=[(m.type,m.name) for m in o.modifiers]; d['arm']=arm
        if arm:
            bones=set(b.name for b in bpy.data.objects[arm[0]].data.bones if b.use_deform)
            gn={g.index:g.name for g in o.vertex_groups}
            mx=0; mxall=0; hist=collections.Counter()
            for v in me.vertices:
                n=sum(1 for g in v.groups if gn[g.group] in bones and g.weight>0); mx=max(mx,n); mxall=max(mxall,len(v.groups)); hist[n]+=1
            d['max_bone_infl']=mx; d['max_all_groups']=mxall; d['hist']=dict(hist)
            d['nonbone_groups']=[g.name for g in o.vertex_groups if g.name not in bones]
        d['zmin']=min((o.matrix_world@v.co).z for v in me.vertices); d['zmax']=max((o.matrix_world@v.co).z for v in me.vertices)
    if o.type=='ARMATURE':
        d['bones']=len(o.data.bones); d['action']=o.animation_data.action.name if o.animation_data and o.animation_data.action else None
        d['nla']=[t.name for t in o.animation_data.nla_tracks] if o.animation_data else []
    out[o.name]=d
out['_actions']=[(a.name,list(a.frame_range)) for a in bpy.data.actions]
print('INSPECT',json.dumps(out))
