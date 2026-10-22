import json,glob
LK=['L_LEG','L_TORSO','L_ARML','L_ARMR','L_HANDL','L_DRESS','L_APRON','L_BOW','ARMR_TORSO','ARMR_LEG','ARMR_DRESS','ARMR_APRON','ARMR_BOW','HANDR_TORSO','HANDR_LEG','HANDR_DRESS','HANDR_APRON','HANDR_BOW','PLAT_L']
S={}
for f in sorted(glob.glob('out/*.json')):
    n=f.split('/')[-1][:-5];R=json.load(open(f));hits={}
    for r in R:
        for k in LK:
            v=r.get(k)
            if isinstance(v,int) and v>0:
                h=hits.setdefault(k,[0,0,None]);h[0]+=1;h[1]=max(h[1],v);h[2]=h[2] or [r['clip'],r['f'],r['run']]
    held=[r for r in R if r.get('lantern','hand')=='hand' and (r.get('hold') is None or r['hold']>=0.999)]
    ramp=[r for r in R if r.get('lantern','hand')=='hand' and r.get('hold') is not None and r['hold']<0.999]
    mm=lambda L,k,f=min:(f(x[k] for x in L if x.get(k) is not None) if any(x.get(k) is not None for x in L) else None)
    d={'frames':len(R),'clips':sorted(set(r['clip'] for r in R)),'runs':sorted(set(r['run'] for r in R)),'lantern_body_cloth_hits':hits,
       'held_frames':len(held),'grip_vertex_min_mm':mm(held,'grip_min_mm'),'grip_vertex_max_mm':mm(held,'grip_min_mm',max),'grip_pen_verts_max':mm(held,'grip_pen_verts',max),
       'grip_mesh_gap_min_mm':mm(held,'grip_mesh_gap_mm'),'grip_mesh_gap_max_mm':mm(held,'grip_mesh_gap_mm',max),
       'grip_surface_min_mm':mm(held,'grip_surface_min_mm'),'grip_surface_pen_tris_max':mm(held,'grip_surface_pen_tris',max),
       'HAND_x_grip_max':mm(held,'HAND_x_grip',max),'HAND_x_body(bail)_max':mm(held,'HAND_x_body',max),'HAND_x_core_max':mm(R,'HAND_x_core',max),
       'ramp_frames(hold<1)':len(ramp),'ramp_grip_vertex_min_mm':mm(ramp,'grip_min_mm'),
       'min_lantern_cloth_gap_mm':mm([r for r in R if r.get('lantern','hand')!='none'],'L_cloth_gap_mm'),
       'pend_deg_max':max(abs(r['pend_deg']) for r in R if r.get('pend_deg') is not None),'grip_rel_deg_max':max((r.get('grip_rel_deg') or 0) for r in R)}
    for k in ('LEG_DRESS','LEG_APRON','DRESS_APRON'):
        d[k+'_depth_max_mm']=mm(R,k+'_depth_mm',max);d[k+'_tris_max']=mm(R,k+'_tris',max)
        w=max(R,key=lambda r:r.get(k+'_depth_mm',0));d[k+'_worst']=[w['clip'],w['f'],w['run']]
    S[n]=d
json.dump(S,open('summary.json','w'),indent=1,ensure_ascii=False)
for n,d in S.items():print(n,{k:v for k,v in d.items() if k not in('clips',)})
