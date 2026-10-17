import json,collections
d=json.load(open('/workspace/handoff-prep/sel.json'))
H='/tmp/wt-handoff/handoff/'
ex=sorted(d['exc'])
with open(H+'EXCLUDED_FROM_SNAPSHOT.tsv','w') as f:
    f.write('path(relative to /workspace/wechat-game)\tbytes\treason\n')
    for p,s,w in ex: f.write(f'{p}\t{s}\t{w}\n')
c=collections.Counter();n=collections.Counter()
for p,s,w in ex: c[w]+=s;n[w]+=1
lines=['| 排除原因 | 檔案數 | 大小 |','|---|---|---|']
for w,s in c.most_common(): lines.append(f'| {w} | {n[w]} | {s/1e6:,.1f} MB |')
big=[(p,s) for p,s,w in ex if s>50_000_000]
inc=sum(s for _,s in d['inc'])
open('/workspace/handoff-prep/excl_summary.md','w').write('\n'.join(lines)+'\n')
open('/workspace/handoff-prep/big.md','w').write('\n'.join(f'| `{p}` | {s/1e6:.1f} MB |' for p,s in sorted(big,key=lambda x:-x[1]))+'\n')
print(len(d['inc']),inc/1e6, sum(c.values())/1e6)
