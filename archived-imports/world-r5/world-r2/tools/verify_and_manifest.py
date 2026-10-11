import pathlib,hashlib,json,datetime,subprocess
r=pathlib.Path(__file__).resolve().parents[1];baseline=json.loads((r/'evidence/frozen-sources-before.json').read_text())
changed=[p for p,h in baseline.items() if not pathlib.Path(p).is_file() or hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()!=h]
if changed:raise RuntimeError('Frozen sources changed: '+str(changed))
receipt={'status':'PASS','filesChecked':len(baseline),'changed':[],'scope':'world-r1, native-board-r1 entire recovered delta, R5 v1.1 import-only; no baseline writes'}
(r/'evidence/frozen-source-integrity.json').write_text(json.dumps(receipt,indent=2)+'\n')
files=[]
for p in sorted(r.rglob('*')):
 if p.is_file() and p.name not in ['MERGE-MANIFEST.json'] and '__pycache__' not in p.parts:
  rel=str(p.relative_to(r));files.append({'path':rel,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mergeDestination':('creator-build-project/assets/scripts/world-r2/'+p.name) if p.parent.name=='components' else ('apply to creator-build-project/assets/scripts/NativeBoardUI.ts' if p.suffix=='.patch' else None)})
report=json.loads((r/'evidence/native-integration-report.json').read_text())
m={'schema':1,'createdUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineCocosCommit':'2a320f93b86625e7d59ebbd32a52e2868f993ce6','nativeUICommit':'1d2d0d1e29845a0f42df6eb405d1c2a43afc9c9a','nativeUIPatch':json.loads((r/'evidence/native-patch-provenance.json').read_text()),'mergeScope':'4 new components + one explicit NativeBoardUI managed-mode patch. Keep world-r1 unchanged; import R5 runtime as separate dependency. No Boot/GLB/meta changes.','verified':{'testLog':'evidence/node-tests.txt','R5PublishedReplays':len(report['replays']),'R5PublishedActions':sum(x['actions'] for x in report['replays']),'realProviderFrameKinds':report['kinds'],'shuffle':'Synthetic schema-bound presentation test only','frozenSources':receipt},'unrun':['Cocos editor import and semantic typecheck','Cocos Web build/runtime','real touch hit-testing and portrait visual review','WeChat/device','production completion ledger/rewards'],'files':files}
(r/'MERGE-MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n');print('Verified',len(baseline),'frozen source files; manifest contains',len(files),'relative file entries')
