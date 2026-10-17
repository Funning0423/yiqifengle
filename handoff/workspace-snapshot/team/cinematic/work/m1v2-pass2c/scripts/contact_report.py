"""Itemised contact/clipping report from a check json: every (clip, pair, frame-run) with any intersection, incl. <=2 mm items (NOT auto-pass)."""
import json, sys, collections
d=json.load(open(sys.argv[1])); out=sys.argv[2]
def n_of(v): return v.get('tri_pairs',v.get('verts_inside',v.get('verts_below',0)))
items=[]
for clip,frames in d['clips'].items():
    runs=collections.OrderedDict()
    for fr in frames:
        for p,v in fr['pairs'].items():
            if p.startswith('self:legLxlegL_ctrl'): continue
            n=n_of(v)
            if n: runs.setdefault(p,[]).append((fr['frame'],n,v.get('depth_mm')))
    for p,rows in runs.items():
        seg=[rows[0]]
        for r in rows[1:]+[None]:
            if r is not None and r[0]==seg[-1][0]+1: seg.append(r); continue
            dm=[x[2] for x in seg if x[2] is not None]
            cat=('informational (armrest variant, not in game)' if p.startswith('info_') else 'model-side' if any(k in p for k in ('torsoxapron','torsoxdress','thin_sheet','layer_cross','apronxdress')) else 'see README')
            items.append({'clip':clip,'pair':p,'frames':[seg[0][0],seg[-1][0]],'max_count':max(x[1] for x in seg),'max_depth_mm':max(dm) if dm else None,
                          'le_2mm':(max(dm)<=2.0) if dm else None,'auto_pass':False,'category_hint':cat})
            if r is not None: seg=[r]
json.dump({'rule':'every intersection is listed; <=2 mm is NOT auto-pass (Oi item 5)','items':items},open(out,'w'),indent=1)
print(len(items),'items;',sum(1 for i in items if i['le_2mm']),'<=2mm')
