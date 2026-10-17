import json,collections,sys
d=json.load(open(sys.argv[1]))
for clip,frames in d['clips'].items():
    print('=====',clip)
    agg=collections.OrderedDict()
    for fr in frames:
        for p,v in fr['pairs'].items():
            dep=v.get('depth_mm',0); n=v.get('tri_pairs',v.get('verts_inside',v.get('verts_below',0)))
            a=agg.setdefault(p,[0,None,0,[],0])
            if n or dep>0:
                a[2]+=1; a[3].append(fr['frame']); a[4]=max(a[4],n)
                if dep>=a[0]: a[0]=dep;a[1]=fr['frame']
    for p,a in agg.items():
        if a[2]:
            fs=a[3]; print(f"{p:50s} max {a[0]:7.2f}mm @f{a[1]}  maxN {a[4]:4d} nz {a[2]:2d} [{fs[0]}..{fs[-1]}]")
    last=frames[-1]['pairs']; print('LAST FRAME nonzero:',{p:v for p,v in last.items() if any((x or 0)>0 for x in v.values())})
