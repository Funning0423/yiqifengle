"""Give every primitive of a Blender-exported Draco glb a white COLOR_0 (RGBA8 normalized, WebGL-aligned), positions/normals/UVs
re-encoded at the same quantization (14/10/12, same bbox -> identical lattice). Needed when the glb is rebound to a city material
that multiplies by a_color (M_sky_palette): a missing a_color reads (0,0,0,1) and draws black (ShoreBreakCore.ts note).
python3 add_vertex_color.py in.glb out.glb [r g b]"""
import sys,json,struct,numpy as np,DracoPy
src,dst=sys.argv[1:3];rgb=[int(x) for x in sys.argv[3:6]] if len(sys.argv)>=6 else [255,255,255]
b=open(src,'rb').read();jl=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+jl]);s=20+jl;bl=struct.unpack('<I',b[s:s+4])[0];bin_=b[s+8:s+8+bl]
views=[bin_[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in j['bufferViews']]
for m in j['meshes']:
    for p in m['primitives']:
        if 'COLOR_0' in p['attributes']:continue
        ext=p['extensions']['KHR_draco_mesh_compression'];d=DracoPy.decode(views[ext['bufferView']])
        P=d.points.astype('f8');col=np.tile(np.array(rgb+[255],np.uint8),(len(P),1))
        enc=DracoPy.encode(P,d.faces.astype('u4'),quantization_bits=14,compression_level=7,normals=d.normals.astype('f8'),tex_coord=d.tex_coord.astype('f8'),colors=col,
                           tex_coord_quantization_bits=12,normal_quantization_bits=10)
        chk=DracoPy.decode(enc)
        key=lambda Q,F:np.array(sorted(tuple(np.round(np.array(sorted(map(tuple,Q[f]))),4).ravel()) for f in F))
        ka,kb=key(P,d.faces),key(chk.points.astype('f8'),chk.faces);assert len(chk.faces)==len(d.faces) and ka.shape==kb.shape and np.abs(ka-kb).max()<2e-3,('lattice moved',np.abs(ka-kb).max() if ka.shape==kb.shape else (ka.shape,kb.shape))
        P=chk.points;col=np.tile(np.array(rgb+[255],np.uint8),(len(P),1))
        views[ext['bufferView']]=enc
        a={'componentType':5121,'normalized':True,'count':len(P),'type':'VEC4'};j['accessors'].append(a);p['attributes']['COLOR_0']=len(j['accessors'])-1
        A={chk.attributes[i]['attribute_type']:chk.attributes[i]['unique_id'] for i in range(len(chk.attributes))}
        ext['attributes']={'POSITION':A[0],'NORMAL':A[1],'COLOR_0':A[2],'TEXCOORD_0':A[3]}
out=bytearray()
for i,v in enumerate(views):
    while len(out)%4:out.append(0)
    j['bufferViews'][i]['byteOffset']=len(out);j['bufferViews'][i]['byteLength']=len(v);out+=v
while len(out)%4:out.append(0)
j['buffers'][0]['byteLength']=len(out)
js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((4-len(js)%4)%4)
open(dst,'wb').write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(out),0x004E4942)+bytes(out))
print(src,len(b),'->',len(12+8+len(js)+8+len(out) and open(dst,'rb').read()))
