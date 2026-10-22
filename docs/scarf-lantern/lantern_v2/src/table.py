import json,glob,csv
R=[];[R.extend(json.load(open(f))) for f in sorted(glob.glob('qa/qa_[abcx]*.json'))]
keys=[k for k in R[0] if k not in('hand_hips',)]+['fo']
with open('QA_frames.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(dict.fromkeys(keys+['hand_hips'])),extrasaction='ignore');w.writeheader();[w.writerow(r) for r in R]
HIT=[k for k in R[0] if k.startswith(('L_','ARMR_','HANDR_')) and k not in('L_HANDR_grip','L_cloth_gap_mm')]
grp={}
for r in R:grp.setdefault((r['run'] if r['run'] in('XF','XF_Wmax') else r['run'],r['clip']),[]).append(r)
L=['| run | 片段 | 帧 | 穿插合计(灯/右臂/右手 × 腿·身体·左臂·裙·围裙·飘带) | 灯-布最小间隙 mm | 外展° (绑定≈10) | 前臂俯仰° | 屈肘° | 前臂扭° | 腕扭° | 灯摆° max | 握把接触三角(参考) |','|'+'---|'*12]
tot=0
for (run,c),rs in grp.items():
    h=sum(sum(r[k] for k in HIT) for r in rs);tot+=h
    mm=lambda k:(min(r[k] for r in rs),max(r[k] for r in rs))
    L.append(f"| {run} | {c} | {len(rs)} | {h} | {mm('L_cloth_gap_mm')[0]} | {mm('abd')[0]}–{mm('abd')[1]} | {mm('fore_pitch')[0]}–{mm('fore_pitch')[1]} | {mm('elbow_flex')[0]}–{mm('elbow_flex')[1]} | {mm('fore_twist')[1]} | {mm('wrist_twist')[1]} | {mm('pend_deg')[1]} | {mm('L_HANDR_grip')[0]}–{mm('L_HANDR_grip')[1]} |")
L.append(f'\n总帧数 {len(R)}，穿插合计 {tot}')
open('QA_table.md','w').write('\n'.join(L));print('\n'.join(L))
