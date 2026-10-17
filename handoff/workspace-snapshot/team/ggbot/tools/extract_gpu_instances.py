#!/usr/bin/env python3
"""把 GLB 里 EXT_mesh_gpu_instancing 的实例数据导出成紧凑 JSON，给 Cocos 侧实例化用（Cocos 3.8 导入器不读这个扩展）。
用法: python3 extract_gpu_instances.py in.glb out.json
输出: {"source_sha256":..., "groups":[{"node":..., "template":..., "count":N, "t":[x,y,z,...], "r":[x,y,z,w,...], "s":[...], "attrs":{"_ROOT_COLOR":[...]}}]}
数值保留 4 位小数（毫米级）。"""
import hashlib, json, struct, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from art_import_check import read_acc
import glb_budget_check as budget
src, out = sys.argv[1], sys.argv[2]
data, g, binc = budget.read_glb(__import__('pathlib').Path(src))
groups = []
for n in g['nodes']:
    e = n.get('extensions', {}).get('EXT_mesh_gpu_instancing')
    if not e: continue
    at = e['attributes']; grp = {"node": n.get('name'), "template": g['meshes'][n['mesh']].get('name'), "attrs": {}}
    for k, key in (('TRANSLATION', 't'), ('ROTATION', 'r'), ('SCALE', 's')):
        if k in at: grp[key] = [round(v, 4) for row in read_acc(g, binc, at[k]) for v in row]
    for k, i in at.items():
        if k.startswith('_'): grp['attrs'][k] = [round(v, 4) for row in read_acc(g, binc, i) for v in row]
    grp['count'] = len(grp['t']) // 3; groups.append(grp)
json.dump({"source": src.split('/')[-1], "source_sha256": hashlib.sha256(data).hexdigest(), "groups": groups}, open(out, 'w'), separators=(',', ':'))
print(out, sum(x['count'] for x in groups), 'instances in', len(groups), 'groups')
