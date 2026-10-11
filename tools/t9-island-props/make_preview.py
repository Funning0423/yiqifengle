#!/usr/bin/env python3
"""QA only (not shipped). Offline NON-NATIVE preview of the T9 island props with the runtime island camera.
python3 make_preview.py <outdir> [--night] [--size 390x844] [--samples 32]
Needs: blender (4.x, glTF Draco import), node (transpiles the REAL IslandPropsLayout.ts), git (preview GLBs with the
palette embedded come from work/grokbot 0f28044 ui-props/*glb-preview*, same geometry as the shipped Draco GLBs)."""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont
H=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(H,'..','..'))
args=sys.argv[1:]; out=args[0]; night='--night' in args
size=args[args.index('--size')+1] if '--size' in args else '390x844'; W,Hh=map(int,size.split('x'))
samples=int(args[args.index('--samples')+1]) if '--samples' in args else 32
SC=1.5 if W<Hh else 1.0  # 390x844 CSS -> 586x1266 evidence pixels
RW,RH=round(W*SC),round(Hh*SC)
os.makedirs(out,exist_ok=True)
L=json.loads(subprocess.check_output(['node',os.path.join(H,'layout_dump.cjs'),str(W),str(Hh)]))
tmp=tempfile.mkdtemp(prefix='t9prev-'); REV=os.environ.get('T9_ART_REV','0f28044')
def art(rel):
    p=os.path.join(tmp,os.path.basename(rel)); open(p,'wb').write(subprocess.check_output(['git','-C',ROOT,'show',f'{REV}:ui-props/{rel}'])); return p
prev={'ui_signpost':'glb-preview/ui_signpost.glb','ui_satchel':'glb-preview/ui_satchel.glb','ui_notebook':'glb-preview/ui_notebook.glb','ui_compass':'glb-preview/ui_compass.glb',
      'beach_palm_tall':'beach-props/glb-preview/beach_palm_tall.glb','beach_palm_short':'beach-props/glb-preview/beach_palm_short.glb'}
R=os.path.join(ROOT,'creator-build-project/assets/bundles/region_island/')
S=L['signpost']
props=[dict(name='signpost',glb=art(prev[S['prefab']]),pos=S['position'],yaw=S['yawDeg'],scale=S['scale'],lampNight=night)]
props+=[dict(name=p['prefab'],glb=art(prev[p['prefab']]),pos=p['position'],yaw=p['yawDeg'],scale=p['scale']) for p in L['palms']]
props+=[dict(name=b['prefab'],glb=art(prev[b['prefab']]),pos=b['position'],yaw=b['yawDeg'],scale=b['scale']) for b in L['buttons']]
pose=L['pose']; tag='night' if night else 'day'
import math as _m
def hexrgb(h): h=h.lstrip('#'); return [((int(h[i:i+2],16)/255)**2.2) for i in (0,2,4)]
def flat(mesh,scale,lift,rgb,alpha,strength=1.0,cxshift=0.0):
    a=_m.radians(S['yawDeg']); c,s_=_m.cos(a),_m.sin(a); P=mesh['positions']; out=[]
    for i in range(0,len(P),3):
        x=(P[i]*scale+cxshift); z=P[i+2]*scale
        out+= [S['position'][0]+x*c+z*s_, L_SEA+lift, S['position'][2]-x*s_+z*c]
    return dict(positions=out,colors=mesh['colors'],indices=mesh['indices'],rgb=rgb,alpha=alpha,strength=strength)

W_=S['water']; L_SEA=-0.92; flats=[flat(L['water']['shadow'],S['scale'],W_['ripple']['lift']*0.5,hexrgb(W_['shadow']['color']),W_['shadow']['nightAlpha' if night else 'alpha'],0.6)]
for k,r in enumerate(L['water']['ripples']):
    sc_=S['scale']*r['scale']; flats.append(flat(L['water']['ring'],sc_,W_['ripple']['lift'],hexrgb(W_['ripple']['nightColor' if night else 'color']),(W_['ripple']['nightAlpha' if night else 'alpha'])*r['alpha'],1.0,W_['centerX']*S['scale']*(1-r['scale'])))
scene=dict(island=R+'combined_visual_m.glb',hide=['_night_v22','env_interior','character_height','floor_skirt'] if not night else ['env_interior','character_height','floor_skirt','sky_dome'],
  props=props,flats=flats,chars=[dict(glb=R+'character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb',pos=[-2.1135,0,5.2814],yaw=0)],
  camera=dict(pos=pose['position'],target=pose['target'],fov=pose['fovVerticalDeg']),res=[RW,RH],out=os.path.join(tmp,'raw.png'),samples=samples,
  sun=0.9 if night else 3.2,world=(0.05,0.08,0.18,1) if night else (0.55,0.7,0.8,1),worldStrength=0.5 if night else 0.9)
sj=os.path.join(tmp,'scene.json'); json.dump(scene,open(sj,'w'))
subprocess.check_call(['blender','-b','--factory-startup','-P',os.path.join(H,'blender_render.py'),'--',sj],stdout=subprocess.DEVNULL)
im=Image.open(scene['out']).convert('RGBA'); d=ImageDraw.Draw(im)
FB='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(px): return ImageFont.truetype(FB,max(8,int(px)),index=2)
def ui2px(x,y): return (RW/2+x*SC, RH/2-y*SC)
# sign text: Label on the panel (runtime uses RenderRoot2D in world space); here drawn at the projected panel centre
tc=S['textCenterWorld']
import math
def proj(p):
    import numpy as np
    P=np.array(pose['position'],float); T=np.array(pose['target'],float); f=T-P; f/=np.linalg.norm(f); r=np.cross(f,[0,1,0]); r/=np.linalg.norm(r); u=np.cross(r,f)
    v=np.array(p,float)-P; z=v@f; t=math.tan(math.radians(pose['fovVerticalDeg'])/2)
    return ((v@r)/(z*t*RW/RH)+1)/2*RW, (1-(v@u)/(z*t))/2*RH, z
cx,cy,z=proj(tc); pxm=RH/(2*z*math.tan(math.radians(pose['fovVerticalDeg'])/2)); panelW=S['text']['widthM']*S['scale']*pxm*0.9*math.cos(math.radians(S['yawDeg']+21))
f=font(panelW/4.6); bb=d.textbbox((0,0),'继续旅程',font=f); d.text((cx-(bb[2]-bb[0])/2-bb[0],cy-(bb[3]-bb[1])/2-bb[1]),'继续旅程',font=f,fill=(99,63,33,255))
# tags (same numbers as IslandJourneyOverlay.layoutProps)
for b in L['buttons']:
    t=b['slot']['tag']; x0,y0=ui2px(t['x']-t['width']/2,t['y']+t['height']/2); x1,y1=ui2px(t['x']+t['width']/2,t['y']-t['height']/2)
    r=(y1-y0)/2; d.rounded_rectangle([x0,y0+2*SC,x1,y1+2*SC],radius=r,fill=(20,50,60,90)); d.rounded_rectangle([x0,y0,x1,y1],radius=r,fill=(248,242,226,255),outline=(149,103,55,255),width=max(2,int(t['fontSize']*SC/10)))
    f=font(t['fontSize']*SC); bb=d.textbbox((0,0),b['label'],font=f); d.text(((x0+x1)/2-(bb[2]-bb[0])/2-bb[0],(y0+y1)/2-(bb[3]-bb[1])/2-bb[1]),b['label'],font=f,fill=(99,63,33,255))
def outline(rect,col):
    x0,y0=ui2px(rect['x']-rect['width']/2,rect['y']+rect['height']/2); x1,y1=ui2px(rect['x']+rect['width']/2,rect['y']-rect['height']/2); d.rectangle([x0,y0,x1,y1],outline=col,width=1)
clean=im.copy()
for b in L['buttons']: outline(b['slot']['hit'],(255,60,60,200))
if S['rectUi']: outline(S['rectUi'],(255,60,60,200))
for img,name in ((clean,f'island-portrait-{tag}.png'),(im,f'island-portrait-{tag}-hitareas.png')):
    dd=ImageDraw.Draw(img); f=font(13*SC); s='NON-NATIVE offline preview (Blender Cycles, runtime island camera)'
    dd.rectangle([0,RH-22*SC,RW,RH],fill=(0,0,0,150)); dd.text((6,RH-19*SC),s,font=font(10*SC),fill=(255,255,255,255))
    img.convert('RGB').save(os.path.join(out,name))
json.dump(L,open(os.path.join(out,f'layout-{W}x{Hh}.json'),'w'),indent=1)
print('wrote',out)
