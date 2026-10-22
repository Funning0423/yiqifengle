# 围巾贴图 64×64：米白底 + 淡黄细条纹 + 截面内侧 AO 带
import io,numpy as np
from PIL import Image
TS=64;img=np.zeros((TS,TS,3),np.float32);base_c=np.array([243,236,222]);stripe=np.array([246,224,128])
for yv in range(TS):
    v=yv/TS
    for xu in range(TS):
        c=base_c.astype(np.float32)
        if (yv%16) in (6,7): c=stripe.astype(np.float32)
        img[yv,xu]=c
# 颈圈截面 v≈0 处为内侧（k=0 朝颈）：v∈[0,0.2]∪[0.8,1] 压暗做 AO 带
for yv in range(TS):
    v=(yv+0.5)/TS;dv=min(v,1-v)
    ao=0.72+0.28*min(1,dv/0.22)
    img[yv]*=ao
# 针织感：横向轻微明暗
for xu in range(TS): img[:,xu]*=0.97+0.03*(xu%4<2)
im=Image.fromarray(np.clip(img,0,255).astype(np.uint8));im.save('T_G2_SCARF_64.png',optimize=True)
