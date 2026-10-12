# Frame-by-frame chair / cloth QA of sit_down, sit_hold, stand_up with the chair and floor at their game positions.
#   blender -b -P sit_qa.py -- <glb> <anim_meta.json> <out.json> [sub]
# sub = samples per 1/30 s frame (default 1; 2 = also half frames).  Morph weights come from anim_meta clips.<clip>.morph.
# Per sample (all distances in mm, game world space):
#   chair_min      min signed distance to the chair per layer (dress / apron / legs / torso+hips / feet / hands); < 0 = inside
#   chair_tris     intersecting triangle pairs layer x chair
#   seat           seated contact: lowest cloth point over the seat slab minus the seat surface (dress_gap, per side L/R
#                  of the chair), body (hips + thighs) above the seat, number of dress vertices resting within 3 mm
#   edge           front / side seat edges: distance from the edge line to the closest dress point (where the dress covers it),
#                  and the dress hanging over the front edge: drop below the seat top 4 cm in front of the edge
#   legs           thigh / shin vs dress and apron: new intersecting triangle pairs (rest-pose pairs excluded) and the deepest
#                  leg vertex on the outer side of the dress (perpendicular foot on a dress face), min inner clearance
#   layers         new dress x apron intersecting pairs, deepest apron vertex inside the dress
#   hands          hands vs apron / dress: intersecting pairs, deepest hand vertex under the apron / dress surface, min gap
import json
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402

COVER_MAX = 0.025          # a leg vertex counts as covered when its perpendicular foot on the dress is this close
SEAT_HIDDEN = 0.03         # leg vertices over the seat footprint and this close to the seat top (under / between the
#                            thighs on the seat: not visible from any side) are reported apart (legs.out_visible_*)


def rest_pairs(ch, a, b, Pa, Pb):
    return set(SL.bvh(Pa, a).overlap(SL.bvh(Pb, b)))


class QA:
    def __init__(self, glb, meta):
        self.ch = SL.Character(glb)
        self.meta = meta
        self.chair = SL.Chair()
        ch = self.ch
        self.F = {k: ch.md[k]['F'] for k in SL.MESHES}
        bf = ch.body_part_faces
        self.leg_F = bf['leg']
        self.hand_F = bf['hand']
        # rest-pose contacts that are part of the model (waist band sewn to the apron, hands / thighs touching nothing)
        W0 = ch.rig.rest_world
        P0 = {k: ch.skin(k, W0) for k in SL.MESHES}
        self.rest = dict(
            leg_dress=rest_pairs(ch, self.leg_F, self.F['DRESS'], P0['BODY'], P0['DRESS']),
            leg_apron=rest_pairs(ch, self.leg_F, self.F['APRON'], P0['BODY'], P0['APRON']),
            dress_apron=rest_pairs(ch, self.F['DRESS'], self.F['APRON'], P0['DRESS'], P0['APRON']),
            hand_apron=rest_pairs(ch, self.hand_F, self.F['APRON'], P0['BODY'], P0['APRON']),
            hand_dress=rest_pairs(ch, self.hand_F, self.F['DRESS'], P0['BODY'], P0['DRESS']))
        self.skirt_ids = np.where(ch.panel['DRESS'] != 'top')[0]
        self.apron_skirt = np.where(ch.panel['APRON'] != 'top')[0]
        self.chair_tree = self.chair.tree
        # leg vertices that are under the skirt at rest (inside the dress tube above the hem): only those are tested for
        # "outside the dress" (knees / shins below the hem are bare by design)
        tD = SL.bvh(P0['DRESS'], self.F['DRESS'])
        legs = ch.ids['leg']
        d = SL.signed_to_surface(P0['BODY'][legs], tD, P0['DRESS'], self.F['DRESS'], maxd=0.08, cos_min=0.9)
        self.cov_legs = legs[np.isfinite(d) & (d < 0)]
        self.rest_out_legs = set(legs[np.isfinite(d) & (d > 0)].tolist())

    def sample(self, clip, t, weights=None, local=None, override=None):
        ch = self.ch
        W = ch.joints(clip, t, local)
        if weights is None:
            weights = SL.morph_weights(self.meta, clip, t)
        P = {k: ch.skin(k, W, weights if k != 'BODY' else None) for k in SL.MESHES + ('BOW',)}
        P.update(override or {})
        return W, P, weights

    def measure(self, clip, t, weights=None, local=None, full=True, override=None):
        """override: {mesh: world positions} replaces the skinned shape (cloth sim / fitted candidates)."""
        ch, chair = self.ch, self.chair
        W, P, weights = self.sample(clip, t, weights, local, override)
        B = P['BODY']
        rec = dict(clip=clip, t=round(float(t), 4), frame=round(float(t) * SL.FPS, 2),
                   weights={k: round(v, 4) for k, v in weights.items()})
        # ---------------- chair
        groups = dict(dress=P['DRESS'], apron=P['APRON'], legs=B[ch.ids['leg']], torso=B[ch.ids['torso']],
                      feet=B[ch.ids['foot']], hands=B[ch.ids['hand']], arms=B[ch.ids['arm']],
                      head=B[ch.ids['head']], bow=P['BOW'])
        cm, cn, cw = {}, {}, {}
        for k, pts in groups.items():
            sd = chair.signed(pts)
            i = int(np.argmin(sd))
            cm[k] = round(float(sd[i]) * 1000, 1)
            cn[k] = int((sd < 0).sum())
            if sd[i] < 0.01:
                _, wh = chair.inside_depth(pts[i:i + 1])
                if wh[0] < 0:
                    r = chair.tree.find_nearest(chair.Vector(pts[i]), 0.2)
                    fi = r[2]
                    wh = [next(j for j, p in enumerate(chair.parts) if fi in p['faces'])] if fi is not None else [-1]
                cw[k] = chair.parts[wh[0]]['name'] if wh[0] >= 0 else '-'
        rec['chair_min'] = cm
        rec['chair_inside_verts'] = cn
        rec['chair_closest_part'] = cw
        tC = chair.tree
        rec['chair_tris'] = dict(dress=len(SL.bvh(P['DRESS'], self.F['DRESS']).overlap(tC)),
                                 apron=len(SL.bvh(P['APRON'], self.F['APRON']).overlap(tC)),
                                 body=len(SL.bvh(B, ch.md['BODY']['F']).overlap(tC)))
        # ---------------- floor (shoes)
        rec['floor_min_mm'] = round(float(B[ch.ids['foot'], 1].min()) * 1000, 1)
        # ---------------- seat contact
        Ld = SL.to_chair(P['DRESS'])
        hs = chair.seat_height(Ld)
        on = np.isfinite(hs) & (np.abs(Ld[:, 0]) < 0.237) & (np.abs(Ld[:, 2]) < 0.181)
        seat = {}
        if on.any():
            g = Ld[on, 1] - hs[on]
            seat['dress_gap'] = round(float(g.min()) * 1000, 1)
            for side, m in (('L', Ld[on, 0] < 0), ('R', Ld[on, 0] >= 0)):
                seat['dress_gap_' + side] = round(float(g[m].min()) * 1000, 1) if m.any() else None
            seat['dress_resting_verts'] = int(((g >= -0.0005) & (g <= 0.003)).sum())
        Lb = SL.to_chair(B[np.concatenate([ch.ids['hips'], ch.ids['thigh']])])
        hb = chair.seat_height(Lb)
        onb = np.isfinite(hb)
        if onb.any():
            seat['body_gap'] = round(float((Lb[onb, 1] - hb[onb]).min()) * 1000, 1)
        rec['seat'] = seat
        if not full:
            return rec, P
        # ---------------- seat edges
        tD = SL.bvh(P['DRESS'], self.F['DRESS'])
        tA = SL.bvh(P['APRON'], self.F['APRON'])
        V = chair.Vector
        edge = {}
        for nm, pts in (('front', [(x, SL.SEAT_TOP, 0.191) for x in np.linspace(-0.2, 0.2, 9)]),
                        ('side_L', [(-0.247, SL.SEAT_TOP, z) for z in np.linspace(-0.12, 0.15, 7)]),
                        ('side_R', [(0.247, SL.SEAT_TOP, z) for z in np.linspace(-0.12, 0.15, 7)])):
            W3 = SL.from_chair(np.array(pts))
            ds = []
            for p in W3:
                r = tD.find_nearest(V(p), 0.06)
                ds.append(r[3] if r[0] is not None else np.nan)
            ds = np.array(ds)
            edge[nm] = dict(min=None if np.all(np.isnan(ds)) else round(float(np.nanmin(ds)) * 1000, 1),
                            max=None if np.all(np.isnan(ds)) else round(float(np.nanmax(ds)) * 1000, 1),
                            covered=int(np.isfinite(ds).sum()), samples=len(ds))
        fr = (Ld[:, 2] > 0.20) & (Ld[:, 2] < 0.235) & (np.abs(Ld[:, 0]) < 0.2) & (Ld[:, 1] < 0.40) & (Ld[:, 1] > 0.2)
        edge['front_overhang_verts'] = int(fr.sum())
        edge['front_overhang_top_mm'] = round(float((Ld[fr, 1].max() - SL.SEAT_TOP) * 1000), 1) if fr.any() else None
        rec['edge'] = edge
        # ---------------- legs vs cloth
        tL = SL.bvh(B, self.leg_F)
        lg = {}
        for nm, tree, rest in (('dress', tD, self.rest['leg_dress']), ('apron', tA, self.rest['leg_apron'])):
            pairs = set(tL.overlap(tree)) - rest
            lg['tris_' + nm] = len(pairs)
        d = SL.signed_to_surface(B[self.cov_legs], tD, P['DRESS'], self.F['DRESS'], maxd=COVER_MAX, cos_min=0.9)
        out = d[np.isfinite(d) & (d > 0)]
        lg['out_of_dress_verts'] = int(len(out))
        lg['out_of_dress_max'] = round(float(out.max()) * 1000, 1) if len(out) else 0.0
        Lc = SL.to_chair(B[self.cov_legs])
        on_seat = (np.abs(Lc[:, 0]) < 0.26) & (np.abs(Lc[:, 2]) < 0.2) & (Lc[:, 1] < SL.SEAT_TOP + SEAT_HIDDEN)
        vis = d[np.isfinite(d) & (d > 0) & ~on_seat]
        lg['out_visible_verts'] = int(len(vis))
        lg['out_visible_max'] = round(float(vis.max()) * 1000, 1) if len(vis) else 0.0
        inn = -d[np.isfinite(d) & (d <= 0)]
        lg['inner_clear_min'] = round(float(inn.min()) * 1000, 1) if len(inn) else None
        rec['legs'] = lg
        # ---------------- dress x apron
        pairs = set(tD.overlap(tA)) - self.rest['dress_apron']
        da = SL.signed_to_surface(P['APRON'][self.apron_skirt], tD, P['DRESS'], self.F['DRESS'], maxd=0.02, cos_min=0.9)
        ins = -da[np.isfinite(da) & (da < 0)]
        rec['layers'] = dict(tris=len(pairs), apron_in_dress_verts=int(len(ins)),
                             apron_in_dress_max=round(float(ins.max()) * 1000, 1) if len(ins) else 0.0)
        # ---------------- hands vs apron / dress
        H = B[ch.ids['hand']]
        tH = SL.bvh(B, self.hand_F)
        hd = {}
        for nm, tree, Pm, Fm, rest in (('apron', tA, P['APRON'], self.F['APRON'], self.rest['hand_apron']),
                                       ('dress', tD, P['DRESS'], self.F['DRESS'], self.rest['hand_dress'])):
            hd['tris_' + nm] = len(set(tH.overlap(tree)) - rest)
            s = SL.signed_to_surface(H, tree, Pm, Fm, maxd=0.03, cos_min=0.9)
            neg = -s[np.isfinite(s) & (s < 0)]
            pos = s[np.isfinite(s) & (s >= 0)]
            hd['in_' + nm + '_verts'] = int(len(neg))
            hd['in_' + nm + '_max'] = round(float(neg.max()) * 1000, 1) if len(neg) else 0.0
            hd['gap_' + nm + '_min'] = round(float(pos.min()) * 1000, 1) if len(pos) else None
        rec['hands'] = hd
        return rec, P


def run(glb, meta, sub=1, clips=SL.CLIPS):
    qa = QA(glb, meta)
    res = dict(glb=os.path.basename(glb), size=os.path.getsize(glb), frames=[], method=__doc__)
    for clip in clips:
        dur = qa.ch.dur[clip]
        n = int(round(dur * SL.FPS))
        ts = np.arange(n * sub + (0 if clip == 'sit_hold' else 1)) / (SL.FPS * sub)
        for t in ts:
            rec, _ = qa.measure(clip, t)
            res['frames'].append(rec)
    return qa, res


def summarize(res):
    out = {}
    for clip in SL.CLIPS:
        fr = [r for r in res['frames'] if r['clip'] == clip]
        if not fr:
            continue
        s = {}
        for k in fr[0]['chair_min']:
            v = [r['chair_min'][k] for r in fr]
            s['chair_min_' + k] = dict(min=min(v), frame=fr[int(np.argmin(v))]['frame'])
        s['chair_tris_total'] = {k: sum(r['chair_tris'][k] for r in fr) for k in fr[0]['chair_tris']}
        s['legs_tris_total'] = sum(r['legs']['tris_dress'] + r['legs']['tris_apron'] for r in fr)
        s['legs_out_max'] = max(r['legs']['out_of_dress_max'] for r in fr)
        s['legs_out_visible_max'] = max(r['legs']['out_visible_max'] for r in fr)
        s['layers_tris_total'] = sum(r['layers']['tris'] for r in fr)
        s['apron_in_dress_max'] = max(r['layers']['apron_in_dress_max'] for r in fr)
        s['hands_tris_total'] = sum(r['hands']['tris_apron'] + r['hands']['tris_dress'] for r in fr)
        s['hands_in_max'] = max(max(r['hands']['in_apron_max'], r['hands']['in_dress_max']) for r in fr)
        g = [r['seat'].get('dress_gap') for r in fr if r['seat'].get('dress_gap') is not None]
        s['seat_dress_gap'] = dict(min=min(g) if g else None, max=max(g) if g else None)
        out[clip] = s
    return out


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:]
    glb, metap, outp = a[0], a[1], a[2]
    sub = int(a[3]) if len(a) > 3 else 1
    with open(metap) as f:
        meta = json.load(f)
    qa, res = run(glb, meta, sub)
    res['summary'] = summarize(res)
    with open(outp, 'w') as f:
        json.dump(res, f, indent=1)
    print('SUMMARY', json.dumps(res['summary']))
