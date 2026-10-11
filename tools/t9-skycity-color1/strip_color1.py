#!/usr/bin/env python3
"""T9 (PM): drop the unused COLOR_1 set from env_sky_static_rock_strata in region_skycity/env_skycity.glb.
Minimal JSON-chunk edit, no Blender / no re-encode: removes COLOR_1 from the primitive attributes and from its
KHR_draco_mesh_compression attribute map, deletes the (bufferView-less, Draco-backed) accessor and renumbers later
accessor references. The BIN chunk is copied byte-for-byte; the Draco stream still contains the old attribute
(unique id 4) but no decoder is asked for it, so the importer only sees COLOR_0.
usage: strip_color1.py <in.glb> <out.glb>"""
import json, struct, sys
MESH, ATTR = 'env_sky_static_rock_strata', 'COLOR_1'
def read(p):
    b = open(p, 'rb').read(); assert b[:4] == b'glTF' and struct.unpack('<I', b[4:8])[0] == 2
    jl, jt = struct.unpack('<II', b[12:20]); assert jt == 0x4E4F534A
    j = json.loads(b[20:20 + jl]); rest = b[20 + jl:]; return j, rest
def write(p, j, rest):
    s = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode()
    s += b' ' * (-len(s) % 4)
    body = struct.pack('<II', len(s), 0x4E4F534A) + s + rest
    open(p, 'wb').write(b'glTF' + struct.pack('<II', 2, 12 + len(body)) + body)
def main(src, dst):
    j, rest = read(src)
    hits = [(m, p) for m in j['meshes'] if m['name'] == MESH for p in m['primitives'] if ATTR in p['attributes']]
    assert len(hits) == 1, f'expected one {MESH} primitive with {ATTR}, got {len(hits)}'
    allc1 = [m['name'] for m in j['meshes'] for p in m['primitives'] if ATTR in p['attributes']]
    assert allc1 == [MESH], allc1
    m, p = hits[0]; dead = p['attributes'].pop(ATTR)
    assert 'bufferView' not in j['accessors'][dead], 'COLOR_1 accessor unexpectedly owns a bufferView'
    d = p.get('extensions', {}).get('KHR_draco_mesh_compression')
    if d: d['attributes'].pop(ATTR)
    # any other reference to the dead accessor would be a bug
    refs = []
    def remap(i):
        assert i != dead, 'accessor %d still referenced' % dead; return i - 1 if i > dead else i
    for mm in j['meshes']:
        for pp in mm['primitives']:
            pp['attributes'] = {k: remap(v) for k, v in pp['attributes'].items()}
            if 'indices' in pp: pp['indices'] = remap(pp['indices'])
            for t in pp.get('targets', []): t.update({k: remap(v) for k, v in t.items()})
    for a in j.get('animations', []):
        for s in a['samplers']: s['input'] = remap(s['input']); s['output'] = remap(s['output'])
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = remap(s['inverseBindMatrices'])
    del j['accessors'][dead]
    write(dst, j, rest)
    print(f'removed {MESH}.{ATTR} accessor #{dead}; accessors {len(j["accessors"]) + 1} -> {len(j["accessors"])}')
if __name__ == '__main__': main(*sys.argv[1:3])
