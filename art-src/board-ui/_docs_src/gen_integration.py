# 生成 INTEGRATION.md：手写部分 + 从各 sizes.json 自动生成的切图表。python3 _docs_src/gen_integration.py（在 棋盘UI美术bot 根目录）
import json, os, subprocess
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def J(p): return json.load(open(os.path.join(R,p)))
def table(rows,prefix,cols=('file','w','h','bytes','note'),group=True):
    out=['| 文件 | 尺寸 | 字节 | 组 | 说明 |','|---|---|---|---|---|']
    for r in rows:
        out.append('| `%s%s` | %s | %s | %s | %s |'%(prefix,r['file'],('%d×%d'%(r['w'],r['h'])) if r.get('w') else '—',format(r['bytes'],','),r.get('group',''),r.get('note','').replace('|','/')))
    return '\n'.join(out)
def fsize(p): return os.path.getsize(os.path.join(R,p))
a_files=['title.png','logo.png','bar_track.png','bar_fill.png','pinwheel.png','loading_bg_PLACEHOLDER.jpg']
a_rows=[]
from PIL import Image
for f in a_files:
    im=Image.open(os.path.join(R,'a-loading/slices',f)); a_rows.append(dict(file=f,w=im.width,h=im.height,bytes=fsize('a-loading/slices/'+f),group='加载页',note=''))
b=J('b-board/slices/sizes.json'); c=J('c-popups/slices/sizes.json'); r2=J('c-popups/r2/slices/sizes.json')['rows']
r3=J('c-popups/r3/slices/cabin_hint.json')['rows']+J('c-popups/r3/slices/about.json')['rows']
for x in r3: x.setdefault('group','r3')
coords=J('a-loading/first-screen/coords.json')
reward=J('c-popups/reward_layout.json')
cab=J('c-popups/r3/slices/cabin_hint.json')
tot_a=sum(x['bytes'] for x in a_rows if 'PLACEHOLDER' not in x['file'])
tot_b=sum(x['bytes'] for x in b)
tot_c=sum(x['bytes'] for x in c if not x['group'].startswith('宝箱(2D'))
tot_r2=sum(x['bytes'] for x in r2 if not (x['file'].startswith('hero_') and 'starlight' not in x['file']))
tot_r3=sum(x['bytes'] for x in r3)
sha=subprocess.run(['git','-C','/workspace/yiqifengle/work/棋盘UI美术bot','rev-parse','--short=7','HEAD'],capture_output=True,text=True).stdout.strip() or 'd637356'
doc=open(os.path.join(R,'_docs_src/INTEGRATION.head.md')).read()
doc=doc.replace('{{A_TABLE}}',table(a_rows,'a-loading/slices/')).replace('{{B_TABLE}}',table(b,'b-board/slices/')).replace('{{C_TABLE}}',table(c,'c-popups/slices/')).replace('{{R2_TABLE}}',table(r2,'c-popups/r2/slices/')).replace('{{R3_TABLE}}',table(r3,'c-popups/r3/slices/'))
doc=doc.replace('{{COORDS}}',json.dumps(coords,ensure_ascii=False,indent=1)).replace('{{REWARD}}',json.dumps(reward,ensure_ascii=False,indent=1)).replace('{{CABIN}}',json.dumps({k:v for k,v in cab.items() if k!='rows'},ensure_ascii=False,indent=1))
for k,v in dict(TOT_A=tot_a,TOT_B=tot_b,TOT_C=tot_c,TOT_R2=tot_r2,TOT_R3=tot_r3,TOT_ALL=tot_a+tot_b+tot_c+tot_r2+tot_r3).items(): doc=doc.replace('{{%s}}'%k,format(v,','))
doc=doc.replace('{{SHA}}',sha)
open(os.path.join(R,'INTEGRATION.md'),'w').write(doc); print(len(doc),tot_a,tot_b,tot_c,tot_r2,tot_r3)
