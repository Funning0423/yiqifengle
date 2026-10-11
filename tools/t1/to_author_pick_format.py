#!/usr/bin/env python3
"""把 decode_pick_geometry.cjs 输出转换为冻结候选 tools/test_geometry.cjs 读取的 evidence/pick-geometry.json 格式。
用法: python3 to_author_pick_format.py <decoded.json> <out pick-geometry.json>"""
import json, sys
d = json.load(open(sys.argv[1])); nodes = []
for n in d['nodes']:
    prims = [{'positions': [p['positions'][i:i+3] for i in range(0, len(p['positions']), 3)], 'indices': p['indices'], 'min': p['accessorMin'], 'max': p['accessorMax']} for p in n['primitives']]
    nodes.append({'index': n['index'], 'node': {'name': n['name'], 'translation': n['translation'], 'rotation': n['rotation'], 'scale': n['scale']}, 'primitives': prims})
json.dump({'input': d['input']['path'], 'input_sha256': d['input']['sha256'], 'decoder': d['decoder'], 'nodes': nodes}, open(sys.argv[2], 'w'))
