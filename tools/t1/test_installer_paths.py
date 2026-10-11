#!/usr/bin/env python3
"""T1 安装器路径负控：在一次性临时目录中对比冻结 apply.py 与 apply_v2.py。
用法: python3 test_installer_paths.py <variant-dir(含 manifest/before/after/apply.py)> <exact-before-inputs-dir> <apply_v2.py> <scratch-dir>
只写 scratch-dir；不读写任何真实工程。"""
import sys, os, shutil, subprocess, json, hashlib, pathlib, tempfile
variant, base, v2, scratch = map(lambda s: pathlib.Path(s).resolve(), sys.argv[1:5])
scratch.mkdir(parents=True, exist_ok=True)
h = lambda b: hashlib.sha256(b).hexdigest()
NEW = 'creator-build-project/assets/scripts/world-r2/IslandHomeInteraction'
def snap(p):
    out = {}
    for dp, dns, fns in os.walk(p, followlinks=False):
        for n in dns + fns:
            q = pathlib.Path(dp) / n; rel = str(q.relative_to(p))
            if rel.split(os.sep)[0] == '.cloud-patch-backups' and not q.is_symlink(): continue
            if q.is_symlink(): out[rel] = ('symlink', os.readlink(q))
            elif q.is_dir(): out[rel] = ('dir',)
            else: out[rel] = ('file', h(q.read_bytes()))
    return out
def pkg(kind):
    d = scratch / f'pkg-{kind}'
    if not d.exists():
        shutil.copytree(variant, d)
        if kind == 'v2': shutil.copy2(v2, d / 'apply.py')
    return d / 'apply.py'
def run(script, repo, *args):
    r = subprocess.run([sys.executable, str(script), str(repo), *args], capture_output=True, text=True); return r.returncode, (r.stdout + r.stderr).strip().splitlines()[:3]
def fresh(name):
    d = scratch / name
    if d.exists(): shutil.rmtree(d)
    shutil.copytree(base, d, symlinks=True); return d
CASES = {}
def case(f): CASES[f.__name__] = f; return f
@case
def clean_roundtrip(r): return None
@case
def dangling_ts_link(r): (r / (NEW + '.ts')).symlink_to(r / 'AUDIT-NONEXISTENT.ts')
@case
def dangling_meta_link(r): (r / (NEW + '.ts.meta')).symlink_to(r / 'AUDIT-NONEXISTENT.ts.meta')
@case
def live_ts_link(r): (r / 'decoy.ts').write_text('// decoy\n'); (r / (NEW + '.ts')).symlink_to(r / 'decoy.ts')
@case
def backup_root_alias_into_assets(r): (r / '.cloud-patch-backups').symlink_to(r / 'creator-build-project/assets/scripts')
@case
def internal_parent_alias(r):
    w = r / 'creator-build-project/assets/scripts/world-r2'; alt = r / 'alt-world-r2'; shutil.move(str(w), str(alt)); w.symlink_to(alt)
@case
def external_parent_alias(r):
    w = r / 'creator-build-project/assets/scripts/world-r2'; ext = pathlib.Path(tempfile.mkdtemp(dir=scratch, prefix='external-')); shutil.move(str(w), str(ext / 'world-r2')); w.symlink_to(ext / 'world-r2')
rows = []
for name, setup in CASES.items():
    for kind in ('frozen', 'v2'):
        r = fresh(f'fx-{name}-{kind}'); setup(r); before = snap(r); script = pkg(kind)
        c = run(script, r, '--check'); afterCheck = snap(r)
        row = {'case': name, 'installer': kind, 'check': c[0], 'checkMsg': c[1]}
        if c[0] == 0:
            ap = run(script, r); rb = run(script, r, '--rollback'); after = snap(r)
            diff = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
            row.update(apply=ap[0], rollback=rb[0], diffAfterRoundTrip=diff, pathLost=bool(diff))
        else:
            row.update(zeroWritesOnReject=(afterCheck == before) and not (r / '.cloud-patch-backups').exists() or (name == 'backup_root_alias_into_assets' and afterCheck == before))
            ap = run(script, r); row.update(applyAlsoRejected=ap[0] != 0, zeroWritesAfterApplyAttempt=(snap(r) == before))
        rows.append(row)
# extra: v2 rollback must refuse to unlink a non-regular path that replaced the new file after apply
r = fresh('fx-rollback-swap-v2'); s = pkg('v2'); run(s, r); t = r / (NEW + '.ts'); t.unlink(); t.symlink_to(r / 'elsewhere.ts'); before = snap(r)
rb = run(s, r, '--rollback'); rows.append({'case': 'rollback_refuses_nonregular_new_path', 'installer': 'v2', 'rollback': rb[0], 'msg': rb[1], 'zeroWrites': snap(r) == before})
print(json.dumps(rows, ensure_ascii=False, indent=1))
