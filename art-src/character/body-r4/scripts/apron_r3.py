# exec'd from build_body.py after legs/shoes + hem raise (needs: bpy,bmesh,math,np,Vector,BVHTree,P,smooth,lerp,body,arm)
# body-r3: new apron front panel (rounded hem, inside the dress silhouette, 10 rows), white waistband, new back bow.
AP=P['apron']
dress_o=bpy.data.objects['LOD0_G2_DRESS']; apron_o=bpy.data.objects['LOD0_G2_APRON']; bow_o=bpy.data.objects['LOD0_G2_BOW']
dg=bpy.context.evaluated_depsgraph_get()
def bvh_of(o):
    me=o.data; return BVHTree.FromPolygons([v.co.copy() for v in me.vertices],[list(p.vertices) for p in me.polygons])
# --- yellow dress: drop the two .mid bones (weights merged into skirt.front / skirt.front.low); GLB mirrored by remap_mid.py
MID={'skirt.front.mid':'skirt.front','skirt.front.low.mid':'skirt.front.low'}
for a_,b_ in MID.items():
    ga=dress_o.vertex_groups.get(a_); gb=dress_o.vertex_groups.get(b_)
    if ga is None: continue
    for v in dress_o.data.vertices:
        w=[g.weight for g in v.groups if g.group==ga.index]
        if w and w[0]>0: gb.add([v.index],w[0],'ADD')
    ga.remove(list(range(len(dress_o.data.vertices))))
dbvh=bvh_of(dress_o); DV=np.array([v.co[:] for v in dress_o.data.vertices])
def dress_center(z):
    s=DV[np.abs(DV[:,2]-z)<0.015]; return Vector((0,(s[:,1].min()+s[:,1].max())/2,z))
def on_dress(z,th,off):
    c=dress_center(z); d=Vector((math.sin(th),-math.cos(th),0))
    h=dbvh.ray_cast(c+d*0.5,-d,0.6)
    if h[0] is None: h=dbvh.find_nearest(c+d*0.3)
    n=h[1].copy(); n.z*=0.3; n.normalize()
    return h[0]+n*off
# --- weight transfer helper (nearest face, inverse-distance blend of that face's vertices)
def transfer(dst_me,dst_o,src_o,filt=None,remap=None,only=None):
    sme=src_o.data; sb=bvh_of(src_o); gn={g.index:g.name for g in src_o.vertex_groups}
    idx=list(range(len(dst_me.vertices))) if only is None else list(only)
    for g in dst_o.vertex_groups: g.remove(idx)
    for v in (dst_me.vertices[i] for i in idx):
        loc,nrm,fi,dd=sb.find_nearest(v.co); acc={}
        fv=sme.polygons[fi].vertices; ws=[1/((sme.vertices[i].co-loc).length+1e-4) for i in fv]; s=sum(ws)
        for i,wi in zip(fv,ws):
            for g in sme.vertices[i].groups:
                n=gn[g.group]
                if n.startswith('_'): continue
                if remap: n=remap.get(n,n)
                acc[n]=acc.get(n,0)+g.weight*wi/s
        if filt: acc=filt(v.co,acc)
        tot=sum(acc.values()) or 1
        for n,w in acc.items():
            if w/tot>1e-3: (dst_o.vertex_groups.get(n) or dst_o.vertex_groups.new(name=n)).add([v.index],w/tot,'REPLACE')
src_apron=apron_o.copy(); src_apron.data=apron_o.data.copy(); bpy.context.scene.collection.objects.link(src_apron)
src_bow=bow_o.copy(); src_bow.data=bow_o.data.copy(); bpy.context.scene.collection.objects.link(src_bow)
# white texel on T_G2_BODY used by the old bow (BOW keeps M_G2_BODY so the prefab material slot is unchanged)
img=[n for n in bow_o.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE'][0].image
W_,H_=img.size; px=np.array(img.pixels[:]).reshape(H_,W_,4)
best=(9,None)
for d in bow_o.data.uv_layers[0].data:
    u,v=d.uv; c=px[int((v%1)*H_)%H_,int((u%1)*W_)%W_,:3]; sc=abs(1-c.mean())+ (c.max()-c.min())
    if sc<best[0]: best=(sc,(u,v))
BOW_UV=best[1]; print('BOW_UV',BOW_UV,best[0])
APRON_UV=tuple(AP['uv'])
# --- apron panel
bm=bmesh.new(); NR=AP['rows']; NC=AP['cols']; G=[]
for r in range(NR):
    v_=r/(NR-1); row=[]
    for c in range(NC):
        u=-1+2*c/(NC-1); t=max(0.0,(abs(u)-AP['corner_u'])/(1-AP['corner_u']))
        zh=AP['hem_z']+AP['corner_r']*(1-math.sqrt(max(0.0,1-t*t)))
        z=AP['top_z']+(zh-AP['top_z'])*v_
        half=math.radians(lerp(AP['half_top'],AP['half_hem'],v_))
        p=on_dress(z,u*half,AP['gap'])
        row.append(bm.verts.new(p))
    G.append(row)
for r in range(NR-1):
    for c in range(NC-1): bm.faces.new((G[r][c],G[r][c+1],G[r+1][c+1],G[r+1][c]))
NAP=len(bm.verts)
# --- waistband (closed ring, 4 loops: rounded top/bottom edge)
NB=AP['belt_cols']; BR=[]
for z,off in AP['belt_rows']:
    ring=[]
    for k in range(NB):
        th=2*math.pi*k/NB; ring.append(bm.verts.new(on_dress(z,th,off)))
    BR.append(ring)
for a,b in zip(BR,BR[1:]):
    for k in range(NB): bm.faces.new((a[k],a[(k+1)%NB],b[(k+1)%NB],b[k]))
bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
# outward check
for f in bm.faces:
    c=f.calc_center_median(); cc=dress_center(c.z)
    if f.normal.dot(Vector((c.x-cc.x,c.y-cc.y,0)))<0: f.normal_flip()
me=apron_o.data; mats=list(me.materials); bm.to_mesh(me); bm.free()
if not me.materials: me.materials.append(mats[0])
uvl=me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
for d in uvl.data: d.uv=APRON_UV
BELT0=NAP
apron_o['n_panel']=NAP
for p_ in me.polygons: p_.use_smooth=True
# apron follows the dress weights exactly (offset sheet), front bones mapped onto the .mid (apron/wind) chain
transfer(me,apron_o,dress_o,remap={'skirt.front':'skirt.front.mid','skirt.front.low':'skirt.front.low.mid'})
# waistband follows the dress top exactly (its lower edge sits on the skirt.* region)
transfer(me,apron_o,dress_o,only=range(BELT0,len(me.vertices)))
# --- bow at the back of the waistband
BW_=AP['bow']; zc=BW_['z']; back=on_dress(zc,math.pi,AP['belt_rows'][1][1]+0.002); cy=back.y
bm=bmesh.new()
def blob(center,rx,ry,rz,nu=10,nv=6,pinch=None):
    vs=[]
    for i in range(1,nv):
        ph=math.pi*i/nv; ring=[]
        for k in range(nu):
            th=2*math.pi*k/nu; x=math.sin(ph)*math.cos(th); z=math.cos(ph); y=math.sin(ph)*math.sin(th)
            sc=pinch(x) if pinch else 1.0
            ring.append(bm.verts.new(center+Vector((x*rx,y*ry*sc,z*rz*sc))))
        vs.append(ring)
    top=bm.verts.new(center+Vector((0,0,rz))); bot=bm.verts.new(center+Vector((0,0,-rz)))
    for a,b in zip(vs,vs[1:]):
        for k in range(nu): bm.faces.new((a[k],a[(k+1)%nu],b[(k+1)%nu],b[k]))
    for k in range(nu): bm.faces.new((top,vs[0][(k+1)%nu],vs[0][k])); bm.faces.new((bot,vs[-1][k],vs[-1][(k+1)%nu]))
K=Vector((0,cy+BW_['knot'][1],zc)); blob(K,BW_['knot'][0],BW_['knot'][1],BW_['knot'][2],8,5)
for sx in (-1,1):
    lc=K+Vector((sx*BW_['loop'][0]*0.85,BW_['loop'][1]*0.3,BW_['loop_lift']))
    # loop lobe: flat ellipsoid, pinched toward the knot (x -> knot side)
    blob(lc,BW_['loop'][0],BW_['loop'][1],BW_['loop'][2],10,6,pinch=lambda x,sx=sx: 0.45+0.55*smooth((x*sx+1.0)/1.2))
# tails: flat ribbons with thickness, lying on the dress back, ending in a V notch
TL=BW_['tail']
for sx in (-1,1):
    secs=[]
    for i in range(TL['n']):
        q=i/(TL['n']-1); z=zc-0.012-q*TL['len']; xm=sx*(TL['x0']+(TL['x1']-TL['x0'])*q)
        wv=TL['w']; pts=[]
        for e in (-1,1):
            x=xm+e*wv/2
            p=on_dress(z,math.atan2(x,0.12)+math.pi,0)   # placeholder angle, re-projected below
            pts.append(x)
        # project the two edge points onto the dress back + offset
        def bp(x,z,off):
            c=dress_center(z); h=dbvh.ray_cast(Vector((x,c.y+0.5,z)),Vector((0,-1,0)),0.6)
            p=h[0] if h[0] is not None else Vector((x,c.y+0.12,z)); return p+Vector((0,off,0))
        notch=TL['notch'] if i==TL['n']-1 else 0
        a0=bp(xm-wv/2,z+notch*(1 if sx<0 else 0),TL['off']); a1=bp(xm+wv/2,z+notch*(0 if sx<0 else 1),TL['off'])
        secs.append([bm.verts.new(a0),bm.verts.new(a1),bm.verts.new(a1+Vector((0,TL['t'],0))),bm.verts.new(a0+Vector((0,TL['t'],0)))])
    for s0,s1 in zip(secs,secs[1:]):
        for k in range(4): bm.faces.new((s0[k],s0[(k+1)%4],s1[(k+1)%4],s1[k]))
    bm.faces.new(secs[-1][::-1])
bmesh.ops.recalc_face_normals(bm,faces=bm.faces[:])
me=bow_o.data; mats=list(me.materials); bm.to_mesh(me); bm.free()
if not me.materials: me.materials.append(mats[0])
uvl=me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name='UVMap')
for d in uvl.data: d.uv=BOW_UV
for p_ in me.polygons: p_.use_smooth=True
def bow_filt(co,acc):
    # knot + loops ride on the hips; tails blend into the dress back below the waistband
    t=smooth((zc-0.03-co.z)/0.08)
    out={k:w*t for k,w in acc.items()}; out['hips']=out.get('hips',0)+(1-t); return out
transfer(me,bow_o,dress_o,filt=bow_filt)
for o in (src_apron,src_bow): bpy.data.objects.remove(o)
print('APRON',len(apron_o.data.vertices),sum(len(p.vertices)-2 for p in apron_o.data.polygons),'BOW',len(bow_o.data.vertices),sum(len(p.vertices)-2 for p in bow_o.data.polygons))
