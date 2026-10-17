import json,sys
for t in sys.argv[1:]:
    d=json.load(open(f'probe/jitter_{t}.json'))['frames']; s=[]
    for o in ('G2_DRESS_R5G2','G2_APRON_R5G2','G2_BOW_TAILS_R5G2'):
        if o not in d[0]: continue
        s.append(f"{o[3:8]} vis-pop-vert-frames {sum(r[o]['n_pop_visible'] for r in d):5d} maxVis {max(r[o]['max_pop_visible'] for r in d):6.2f} allMax {max(r[o]['max_pop'] for r in d):6.2f}")
    print(f'{t:6s}',' | '.join(s))
