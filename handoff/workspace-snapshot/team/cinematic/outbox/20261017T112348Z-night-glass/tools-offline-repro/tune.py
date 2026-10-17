import numpy as np,json,sys
from PIL import Image
from scipy.ndimage import binary_dilation
from composite import compose
from glass import render
bg=np.load('bg.npy'); box=tuple(np.load('box.npy')); sub=np.load('sub.npy')
r=264/2/123.2
def P(night, p3=(1,1,1,0), p4=(1,1,1,0), rimTint=(1,1,1)):
    return dict(p0=(min(1,0.43*r**0.6),1.2*r**0.6*2,2.6,1.0),p1=(1,0,-1,0),p2=(0,night,0.35,2),p3=p3,p4=p4,rimTint=rimTint)
def lum(c):
    c=np.asarray(c,float); v=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4); return 0.2126*v[...,0]+0.7152*v[...,1]+0.0722*v[...,2]
def cr(a,b): la,lb=lum(a),lum(b); return (np.maximum(la,lb)+0.05)/(np.minimum(la,lb)+0.05)
def metrics(img,glass_only,ga,text_rgb):
    glyph=ga>0.9; ring=binary_dilation(ga>0.5,iterations=1)&(ga<0.5)
    t=np.array(text_rgb)/255
    halo=img[ring]; bare=glass_only[binary_dilation(ga>0.05,iterations=3)]
    def stat(px): c=cr(t[None],px); return dict(median=round(float(np.median(c)),2),p5=round(float(np.percentile(c,5)),2))
    return dict(text_vs_halo=stat(halo),text_vs_bare_glass=stat(bare))
def run(name,params,text_rgb,sh,blur,off,outline=None):
    img,(gl,ga)=compose(bg,box,params,text_rgb,sh,blur,off,outline)
    Image.fromarray((np.clip(img,0,1)*255+0.5).astype(np.uint8)).save(name+'.png')
    m=metrics(img,gl,ga,text_rgb); 
    # leaf vs glass (non-text 3:1): mean leaf green vs surrounding glass
    return img,m
if __name__=='__main__':
    k=float(sys.argv[1]) if len(sys.argv)>1 else 0.45
    DAYTXT=((255,255,255),(0,40,60,115),6,(0,-1))
    d,md=run('t_day',P(0),*DAYTXT); print('day repro err vs real (mean abs, 0-255):',float(np.abs(d-sub).mean()*255)); print('day/night-before',md)
    NT=((232,226,212),(24,14,6,235),3,(0,-1))
    n,mn=run('t_night',P(1,p3=(k,0.45,0.0,0),p4=(0.30,0.20,0.12,0),rimTint=(1,0.86,0.66)),*NT); print('night after',mn)
