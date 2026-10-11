#!/usr/bin/env python3
"""T1 exact-file installer v2 (GGbot 2026-10-11)。用法: apply.py <repo> [--check|--rollback]
相对冻结 apply.py (268789cb…) 的改动：
 1. 所有目标/依赖路径用 lstat 判定类型：只接受「真实缺失」或「普通文件(非链接)」。悬空链接、链接、目录、FIFO 等一律写前拒绝。
 2. 从仓库根到目标父目录的每一级必须是真实目录或尚不存在（不跟随任何符号链接，包括仓库内部链接）。
 3. 备份根 .cloud-patch-backups 及其每级父目录同样不得是链接；逐级 mkdir 后再 lstat 复核；备份根不得落在 assets/ 下。
 4. 回退 / 失败恢复只 unlink 经 lstat 确认的普通文件；恢复写入用同目录临时文件 + os.replace。
 5. 写前拒绝时保证零变化（不创建备份目录）。
"""
import argparse, pathlib, json, hashlib, sys, os, stat, datetime, uuid

def parse():
    p = argparse.ArgumentParser(); p.add_argument('repo'); p.add_argument('--rollback', action='store_true'); p.add_argument('--check', action='store_true'); return p.parse_args()

def kind(p: pathlib.Path):
    """'absent' | 'file' | 'symlink' | 'dir' | 'other' — never follows links."""
    try: st = os.lstat(p)
    except FileNotFoundError: return 'absent'
    if stat.S_ISLNK(st.st_mode): return 'symlink'
    if stat.S_ISREG(st.st_mode): return 'file'
    if stat.S_ISDIR(st.st_mode): return 'dir'
    return 'other'

def digest(p: pathlib.Path):
    return hashlib.sha256(p.read_bytes()).hexdigest() if kind(p) == 'file' else None

def chain_errors(root: pathlib.Path, rel: str, label: str):
    """Every existing component between root and the leaf's parent must be a real directory."""
    errs = []; rp = pathlib.PurePosixPath(rel)
    if rp.is_absolute() or '..' in rp.parts or not rp.parts: return [f'Unsafe path {label}: {rel}']
    cur = root
    for part in rp.parts[:-1]:
        cur = cur / part; k = kind(cur)
        if k == 'absent': break
        if k != 'dir': errs.append(f'Parent not a real directory ({k}) for {label}: {cur.relative_to(root)}'); break
    return errs

def main():
    a = parse(); here = pathlib.Path(__file__).resolve().parent
    if kind(pathlib.Path(a.repo).absolute()) not in ('dir', 'symlink'): sys.exit('No files changed.\nRepository root missing')
    root = pathlib.Path(a.repo).resolve()  # the root itself may be reached via a link; nothing below it may be
    m = json.loads((here / 'manifest.json').read_text())
    src = 'before' if a.rollback else 'after'; expect = 'after_sha256' if a.rollback else 'before_sha256'; target = 'before_sha256' if a.rollback else 'after_sha256'
    errors = []
    if not a.rollback:
        for d in m.get('dependencies', []):
            errors += chain_errors(root, d['path'], 'dependency')
            p = root / d['path']; k = kind(p)
            if k != 'file': errors.append(f'Dependency not a regular file ({k}): {d["path"]}')
            elif digest(p) != d['sha256']: errors.append('Dependency hash mismatch: ' + d['path'])
    for f in m['files']:
        errors += chain_errors(root, f['path'], 'target')
        p = root / f['path']; k = kind(p); want = f[expect]
        if want is None and k != 'absent': errors.append(f'Target must be truly absent but is {k}: {f["path"]}')
        elif want is not None and k != 'file': errors.append(f'Target not a regular file ({k}): {f["path"]}')
        elif want is not None and digest(p) != want: errors.append('Current hash mismatch: ' + f['path'])
        s = here / src / f['path']
        if f[target] is not None and (kind(s) != 'file' or digest(s) != f[target]): errors.append('Package hash mismatch: ' + f['path'])
    bk_rel = '.cloud-patch-backups'
    bk_root = root / bk_rel; bk_kind = kind(bk_root)
    if bk_kind not in ('absent', 'dir'): errors.append(f'Backup root not a real directory ({bk_kind}): {bk_rel}')
    if errors: sys.exit('No files changed.\n' + '\n'.join(errors))
    if a.check: print('Preflight PASS; zero writes'); sys.exit(0)
    backup = bk_root / (m['name'] + '-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8])
    for d in (bk_root, backup):
        if kind(d) == 'absent': os.mkdir(d)
        if kind(d) != 'dir': sys.exit('No target files changed; backup path became non-directory: ' + str(d))
    state = []
    for f in m['files']:
        p = root / f['path']; saved = backup / 'original' / f['path']; staged = backup / 'staged' / f['path']
        k = kind(p); data = p.read_bytes() if k == 'file' else None
        state.append({'path': f['path'], 'kind': k, 'sha256': digest(p)})
        if data is not None: saved.parent.mkdir(parents=True, exist_ok=True); saved.write_bytes(data)
        if f[target] is not None: staged.parent.mkdir(parents=True, exist_ok=True); staged.write_bytes((here / src / f['path']).read_bytes())
    (backup / 'STATE.json').write_text(json.dumps({'package': m['name'], 'rollback': a.rollback, 'files': state}, indent=2) + '\n')
    # re-verify (TOCTOU window): kinds + hashes + parent chains unchanged
    for f in m['files']:
        p = root / f['path']; k = kind(p)
        if chain_errors(root, f['path'], 'target') or (f[expect] is None and k != 'absent') or (f[expect] is not None and (k != 'file' or digest(p) != f[expect])):
            sys.exit('No target files changed; concurrent edit detected: ' + f['path'] + '; backup ' + str(backup))
    changed = []; fault = int(os.environ['T1_FAULT_AFTER']) if os.environ.get('T1_FAULT_AFTER', '').isdigit() else None  # test-only fault injection
    try:
        for f in m['files']:
            if fault is not None and len(changed) >= fault: raise RuntimeError('Injected fault (T1_FAULT_AFTER) before ' + f['path'])
            p = root / f['path']; changed.append(f['path'])
            if f[target] is None:
                if kind(p) != 'file': raise RuntimeError('Refusing to unlink non-regular path: ' + f['path'])
                p.unlink()
            else:
                p.parent.mkdir(parents=True, exist_ok=True)
                if chain_errors(root, f['path'], 'target'): raise RuntimeError('Parent chain changed: ' + f['path'])
                os.replace(backup / 'staged' / f['path'], p)
        for f in m['files']:
            p = root / f['path']
            if (f[target] is None and kind(p) != 'absent') or (f[target] is not None and digest(p) != f[target]): raise RuntimeError('Postwrite mismatch: ' + f['path'])
    except BaseException as error:
        failures = []
        want = {f['path']: f[expect] for f in m['files']}
        for rel in reversed(changed):
            p = root / rel; saved = backup / 'original' / rel
            try:
                if (want[rel] is None and kind(p) == 'absent') or (want[rel] is not None and digest(p) == want[rel]): continue  # untouched or already original
                if kind(saved) == 'file':
                    tmp = p.parent / ('.restore-' + uuid.uuid4().hex[:8]); tmp.write_bytes(saved.read_bytes()); os.replace(tmp, p)
                elif kind(p) == 'file': p.unlink()
            except BaseException as recovery: failures.append(rel + ': ' + str(recovery))
        for f in m['files']:
            p = root / f['path']
            if (f[expect] is None and kind(p) != 'absent') or (f[expect] is not None and digest(p) != f[expect]): failures.append('Not restored: ' + f['path'])
        sys.exit('Patch failed: ' + str(error) + '\n' + ('Automatic restoration verified.' if not failures else 'RESTORE INCOMPLETE: ' + '; '.join(failures)) + '\nFull backup: ' + str(backup))
    (backup / 'SUCCESS.txt').write_text(('Rolled back' if a.rollback else 'Applied') + ' ' + m['name'] + '\n')
    print(('Rolled back' if a.rollback else 'Applied') + ' ' + m['name'] + '; ' + str(len(m['files'])) + ' exact files; full backup: ' + str(backup))

if __name__ == '__main__': main()
