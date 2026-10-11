#!/usr/bin/env python3
"""只读校验：包完整性 + 目标工程当前状态。不写任何文件。
用法: python3 verify_t1.py <variant-dir> <repo>
退出码: 0=BASELINE(全部前置) 10=APPLIED(全部 after) 2=MIXED/异常 3=包自身 SHA256SUMS 不符"""
import sys, os, stat, json, hashlib, pathlib
H = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
v, repo = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
pkg = v.parent.parent; bad = []
for line in (pkg / 'SHA256SUMS').read_text().splitlines():
    sha, rel = line.split('  ', 1)
    if H(pkg / rel) != sha: bad.append(rel)
if bad: print('PACKAGE CORRUPT:', bad); sys.exit(3)
m = json.loads((v / 'manifest.json').read_text())
def kind(p):
    try: st = os.lstat(p)
    except FileNotFoundError: return 'absent'
    return 'symlink' if stat.S_ISLNK(st.st_mode) else 'file' if stat.S_ISREG(st.st_mode) else 'other'
rows, states = [], set()
for f in m['files']:
    p = repo / f['path']; k = kind(p); sha = H(p) if k == 'file' else None
    s = 'before' if (sha == f['before_sha256'] and (k == 'file' or f['before_sha256'] is None and k == 'absent')) else 'after' if sha == f['after_sha256'] else 'OTHER'
    states.add(s); rows.append((s, k, (sha or '-')[:12], f['path']))
deps = [(d['path'], kind(repo / d['path']) == 'file' and H(repo / d['path']) == d['sha256']) for d in m['dependencies']]
for r in rows: print('%-6s %-7s %-12s %s' % r)
print('dependencies:', sum(ok for _, ok in deps), '/', len(deps), 'match', [p for p, ok in deps if not ok] or '')
state = 'BASELINE' if states == {'before'} else 'APPLIED' if states == {'after'} else 'MIXED'
print('package', m['name'], 'state', state)
sys.exit(0 if state == 'BASELINE' and all(ok for _, ok in deps) else 10 if state == 'APPLIED' and all(ok for _, ok in deps) else 2)
