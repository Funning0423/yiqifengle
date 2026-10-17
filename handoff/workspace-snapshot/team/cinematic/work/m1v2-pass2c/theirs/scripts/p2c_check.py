# pass2c AUTHORITY check: true triangle-triangle intersections (BVHTree.overlap) with the source's own (<=4, normalized) weights.
# modes: mid = garments without solidify (game midsurface), vis = with solidify 0.8 mm.  Chair = REAL game chair.
import bpy, sys, os, json, numpy as np, bmesh
sys.path.insert(0,os.path.dirname(__file__)); import p2c_poses as PZ
from mathutils import Vector
from mathutils.bvhtree import BVHTree
out=sys.argv[sys.argv.index("--")+1]
POSES=os.environ.get("POSES","rest,walk_s100,walk_s50,walk_sm50,walk_sm100,sit,stand_a90,stand_a75,stand_a50,stand_a25").split(",")
MODES=os.environ.get("MODES","mid,vis").split(",")
BN=os.environ.get("BODY","B_ANATOMICAL_VERTICAL_SLENDER_R5"); DN=os.environ.get("DRESS","G2_DRESS_R5G2"); AN=os.environ.get("APRON","G2_APRON_R5G2")
arm=bpy.data.objects["R5G2_RIG_22P4"]; body=bpy.data.objects[BN]; D=bpy.data.objects[DN]; A=bpy.data.objects[AN]
CH=bpy.data.objects.get("REF_CHAIR_REAL_reading_chair")
def maxinf(o):
    bi={g.index for g in o.vertex_groups if g.name in arm.data.bones}
    return max(len([g for g in v.groups if g.weight>1e-6 and g.group in bi]) for v in o.data.vertices)
INF={o.name:maxinf(o) for o in (body,D,A)}
# body tri groups by dominant bone (+ bow tails by island)
me=body.data; vgn={g.index:g.name for g in body.vertex_groups}
dom=np.array([vgn[max(v.groups,key=lambda g:g.weight).group] if v.groups else "" for v in me.vertices])
bm=bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); co0=np.array([v.co[:] for v in me.vertices])
seen=np.zeros(len(me.vertices),bool); bow=np.zeros(len(me.vertices),bool)
for v in bm.verts:
    if seen[v.index] or not v.link_edges: continue
    st=[v]; comp=[]; seen[v.index]=True
    while st:
        x=st.pop(); comp.append(x.index)
        for e in x.link_edges:
            w=e.other_vert(x)
            if not seen[w.index]: seen[w.index]=True; st.append(w)
    if co0[comp,1].min()>0.06 and co0[comp,2].max()<1.15 and len(comp)<300: bow[comp]=True
bm.free()
cat=np.full(len(dom),"torso",dtype=object)
cat[np.isin(dom,["thigh.L","shin.L","foot.L"])]="legL"; cat[np.isin(dom,["thigh.R","shin.R","foot.R"])]="legR"
cat[np.isin(dom,["upper_arm.L","forearm.L","hand.L"])]="armL"; cat[np.isin(dom,["upper_arm.R","forearm.R","hand.R"])]="armR"
cat[np.isin(dom,["head","neck"])]="head"; cat[bow]="bow"
def tris(o,mods_on):
    for m in o.modifiers:
        if m.type in ("SOLIDIFY","TRIANGULATE","NODES"): m.show_viewport = (m.type!="NODES") and mods_on
    dg=bpy.context.evaluated_depsgraph_get(); e=o.evaluated_get(dg); mm=e.to_mesh(); mm.calc_loop_triangles()
    P=np.array([o.matrix_world@v.co for v in mm.vertices]); T=np.array([t.vertices[:] for t in mm.loop_triangles]); e.to_mesh_clear()
    for m in o.modifiers: m.show_viewport=True
    return P,T
def tree(P,T): return BVHTree.FromPolygons([Vector(p) for p in P],T.tolist(),all_triangles=True)
if CH:
    CP=np.array([CH.matrix_world@v.co for v in CH.data.vertices]); CH.data.calc_loop_triangles(); CT=np.array([t.vertices[:] for t in CH.data.loop_triangles]); TC=tree(CP,CT)
USED=np.zeros(len(body.data.vertices),bool)
for _p in body.data.polygons: USED[list(_p.vertices)]=True
def self_pairs(P,T):
    tr=tree(P,T); n=0
    for i,j in tr.overlap(tr):
        if i<j and not (set(T[i].tolist())&set(T[j].tolist())): n+=1
    return n
# layer baseline at rest: side of the dress for each nearby apron vert (运镜bot checker definition)
PZ.apply(arm,"rest"); _dp,_dt=tris(D,False); _ap,_at=tris(A,False); _DT=tree(_dp,_dt); LB={}
for i in np.unique(_at.ravel()):
    cp,n,fi,d=_DT.find_nearest(Vector(_ap[i]),0.02)
    if cp is not None and d>1e-5: LB[int(i)]=float(np.sign((Vector(_ap[i])-cp).dot(n)))
SELF=os.environ.get("SELF","1")=="1"
res=[]
for pn in POSES:
    PZ.apply(arm,pn)
    BP,BT=tris(body,False); tc=cat[BT[:,0]]
    # a triangle belongs to a group only if all 3 verts do (seams between groups are skipped from cross-group self tests only)
    allsame=(cat[BT[:,0]]==cat[BT[:,1]])&(cat[BT[:,0]]==cat[BT[:,2]])
    G={g:tree(BP,BT[(tc==g)]) for g in ["legL","legR","armL","armR","torso","head","bow"]}
    r=dict(pose=pn)
    for mode in MODES:
        on=(mode=="vis"); DP,DT=tris(D,on); AP,AT=tris(A,on); TD,TA=tree(DP,DT),tree(AP,AT)
        for g,TG in G.items():
            r[f"{mode}:{g}xdress"]=len(TG.overlap(TD)); r[f"{mode}:{g}xapron"]=len(TG.overlap(TA))
        r[f"{mode}:apronxdress"]=len(TA.overlap(TD))
        if mode=="mid" and SELF:
            r["mid:dress_self"]=self_pairs(DP,DT); r["mid:apron_self"]=self_pairs(AP,AT)
            bad=0
            for i,s0 in LB.items():
                cp,n,fi,d=TD.find_nearest(Vector(AP[i]),0.03)
                if cp is not None and d>1e-5 and np.sign((Vector(AP[i])-cp).dot(n))!=s0: bad+=1
            r["mid:layer_cross_verts"]=bad
        if CH and (pn.startswith(("sit","stand","m1"))):
            r[f"{mode}:dressxchair"]=len(TD.overlap(TC)); r[f"{mode}:apronxchair"]=len(TA.overlap(TC))
    if CH and (pn.startswith(("sit","stand","m1"))):
        for g,TG in G.items(): r[f"body:{g}xchair"]=len(TG.overlap(TC))
    r["ground:body_verts_below_0.2mm"]=int((BP[USED,2]<0.0002).sum()) if not pn.startswith("walk") else 0
    r["info:body_min_z_mm"]=round(float(BP[USED,2].min())*1000,3)
    for a_,b_ in (("armL","legL"),("armL","legR"),("armR","legR"),("armR","legL"),("armL","torso"),("armR","torso")):
        r[f"info:self_{a_}x{b_}"]=len(G[a_].overlap(G[b_]))
    r["info:legLxlegR"]=len(tree(BP,BT[(tc=="legL")&allsame]).overlap(tree(BP,BT[(tc=="legR")&allsame])))
    r["total_acceptance"]=int(sum(v for k,v in r.items() if isinstance(v,int) and not k.startswith("info")))
    print("CHK",json.dumps({k:v for k,v in r.items() if not isinstance(v,int) or v or k=="total_acceptance"}),flush=True); res.append(r)
PZ.apply(arm,"rest")
json.dump(dict(agent="grokbot-2 (第二个 Grok Bot)",max_influences=INF,bow_tail_verts=int(bow.sum()),chair=CH.name if CH else None,results=res),open(out,"w"),indent=1)
print("INF",INF,"bow",int(bow.sum()))
