import json,pathlib,hashlib,datetime,subprocess
root=pathlib.Path(__file__).resolve().parents[1]
files=[]
for p in sorted(root.rglob('*')):
 if p.is_file() and p.name not in ['DELTA-MANIFEST.json']:
  rel=str(p.relative_to(root));files.append({'path':rel,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cocosDestination':'assets/scripts/world-r1/'+p.name if p.parent.name=='components' else None})
report={'schema':1,'task':'world-r1 independent scene-flow integration','createdUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineCommit':'2a320f93b86625e7d59ebbd32a52e2868f993ce6','operation':'add only; no baseline edits','sourceIntegrity':json.loads((root/'evidence/source-integrity.json').read_text()),'checks':{'nodeTests':'see evidence/node-tests.txt','grammar':'see evidence/syntax.json','doorAndCameraGeometry':'see evidence/geometry.json','staticTriangleGeometry':'see evidence/static-proxy-geometry.json','officialCocosImport':'NOT RUN','officialCocosTypecheckBuild':'NOT RUN','browserRuntime':'NOT RUN','WeChatBuild':'NOT RUN','deviceRuntime':'NOT RUN','finalCharacterAnimation':'NOT DELIVERED'},'files':files}
(root/'DELTA-MANIFEST.json').write_text(json.dumps(report,indent=2)+'\n');print('Wrote delta manifest:',len(files),'files')
