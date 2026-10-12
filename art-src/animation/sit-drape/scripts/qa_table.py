# Per-frame minimum-gap table (markdown) from a sit_qa.py report.
#   python3 qa_table.py <qa.json>  -> stdout
# Columns (mm; chair distances clipped at 100; negative = inside):
#   dress / apron / bow / legs / arms: min signed distance to the chair; tris: cloth x chair intersecting triangle pairs;
#   body: hips + thighs above the seat; seat: lowest dress point over the seat minus the seat top;
#   leg x: new leg x dress + leg x apron pairs; out: deepest leg vertex outside the dress (all / visible = not on the seat
#   under the thighs);
#   layer: new dress x apron pairs / deepest apron vertex inside the dress; hand: deepest hand vertex under apron / dress.
import json
import sys


def f(v, nd=1):
    return '' if v is None else ('%.*f' % (nd, v))


def rows(q):
    out = []
    for r in q['frames']:
        cm, ct, s, lg, ly, hd = r['chair_min'], r['chair_tris'], r.get('seat') or {}, r['legs'], r['layers'], r['hands']
        out.append([r['clip'], '%d' % r['frame'] if float(r['frame']).is_integer() else '%.1f' % r['frame'], f(r.get('weights', {}).get('sit_drape'), 2),
                    f(cm['dress']), f(cm['apron']), f(cm['bow']), f(cm['legs']), f(cm['arms']),
                    '%d/%d' % (ct['dress'], ct['apron']), f(s.get('body_gap')), f(s.get('dress_gap')),
                    '%d' % (lg['tris_dress'] + lg['tris_apron']), f(lg['out_of_dress_max']) + ' / ' + f(lg.get('out_visible_max')),
                    '%d/%s' % (ly['tris'], f(ly['apron_in_dress_max'])), f(max(hd['in_apron_max'], hd['in_dress_max']))])
    return out


HEAD = ['clip', 'frame', 'w', 'dress', 'apron', 'bow', 'legs', 'arms', 'tris d/a', 'body', 'seat', 'leg x', 'out all / vis', 'layer', 'hand']


def main():
    q = json.load(open(sys.argv[1]))
    print('| ' + ' | '.join(HEAD) + ' |')
    print('|' + '---|' * len(HEAD))
    for r in rows(q):
        print('| ' + ' | '.join(r) + ' |')


if __name__ == '__main__':
    main()
