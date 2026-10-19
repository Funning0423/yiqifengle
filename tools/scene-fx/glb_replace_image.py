# Asset tool (场景特效bot r5 S3 fix_r1, not shipped): replace ONE embedded glTF image in a .glb, keeping every node, mesh,
# accessor, material, texture, sampler and image name/index. Only that image's bufferView bytes change; later bufferViews
# are shifted by the size difference (4-byte aligned). Usage:
#   python3 glb_replace_image.py in.glb <imageIndex> new.(png|jpg) out.glb
import json, struct, sys
src, idx, new, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
b = open(src, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl])
bl = struct.unpack('<I', b[20 + jl:24 + jl])[0]; bin_ = bytearray(b[28 + jl:28 + jl + bl])
data = open(new, 'rb').read(); mime = 'image/png' if data[:8] == b'\x89PNG\r\n\x1a\n' else 'image/jpeg'
im = j['images'][idx]; bv = j['bufferViews'][im['bufferView']]; o0 = bv.get('byteOffset', 0); n0 = bv['byteLength']
pad = lambda n: (n + 3) & ~3
old_span = pad(n0); new_span = pad(len(data)); delta = new_span - old_span
if any(v is not bv and v.get('buffer', 0) == 0 and o0 < v.get('byteOffset', 0) < o0 + old_span for v in j['bufferViews']): raise SystemExit('overlapping bufferView')
bin_ = bin_[:o0] + data + b'\0' * (new_span - len(data)) + bin_[o0 + old_span:]
for v in j['bufferViews']:
    if v is not bv and v.get('byteOffset', 0) > o0: v['byteOffset'] = v.get('byteOffset', 0) + delta
bv['byteLength'] = len(data); im['mimeType'] = mime
while len(bin_) % 4: bin_ += b'\0'
j['buffers'][0]['byteLength'] = len(bin_)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
o = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
open(out, 'wb').write(o); print('replaced image', idx, im.get('name'), n0, '->', len(data), mime, 'glb', len(b), '->', len(o))
