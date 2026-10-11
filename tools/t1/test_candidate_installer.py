#!/usr/bin/env python3
"""T1 baseline 候选安装器场景测试（只写 scratch）。
用法: python3 test_candidate_installer.py <candidate-dir> <baseline-tree> <near-tree> <scratch>
baseline-tree / near-tree 为只读源（git archive 导出）；每个场景复制到 scratch 下的一次性目录。"""
import sys, os, shutil, subprocess, json, hashlib, pathlib, tempfile, stat
cand, base, near, scratch = (pathlib.Path(x).resolve() for x in sys.argv[1:5]); scratch.mkdir(parents=True, exist_ok=True)
H = lambda b: hashlib.sha256(b).hexdigest(); S = 'creator-build-project/assets/scripts'; NEW = f'{S}/world-r2/IslandHomeInteraction'
TGT = os.environ.get('T1_TARGET', 'baseline'); OTHER = 'near' if TGT == 'baseline' else 'baseline'  # near 目标: argv 依次为 <cand> <near-tree> <baseline-tree>
L123 = cand / f'variants/{TGT}-l123'; L12 = cand / f'variants/{TGT}-l12'
def snap(p):
    out = {}
    for dp, dns, fns in os.walk(p, followlinks=False):
        for n in dns + fns:
            q = pathlib.Path(dp) / n; rel = str(q.relative_to(p))
            if rel.split(os.sep)[0] == '.cloud-patch-backups': continue
            out[rel] = ('symlink', os.readlink(q)) if q.is_symlink() else ('dir',) if q.is_dir() else ('file', H(q.read_bytes()))
    return out
def fresh(name, src=base):
    d = scratch / name
    if d.exists(): subprocess.run(['chmod', '-R', 'u+w', str(d)]); shutil.rmtree(d)
    shutil.copytree(src, d, symlinks=True); return d
def run(v, repo, *args, env=None):
    r = subprocess.run([sys.executable, str(v / 'apply.py'), str(repo), *args], capture_output=True, text=True, env={**os.environ, **(env or {})})
    return r.returncode, (r.stdout + r.stderr).strip().splitlines()
def verify(v, repo): return subprocess.run([sys.executable, str(cand / 'verify_t1.py'), str(v), str(repo)], capture_output=True, text=True).returncode
rows = []
def rec(name, ok, **kw): rows.append({'case': name, 'pass': bool(ok), **kw})
# 1 正常往返（两变体）
for v in (L123, L12):
    r = fresh('rt-' + v.name); b = snap(r)
    c = run(v, r, '--check'); zero = snap(r) == b and not (r / '.cloud-patch-backups').exists()
    a = run(v, r); va = verify(v, r); rb = run(v, r, '--rollback'); vb = verify(v, r)
    rec(f'roundtrip-{v.name}', c[0] == 0 and zero and a[0] == 0 and va == 10 and rb[0] == 0 and vb == 0 and snap(r) == b, check=c[0], checkZeroWrites=zero, apply=a[0], verifyAfterApply=va, rollback=rb[0], verifyAfterRollback=vb, treeIdentical=snap(r) == b)
# 2 前置 SHA 失败（依赖被改）→ 零写入
for dep in (f'{S}/world-r1/WorldFlowCore.ts', 'creator-build-project/assets/bundles/region_island/combined_visual_m.glb', f'{S}/WarmButton.ts'):
    r = fresh('dep'); (r / dep).write_bytes((r / dep).read_bytes() + b'\n'); b = snap(r)
    c = run(L123, r, '--check'); a = run(L123, r)
    rec('prereq-dependency-mismatch:' + dep.split('/')[-1], c[0] != 0 and a[0] != 0 and snap(r) == b and not (r / '.cloud-patch-backups').exists(), check=c[0], apply=a[0], msg=a[1][-1:])
# 3 目标前置 SHA 失败（Boot 被改）
r = fresh('tgt'); t = r / f'{S}/WorldIntegrationBoot.ts'; t.write_bytes(t.read_bytes() + b' '); b = snap(r); a = run(L123, r)
rec('prereq-target-mismatch:Boot', a[0] != 0 and snap(r) == b, apply=a[0], msg=a[1][-1:])
# 4 错误树：near 分支（近镜 Core c5cd / Routes 8272）
r = fresh('near', near); b = snap(r); a = run(L123, r)
rec(f'wrong-tree-{OTHER}-rejected', a[0] != 0 and snap(r) == b, apply=a[0], msg=[x for x in a[1] if 'mismatch' in x][:3])
# 5 互斥：l123 已装再装 l12 / 用 l12 回退
r = fresh('excl'); run(L123, r); b = snap(r); a = run(L12, r); rb = run(L12, r, '--rollback')
rec('mutually-exclusive-l12-on-l123', a[0] != 0 and rb[0] != 0 and snap(r) == b, apply=a[0], rollback=rb[0])
# 6 路径类：悬空/活链接、备份别名、父链别名
def lk(r, rel, tgt): (r / rel).symlink_to(r / tgt)
setups = {
 'dangling-ts-link': lambda r: lk(r, NEW + '.ts', 'AUDIT-NONEXISTENT.ts'),
 'dangling-meta-link': lambda r: lk(r, NEW + '.ts.meta', 'AUDIT-NONEXISTENT.meta'),
 'live-ts-link': lambda r: ((r / 'decoy.ts').write_text('x'), lk(r, NEW + '.ts', 'decoy.ts')),
 'backup-root-alias-into-assets': lambda r: (r / '.cloud-patch-backups').symlink_to(r / S),
 'internal-parent-alias-world-r2': lambda r: (shutil.move(str(r / S / 'world-r2'), str(r / 'alt-world-r2')), (r / S / 'world-r2').symlink_to(r / 'alt-world-r2')),
 'external-parent-alias-world-r2': lambda r: (lambda e: (shutil.move(str(r / S / 'world-r2'), str(e / 'w')), (r / S / 'world-r2').symlink_to(e / 'w')))(pathlib.Path(tempfile.mkdtemp(dir=scratch, prefix='ext-'))),
}
for name, f in setups.items():
    r = fresh('path'); f(r); b = snap(r); c = run(L123, r, '--check'); a = run(L123, r)
    rec('path-' + name, c[0] != 0 and a[0] != 0 and snap(r) == b and (name == 'backup-root-alias-into-assets' or not (r / '.cloud-patch-backups').exists()), check=c[0], apply=a[0], msg=c[1][-1:])
# 7 写入中途失败 → 自动完整回退
for n in (1, 2, 3, 4):
    r = fresh('fault'); b = snap(r); a = run(L123, r, env={'T1_FAULT_AFTER': str(n)})
    rec(f'apply-fault-after-{n}-full-restore', a[0] != 0 and snap(r) == b and any('Automatic restoration verified' in x for x in a[1]), apply=a[0], msg=a[1][:2])
r = fresh('fault-rb'); run(L123, r); b = snap(r); a = run(L123, r, '--rollback', env={'T1_FAULT_AFTER': '3'})
rec('rollback-fault-after-3-full-restore', a[0] != 0 and snap(r) == b and any('Automatic restoration verified' in x for x in a[1]), rollback=a[0], msg=a[1][:2])
# 7b 真实 OS 错误：world-r2 目录只读（Boot、Component 已替换后在 Overlay 处失败）
if os.geteuid() != 0:
    r = fresh('perm'); b = snap(r); w = r / S / 'world-r2'; os.chmod(w, 0o555)
    try: a = run(L123, r)
    finally: os.chmod(w, 0o755)
    rec('apply-real-permission-error-full-restore', a[0] != 0 and snap(r) == b and any('Automatic restoration verified' in x for x in a[1]), apply=a[0], msg=a[1][:2])
# 8 安装后被手改 → 回退拒绝，零写入
r = fresh('edited'); run(L123, r); t = r / f'{S}/world-r1/WorldFlowComponent.ts'; t.write_bytes(t.read_bytes() + b'//x'); b = snap(r); rb = run(L123, r, '--rollback')
rec('rollback-refuses-edited-file', rb[0] != 0 and snap(r) == b, rollback=rb[0], msg=rb[1][-1:])
# 9 安装后新文件被换成链接 → 回退拒绝
r = fresh('swap'); run(L123, r); t = r / (NEW + '.ts'); t.unlink(); t.symlink_to(r / 'elsewhere.ts'); b = snap(r); rb = run(L123, r, '--rollback')
rec('rollback-refuses-nonregular-new-path', rb[0] != 0 and snap(r) == b, rollback=rb[0], msg=rb[1][-1:])
# 10 包损坏 → verify 报 3
pc = scratch / 'pkg-corrupt'
if pc.exists(): shutil.rmtree(pc)
shutil.copytree(cand, pc); (pc / f'variants/{TGT}-l123/after' / (NEW + '.ts')).write_text('//tampered'); r = fresh('corrupt'); b = snap(r)
vr = subprocess.run([sys.executable, str(pc / 'verify_t1.py'), str(pc / f'variants/{TGT}-l123'), str(r)], capture_output=True).returncode; a = run(pc / f'variants/{TGT}-l123', r)
rec('tampered-package-rejected', vr == 3 and a[0] != 0 and snap(r) == b, verify=vr, apply=a[0])
print(json.dumps({'pass': all(x['pass'] for x in rows), 'total': len(rows), 'failed': [x['case'] for x in rows if not x['pass']], 'rows': rows}, ensure_ascii=False, indent=1))
sys.exit(0 if all(x['pass'] for x in rows) else 1)
