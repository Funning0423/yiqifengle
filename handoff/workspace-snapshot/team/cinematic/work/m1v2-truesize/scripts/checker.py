"""Per-frame interference checker (Blender 4.5). Exact triangle-triangle intersection counts via BVHTree.overlap,
plus approximate penetration depth (max distance of involved vertices lying on the wrong side of the other surface),
plus vertex containment in col_* proxy boxes and ground penetration. Character meshes are evaluated with the
Cocos-style 4-weight-normalised skin (normalised in build_scene.py) and shape keys."""
import bpy, numpy as np, collections, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
BODY='B_ANATOMICAL_VERTICAL_SLENDER_R5'; DRESS='G2_DRESS_R5G2'; APRON='G2_APRON_R5G2'; HAIR='G2_HAIR_BOB_R5G2'
CHAIR='CHAIR_REAL_reading_chair'; ARMS='CHAIR_VARIANT_arms_NOT_IN_GAME'
class Checker:
    def __init__(s):
        b=bpy.data.objects[BODY]; me=b.data
        vg=[g.name for g in b.vertex_groups]; W=np.zeros((len(me.vertices),len(vg)))
        for v in me.vertices:
            for g in v.groups: W[v.index,g.group]=g.weight
        s.dom=np.array(vg)[W.argmax(1)]
        co,T=s.ev(BODY); s.T=T
        par=np.arange(len(co))
        def f(x):
            while par[x]!=x: par[x]=par[par[x]]; x=par[x]
            return x
        for t in T:
            r=[f(v) for v in t]
            for k in r[1:]: par[f(k)]=r[0]
        comp=np.array([f(v) for v in range(len(co))]); tc=comp[T[:,0]]; main=collections.Counter(tc).most_common(1)[0][0]
        tdom=s.dom[T[:,0]]; ism=tc==main; s.used=np.zeros(len(co),bool); s.used[T.ravel()]=True
        P={}
        P['handL']=~ism&(tdom=='hand.L'); P['handR']=~ism&(tdom=='hand.R')
        P['armL']=ism&np.isin(tdom,['forearm.L','hand.L']); P['armR']=ism&np.isin(tdom,['forearm.R','hand.R'])
        P['uarmL']=tdom=='upper_arm.L'; P['uarmR']=tdom=='upper_arm.R'
        P['torso']=ism&np.isin(tdom,['hips','spine','chest'])
        P['legL']=~ism&np.isin(tdom,['thigh.L','shin.L','foot.L']); P['legR']=~ism&np.isin(tdom,['thigh.R','shin.R','foot.R'])
        P['hipsAll']=tdom=='hips'
        P['head']=np.isin(tdom,['head','neck'])
        s.parts={k:np.where(v)[0] for k,v in P.items()}
        s.parts['body']=np.arange(len(T))
        s.parts['legL_ctrl']=s.parts['legL']
        bow=np.zeros(len(co),bool); bow[np.load('/workspace/wechat-game/team/cinematic/work/m1v2-truesize/probe/bow_tail_vidx.npy')]=True
        s.parts['body_nobow']=np.where(~bow[T].any(1))[0]   # body minus the 155 hips-weighted bow-tail verts (model-level issue)
        s.parts['bow']=np.where(bow[T].any(1))[0]   # pass2c: bow-tail ribbon tris (known incomplete in the interim; reported separately)
        s.parts['torso']=np.setdiff1d(s.parts['torso'],s.parts['bow'])
        s.n_bow_verts=int(bow.sum())
        # chair (real, in game) + armrest variant + proxies + env
        ch=bpy.data.objects[CHAIR]; s.chM=ch.matrix_world.copy(); s.chMi=s.chM.inverted()
        s.chair=s.static(CHAIR); s.arms=s.static(ARMS,exclude_near=s.chair[0])
        s.env={}
        for n in ['ENV_props_merged_minus_chair','env_interior_shell']:
            if n in bpy.data.objects: s.env[n]=s.static(n)
        s.boxes={}
        for o in bpy.data.objects:
            if o.name.startswith('col_') and len(o.data.vertices)==8:
                c=np.array([o.matrix_world@v.co for v in o.data.vertices]); s.boxes[o.name]=c
        # ground: shell floor + props (rug) ray-cast
        gco=[];gt=[];off=0
        for n,(c,t,_,_) in s.env.items(): gco.append(c); gt.append(t+off); off+=len(c)
        s.gtree=BVHTree.FromPolygons([Vector(p) for p in np.vstack(gco)],np.vstack(gt).tolist(),all_triangles=True)
    def ev(s,n,solid=True):
        o=bpy.data.objects[n]
        for m in o.modifiers:
            if m.type=='SOLIDIFY': m.show_viewport=solid
        dg=bpy.context.evaluated_depsgraph_get(); dg.update(); oe=o.evaluated_get(dg); me=oe.to_mesh()
        co=np.empty(len(me.vertices)*3); me.vertices.foreach_get('co',co); co=co.reshape(-1,3)
        me.calc_loop_triangles(); t=np.empty(len(me.loop_triangles)*3,np.int32); me.loop_triangles.foreach_get('vertices',t)
        mw=np.array(o.matrix_world); co=co@mw[:3,:3].T+mw[:3,3]; oe.to_mesh_clear()
        for m in o.modifiers:
            if m.type=='SOLIDIFY': m.show_viewport=True
        return co,t.reshape(-1,3)
    def static(s,n,exclude_near=None):
        co,t=s.ev(n)
        if exclude_near is not None:
            from mathutils.kdtree import KDTree
            kd=KDTree(len(exclude_near)); [kd.insert(Vector(p),i) for i,p in enumerate(exclude_near)]; kd.balance()
            new=np.array([kd.find(Vector(p))[2]>1e-5 for p in co]); t=t[new[t].any(1)]
        tree=BVHTree.FromPolygons([Vector(p) for p in co],t.tolist(),all_triangles=True)
        return co,t,tree,None
    @staticmethod
    def tree(co,t): return BVHTree.FromPolygons([Vector(p) for p in co],t.tolist(),all_triangles=True)
    def depth(s,A_co,A_t,ov,B_tree,proper=None,idx=0):
        """approx penetration depth (m) & count of wrong-side involved verts of A vs surface B"""
        if not ov: return 0.0,0
        inv=np.unique(A_t[[o[idx] for o in ov]].ravel())
        sg=[];dd=[]
        for i in inv:
            cp,n,fi,d=B_tree.find_nearest(Vector(A_co[i]))
            if cp is None: continue
            sg.append(np.sign((Vector(A_co[i])-cp).dot(n))); dd.append(d)
        sg=np.array(sg); dd=np.array(dd)
        if proper is None:  # majority side of A verts near B = proper side
            near=[]
            sub=np.unique(A_t.ravel()); sub=sub[::max(1,len(sub)//3000)]
            for i in sub:
                cp,n,fi,d=B_tree.find_nearest(Vector(A_co[i]),0.03)
                if cp is not None: near.append(np.sign((Vector(A_co[i])-cp).dot(n)))
            proper=1.0 if (np.sum(near)>=0) else -1.0
        bad=sg!=proper
        return (float(dd[bad].max()) if bad.any() else 0.0), int(bad.sum())
    @staticmethod
    def self_pairs(co,t):
        """thin-sheet self-intersection: true triangle-triangle intersections of a garment with itself, excluding triangles sharing a vertex"""
        tr=BVHTree.FromPolygons([Vector(p) for p in co],t.tolist(),all_triangles=True); ov=tr.overlap(tr); n=0
        for i,j in ov:
            if i<j and not (set(t[i].tolist())&set(t[j].tolist())): n+=1
        return n
    def set_layer_baseline(s):
        """call at REST (sit_corrective 0): which side of the dress each nearby apron vertex lies on"""
        dc,dt=s.ev(DRESS,False); ac,at=s.ev(APRON,False); DT=s.tree(dc,dt); base={}
        for i in np.unique(at.ravel()):
            cp,n,fi,d=DT.find_nearest(Vector(ac[i]),0.02)
            if cp is not None and d>1e-5: base[int(i)]=float(np.sign((Vector(ac[i])-cp).dot(n)))
        s.layer_base=base
    def layer_cross(s,ac,DT):
        bad=0; worst=0.0; s.last_bad=[]
        for i,s0 in getattr(s,'layer_base',{}).items():
            cp,n,fi,d=DT.find_nearest(Vector(ac[i]),0.03)
            if cp is None: continue
            sg=np.sign((Vector(ac[i])-cp).dot(n))
            if sg!=s0 and d>1e-5: bad+=1; worst=max(worst,d); s.last_bad.append((int(i),float(d)))
        return bad,worst
    def run(s, garments_midsurface_too=True):
        R={}
        bc,_=s.ev(BODY); T=s.T
        BT={k:s.tree(bc,T[v]) for k,v in s.parts.items() if len(v)}
        def rec(name,A_co,A_t,B_tree,ATree,proper=None):
            ov=ATree.overlap(B_tree); d,n=s.depth(A_co,A_t,ov,B_tree,proper)
            R[name]={'tri_pairs':len(ov),'wrong_side_verts':n,'depth_mm':round(d*1000,2)}
        # body self pairs (pass2 set) incl positive control
        for p,q in [('legL','legL_ctrl'),('handL','legL'),('handL','legR'),('handR','legR'),('handR','legL'),('handL','torso'),('handR','torso'),('handL','handR'),('armL','torso'),('armR','torso'),('legL','legR'),('armL','legL'),('armL','legR'),('armR','legL'),('armR','legR')]:
            ov=BT[p].overlap(BT[q]); R[f'self:{p}x{q}']={'tri_pairs':len(ov)}
        hc,ht=s.ev(HAIR); HT=s.tree(hc,ht)
        for q in ['torso','armL','armR','uarmL','uarmR','handL','handR']:
            R[f'self:hairx{q}']={'tri_pairs':len(HT.overlap(BT[q]))}
        # garments
        modes=[('visible',True)]+([('midsurface',False)] if garments_midsurface_too else [])
        for mode,solid in modes:
            dc,dt=s.ev(DRESS,solid); ac,at=s.ev(APRON,solid); DT=s.tree(dc,dt); AT=s.tree(ac,at)
            for g in ['legL','legR','handL','handR','armL','armR','uarmL','uarmR','torso','bow']:
                pt=T[s.parts[g]]
                rec(f'garment[{mode}]:{g}xdress',bc,pt,DT,BT[g]); rec(f'garment[{mode}]:{g}xapron',bc,pt,AT,BT[g])
            rec(f'garment[{mode}]:apronxdress',ac,at,DT,AT)
            if mode=='midsurface':
                R['thin_sheet:dress_self']={'tri_pairs':s.self_pairs(dc,dt)}; R['thin_sheet:apron_self']={'tri_pairs':s.self_pairs(ac,at)}
                b_,w_=s.layer_cross(ac,DT); R['layer_cross:apron_vs_dress']={'verts_inside':b_,'depth_mm':round(w_*1000,2)}
            if mode=='visible': VIS=(dc,dt,DT,ac,at,AT)
        dc,dt,DT,ac,at,AT=VIS
        # chair (real mesh) – label chair hits by chair-local location
        cco,ctri,CT,_=s.chair
        def chair_label(fi):
            c=Vector(cco[ctri[fi]].mean(0)); l=s.chMi@c
            if l.z<0.33: return 'chair_legs'
            if l.y>0.17 and l.z>0.40: return 'chair_back'
            if l.y<-0.15: return 'chair_front_edge'
            return 'chair_seat'
        for nm,(A_co,A_t,ATr) in {'body':(bc,T,BT['body']),'body_nobow':(bc,T[s.parts['body_nobow']],BT['body_nobow']),'dress':(dc,dt,DT),'apron':(ac,at,AT),'hair':(hc,ht,HT)}.items():
            ov=ATr.overlap(CT); lab=collections.defaultdict(list)
            for o in ov: lab[chair_label(o[1])].append(o)
            for L in ['chair_seat','chair_back','chair_front_edge','chair_legs']:
                d,n=s.depth(A_co,A_t,lab.get(L,[]),CT,proper=1.0)
                R[f'chair:{nm}x{L}']={'tri_pairs':len(lab.get(L,[])),'wrong_side_verts':n,'depth_mm':round(d*1000,2)}
            # INFORMATIONAL ONLY (team 17:02): armrest-variant mesh (not in game; chair choice may change). Not part of pass/fail.
            aco,atri,ATT,_=s.arms
            ov=ATr.overlap(ATT); d,n=s.depth(A_co,A_t,ov,ATT,proper=1.0)
            R[f'info_chair_variant:{nm}xarmrest_mesh']={'tri_pairs':len(ov),'wrong_side_verts':n,'depth_mm':round(d*1000,2)}
            # proxy boxes containment
            pts=A_co[np.unique(A_t.ravel())]
            for bn,bx in s.boxes.items():
                if not any(k in bn for k in ('chair','side_table','walls','stool','desk','door')): continue
                if 'armrest' in bn: continue   # team decision 16:59: game chair has NO armrests; col_int_chair_armrest_l/_r ignored (backrest still counts)
                o=bx[0]; 
                # box axes from corners
                e=[bx[i]-o for i in range(1,8)]; e=sorted(e,key=np.linalg.norm)
                ax=[e[0]]; 
                for v in e[1:]:
                    if all(abs(np.dot(v,a))/(np.linalg.norm(v)*np.linalg.norm(a))<1e-3 for a in ax): ax.append(v)
                    if len(ax)==3: break
                if len(ax)<3: continue
                M=np.array(ax).T; loc=np.linalg.solve(M,(pts-o).T).T
                ins=(loc>0).all(1)&(loc<1).all(1)
                if 'walls' in bn: continue
                if ins.any():
                    L=np.array([np.linalg.norm(a) for a in ax]); dmin=np.minimum(loc[ins],1-loc[ins])*L
                    R[f'proxy:{nm}x{bn}']={'verts_inside':int(ins.sum()),'depth_mm':round(float(dmin.min(1).max())*1000,2)}
                else: R[f'proxy:{nm}x{bn}']={'verts_inside':0,'depth_mm':0.0}
            # env meshes (props minus chair, shell)
            for en,(eco,et,ET,_) in s.env.items():
                ov=ATr.overlap(ET); d,n=s.depth(A_co,A_t,ov,ET,proper=1.0)
                R[f'env:{nm}x{en}']={'tri_pairs':len(ov),'wrong_side_verts':n,'depth_mm':round(d*1000,2)}
            # ground
            pts=A_co[np.unique(A_t.ravel())]; low=pts[pts[:,2]<0.06]; worst=0.0;cnt=0
            for p in low:
                hit=s.gtree.ray_cast(Vector((p[0],p[1],0.3)),Vector((0,0,-1)),0.5)
                if hit[0] is not None and p[2]<hit[0].z-1e-4: cnt+=1; worst=max(worst,hit[0].z-p[2])
            R[f'ground:{nm}']={'verts_below':cnt,'depth_mm':round(worst*1000,2)}
        return R
