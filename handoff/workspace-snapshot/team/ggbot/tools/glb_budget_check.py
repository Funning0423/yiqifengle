#!/usr/bin/env python3
"""GLB 资源预算检查（静态分析，不是 Cocos 导入或真机结果）。
用法: python3 glb_budget_check.py <file.glb> [更多.glb] [--budget budget.json] [--out report]
输出 <out>.json 和 <out>.md。只用 Python 标准库。
"""
import argparse, hashlib, json, struct, sys
from pathlib import Path

DEFAULT_BUDGET = {  # 来源: dev-plan-v1.md §4 / §3 E2，除微信包体外均为项目目标
    "scene_triangles_max": 120000,
    "draw_calls_max": 80,
    "texture_edge_recommended_max": 1024,
    "texture_edge_hard_max": 2048,
    "active_texture_mib_max": 64,
    "main_package_mb_max": 4.0,
    "total_package_mb_max": 20.0,   # 未开通虚拟支付前；开通后 30
}
MB = 1024 * 1024

def read_glb(path):
    data = path.read_bytes()
    magic, version, size = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2:
        raise ValueError('不是 glTF 2.0 GLB')
    off, js, binc = 12, None, b''
    while off < len(data):
        ln, kind = struct.unpack_from('<II', data, off); off += 8
        chunk = data[off:off + ln]; off += ln
        if kind == 0x4E4F534A: js = json.loads(chunk)
        elif kind == 0x004E4942: binc = chunk
    return data, js, binc

def image_size(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', b[16:24]); return 'png', w, h
    if b[:2] == b'\xff\xd8':
        i = 2
        while i < len(b):
            if b[i] != 0xFF: i += 1; continue
            m = b[i + 1]
            if m in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', b[i + 5:i + 9]); return 'jpeg', w, h
            i += 2 + struct.unpack('>H', b[i + 2:i + 4])[0]
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP': return 'webp', None, None
    if b[:4] == b'\xabKTX': return 'ktx2', None, None
    return 'unknown', None, None

def tri_count(g, prim):
    mode = prim.get('mode', 4)
    n = g['accessors'][prim['indices']]['count'] if 'indices' in prim else g['accessors'][prim['attributes']['POSITION']]['count']
    return {4: n // 3, 5: max(n - 2, 0), 6: max(n - 2, 0)}.get(mode, 0)

def analyze(path, budget):
    data, g, binc = read_glb(path)
    meshes = g.get('meshes', [])
    mesh_tris = [[tri_count(g, p) for p in m['primitives']] for m in meshes]
    # 遍历场景节点，按实例统计（同一 mesh 被多个节点引用会算多次）
    nodes = g.get('nodes', [])
    scene_roots = g['scenes'][g.get('scene', 0)]['nodes'] if g.get('scenes') else range(len(nodes))
    inst, stack, mesh_nodes, skinned = {}, list(scene_roots), 0, 0
    while stack:
        n = nodes[stack.pop()]
        if 'mesh' in n:
            k = 1
            ext = n.get('extensions', {}).get('EXT_mesh_gpu_instancing')
            if ext:
                k = g['accessors'][next(iter(ext['attributes'].values()))]['count']
            inst[n['mesh']] = inst.get(n['mesh'], 0) + k
            mesh_nodes += 1
            if 'skin' in n: skinned += 1
        stack.extend(n.get('children', []))
    tris_total = sum(sum(mesh_tris[m]) * c for m, c in inst.items())
    draw_calls = sum(len(meshes[m]['primitives']) * c for m, c in inst.items())
    per_mesh = sorted(({"mesh": meshes[m].get('name', f'mesh{m}'), "instances": c, "primitives": len(meshes[m]['primitives']),
                        "triangles_each": sum(mesh_tris[m])} for m, c in inst.items()), key=lambda r: -r['triangles_each'] * r['instances'])
    # 贴图
    images, tex_bytes_gpu = [], 0
    for i, im in enumerate(g.get('images', [])):
        if 'bufferView' in im:
            bv = g['bufferViews'][im['bufferView']]; b = binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        else:
            p = path.parent / im.get('uri', ''); b = p.read_bytes() if p.exists() else b''
        fmt, w, h = image_size(b)
        gpu = int(w * h * 4 * 4 / 3) if w else None  # RGBA8 + mipmap 估算
        tex_bytes_gpu += gpu or 0
        flag = 'ok'
        if w and max(w, h) > budget['texture_edge_hard_max']: flag = 'red'
        elif w and max(w, h) > budget['texture_edge_recommended_max']: flag = 'yellow'
        images.append({"index": i, "name": im.get('name'), "format": fmt, "width": w, "height": h, "file_bytes": len(b), "gpu_bytes_est": gpu, "flag": flag})
    # 文件体积构成
    bvs = g.get('bufferViews', [])
    img_views = {im['bufferView'] for im in g.get('images', []) if 'bufferView' in im}
    anim_views = set()
    for a in g.get('animations', []):
        for s in a['samplers']:
            for acc in (s['input'], s['output']):
                if 'bufferView' in g['accessors'][acc]: anim_views.add(g['accessors'][acc]['bufferView'])
    size_img = sum(bvs[i]['byteLength'] for i in img_views)
    size_anim = sum(bvs[i]['byteLength'] for i in anim_views)
    size_bin = len(binc)
    exts = sorted(set(g.get('extensionsUsed', [])))
    size_mb = len(data) / MB

    def light(ok, warn=False): return 'green' if ok and not warn else ('yellow' if ok else 'red')
    checks = [
        {"item": "场景三角面", "value": tris_total, "budget": f"≤{budget['scene_triangles_max']}", "result": light(tris_total <= budget['scene_triangles_max'], tris_total > 0.85 * budget['scene_triangles_max'])},
        {"item": "draw call 估算（未合批：每个实例的每个 primitive 算 1 次）", "value": draw_calls, "budget": f"≤{budget['draw_calls_max']}", "result": light(draw_calls <= budget['draw_calls_max'], draw_calls > 0.85 * budget['draw_calls_max'])},
        {"item": "最大贴图边长", "value": max([max(i['width'], i['height']) for i in images if i['width']] or [0]), "budget": f"建议≤{budget['texture_edge_recommended_max']}，上限{budget['texture_edge_hard_max']}", "result": 'red' if any(i['flag'] == 'red' for i in images) else ('yellow' if any(i['flag'] == 'yellow' for i in images) else 'green')},
        {"item": "贴图显存估算 MiB（RGBA8+mip，未压缩）", "value": round(tex_bytes_gpu / MB, 2), "budget": f"≤{budget['active_texture_mib_max']}", "result": light(tex_bytes_gpu / MB <= budget['active_texture_mib_max'])},
        {"item": "GLB 文件体积 MB（能否进主包）", "value": round(size_mb, 2), "budget": f"主包整体≤{budget['main_package_mb_max']}", "result": 'red' if size_mb > budget['main_package_mb_max'] else ('yellow' if size_mb > 1 else 'green')},
    ]
    return {
        "file": str(path), "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
        "generator": g.get('asset', {}).get('generator'), "extensionsUsed": exts,
        "size_breakdown_bytes": {"json": len(data) - size_bin - 28, "bin_total": size_bin, "images": size_img, "animations": size_anim, "geometry_and_other": size_bin - size_img - size_anim},
        "counts": {"meshes": len(meshes), "mesh_nodes": mesh_nodes, "skinned_nodes": skinned, "materials": len(g.get('materials', [])),
                   "textures": len(g.get('textures', [])), "images": len(images), "animations": len(g.get('animations', [])), "skins": len(g.get('skins', [])), "nodes": len(nodes)},
        "triangles_scene": tris_total, "draw_calls_est": draw_calls, "checks": checks, "images": images, "top_meshes": per_mesh[:15],
        "notes": ["静态分析，不等于 Cocos 导入结果或真机数据。", "draw call 是未合批上限估算；同材质静态合批或 GPU instancing 后会更低。", "Cocos 导入后包体以构建产物为准（导入会转成 .bin/.json，体积可能与 GLB 不同）。"]}

def to_md(reports, budget):
    L = ["# GLB 资源预算检查报告", "", "生成：GGbot `glb_budget_check.py`（静态分析，非 Cocos 导入/真机结果）", "",
         "预算来源：dev-plan-v1.1 §4、§3 E2。", ""]
    icon = {'green': '🟢', 'yellow': '🟡', 'red': '🔴'}
    for r in reports:
        L += [f"## {Path(r['file']).name}", "", f"- SHA256 `{r['sha256']}`", f"- 大小 {r['bytes']:,} B（{r['bytes']/MB:.2f} MB）",
              f"- 生成器 {r['generator']}；扩展 {', '.join(r['extensionsUsed']) or '无'}",
              "- 体积构成：" + "，".join(f"{k} {v/MB:.2f} MB" for k, v in r['size_breakdown_bytes'].items()),
              "- 数量：" + "，".join(f"{k} {v}" for k, v in r['counts'].items()), "",
              "| 检查项 | 实测 | 预算 | 结果 |", "|---|---|---|---|"]
        L += [f"| {c['item']} | {c['value']} | {c['budget']} | {icon[c['result']]} |" for c in r['checks']]
        L += ["", "### 贴图", "", "| # | 名称 | 格式 | 尺寸 | 文件 | 显存估算 | 判定 |", "|---|---|---|---|---|---|---|"]
        L += [f"| {i['index']} | {i['name']} | {i['format']} | {i['width']}×{i['height']} | {i['file_bytes']/1024:.0f} KB | {(i['gpu_bytes_est'] or 0)/MB:.2f} MiB | {icon.get(i['flag'].replace('ok','green'))} |" for i in r['images']]
        L += ["", "### 三角面最多的网格（前 15）", "", "| 网格 | 实例 | primitive | 每实例三角面 |", "|---|---|---|---|"]
        L += [f"| {m['mesh']} | {m['instances']} | {m['primitives']} | {m['triangles_each']:,} |" for m in r['top_meshes']]
        L += ["", "注意：" + " ".join(r['notes']), ""]
    return "\n".join(L)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('glb', nargs='+'); ap.add_argument('--budget'); ap.add_argument('--out', default='glb-budget-report')
    a = ap.parse_args()
    budget = dict(DEFAULT_BUDGET)
    if a.budget: budget.update(json.loads(Path(a.budget).read_text()))
    reports = [analyze(Path(p), budget) for p in a.glb]
    Path(a.out + '.json').write_text(json.dumps({"budget": budget, "reports": reports}, ensure_ascii=False, indent=2))
    Path(a.out + '.md').write_text(to_md(reports, budget))
    worst = max((c['result'] for r in reports for c in r['checks']), key=['green', 'yellow', 'red'].index)
    print(f"{a.out}.md written; worst={worst}")
    sys.exit(1 if worst == 'red' else 0)
