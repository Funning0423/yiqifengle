# python3 face_rgb.py -> /tmp/hy/face_rgb.npy : albedo RGB at each Hunyuan triangle's UV centroid (Blender's Python has no PIL)
import os, io, sys, numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import hy_load as H
W,UV,I,cls,alb=H.load()
A=np.asarray(Image.open(io.BytesIO(alb)).convert('RGB'))
c=UV[I].mean(1); px=np.clip((c[:,0]*4096).astype(int),0,4095); py=np.clip((c[:,1]*4096).astype(int),0,4095)
np.save(os.environ.get('HY_RGB','/tmp/hy/face_rgb.npy'),A[py,px].astype(np.uint8))
