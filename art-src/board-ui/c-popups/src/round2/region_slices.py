# 只重出旅程册的地区之窗切图（render_regions.py 重渲以后用），同步 r2/slices/sizes.json；其余 r2 切图不动。
# python3 region_slices.py <c-popups> [sky,sky_locked,...]
import sys, os, json, subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE)); sys.path.insert(0,HERE)
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..')); WHICH=sys.argv[2].split(',') if len(sys.argv)>2 else ['tide','meadow','sky','sky_locked']
sys.argv=[sys.argv[0],CP]
import compose2 as C2
SL=os.path.join(CP,'r2','slices'); SP=os.path.join(SL,'sizes.json'); sizes=json.load(open(SP))
GLB={'tide':'combined_visual_m.glb','sky':'env_skycity.glb'}; PLACEHOLDER={'meadow'}
for key in WHICH:
    rid=key.split('_')[0]; lk=key.endswith('_locked'); ph_=rid in PLACEHOLDER
    im=C2.region_window(rid,200,128,lk,ph_); name='region_'+key; p=os.path.join(SL,name+'.png'); im.save(p)
    subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p],check=False)
    row=dict(file=name+'.png',group='旅程册',w=im.width,h=im.height,bytes=os.path.getsize(p),
             note='地区之窗 200×128（含 4 px 窗沿）'+('；占位图' if ph_ else '；%s 实渲'%GLB[rid])+('；未解锁：去色 + 雾' if lk else ''))
    sizes['rows']=[row if r['file']==row['file'] else r for r in sizes['rows']]; print(name, row['bytes'])
groups={}
for r in sizes['rows']: groups[r['group']]=groups.get(r['group'],0)+r['bytes']
sizes['groups']=groups; sizes['total']=sum(r['bytes'] for r in sizes['rows'] if not r['group'].startswith('精简'))
json.dump(sizes,open(SP,'w'),ensure_ascii=False,indent=1)
print(groups.get('旅程册'),sizes['total'])
