#!/usr/bin/env python3
"""U2 对话框字体子集 —— 构建时扫描台词收字（脚本草案，放在 docs，不进 creator-build-project）。

  python3 build_dialog_fonts.py --lines 'path/to/dialog/**/*.json' --out build/fonts
  python3 build_dialog_fonts.py --lines ... --out build/fonts --check      # 只检查：台词里有、子集里没有 → exit 1

做什么
  1. 扫台词：--lines 给的 glob（json / txt / ts 都行）。json 递归取字段 text / line / lines / speaker / name 的字符串；
     txt 取全文；ts 取引号里的字符串。speaker / name 字段的字进「名字字体」，其余进「正文字体」。
  2. 只收简体：每个汉字必须能编码进 GB2312（6763 个简体规范常用字）；不在里面的字先查 --allow 白名单（一行一个字，
     给少数规范字表里有、GB2312 没有的字，比如「啰」「𬱖」），再不在就报错并列出来（多半是繁体或错别字，要改台词，不要静默补字）。
  3. 固定附带：ASCII 可见字符、全角标点 ，。、！？：；“”‘’（）《》「」—…·～、数字全角半角各一套、省略号「…」（名字截断要用）。
  4. 子集：fontTools.subset，去 hinting、去 GSUB/GPOS 以外的表、保留 vert/vrt2 之外不要的 feature 一律丢。
  5. 思源黑体（Noto Sans CJK SC，CFF 轮廓）转成 TrueType glyf 轮廓（cu2qu，最大误差 1 unit），因为小游戏代码包白名单只有 .ttf，
     wx.loadFont 也只认 TTF；资源圆体本来就是 glyf，不用转。
  6. 改名（OFL 1.1 第 3 条：修改版不得使用保留名 "Source"）：family 改成 "QFL Dialog Name" / "QFL Dialog Body"，
     name ID 1/3/4/6/16/17/21/22 全部重写，保留 ID 0（版权）、13/14（授权），在 ID 10 写明「基于 xxx 的子集，按 OFL 1.1 分发」。
     检查：字体名记录（ID 1/3/4/6/16/17/18/21/22）里出现 "Source" / "Noto" / "Resource Han" 就失败（Noto 是 Google 商标，一并避开）。
  7. 输出 QFLDialogName.ttf / QFLDialogBody.ttf + fonts_manifest.json（字数、字表 sha256、体积、源字体版本），
     OFL 原文另外随包放 licenses/（board_art_sync.py 已有 licenses/ 目录的做法）。

源字体（不进仓库，构建机上放好）
  --name-src  ResourceHanRoundedCN-Bold.ttf  （Resource Han Rounded 0.990，github.com/CyanoHao/Resource-Han-Rounded）
  --body-src  NotoSansCJK-Bold.ttc#2         （Noto Sans CJK SC Bold 2.004，# 后是 TTC 里的序号；也可以给单独的 NotoSansSC-Bold.otf）
"""
import argparse, glob, hashlib, json, os, re, sys
from fontTools.ttLib import TTFont, newTable
from fontTools import subset
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

FIXED = ''.join(chr(c) for c in range(0x20, 0x7F)) + '，。、！？：；“”‘’（）《》「」『』—…·～０１２３４５６７８９ '
NAME_FIXED = '…·'
BANNED = ('Source', 'Noto', 'Resource Han')
TEXT_KEYS = ('text', 'line', 'lines', 'body', 'say')
NAME_KEYS = ('speaker', 'name', 'who')

def walk_json(o, body, names, is_name=False):
    if isinstance(o, str): (names if is_name else body).append(o)
    elif isinstance(o, list):
        for v in o: walk_json(v, body, names, is_name)
    elif isinstance(o, dict):
        for k, v in o.items(): walk_json(v, body, names, k in NAME_KEYS)

def scan(patterns):
    body, names, files = [], [], []
    for pat in patterns:
        for p in sorted(glob.glob(pat, recursive=True)):
            files.append(p); s = open(p, encoding='utf-8').read()
            if p.endswith('.json'): walk_json(json.loads(s), body, names)
            elif p.endswith('.ts'): body += [a or b for a, b in re.findall(r"'([^'\n]*)'|\"([^\"\n]*)\"", s)]
            else: body.append(s)
    return ''.join(body), ''.join(names), files

def is_han(ch): return 0x3400 <= ord(ch) <= 0x9FFF or 0x20000 <= ord(ch) <= 0x3FFFF or 0xF900 <= ord(ch) <= 0xFAFF

def simplified_only(chars, allow):
    bad = []
    for ch in sorted(set(chars)):
        if not is_han(ch) or ch in allow: continue
        try: ch.encode('gb2312')
        except UnicodeEncodeError: bad.append(ch)
    return bad

def load_src(spec):
    path, _, idx = spec.partition('#')
    return TTFont(path, fontNumber=int(idx) if idx else -1, lazy=False)

def cff_to_glyf(font, max_err=1.0):
    """CFF/CFF2 → glyf（fontTools snippets/otf2ttf.py 的做法）。"""
    gs = font.getGlyphSet(); order = font.getGlyphOrder(); glyphs = {}
    for name in order:
        pen = TTGlyphPen(gs); gs[name].draw(Cu2QuPen(pen, max_err, reverse_direction=True)); glyphs[name] = pen.glyph()
    font['loca'] = newTable('loca'); font['glyf'] = g = newTable('glyf'); g.glyphOrder = order; g.glyphs = glyphs
    for t in ('CFF ', 'CFF2', 'VORG'):
        if t in font: del font[t]
    font['maxp'] = m = font['maxp']; m.tableVersion = 0x00010000
    for a in ('maxZones', 'maxTwilightPoints', 'maxStorage', 'maxFunctionDefs', 'maxInstructionDefs', 'maxStackElements', 'maxSizeOfInstructions', 'maxComponentElements'):
        setattr(m, a, 0)
    m.maxZones = 1; font['head'].indexToLocFormat = 0; font['head'].glyphDataFormat = 0
    font['post'].formatType = 3.0          # 不要字形名，省体积
    font.sfntVersion = '\x00\x01\x00\x00'
    return font

def rename(font, family, src_desc):
    nt = font['name']; keep = {0, 13, 14}
    old = [r for r in nt.names if r.nameID in keep]
    nt.names = old
    ps = family.replace(' ', '') + '-Bold'
    for nid, val in ((1, family), (2, 'Regular'), (3, ps + ';subset'), (4, family), (6, ps),
                     (10, 'Subset of %s for the dialog of Yi Qi Feng Le (咦，起风了). Modified Version under SIL OFL 1.1; not the Reserved Font Name.' % src_desc)):
        nt.setName(val, nid, 3, 1, 0x409)   # 只写 Windows Unicode 记录（Mac Roman 编不了中文）
    for r in nt.names:
        s = r.toUnicode()
        if r.nameID in (1, 3, 4, 6, 16, 17, 18, 21, 22) and any(b in s for b in BANNED): raise SystemExit('name %d still contains a reserved/trademark name: %s' % (r.nameID, s))
    if 'CFF ' in font: font['CFF '].cff.fontNames = [ps]

def make(src, text, out, family, desc, to_glyf):
    f = load_src(src)
    opt = subset.Options(); opt.hinting = False; opt.desubroutinize = True; opt.layout_features = []; opt.name_IDs = ['*']
    opt.name_languages = ['*']; opt.notdef_outline = True; opt.glyph_names = False; opt.drop_tables += ['DSIG', 'VORG', 'vhea', 'vmtx', 'BASE', 'JSTF', 'meta']
    sub = subset.Subsetter(opt); sub.populate(text=text); sub.subset(f)
    if to_glyf and 'CFF ' in f: cff_to_glyf(f)
    rename(f, family, desc); f.save(out)
    cmap = f.getBestCmap(); return dict(file=os.path.basename(out), bytes=os.path.getsize(out), chars=len(set(text)), glyphs=len(f.getGlyphOrder()),
                                        outline='glyf' if 'glyf' in f else 'CFF', missing=[c for c in sorted(set(text)) if ord(c) not in cmap and c.strip()])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--lines', nargs='+', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--name-src', default='/workspace/fonts/ResourceHanRoundedCN-Bold.ttf')
    ap.add_argument('--body-src', default='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc#2')
    ap.add_argument('--allow', default=None); ap.add_argument('--check', action='store_true')
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    body, names, files = scan(a.lines)
    if not files: raise SystemExit('no dialog files matched ' + ' '.join(a.lines))
    allow = set(open(a.allow, encoding='utf-8').read()) if a.allow else set()
    bad = simplified_only(body + names, allow)
    if bad: raise SystemExit('不是 GB2312 简体的字（繁体 / 异体 / 生僻，改台词或加进 --allow）: ' + ''.join(bad))
    body_txt = ''.join(sorted(set(body + names + FIXED) - {'\n', '\r', '\t'}))
    name_txt = ''.join(sorted(set(names + NAME_FIXED) - {'\n', '\r', '\t', ' '}))
    nm, bd = os.path.join(a.out, 'QFLDialogName.ttf'), os.path.join(a.out, 'QFLDialogBody.ttf')
    if a.check:
        miss = []
        for p, t in ((nm, name_txt), (bd, body_txt)):
            if not os.path.exists(p): miss.append(p + ' (missing)'); continue
            cm = TTFont(p).getBestCmap(); m = [c for c in t if ord(c) not in cm and c.strip()]
            if m: miss.append('%s: %s' % (os.path.basename(p), ''.join(m)))
        if miss: print('字体子集缺字，重跑 build_dialog_fonts.py：\n  ' + '\n  '.join(miss)); return 1
        print('fonts OK'); return 0
    r1 = make(a.name_src, name_txt, nm, 'QFL Dialog Name', 'Resource Han Rounded CN Bold 0.990', False)
    r2 = make(a.body_src, body_txt, bd, 'QFL Dialog Body', 'Noto Sans CJK SC Bold 2.004', True)
    man = dict(sources=files, name=r1, body=r2, name_chars_sha256=hashlib.sha256(name_txt.encode()).hexdigest(),
               body_chars_sha256=hashlib.sha256(body_txt.encode()).hexdigest(), license='SIL OFL 1.1 (licenses/qfl-dialog-name-ofl.txt, licenses/qfl-dialog-body-ofl.txt)')
    json.dump(man, open(os.path.join(a.out, 'fonts_manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: man[k] for k in ('name', 'body')}, ensure_ascii=False)); return 0 if not (r1['missing'] or r2['missing']) else 1

if __name__ == '__main__': sys.exit(main())
