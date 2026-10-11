# Export runtime slices (+pngquant) and sizes.json.  python3 slices.py <outdir>
import sys, os, json, subprocess, shutil, math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from ui_kit import *
from compose import rays
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
fr=scaled(L('panel_frame_clean'),FRAME_SCALE); ins=round(FRAME_INS[0]*FRAME_SCALE)
save(compact(fr,ins,ins),'panel_frame_9s','弹窗框',f'精简版（无角钉）。九宫格 insets {ins} px（四边相同），中心 24 px 可拉伸；所有弹窗宽 680')
pl=scaled(A('title_plank_clean'),0.56); e=round(150*0.56); save(compact(pl,e,0),'title_plank_3s','弹窗框','精简版（无绳无钉）。三宫格：左右各 %d px 不拉伸'%e)
for k in ('primary','secondary'):
    b=fith(A('btn_'+k),104); e=round(110*104/A('btn_'+k).height); save(compact(b,e,0),'btn_%s_3s'%k,'通用按钮','三宫格：左右各 %d px 不拉伸；高 104 = 54pt'%e)
save(fitw(A('btn_close'),96),'btn_close','通用按钮','命中区 ≥44pt')
for k in ('restart','bag','settings'): save(fitw(A('tile_'+k),150),'tile_'+k,'暂停图标')
for k in ('music','sfx','sun','moon','motion','home','about','play'): save(fith(A('icon_'+k),84 if k!='play' else 56),'icon_'+k,'小图标')
save(fith(A('toggle_on'),56),'toggle_on','开关','也做音乐音量滑条的已填充段（三宫格，左右各 28 px）'); save(fith(A('toggle_off'),56),'toggle_off','开关','也做音乐音量滑条的轨道（三宫格）'); save(fith(A('toggle_knob'),48),'toggle_knob','开关','跟随 isOn 左右移动 0.15 s')
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
