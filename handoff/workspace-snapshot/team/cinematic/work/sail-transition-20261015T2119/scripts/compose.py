import json,subprocess,sys,numpy as np
from PIL import Image,ImageDraw,ImageFont
mode,src,t0,tlast,meadow_png,out,nframes,font=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4]),sys.argv[5],sys.argv[6],int(sys.argv[7]),sys.argv[8]
W,H=402,870
D=json.load(open('/tmp/sail/out/cloud_frames.json'));FR=D['frames'];last=D['timing']['lastFrame']
def read_frames(path,start,dur):
    p=subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-t',str(dur),'-i',path,'-vf',f'crop=375:812:0:0,fps=30,scale={W}:{H}','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
    return np.frombuffer(p,np.uint8).reshape(-1,H,W,3)
src_frames=read_frames(src,t0,nframes/30+0.2)
print('src frames',len(src_frames))
n_island=int(round((tlast-t0)*30))  # last real island frame index
tex=[np.frombuffer(open(f'/tmp/sail/out/tex{i}.rgba','rb').read(),np.uint8).reshape(128,128,4) for i in range(3)]
cache={}
def puff_img(t,s):
    sz=max(2,int(round(2*s*H)));k=(t,sz)
    if k not in cache:
        cache[k]=np.asarray(Image.fromarray(tex[t]).resize((sz,sz),Image.BILINEAR)).astype(np.float32)/255
    return cache[k]
M=Image.open(meadow_png).convert('RGB')
mw,mh=M.size
def meadow(blend,night):
    z=1.12-0.12*blend
    cw,ch=mw/z,mh/z;x0=(mw-cw)/2;y0=(mh-ch)*0.55
    im=np.asarray(M.crop((int(x0),int(y0),int(x0+cw),int(y0+ch))).resize((W,H),Image.BILINEAR)).astype(np.float32)
    if night:
        im=im*np.array([0.32,0.38,0.62])+np.array([4,8,22])
    return im
def clouds(img,fr):
    if fr['shown']<=1/255:return img
    for i in reversed(range(len(fr['puffs']))):
        p=fr['puffs'][i]
        if p['a']<=0:continue
        P=puff_img(p['tex'],p['s']);sz=P.shape[0]
        cx=(0.5+p['x'])*W;cy=(0.5-p['y'])*H
        x0=int(round(cx-sz/2));y0=int(round(cy-sz/2))
        xa,ya=max(0,x0),max(0,y0);xb,yb=min(W,x0+sz),min(H,y0+sz)
        if xa>=xb or ya>=yb:continue
        sub=P[ya-y0:yb-y0,xa-x0:xb-x0]
        rgb=sub[...,:3]*np.array(p['rgbn'] if night else p['rgb']);a=sub[...,3:4]*p['a']
        img[ya:yb,xa:xb]=img[ya:yb,xa:xb]*(1-a)+rgb*a
    return img
night=mode=='night'
fnt=ImageFont.truetype(font,15);small=ImageFont.truetype(font,12)
proc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{2*W+6}x{H+44}','-r','30','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18',out],stdin=subprocess.PIPE)
for k in range(nframes):
    b=src_frames[k].astype(np.float32) if k<len(src_frames) else np.zeros((H,W,3),np.float32)
    fi=min(k,len(FR)-1);fr=FR[fi] if k<=last else FR[last+1]
    if k>last: a=meadow(1,night)
    else:
        a=meadow(fr['meadowBlend'],night) if fr['swapped'] else src_frames[min(k,n_island,len(src_frames)-1)].astype(np.float32)
        a=clouds(a,fr)
    canvas=Image.new('RGB',(2*W+6,H+44),(20,20,24))
    canvas.paste(Image.fromarray(np.clip(b,0,255).astype(np.uint8)),(0,44));canvas.paste(Image.fromarray(np.clip(a,0,255).astype(np.uint8)),(W+6,44))
    d=ImageDraw.Draw(canvas)
    d.text((6,4),f'BEFORE  r2 real Mac Cocos web rec ({mode})',font=fnt,fill=(255,210,120))
    d.text((W+12,4),f'AFTER  04632a6 PROXY composite ({mode})',font=fnt,fill=(140,230,160))
    tt=k/30
    d.text((6,24),f'rec t={t0+tt:.2f}s  (sail start ~{t0:.2f}s)',font=small,fill=(220,220,220))
    st='done' if k>last else fr['phase']
    d.text((W+12,24),f'f{min(k,last):03d} t={min(k,last)/30:.2f}s cover={fr["cover"] if k<=last else 0:.2f} {st}',font=small,fill=(220,220,220))
    if k>=len(src_frames):d.text((120,H/2+44),'recording ended',font=fnt,fill=(200,200,200))
    proc.stdin.write(canvas.tobytes())
proc.stdin.close();proc.wait();print('wrote',out)
