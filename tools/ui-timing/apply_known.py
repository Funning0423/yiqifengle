#!/usr/bin/env python3
"""Apply tools/ui-timing/known-timings.json to a check_ui_motion.py result (read-only; never edits ui-audit).
  python3 /workspace/wechat-game/ui-audit/tools/check_ui_motion.py --repo R --rev REV --out P \
      --register "$(python3 -c 'import json;print(",".join(json.load(open("tools/ui-timing/known-timings.json"))["register"]))')"
  python3 tools/ui-timing/apply_known.py P.json   → prints remaining fail / needs-class items; exit 1 if any fail remains.
Same rules as check_ui_motion.py: small 100–200 ms, enter 250–400 ms, exit < paired enter, skip = not an animation."""
import json, sys, os
K = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'known-timings.json')))
known = {(i['file'], i['name']): i for i in K['items']}
def rule(i):
    c, v, pe = i['cls'], i['ms'], i.get('pair')
    if c == 'small': return 'pass' if 100 <= v <= 200 else 'fail'
    if c == 'enter': return 'pass' if 250 <= v <= 400 else 'fail'
    if c == 'exit': return ('pass' if v < pe['ms'] else 'fail') if pe else 'needs-pair'
    if c == 'skip': return 'skip'
    return 'pass' if v <= 600 else 'fail'
def apply(scan):
    out = []
    for it in scan['items']:
        if it.get('missing'): continue
        k = known.get((it['file'], it['name']))
        if k and k['ms'] == it['ms']: it = dict(it, cls=k['cls'], pair=k.get('pair', it.get('pair')), status=None, known=k['reason']); it['status'] = rule(it)
        out.append(it)
    return out
if __name__ == '__main__':
    items = apply(json.load(open(sys.argv[1])))
    left = [i for i in items if i['status'] in ('fail', 'needs-class', 'needs-pair')]
    for i in left: print(i['status'], f"{i['file']}:{i['line']}", i['name'], i['ms'], i.get('rule', ''))
    print('known applied:', sum(1 for i in items if 'known' in i), '| remaining:', len(left))
    sys.exit(1 if any(i['status'] == 'fail' for i in left) else 0)
