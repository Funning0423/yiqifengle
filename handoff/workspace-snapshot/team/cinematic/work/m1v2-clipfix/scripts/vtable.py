import json,sys,os
for t in sys.argv[1:]:
    m=json.load(open(f'probe/measure_{t}.json')); c=json.load(open(f'probe/cloth_{t}.json'))['cine_open_stand']
    fr=[r for r in m['frames'] if r['clip']=='cine_open_stand']
    def mx(k): return max(r[k]['depth_mm'] for r in fr)
    legs={g:max(mx(f'legLx {g}[mid]'),mx(f'legRx {g}[mid]')) for g in ('dress','apron')}
    sh={g:max(mx(f'legLx {g}[shell_bound]'),mx(f'legRx {g}[shell_bound]')) for g in ('dress','apron')}
    print(f"{t:8s} legs×dress mid {legs['dress']:7.2f} shellB {sh['dress']:6.2f} | legs×apron mid {legs['apron']:7.2f} shellB {sh['apron']:6.2f} | chairback legs {max(mx('legLx chair_back_proxy'),mx('legRx chair_back_proxy')):7.2f} | accel mm/f2 "+' '.join(f"{o[3:8]} {v['max_accel_mm_per_frame2']:6.1f}@{v['accel_at_frame']}" for o,v in c.items()))
