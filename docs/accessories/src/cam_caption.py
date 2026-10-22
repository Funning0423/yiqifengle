import json,glob,os,subprocess
from PIL import Image,ImageDraw,ImageFont
V=json.load(open('raw/visibility.json'));FONT=[l.split(':')[0] for l in subprocess.run(['fc-list',':lang=zh','file'],capture_output=True,text=True).stdout.split('\n') if l][0]
f=ImageFont.truetype(FONT,34);fs=ImageFont.truetype(FONT,22)
EST={'follow':'机位来自运镜bot camera-track.json：竖直 FOV 68°，距离 2.32 m，俯角 16.8°；方位角是估计值','stand':'估计机位：FOV 40°，距离 1.1 m，俯角 10°；高台用旧版 (−0.20, 0.40, 0.36)','ladder':'估计机位：FOV 60°，仰角 28°，距离 1.6 m；没有爬梯动画，用提灯站姿代替'}
thumbs=[]
for name,v in V.items():
    vis=v['bad_px']>0
    for tod in ('day','night'):
        im=Image.open(f'raw/{name}_{tod}.png').convert('RGB');W,H=im.size;c=Image.new('RGB',(W,H+150),(20,20,20));c.paste(im,(0,0));d=ImageDraw.Draw(c)
        d.text((16,H+10),f'commit f9c343c1 | {name} | {"白天" if tod=="day" else "夜间（lantern.core 暖橙点光）"}',font=f,fill=(255,255,255))
        d.text((16,H+56),f'穿插三角可见：{"是" if vis else "否"}（{v["bad_px"]} px，握把 {v["grip_px"]} px，1170×2532）',font=f,fill=(255,120,120) if vis else (120,255,120))
        d.text((16,H+104),EST[name.split('_')[0]],font=fs,fill=(200,200,200))
        c.save(f'{name}_{tod}.png');thumbs.append((name,tod,c.resize((234,536))))
        os.system(f'python3 ../../../src/zoom.py raw {name} {tod} 4 /tmp/zz.png')
        z=Image.open('/tmp/zz.png');zc=Image.new('RGB',(z.width,z.height+60),(20,20,20));zc.paste(z,(0,0));ImageDraw.Draw(zc).text((8,z.height+12),f'f9c343c1 | {name} | {tod} | 4×放大，右图：品红=穿插三角，绿=握把 | 可见：{"是" if vis else "否"}',font=fs,fill=(255,255,255));zc.save(f'{name}_{tod}_zoom4x.png')
cols=8;rows=(len(thumbs)+cols-1)//cols;S=Image.new('RGB',(cols*234,rows*536),(0,0,0))
for i,(n,t,im) in enumerate(thumbs): S.paste(im,((i%cols)*234,(i//cols)*536))
S.save('contact_sheet.jpg',quality=88);print(len(thumbs))
