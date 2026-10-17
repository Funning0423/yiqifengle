import sys
argv=sys.argv[sys.argv.index('--')+1:]
import OpenImageIO as oiio, numpy as np
inp=oiio.ImageInput.open(argv[0]); out={}; si=0
while True:
    if not inp.seek_subimage(si,0): break
    spec=inp.spec(); a=np.asarray(inp.read_image(oiio.FLOAT))
    for k,n in enumerate(spec.channelnames): out[(spec.getattribute('name') or '')+'|'+n]=a[...,k] if a.ndim==3 else a
    si+=1
inp.close(); print(list(out.keys())[:40], si)
np.savez_compressed(argv[1], **{k.replace('|','__'):v for k,v in out.items()})
