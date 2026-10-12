# python3 raise_hem.py in.glb out.glb raise z0 z1 : lift LOD0_G2_DRESS vertices (same formula as build_body.py) in place
import json,struct,sys
import numpy as np
src,dst=sys.argv[1],sys.argv[2]; R,Z0,Z1=map(float,sys.argv[3:6])
b=bytearray(open(src,'rb').read()); L=struct.unpack('<I',b[12:16])[0]; J=json.loads(b[20:20+L]); bin0=20+L+8
for n in J['nodes']:
    if 'mesh' in n and J['meshes'][n['mesh']]['name']=='LOD0_G2_DRESS':
        assert not any(k in n for k in ('translation','rotation','scale','matrix')) or n.get('scale',[1,1,1])==[1,1,1], n
m=[m for m in J['meshes'] if m['name']=='LOD0_G2_DRESS'][0]
done=set()
for pr in m['primitives']:
    ai=pr['attributes']['POSITION']
    if ai in done: continue
    done.add(ai); a=J['accessors'][ai]; bv=J['bufferViews'][a['bufferView']]
    off=bin0+bv.get('byteOffset',0)+a.get('byteOffset',0); st=bv.get('byteStride',12); n=a['count']
    assert st==12
    P=np.frombuffer(bytes(b[off:off+12*n]),np.float32).reshape(n,3).copy()
    t=np.clip((Z1-P[:,1])/(Z1-Z0),0,1); P[:,1]+=R*t*t*(3-2*t)
    b[off:off+12*n]=P.astype(np.float32).tobytes(); a['min']=P.min(0).tolist(); a['max']=P.max(0).tolist()
js=json.dumps(J,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
rest=bytes(b[20+L:]); out=struct.pack('<III',0x46546C67,2,12+8+len(js)+len(rest))+struct.pack('<II',len(js),0x4E4F534A)+js+rest
open(dst,'wb').write(out); print('hem raised',src,'->',dst)
