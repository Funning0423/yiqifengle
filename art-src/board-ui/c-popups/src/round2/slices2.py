# r2 切图（pngquant）+ sizes.json。python3 slices2.py <c-popups>
import sys, os, json, subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE)); sys.path.insert(0,HERE)
CP=os.path.abspath(sys.argv[1] if len(sys.argv)>1 else os.path.join(HERE,'../..')); sys.argv=[sys.argv[0],CP]
from ui_kit import *
import compose2 as C2
SL=os.path.join(CP,'r2','slices'); os.makedirs(SL,exist_ok=True)
for f in os.listdir(SL): os.remove(os.path.join(SL,f))
rows=[]
def save(im,name,group,note=''):
    p=os.path.join(SL,name+'.png'); im.save(p)
    subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p],check=False)
    rows.append(dict(file=name+'.png',group=group,w=im.width,h=im.height,bytes=os.path.getsize(p),note=note))
def compact(im,l,t,mid=16):
    w,h=im.size; r=l; b=t
    cx0=(w-mid)//2; cy0=(h-mid)//2 if t else 0
    nw=l+mid+r; nh=(t+mid+b) if t else h; o=Image.new('RGBA',(nw,nh),(0,0,0,0))
    xs=[(0,l,0),(cx0,cx0+mid,l),(w-r,w,l+mid)]; ys=[(0,t,0),(cy0,cy0+mid,t),(h-b,h,t+mid)] if t else [(0,h,0)]
    for (a0,a1,dx) in xs:
        for (b0,b1,dy) in ys: o.alpha_composite(im.crop((a0,b0,a1,b1)),(dx,dy))
    return o
src=C2.A2('sign_plank_clean'); sp=scaled(src,176/src.height); e=round(sp.width*0.16); save(compact(sp,e,0),'sign_plank_3s','旅程册',f'精简版（无钉）横幅章节牌，三宫格（横向）：左 {e} px / 右 {e} px（箭头）不拉伸；高 176，显示宽 544')
REGION_GLB={'tide':'combined_visual_m.glb','sky':'env_skycity.glb'}
for rid,lk,ph_ in (('tide',False,False),('meadow',False,True),('sky',False,False),('sky',True,False)):
    save(C2.region_window(rid,200,128,lk,ph_),'region_%s%s'%(rid,'_locked' if lk else ''),'旅程册',('地区之窗 200×128（含 4 px 窗沿）'+('；占位图' if ph_ else '；%s 实渲'%REGION_GLB[rid])+('；未解锁：去色 + 雾' if lk else '')))
save(fitw(C2.A2('tool_starlight_hero'),400),'hero_starlight','首次获得','道具介绍大图 400 px（(b) v3.1 模型 720 px 重渲后缩）')
for t in ('windbell','tidebottle'): save(fitw(C2.A2('tool_%s_hero'%t),400),'hero_'+t,'首次获得','同上（可选：先只放星光）')
for t,cn in (('tidenet','潮汐网'),('sunseed','日光籽'),('starshears','星剪')): save(C2.A2('tool_'+t),'tool_'+t,'行囊',cn+'：本轮补的 3D 道具（和 (b) tool_* 同机位同尺寸，道具栏也能直接用）')
save(fith(C2.A2('icon_charm'),96),'icon_charm','行囊','装扮空状态的蝴蝶结（运行时半透明）')
save(fith(C2.A2('icon_lock'),72),'icon_lock','结算','旅途回顾说明行 / 未解锁章节共用（显示 36–64 px）')
save(fith(C2.A2('beacon_lighthouse'),96),'beacon_lighthouse','灯塔目标格','格子角上的小灯塔；HUD 目标图标用同一张缩小')
rg=crop(Image.open(os.path.join(C2.R2,'beacon_ring.png')).convert('RGBA')); save(fitw(rg,96),'beacon_ring','灯塔目标格','金色灯座框（1 格大小，四角灯珠）；暖光池用程序画（0 B）')
for t in ('星光','旅人的行囊','旅程册','海岛小憩','还没存上','旅途回顾'): save(baked_title(t),'title_'+t,'标题字（烘焙）','霞鹜文楷 46 px，同 (c)')
for t in ('潮汐小径','花粉草甸','天空回声'): save(baked_title(t,40),'chapter_'+t,'标题字（烘焙）','章节名 40 px')
tot=sum(r['bytes'] for r in rows if not r['group'].startswith('精简')); groups={}
for r in rows: groups[r['group']]=groups.get(r['group'],0)+r['bytes']
json.dump(dict(rows=rows,groups=groups,total=tot),open(os.path.join(SL,'sizes.json'),'w'),ensure_ascii=False,indent=1)
print(groups,tot)
