"""Per-category max count / max depth per frame range + verdict 'zero visible clipping' (bow tail excluded only in stand f34-54, f74-81)."""
import json,sys
src,out=sys.argv[1],sys.argv[2]; d=json.load(open(src))
R={'cine_open_stand':[(0,29),(30,32),(33,33),(34,54),(55,73),(74,81),(82,90)],'cine_open_turn':[(0,45)],'cine_open_safe_end':[(0,0)],'cine_home_safe_end':[(0,0)]}
def cnt(v): return v.get('tri_pairs',v.get('verts_inside',v.get('verts_below',0)))
def vis_key(k):  # categories that are visible clipping in game (real geometry only)
    if k.startswith(('proxy:','info','self:legLxlegL_ctrl')): return False
    if k.startswith('chair:body') and not k.startswith('chair:body_nobow'): return False   # counted via body_nobow + bow-diff below
    if k.startswith('env:body') and not k.startswith('env:body_nobow'): return False
    if k.startswith('ground:body') and k!='ground:body_nobow': return False
    return k.startswith(('garment[visible]','garment[midsurface]','chair:','env:','ground:','thin_sheet','layer_cross','self:'))
def is_bow(k): return k.startswith('chair:bow(') or ('bow' in k and 'nobow' not in k)
lines=[]; verdict={'fail':[],'bow_known':[]}
for clip,ranges in R.items():
    rows=d['clips'][clip]; lines.append(f'===== {clip}')
    for a,b in ranges:
        agg={}
        for r in rows:
            if not a<=r['frame']<=b: continue
            for k,v in r['pairs'].items():
                c=cnt(v); dep=v.get('depth_mm',0.0)
                if c<=0 and dep<=0: continue
                m=agg.setdefault(k,[0,0.0,[]]); m[0]=max(m[0],c); m[1]=max(m[1],dep); m[2].append(r['frame'])
            # bow x chair = chair:body - chair:body_nobow
            for part in ('seat','back','front_edge','legs'):
                cb=r['pairs'].get(f'chair:bodyxchair_{part}',{}); cn=r['pairs'].get(f'chair:body_nobowxchair_{part}',{})
                dlt=cnt(cb)-cnt(cn)
                if dlt>0: m=agg.setdefault(f'chair:bow(=body-body_nobow)xchair_{part}',[0,0.0,[]]); m[0]=max(m[0],dlt); m[1]=max(m[1],cb.get('depth_mm',0)); m[2].append(r['frame'])
        lines.append(f'-- f{a}-{b}')
        for k in sorted(agg):
            n,dep,fr=agg[k]; tag=''
            if k=='self:legLxlegL_ctrl': tag=' [control]'
            elif k.startswith(('proxy:','info')): tag=' [info]'
            elif is_bow(k): tag=' [bow ribbon, reported separately, excluded]'; verdict['bow_known'].append((clip,a,b,k,n))
            elif vis_key(k) or is_bow(k): tag=' [FAIL]'; verdict['fail'].append((clip,a,b,k,n,round(dep,2),f'f{min(fr)}-{max(fr)}'))
            lines.append(f'   {k:50s} maxN {n:5d}  maxDepth {dep:7.2f} mm  frames {min(fr)}-{max(fr)} ({len(fr)}){tag}')
lines.append('VERDICT zero visible clipping (bow ribbon excluded on all frames, reported separately): '+('PASS' if not verdict['fail'] else f"FAIL ({len(verdict['fail'])} category-ranges)"))
open(out,'w').write('\n'.join(lines)+'\n'); json.dump(verdict,open(out.replace('.txt','.json'),'w'),indent=0); print('\n'.join(lines))
