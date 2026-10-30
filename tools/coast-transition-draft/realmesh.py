"""Load island combined_visual_m.glb + coast bundle (scene/b19-coast-scene 7297fa5f) in island scene_root (=world) frame."""
import json, math, re, os, numpy as np, trimesh
R = os.path.dirname(os.path.abspath(__file__)); FIT = os.environ.get('FIT', 'r2')  # r5d = scene/b19-coast-scene @bb238126 (same placement as r2); r2 = scene/b19-coast-scene @73330bef; v2 = @7297fa5f (void placement, kept for before/after)
W = {'r5d': '/workspace/coast-r5d', 'r2': '/workspace/coast-reanchor-r2', 'v2': '/workspace/coast-reanchor'}[FIT]
ISLAND_GLB = os.path.join(R, '../../creator-project/assets/firstslice/combined_visual_m.glb')
COAST_T = np.array({'r5d': [-0.6, -0.845, 21.5], 'r2': [-0.6, -0.845, 21.5], 'v2': [-2.11, -0.6, 17.39]}[FIT]); COAST_YAW = 180.0
IGNORE = re.compile(r'^(env_sky|env_sea|env_cloud|env_chimney_smoke|env_anim_seagull_fly|env_foam|fx_|env_moon|env_lighthouse_door$|env_window_blind_cards|.*glass|.*beam|.*glow|foam|tide_sheet|beacon_line|contact|seaglass|reuse_cloud)')
def rotY(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a); M = np.eye(4); M[0, 0] = c; M[0, 2] = s; M[2, 0] = -s; M[2, 2] = c; return M
def coast_to_world(p):
    return (rotY(COAST_YAW) @ np.r_[p, 1])[:3] + COAST_T
def load():
    parts = []; skinned = set(json.load(open(W + '/anchors.json'))['sibling_skinned_roots'])
    sc = trimesh.load(ISLAND_GLB, force='scene')
    for node in sc.graph.nodes_geometry:
        M, g = sc.graph[node]
        if IGNORE.match(node) or node in skinned or node.startswith('env_int'): continue
        m = sc.geometry[g].copy(); m.apply_transform(M); parts.append(('island:' + node, m))
    src = {}
    for f in ['coast_terrain', 'coast_rocks', 'coast_props', 'coast_board', 'coast_pieces']:
        s2 = trimesh.load(f'{W}/{f}.glb', force='scene')
        for node in s2.graph.nodes_geometry:
            M, g = s2.graph[node]; m = s2.geometry[g].copy(); m.apply_transform(M); src[node] = m
    root = np.eye(4); root[:3, :3] = rotY(COAST_YAW)[:3, :3]; root[:3, 3] = COAST_T
    missing = set()
    for d in json.load(open(W + '/coast_layout.json'))['layout']:
        n = d['mesh']
        if IGNORE.match(n): continue
        if n not in src: missing.add(n); continue
        L = np.eye(4); L[:3, :3] = rotY(math.degrees(d['rz']))[:3, :3] * d['s']; L[:3, 3] = d['p']
        m = src[n].copy(); m.apply_transform(root @ L); parts.append(('coast:' + n + '@' + ','.join(f'{v:.2f}' for v in d['p']), m))
    return parts, missing
if __name__ == '__main__':
    parts, missing = load(); print(len(parts), 'parts; missing (proxied/ignored):', missing)
    allm = trimesh.util.concatenate([m for _, m in parts]); print('bounds', allm.bounds)
