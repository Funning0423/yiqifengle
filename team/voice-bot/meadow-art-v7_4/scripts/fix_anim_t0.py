# shift new animations so they start at t=0 (Blender frame 1 -> 0 s)
import json,struct,sys
f=sys.argv[1]; b=bytearray(open(f,'rb').read()); n=struct.unpack('<I',b[12:16])[0]; g=json.loads(b[20:20+n]); o=28+n
done=set()
for a in g['animations']:
    if a['name']=='windmill_sails_loop': continue
    t0=min(g['accessors'][s['input']]['min'][0] for s in a['samplers'])
    for s in a['samplers']:
        i=s['input']
        if i in done: continue
        done.add(i); ac=g['accessors'][i]; bv=g['bufferViews'][ac['bufferView']]; st=o+bv.get('byteOffset',0)+ac.get('byteOffset',0)
        for k in range(ac['count']):
            v=struct.unpack_from('<f',b,st+4*k)[0]; struct.pack_into('<f',b,st+4*k,max(0.0,v-t0))
        ac['min']=[max(0.0,ac['min'][0]-t0)]; ac['max']=[ac['max'][0]-t0]
js=json.dumps(g,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
binc=b[20+n:]
open(f,'wb').write(struct.pack('<III',0x46546C67,2,12+8+len(js)+len(binc))+struct.pack('<II',len(js),0x4E4F534A)+js+binc)
for a in g['animations']: print(a['name'],min(g['accessors'][s['input']]['min'][0] for s in a['samplers']),max(g['accessors'][s['input']]['max'][0] for s in a['samplers']))
