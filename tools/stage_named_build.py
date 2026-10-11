"""Stage a verified build in the existing disposable window, preserving rollback."""
from pathlib import Path
import hashlib
import sys
import re
import json
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
evidence = root / 'evidence/fb338ef-integration-20261010'
name,baselineName,tag=sys.argv[1:4]
assert all(re.fullmatch(r'[a-z0-9-]+',x) for x in [name,baselineName,tag])
baseline = json.loads((evidence / (baselineName+'.json')).read_text())
target = Path(baseline['target'])
expected = 'QFFirstOpen-20261010T084620701Z-adad-e429da-default'
assert target.parent.name == 'qf-first-open' and target.name == expected
assert not (target / '.git').exists()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
cfg = json.loads((target / 'project.config.json').read_text())
assert cfg['appid'] == 'wx3bdd911c5c06f591' and cfg['projectname'] == expected
assert {str(p.relative_to(target)) for p in target.rglob('*') if p.is_file()} == {x['path'] for x in baseline['files']}
assert all(sha(target / x['path']) == x['sha256'] for x in baseline['files']), 'Target changed; stop'
source = root / 'creator-build-project/build' / name
assert (source / 'game.js').is_file()
assert (source / 'game.json').is_file()
subprocess.run(['python3',str(root/'tools/check_wechat_build.py'),str(source)],check=True)
# Custom first screen (docs/first-screen.md): the build must carry build-templates/wechatgame/first-screen.js + startup-art.
subprocess.run(['python3',str(root/'tools/verify_native_loading.py'),str(source)],check=True)
backup = evidence / ('rollback-before-'+tag+'.zip')
assert not backup.exists(), 'Already staged; stop'
with zipfile.ZipFile(backup, 'w', zipfile.ZIP_DEFLATED) as z:
    for x in baseline['files']:
        z.write(target / x['path'], x['path'])
with zipfile.ZipFile(backup) as z:
    assert z.testzip() is None
    assert all(hashlib.sha256(z.read(x['path'])).hexdigest() == x['sha256'] for x in baseline['files'])
for p in source.rglob('*'):
    if p.is_file() and p.name not in {'project.config.json', 'project.private.config.json'}:
        dst = target / p.relative_to(source)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, dst)
newcfg = json.loads((source / 'project.config.json').read_text())
newcfg.update(projectname=cfg['projectname'], appid=cfg['appid'])
(target / 'project.config.json').write_text(json.dumps(newcfg, ensure_ascii=False, indent=2) + '\n')
receipt = {'target': str(target), 'rollbackZip': str(backup), 'rollbackSHA256': sha(backup),
           'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
           'privateConfigPreserved': True, 'sameWindowIdentityPreserved': True,
           'files': [{'path': str(p.relative_to(target)), 'sha256': sha(p)} for p in sorted(target.rglob('*')) if p.is_file()]}
(evidence / (tag+'-staging-receipt.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'staged': True, 'backupFiles': len(baseline['files']), 'target': str(target)}))
