import numpy as np
from PIL import Image
# fractions of a 720x1280 portrait frame (board camera); measured on the r5h3 reference + Mac v3.2 frames
R={'near_water_L':(0.02,0.93,0.10,0.99),'near_water_R':(0.88,0.60,0.98,0.66),'mid_water':(0.1,0.30,0.9,0.38),
   'bridge_deck':(0.42,0.415,0.58,0.445),'bridge_side':(0.30,0.46,0.40,0.50),'bridge_rail':(0.45,0.400,0.55,0.410),
   'grass_L':(0.02,0.47,0.10,0.50),'grass_R':(0.86,0.45,0.96,0.48),'far_trees':(0.1,0.12,0.9,0.22),'roof':(0.02,0.31,0.12,0.33)}
def med(a,b):
    a=np.asarray(a.convert('RGB').resize((720,1280)) if isinstance(a,Image.Image) else a).astype(float);H,W=a.shape[:2];x0,y0,x1,y1=b
    return tuple(int(v) for v in np.median(a[int(y0*H):int(y1*H),int(x0*W):int(x1*W)].reshape(-1,3),axis=0))
def table(items,keys=None):
    keys=keys or list(R)
    out=['| region | '+' | '.join(n for n,_ in items)+' |','|---|'+'---|'*len(items)]
    for k in keys: out.append(f'| {k} | '+' | '.join('%d/%d/%d'%med(im,R[k]) for _,im in items)+' |')
    return '\n'.join(out)
