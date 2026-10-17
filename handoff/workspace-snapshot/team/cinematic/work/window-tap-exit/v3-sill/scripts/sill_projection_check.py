"""Mirror of RoomLook.window() + RoomExploreOverlay.paintWindowGuide() (v3 sill tip) for the default home pose.
Checks the tip box (and its >=44 hit box) never overlaps the projected glass quad, and stays inside the safe area."""
import numpy as np,json,sys
P=np.array([-1.32022071,1.38613379,-2.11374307]);T=np.array([0.04,1.22,-4.45]);FOV=75 # RegionCameraData sitting-room (active home pose)
G=dict(x0=-0.574,x1=0.674,y0=1.222,y1=2.749,z=-5.125)
U=dict(icon=12,textSize=13,padX=10,tipH=26,gap=8,hitMin=44,margin=16,safeTop=64,safeBottom=96)
CAP='出发去看海'
f=(T-P)/np.linalg.norm(T-P);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);th=np.tan(np.radians(FOV/2))
def proj(q,a):d=np.array(q)-P;z=d@f;return ((d@r)/z/th/a+1)/2,((d@u)/z/th+1)/2  # y up, like projectPoint
out=[]
for a,W,H in ((0.46,360,780),(0.75,390,520)):
  pts=[proj((x,y,G['z']),a) for x in (G['x0'],G['x1']) for y in (G['y0'],G['y1'])]
  gx0=min(p[0] for p in pts)*W;gx1=max(p[0] for p in pts)*W;gy0=min(p[1] for p in pts)*H;gy1=max(p[1] for p in pts)*H
  sx,sy=proj(((G['x0']+G['x1'])/2,G['y0'],G['z']),a)
  tw=int(np.ceil(len(CAP)*U['textSize']*1.02));w=U['padX']+U['icon']*2+6+tw+U['padX']
  x=max(w/2+U['margin'],min(W-w/2-U['margin'],sx*W));y=max(U['safeBottom']+U['tipH']/2,gy0-U['gap']-U['tipH']/2)
  tip=dict(l=x-w/2,r=x+w/2,b=y-U['tipH']/2,t=y+U['tipH']/2);hw,hh=max(w,44),max(U['tipH'],44);hit=dict(l=x-hw/2,r=x+hw/2,b=y-hh/2,t=y+hh/2)
  ov=lambda R:not(R['r']<gx0 or R['l']>gx1 or R['t']<gy0 or R['b']>gy1)
  safe=tip['l']>=U['margin'] and tip['r']<=W-U['margin'] and tip['b']>=U['safeBottom'] and tip['t']<=H-U['safeTop']
  # screen coords (y down) for the mockup
  res=dict(aspect=a,viewport=[W,H],glass_screen=dict(l=gx0,r=gx1,top=H-gy1,bottom=H-gy0),tip_screen=dict(l=tip['l'],r=tip['r'],top=H-tip['t'],bottom=H-tip['b'],w=w,h=U['tipH']),
    hit_screen=dict(l=hit['l'],r=hit['r'],top=H-hit['t'],bottom=H-hit['b'],w=hw,h=hh),gap_tip_to_glass_px=gy0-tip['t'],tip_overlaps_glass=bool(ov(tip)),hit_overlaps_glass_ok_by_design=bool(ov(hit)),inside_safe=bool(safe))
  out.append(res);print(json.dumps(res,ensure_ascii=False,default=float))
json.dump(out,open(sys.argv[1] if len(sys.argv)>1 else '/dev/null','w'),ensure_ascii=False,indent=1,default=float)
