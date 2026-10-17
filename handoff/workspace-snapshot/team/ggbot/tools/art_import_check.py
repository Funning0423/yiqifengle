#!/usr/bin/env python3
"""美术 GLB 导入前检查（静态，非 Cocos 导入结果）。
检查：坐标朝向（Y-up、根节点旋转、角色朝 +Z）、单位（包围盒尺寸是否像米）、缩放（非 1 / 非等比 / 负缩放 / K 重复施加）、
命名（env_/chr_/anim_/col_/anchor_ 等前缀，骨骼名对契约）、骨骼数（每个 skin ≤22，可配）、每顶点权重 ≤4、
面数和贴图统计（复用 glb_budget_check）。
用法: python3 art_import_check.py <a.glb> [...] [--kind auto|chr|env] [--out reports/xxx]
退出码: 0 全绿/黄，1 有红灯。
"""
import argparse, json, math, struct, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import glb_budget_check as budget

K = 1.061164379119873
CHR_BONES = ["root", "hips", "spine", "chest", "neck", "head", "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R", "forearm.R", "hand.R",
             "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R", "skirt.front", "skirt.left", "skirt.back", "skirt.right"]
PREFIXES = ("env_", "chr_", "anim_", "col_", "anchor_", "ui_", "tex_", "state_", "M_", "B_", "R5_")
COCOS_EXTS = {"KHR_materials_unlit", "KHR_texture_transform", "KHR_mesh_quantization", "KHR_draco_mesh_compression", "KHR_materials_specular",
              "KHR_lights_punctual", "KHR_materials_emissive_strength"}  # 未列入的都标黄，需在 Cocos 实测
CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def read_acc(g, binc, i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    fmt, sz = CT[a['componentType']]; n = NC[a['type']]
    stride = bv.get('byteStride') or sz * n; base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for k in range(a['count']):
        v = struct.unpack_from('<' + fmt * n, binc, base + k * stride)
        if a.get('normalized'): v = tuple(x / {1: 255, 2: 65535}[sz] if fmt in 'BH' else x for x in v)
        out.append(v)
    return out

def mat_mul(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def local(n):
    if 'matrix' in n: m = n['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    x, y, z, w = n.get('rotation', [0, 0, 0, 1]); sx, sy, sz = n.get('scale', [1, 1, 1]); tx, ty, tz = n.get('translation', [0, 0, 0])
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx], [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty], [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz], [0, 0, 0, 1]]
def xf(m, p): return [m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3)]
def col_scale(m): return [math.sqrt(sum(m[r][c] ** 2 for r in range(3))) for c in range(3)]
def det3(m): return (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))

def check(path, kind, max_bones):
    _, g, binc = budget.read_glb(path)
    nodes = g.get('nodes', []); res = []
    def add(item, result, detail): res.append({"item": item, "result": result, "detail": detail})
    if kind == 'auto': kind = 'chr' if path.name.startswith(('chr_', 'B_')) or any(n.get('name') in ('hips', 'R5_WEIGHTED_BODY_AUTHORING_REFERENCE') for n in nodes) else 'env'
    roots = g['scenes'][g.get('scene', 0)]['nodes']; world = {}; parent = {}
    stack = [(r, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) for r in roots]
    while stack:
        i, pm = stack.pop(); m = mat_mul(pm, local(nodes[i])); world[i] = m
        for c in nodes[i].get('children', []): parent[c] = i; stack.append((c, m))
    # 1 朝向 / 缩放
    def x90(q): x, y, z, w = q; return abs(y) < 1e-3 and abs(z) < 1e-3 and abs(abs(x) - math.sqrt(.5)) < 1e-3
    bad_rot = [nodes[r].get('name') for r in roots if x90(nodes[r].get('rotation', [0, 0, 0, 1]))]
    yaw = [nodes[r].get('name') for r in roots if 'rotation' in nodes[r] and nodes[r].get('name') not in bad_rot and abs(abs(nodes[r]['rotation'][3]) - 1) > 1e-4]
    add("Y-up：根节点没有残留 Blender 的 X ±90° 旋转", 'red' if bad_rot else 'green', f"X±90° 的根: {bad_rot}" if bad_rot else ("无；其他有旋转的根（锚点朝向等，属正常）: " + ', '.join(yaw[:8]) if yaw else "无"))
    neg, nonuni, nonone, kdup = [], [], [], []
    for i, m in world.items():
        s = col_scale(m); nm = nodes[i].get('name', f'#{i}')
        if det3(m) < 0: neg.append(nm)
        if max(s) - min(s) > 1e-3 * max(s): nonuni.append(nm)
        if any(abs(x - 1) > 1e-3 for x in s) and not any(abs(x - K) < 1e-4 for x in s): nonone.append(f"{nm}:{round(s[0], 4)}")
        if any(abs(x - K * K) < 1e-3 for x in s): kdup.append(nm)
    add("无负缩放（镜像）", 'red' if neg else 'green', ', '.join(neg[:10]) or '无')
    add("无非等比缩放", 'yellow' if nonuni else 'green', ', '.join(nonuni[:10]) or '无')
    add("世界缩放为 1（或仅一次 K=1.061164）", 'yellow' if nonone else 'green', ', '.join(nonone[:10]) or '无')
    add("K 没有被重复施加（K²）", 'red' if kdup else 'green', ', '.join(kdup[:10]) or '无')
    # 2 包围盒 / 单位
    lo, hi = [1e18] * 3, [-1e18] * 3
    for i in world:
        if 'mesh' not in nodes[i]: continue
        for p in g['meshes'][nodes[i]['mesh']]['primitives']:
            a = g['accessors'][p['attributes']['POSITION']]
            if 'min' not in a: continue
            for c in [(x, y, z) for x in (a['min'][0], a['max'][0]) for y in (a['min'][1], a['max'][1]) for z in (a['min'][2], a['max'][2])]:
                w = xf(world[i] if 'skin' not in nodes[i] else [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], c)
                lo = [min(lo[k], w[k]) for k in range(3)]; hi = [max(hi[k], w[k]) for k in range(3)]
    size = [round(hi[k] - lo[k], 3) for k in range(3)] if lo[0] < 1e17 else [0, 0, 0]
    if kind == 'chr':
        ok = 1.3 <= size[1] <= 2.1
        add("单位：角色高度像米（1.3–2.1 m，Y 向）", 'green' if ok else 'red', f"包围盒 {size} m（X,Y,Z）")
        tallest = max(range(3), key=lambda k: size[k])
        add("Y 轴向上（Y 是最长轴）", 'green' if tallest == 1 else 'red', f"最长轴 {'XYZ'[tallest]}")
    else:
        add("单位：场景尺寸像米（最长边 1–2000 m）", 'green' if 1 <= max(size) <= 2000 else 'red', f"包围盒 {size} m（X,Y,Z）")
        add("Y 范围（信息，天空盒/云海会低于 0）", 'green', f"最低 Y={round(lo[1], 3)}，最高 Y={round(hi[1], 3)}")
    # 3 命名
    names = [n.get('name', '') for n in nodes]
    joint_ids = {j for s in g.get('skins', []) for j in s['joints']}
    mesh_nodes = [nodes[i].get('name', '') for i in range(len(nodes)) if 'mesh' in nodes[i]]
    badn = [n for n in mesh_nodes if not n.startswith(PREFIXES)]
    add("网格节点命名有前缀（env_/chr_/col_/anchor_…）", 'yellow' if badn else 'green', f"{len(badn)}/{len(mesh_nodes)} 不合规: {badn[:10]}")
    bad_chars = [n for n in names if any(ord(ch) > 127 or ch in ' ' for ch in n)]
    add("名称无空格和非 ASCII 字符", 'red' if bad_chars else 'green', ', '.join(bad_chars[:10]) or '无')
    dup = sorted({n for n in mesh_nodes if mesh_nodes.count(n) > 1})
    add("网格节点不重名", 'yellow' if dup else 'green', ', '.join(dup[:10]) or '无')
    # 4 骨骼
    skins = g.get('skins', [])
    if skins:
        per = [(s.get('name', f'skin{i}'), len(s['joints'])) for i, s in enumerate(skins)]
        over = [p for p in per if p[1] > max_bones]
        add(f"每个 skin 骨骼数 ≤{max_bones}", 'red' if over else 'green', f"{len(skins)} 个 skin，最多 {max(p[1] for p in per)} 根；超标: {over}")
        if kind == 'chr':
            jn = {nodes[j].get('name') for s in skins for j in s['joints']}
            miss = [b for b in CHR_BONES if b not in jn]; extra = sorted(jn - set(CHR_BONES))
            add("骨骼名与 R5 契约 22 骨一致", 'red' if miss else ('yellow' if extra else 'green'), f"缺: {miss}；多出(需写文档): {extra[:10]}")
            hl = next((j for j in joint_ids if nodes[j].get('name') == 'hand.L'), None)
            if hl is not None:
                x = world[hl][0][3]
                add("朝向：面向 +Z（hand.L=物理右手应在 -X）", 'green' if x < 0 else 'red', f"hand.L 世界 X={round(x, 3)}")
            else: add("朝向：面向 +Z", 'yellow', "没有 hand.L，无法自动判断，需看预览")
    else:
        add("骨骼", 'green' if kind == 'env' else 'yellow', "无 skin")
    # 5 权重
    over4, verts, unnorm, j1 = 0, 0, 0, False
    for m in g.get('meshes', []):
        for p in m['primitives']:
            at = p['attributes']
            if 'JOINTS_1' in at or 'WEIGHTS_1' in at: j1 = True
            if 'WEIGHTS_0' in at:
                ws = read_acc(g, binc, at['WEIGHTS_0']); extra = read_acc(g, binc, at['WEIGHTS_1']) if 'WEIGHTS_1' in at else None
                for k, w in enumerate(ws):
                    full = list(w) + (list(extra[k]) if extra else []); verts += 1
                    if sum(1 for x in full if x > 1e-4) > 4: over4 += 1
                    if abs(sum(full) - 1) > 0.01: unnorm += 1
    if verts:
        add("每顶点权重 ≤4", 'red' if over4 or j1 else 'green', f"蒙皮顶点 {verts}，超 4 权重 {over4}，有 JOINTS_1/WEIGHTS_1: {j1}")
        add("权重归一化（和为 1）", 'yellow' if unnorm else 'green', f"未归一 {unnorm}")
    # 5b 同屏面数：state_<组>_<状态>[_后缀] 同组不同状态互斥，同屏取每组最大的状态
    base, groups, st = 0, {}, [(r, None) for r in roots]
    while st:
        i, tag = st.pop(); n = nodes[i]; nm = n.get('name', '')
        if nm.startswith('state_') and len(nm.split('_')) >= 3 and tag is None: tag = tuple(nm.split('_')[1:3])
        if 'mesh' in n:
            tri = sum(budget.tri_count(g, p) for p in g['meshes'][n['mesh']]['primitives'])
            if tag: groups.setdefault(tag[0], {}).setdefault(tag[1], 0); groups[tag[0]][tag[1]] += tri
            else: base += tri
        st.extend((c, tag) for c in n.get('children', []))
    if groups:
        cap = budget.DEFAULT_BUDGET['scene_triangles_max']
        variants = sorted({s for v in groups.values() for s in v})
        per_state = {s: base + sum(v.get(s, max(v.values())) for v in groups.values()) for s in variants}
        worst_mix = base + sum(max(v.values()) for v in groups.values())
        detail = "；".join(f"全部 {s} {c:,}" for s, c in per_state.items()) + f"；各组取最大的混搭 {worst_mix:,}；常驻 {base:,}，" + "，".join(f"{k}: " + "/".join(f"{s} {c:,}" for s, c in v.items()) for k, v in sorted(groups.items()))
        ok = max(per_state.values()) <= cap
        add(f"同屏三角面（按 state_ 分组，整体切换）≤{cap:,}", ('yellow' if worst_mix > cap else 'green') if ok else 'red', detail + ("（如果各组状态会单独切换，以混搭值为准）" if worst_mix > cap else ""))
    # 6 扩展 / 动画
    exts = set(g.get('extensionsUsed', [])); unk = sorted(exts - COCOS_EXTS)
    add("glTF 扩展在 Cocos 已知支持范围", 'yellow' if unk else 'green', f"未确认: {unk}" if unk else (', '.join(sorted(exts)) or '无'))
    anims = [(a.get('name', ''), len(a['channels'])) for a in g.get('animations', [])]
    morph = any('targets' in p for m in g.get('meshes', []) for p in m['primitives'])
    add("动画 clip 命名", 'yellow' if any(not n for n, _ in anims) else 'green', f"{anims}" + ("；含 blendshape" if morph else ""))
    return kind, size, res

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('glb', nargs='+'); ap.add_argument('--kind', default='auto', choices=['auto', 'chr', 'env'])
    ap.add_argument('--max-bones', type=int, default=22); ap.add_argument('--out', default='art-import-check')
    a = ap.parse_args(); icon = {'green': '🟢', 'yellow': '🟡', 'red': '🔴'}
    out, md = [], ["# 美术导入检查报告", "", "GGbot `art_import_check.py`，静态检查，非 Cocos 导入或真机结果。", ""]
    for p in a.glb:
        p = Path(p); kind, size, res = check(p, a.kind, a.max_bones)
        bud = budget.analyze(p, dict(budget.DEFAULT_BUDGET))
        vis = next((r for r in res if r['item'].startswith('同屏')), None)
        if vis and vis['result'] != 'red':
            for c in bud['checks']:
                if c['item'] == '场景三角面' and c['result'] == 'red': c['result'] = 'yellow'; c['item'] = '场景三角面（文件总数，含互斥状态；以同屏为准）'
        out.append({"file": str(p), "kind": kind, "bbox_m": size, "checks": res, "budget": bud})
        md += [f"## {p.name}（{ '角色' if kind == 'chr' else '场景/道具' }）", "", f"SHA256 `{bud['sha256']}`，{bud['bytes']/1048576:.2f} MB，三角面 {bud['triangles_scene']:,}，draw call 估算 {bud['draw_calls_est']}，贴图 {len(bud['images'])} 张",
               "", "| 检查项 | 结果 | 说明 |", "|---|---|---|"] + [f"| {r['item']} | {icon[r['result']]} | {r['detail']} |" for r in res]
        md += ["", "预算：", "", "| 检查项 | 实测 | 预算 | 结果 |", "|---|---|---|---|"] + [f"| {c['item']} | {c['value']} | {c['budget']} | {icon[c['result']]} |" for c in bud['checks']]
        md += ["", "贴图：" + ("；".join(f"{i['name']} {i['format']} {i['width']}×{i['height']}" for i in bud['images']) or "无"), ""]
    Path(a.out + '.json').write_text(json.dumps(out, ensure_ascii=False, indent=2)); Path(a.out + '.md').write_text("\n".join(md))
    worst = max([r['result'] for o in out for r in o['checks'] + o['budget']['checks']], key=['green', 'yellow', 'red'].index)
    print(f"{a.out}.md worst={worst}"); sys.exit(1 if worst == 'red' else 0)
if __name__ == '__main__': main()
