#!/usr/bin/env python3
"""Validate the frozen source and generate a separate non-rendering proxy candidate.
This is a static GLB inspection, never an editor import/runtime result.
"""
import argparse, hashlib, json, struct
from pathlib import Path

def read_glb(path):
    data = path.read_bytes()
    magic, version, size = struct.unpack_from('<III', data)
    if magic != 0x46546c67 or version != 2 or size != len(data):
        raise ValueError('Invalid GLB header')
    offset, chunks = 12, []
    while offset < len(data):
        length, kind = struct.unpack_from('<II', data, offset)
        offset += 8
        if length % 4 or offset + length > len(data):
            raise ValueError('Invalid GLB chunk')
        chunks.append((kind, data[offset:offset + length]))
        offset += length
    if not chunks or chunks[0][0] != 0x4e4f534a:
        raise ValueError('Missing glTF JSON')
    return json.loads(chunks[0][1]), chunks

def preflight(source, output):
    manifest = json.loads((source / 'PACKAGE-MANIFEST.json').read_text())
    verified = []
    for record in manifest['files']:
        path = source / record['path']
        if not path.resolve().is_relative_to(source.resolve()):
            raise ValueError('Manifest path escape')
        data = path.read_bytes()
        if len(data) != record['bytes'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise ValueError('Manifest hash mismatch: ' + record['path'])
        verified.append(record['path'])
    if len(verified) != manifest['file_count']:
        raise ValueError('Manifest count mismatch')
    source_glb = source / 'scene/env_interior_assembled.glb'
    gltf, chunks = read_glb(source_glb)
    hidden = []
    # Node mesh references are removed only in this generated copy; source collider geometry stays frozen.
    for index, node in enumerate(gltf.get('nodes', [])):
        extras = node.get('extras', {})
        name = node.get('name', '')
        if name.startswith('col_') or extras.get('render') is False or extras.get('preview_only') is True or extras.get('ship') is False:
            if 'mesh' in node:
                hidden.append({'node_index': index, 'name': name, 'source_mesh_index': node.pop('mesh'), 'source_skin_index': node.pop('skin', None)})
    required = gltf.get('extensionsRequired', [])
    used = gltf.get('extensionsUsed', [])
    output.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(gltf, ensure_ascii=False, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    new_chunks = [(chunks[0][0], encoded)] + chunks[1:]
    payload = b''.join(struct.pack('<II', len(data), kind) + data for kind, data in new_chunks)
    target = output / 'interior-preflight-no-proxy-render.glb'
    target.write_bytes(struct.pack('<III', 0x46546c67, 2, 12 + len(payload)) + payload)
    names = {n.get('name') for n in gltf.get('nodes', [])}
    report = {'status': 'static_preflight_only', 'manifest_files_verified': len(verified),
        'source_glb_sha256': hashlib.sha256(source_glb.read_bytes()).hexdigest(),
        'candidate_glb_sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'unit_variant': 'metres; root transforms unchanged; no B scale applied',
        'suppressed_mesh_bindings': hidden, 'extensions_required': required, 'extensions_used': used,
        'instancing_requires_compatibility_validation': 'EXT_mesh_gpu_instancing' in used,
        'skins': len(gltf.get('skins', [])), 'clips': [a.get('name') for a in gltf.get('animations', [])],
        'missing_semantic_nodes': [n for n in ['scene_root', 'seat_back'] if n not in names],
        'physics_colliders': 'not_created; map source_mesh_index to explicit proxies after editor approval',
        'cocos_import': 'not_run', 'device_performance': 'not_run', 'B_actions': 'not_delivered',
        'remaining': ['door_handle radius conflict', 'B height calibration', 'camera and door swept volume runtime check',
                      'sitting capsule filtering without disabling hand/garment contacts']}
    (output / 'asset-preflight.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    report = preflight(args.source, args.output)
    print(json.dumps({'verified': report['manifest_files_verified'], 'suppressed': len(report['suppressed_mesh_bindings']),
                      'status': report['status']}, ensure_ascii=False))
