# 三件地区道具（潮汐网 / 日光籽 / 星剪）v3 的后处理，只动这三件：
#   1. 切图 → r2/slices/tool_*.png（pngquant 70-92，和 slices2.py 同一做法），回写 sizes.json 里这三行并重算合计
#   2. 行囊样张 r2/bag_island.png、r2/bag_level.png（compose2.bag，用新图标）
#   3. r2/compare/bag_tools_old_vs_new.jpg：旧图标 ↔ 新图标的行囊样张；再调 tools_compare.py 出两张道具对比图
# 用法（先用 build_popups.py 把 tool_tidenet,tool_sunseed,tool_starshears 渲到 raw/）：
#   ISLAND_IMG=<岛截图> python3 region_tools.py <c-popups>
import sys, os, json, subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE)); sys.path.insert(0,HERE)
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..')); sys.argv=[sys.argv[0],CP]
from ui_kit import *
import compose2 as C2
import compose as C
R2O=os.path.join(CP,'r2'); SL=os.path.join(R2O,'slices'); CMP=os.path.join(R2O,'compare'); os.makedirs(CMP,exist_ok=True)
TOOLS3=(('tidenet','潮汐网'),('sunseed','日光籽'),('starshears','星剪'))

# ---- 1. 切图
js=json.load(open(os.path.join(SL,'sizes.json'))); rows={r['file']:r for r in js['rows']}
for t,cn in TOOLS3:
    im=C2.A2('tool_'+t); p=os.path.join(SL,'tool_%s.png'%t); im.save(p)
    subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p],check=False)
    r=rows['tool_%s.png'%t]; r.update(w=im.width,h=im.height,bytes=os.path.getsize(p),note=cn+'：地区道具 v3（精细版；和 (b) tool_* 同机位同尺寸，道具栏也能直接用；旧版在 src/round2/raw_v1/）')
    print(p,im.size,r['bytes'])
tot=sum(r['bytes'] for r in js['rows'] if not r['group'].startswith('精简')); groups={}
for r in js['rows']: groups[r['group']]=groups.get(r['group'],0)+r['bytes']
js['groups']=groups; js['total']=tot
json.dump(js,open(os.path.join(SL,'sizes.json'),'w'),ensure_ascii=False,indent=1); print(groups,tot)

# ---- 2. 行囊样张（新图标）
C.OUT=R2O
C2.bag('island'); C2.bag('level')

# ---- 3. 行囊样张对比：旧图标 / 新图标 / 新图标（三件都有货，示意）
def bags(old=False,stock=None):
    C.OUT=CMP; saved=dict(C2._C2); savedT=list(C2.TOOLS)
    if old:
        for t,_ in TOOLS3:
            im=crop(Image.open(os.path.join(HERE,'raw_v1','tool_%s.png'%t)).convert('RGBA')); C2._C2['tool_'+t]=focus_grade(im)
    if stock: C2.TOOLS[:]=[(n,l,stock if n in ('tool_tidenet','tool_sunseed','tool_starshears') else c) for n,l,c in C2.TOOLS]
    res={}
    for where in ('island','level'):
        C2.bag(where); res[where]=Image.open(os.path.join(CMP,'bag_%s.png'%where)).convert('RGB')
    C2._C2.clear(); C2._C2.update(saved); C2.TOOLS[:]=savedT; return res
old=bags(True); new=bags(False); stk=bags(False,1)
for f in ('bag_island.png','bag_level.png'): os.remove(os.path.join(CMP,f))
for where in ('island','level'):
    cols=[('旧图标（本轮前）',old[where]),('新图标',new[where]),('新图标 · 三件有货（示意）',stk[where])]
    h=1180; ims=[im.resize((round(im.width*h/im.height),h),Image.LANCZOS) for _,im in cols]
    out=Image.new('RGB',(sum(i.width for i in ims)+30*(len(ims)+1),h+90),(246,240,226)); d=ImageDraw.Draw(out); x=30
    for (lab,_),im in zip(cols,ims): d.text((x,24),'行囊 · %s　%s'%('岛上' if where=='island' else '关卡内',lab),font=font(24),fill=(70,52,34)); out.paste(im,(x,70)); x+=im.width+30
    p=os.path.join(CMP,'bag_tools_old_vs_new_%s.jpg'%where); out.save(p,quality=86,optimize=True); print(p,os.path.getsize(p))
subprocess.run([sys.executable,os.path.join(HERE,'tools_compare.py'),CP],check=True)
