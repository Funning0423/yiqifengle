#!/usr/bin/env python3
"""Finalize only a local debug test copy; never edit the user's package or storage."""
import pathlib,json,uuid,shutil,hashlib
root=pathlib.Path(__file__).resolve().parents[1];out=root.parent/'native-package';src=root/'creator-build-project/build/wechat-region-flow-test'
if out.exists():raise RuntimeError('fresh output directory required')
s=(src/'subpackages/main/game.js').read_text()
if '地区流程测试' not in s:raise RuntimeError('debug test entry missing')
shutil.copytree(src,out)
prefix='task25-'+uuid.uuid4().hex+':'
shutil.copyfile(root/'native-storage-isolation.cjs',out/'native-storage-isolation.cjs')
p=out/'game.js';p.write_text("require('./native-storage-isolation.cjs')(wx,"+json.dumps(prefix)+");\n"+p.read_text())
# Creator emits mini-program-only, empty custom compilation conditions for this game.
p=out/'project.config.json';cfg=json.loads(p.read_text());condition=cfg.get('condition',{})
if any(v.get('list') for v in condition.values()):raise RuntimeError('nonempty custom condition requires inspection')
del cfg['condition'];p.write_text(json.dumps(cfg,ensure_ascii=False,separators=(',',':')))
(root.parent/'evidence/isolation-identity.json').write_text(json.dumps({'prefix':prefix,'package':str(out),'isPhysicalDevice':False,'conditionRemoved':condition},indent=2))
print(str(out))
