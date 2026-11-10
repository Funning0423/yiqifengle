#!/usr/bin/env python3
"""COAST01 re-shoot gate (场景设计部). usage: perf_gate.py <out_dir>  -> prints JSON, exit 0 = all PASS.
Perf line (Grok Bot 2026-11-09): 390x844 steady state fps >= 55 and no long task > 100 ms; else simplify board_rim to < 4000 tris.
Steady state = the idle-cXX perf windows (board settled, no input). load-c01 is reported but not gated (asset load)."""
import json, os, re, sys, glob
O = sys.argv[1]; out = {'sessions': {}, 'gate': {}}
def res(s):
    p = os.path.join(O, 's-' + s, 'ev', 'result.json')
    return json.load(open(p)) if os.path.exists(p) else None
def cons(s):
    p = os.path.join(O, 's-' + s, 'ev', 'console.log'); return open(p, errors='replace').read() if os.path.exists(p) else ''
def perfs(r):
    o = {}; pending = []
    for st in r.get('steps', []):
        if st.get('op') == 'perfStart': pending.append(st.get('name'))
        if st.get('op') == 'perfStop' and st.get('perf'):
            nm = st.get('name') or (pending.pop(0) if pending else 'perf%d' % len(o)); o[nm] = st['perf']
    return o
for s in sorted(d[2:] for d in os.listdir(O) if d.startswith('s-')):
    r = res(s); c = cons(s)
    if not r: out['sessions'][s] = {'result': None}; continue
    P = perfs(r)
    marks = [json.loads(m) for m in re.findall(r'\[QF_COAST\] (\{"event":"beacon-marks"[^\n]*\})', c)]
    txt = json.dumps([st for st in r.get('steps', []) if st.get('op') == 'dumpUi'], ensure_ascii=False)
    files = [st.get('file') for st in r.get('steps', []) if st.get('op') == 'screenshot' and st.get('file')]
    out['sessions'][s] = {'exit': r.get('exit'), 'shots': files, 'shotCount': r.get('shots'), 'shotsFailed': r.get('shotsFailed'), 'consoleErrors': r.get('consoleErrors'),
        'perf': {k: {'fps': v.get('fps'), 'drawCallsMed': (v.get('drawCalls') or {}).get('med'), 'drawCallsMax': (v.get('drawCalls') or {}).get('max'),
                     'trisMed': (v.get('tris') or {}).get('med'), 'frameMsP95': (v.get('frameMs') or {}).get('p95'), 'frameMsMax': (v.get('frameMs') or {}).get('max'),
                     'longtaskEntries': v.get('longtaskEntries'), 'longtaskMaxMs': v.get('longtaskMaxMs'), 'gapsOver100': v.get('gapsOver100'), 'gapsOver50MaxMs': v.get('gapsOver50MaxMs')} for k, v in P.items()},
        'beaconMarks': {m['stageId']: m.get('cells') for m in marks},
        'stagesSeen': sorted({(st.get('info') or {}).get('stageId') for st in r.get('steps', []) if st.get('op') == 'boardInfo'} - {None}),
        'journal9of9': bool(re.search(r'9\s*/\s*9', txt)), 'journalText': (re.findall(r'灯塔海岸[^"]{0,24}', txt) or [None])[:3]}
m = out['sessions'].get('after-390x844') or {}
idle = {k: v for k, v in (m.get('perf') or {}).items() if k.startswith('idle')}
def lt(v):
    a = [x for x in (v.get('longtaskMaxMs'), v.get('frameMsMax')) if x is not None]; return max(a) if a else None
fpsok = bool(idle) and all((v['fps'] or 0) >= 55 for v in idle.values())
ltmax = max([lt(v) or 0 for v in idle.values()] or [0]); ltok = bool(idle) and ltmax <= 100
out['gate'] = {
    'perf390': {'pass': fpsok and ltok, 'minIdleFps': min([v['fps'] or 0 for v in idle.values()] or [0]), 'maxLongTaskOrFrameGapMs': ltmax, 'windows': sorted(idle),
                'onFail': 'simplify board_rim to < 4000 triangles (Grok Bot 11/09)'},
    'stages08_09': {'c08Visited': 'r06-coast-08' in (m.get('stagesSeen') or []), 'c09Visited': 'r06-coast-09' in (m.get('stagesSeen') or []), 'c08NoBeacon': 'r06-coast-08' not in (m.get('beaconMarks') or {}) or not m['beaconMarks']['r06-coast-08'],
                    'beaconStages': m.get('beaconMarks'), 'shots08_09': [x for x in (m.get('shots') or []) if re.search(r'c0?8|c0?9|journal', str(x))]},
    'journal9of9': m.get('journal9of9'), 'journalText': m.get('journalText'),
    'devices': {k: (v.get('exit'), len(v.get('shots') or [])) for k, v in out['sessions'].items()},
}
need = ['after-390x844', 'after-375x667', 'after-430x932', 'after-kitoff-390x844']
out['gate']['allSessions'] = all((out['sessions'].get(k) or {}).get('exit') == 'done' for k in need)
g8 = out['gate']['stages08_09']; ok = out['gate']['perf390']['pass'] and g8['c08Visited'] and g8['c09Visited'] and g8['c08NoBeacon'] and out['gate']['journal9of9'] and out['gate']['allSessions']
out['gate']['ALL_PASS'] = ok
print(json.dumps(out, ensure_ascii=False, indent=1)); sys.exit(0 if ok else 1)
