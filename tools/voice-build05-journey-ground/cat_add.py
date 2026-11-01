"""python3 cat_add.py out.json a.json b.json ... — concatenate scatter passes per mesh (index-offset) for merge.mjs."""
import json,sys
out={}
for f in sys.argv[2:]:
    a=json.load(open(f))
    for m in ('env_sky_static_foliage_cards','env_sky_static_palette'):
        o=out.setdefault(m,{'pos':[],'nor':[],'uv':[],'idx':[]}); n=len(o['pos'])
        for k in ('pos','nor','uv'): o[k]+=a[m][k]
        o['idx']+=[i+n for i in a[m]['idx']]
json.dump(out,open(sys.argv[1],'w'))
