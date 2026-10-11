import json,pathlib,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
original=json.loads((root/'evidence/source-before.json').read_text())
changes=[]
for name,expected in original.items():
 p=pathlib.Path(name)
 if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=expected:changes.append(name)
result={'sourceFilesChecked':len(original),'changed':changes,'status':'PASS' if not changes else 'FAIL','scope':'Entire recovered creator-build-project file tree and portable-firstslice-v0.1 asset tree as snapshotted before work.'}
(root/'evidence/source-integrity.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
sys.exit(bool(changes))
