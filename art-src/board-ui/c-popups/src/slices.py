# Export runtime slices (+pngquant) and sizes.json.  python3 slices.py <outdir>
import sys, os, json, subprocess, shutil, math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from ui_kit import *
from compose import rays
import sharpen_slices as SH
OUT=sys.argv[1] if len(sys.argv)>1 else '..'; SL=os.path.join(OUT,'slices'); os.makedirs(SL,exist_ok=True)
for f in os.listdir(SL): os.remove(os.path.join(SL,f))
rows=[]
def save(im,name,group,note=''):
    p=os.path.join(SL,name+'.png'); im.save(p)
    subprocess.run(['pngquant','--force','--skip-if-larger','--quality','70-92','--speed','1','--strip','--output',p,p],check=False)
    rows.append(dict(file=name+'.png',group=group,w=im.width,h=im.height,bytes=os.path.getsize(p),note=note))
def compact(im,l,t,mid=24):
    # keep corners/edges, collapse the uniform centre to `mid` px (9-slice needs only 1 px of it)
    w,h=im.size; r=l; b=t if t else 0
    cx0=(w-mid)//2; cy0=(h-mid)//2 if t else 0
    nw=l+mid+r; nh=(t+mid+b) if t else h; o=Image.new('RGBA',(nw,nh),(0,0,0,0))
    xs=[(0,l,0),(cx0,cx0+mid,l),(w-r,w,l+mid)]; ys=[(0,t,0),(cy0,cy0+mid,t),(h-b,h,t+mid)] if t else [(0,h,0)]
    for (a0,a1,dx) in xs:
        for (b0,b1,dy) in ys: o.alpha_composite(im.crop((a0,b0,a1,b1)),(dx,dy))
    return o
RAW_DIR=os.path.join(os.path.dirname(os.path.abspath(__file__)),'raw')
for name,im,group,note in SH.frame_and_buttons(RAW_DIR): save(im,name,group,note)
for k in ('restart','bag','settings'): save(fitw(A('tile_'+k),150),'tile_'+k,'暂停图标')
for name,im,group,note in SH.icons_and_toggles(RAW_DIR): save(im,name,group,note)
save(fith(A('star_full'),170),'star_full','结算'); save(fith(A('star_empty'),170),'star_empty','结算','也可用 star_full + 灰化，省 1 张')
for rg,cn in (('tide','潮汐'),('meadow','草甸'),('sky','天空城')): save(fith(A('reward_seal_'+rg),128),'reward_seal_'+rg,'奖励','地区印记·'+cn)
save(fitw(A('chest_body'),380),'chest_closed','宝箱(2D 备选)','只在用 2D Sprite 方案时需要')
save(fitw(A('chest_open'),380),'chest_open','宝箱(2D 备选)','同上')
save(scaled(rays(620),0.5),'fx_rays','奖励','显示时 ×2 放大、慢转 1 圈/12 s；纯程序也可，0 B')
# stamp "已领取"
st=Image.new('RGBA',(200,200),(0,0,0,0)); d=ImageDraw.Draw(st); c=(198,95,45,230)
d.ellipse((10,10,190,190),outline=c,width=8); d.ellipse((26,26,174,174),outline=c,width=3)
d.text((100,100),'已领取',font=kfont(46),fill=c,anchor='mm'); st=st.rotate(-14,resample=Image.BICUBIC)
save(st,'stamp_claimed','奖励','已领取状态')
# titles baked in 霞鹜文楷 (PM 决定 3：全部用烘好的图，和加载页同一套 fontTools→SVG 流程；深棕渐变 + 奶油描边)
for i,t in enumerate(('暂停一下','重来这一关？','设置','获得','过关啦','差一点点')):
    save(baked_title(t),'title_%d'%i,'标题字（烘焙）',t)
# chest GLB
for g in ('result_chest.glb',):
    shutil.copy(os.path.join(OUT,'glb',g),os.path.join(SL,g)); rows.append(dict(file=g,group='宝箱 GLB',w=0,h=0,bytes=os.path.getsize(os.path.join(SL,g)),note='Draco，M_env_palette，不内嵌贴图；子节点 chest_lid 原点在铰链；动画 chest_open 0.5 s（0→−126°→−114°→−118°）'))
json.dump(rows,open(os.path.join(SL,'sizes.json'),'w'),ensure_ascii=False,indent=1)
tot={}
for r in rows: tot[r['group']]=tot.get(r['group'],0)+r['bytes']
print(json.dumps(tot,ensure_ascii=False),sum(r['bytes'] for r in rows))
for r in rows: print(r['file'],r['w'],r['h'],r['bytes'])
