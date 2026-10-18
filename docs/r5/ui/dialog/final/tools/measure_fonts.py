#!/usr/bin/env python3
"""实测子集体积：同一套 build_dialog_fonts.make()，换三种字表。大文件只写到 /tmp，不进仓库。
  A 本次定稿图示意台词（tools/sample_dialog）  B 随机 800 个 GB2312 一级字（估一章台词规模）  C GB2312 一级字全部 3755 个（上限）
另外量一次「思源黑体不转 glyf、保留 CFF」的体积作对照（小游戏代码包不收 .otf，只是给个参考）。"""
import json, os, sys, gzip, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_dialog_fonts as B
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(os.path.dirname(HERE), 'fonts')
NAME_SRC = '/workspace/fonts/ResourceHanRoundedCN-Bold.ttf'; BODY_SRC = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc#2'
body_a, names_a, _ = B.scan([os.path.join(HERE, 'sample_dialog', '*.json')])
c800 = open('/workspace/fonts/c800.txt', encoding='utf-8').read().strip(); gb1 = open('/workspace/fonts/gb1.txt', encoding='utf-8').read().strip()
sets = {'A_mock': body_a + names_a, 'B_800': c800, 'C_gb1_3755': gb1}
tmp = tempfile.mkdtemp(); res = {}
def gz(p): return len(gzip.compress(open(p, 'rb').read(), 9))
for k, t in sets.items():
    txt = ''.join(sorted(set(t + B.FIXED) - {'\n', '\r', '\t'})); han = sum(1 for c in set(txt) if B.is_han(c))
    r = {}
    for tag, src, fam, glyf in (('body_glyf', BODY_SRC, 'QFL Dialog Body', True), ('body_cff', BODY_SRC, 'QFL Dialog Body', False), ('name_glyf', NAME_SRC, 'QFL Dialog Name', False)):
        p = os.path.join(tmp, '%s_%s.%s' % (k, tag, 'otf' if tag == 'body_cff' else 'ttf'))
        m = B.make(src, txt, p, fam, 'measure', glyf); r[tag] = dict(bytes=m['bytes'], gzip=gz(p), glyphs=m['glyphs'])
    res[k] = dict(han_chars=han, total_chars=len(set(txt)), **r)
names_txt = ''.join(sorted(set(names_a + B.NAME_FIXED)))
p = os.path.join(tmp, 'names.ttf'); m = B.make(NAME_SRC, names_txt, p, 'QFL Dialog Name', 'measure', False)
res['names_only'] = dict(chars=len(set(names_txt)), name_glyf=dict(bytes=m['bytes'], gzip=gz(p)))
json.dump(res, open(os.path.join(OUT, 'measure_sizes.json'), 'w'), ensure_ascii=False, indent=1); print(json.dumps(res, ensure_ascii=False, indent=1))
