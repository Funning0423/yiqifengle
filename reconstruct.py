from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent
m=json.loads((root/'HANDOFF-MANIFEST.json').read_text())
out=root/'reconstructed'
for f in m['originalFiles']:
    p=out/f['path'];p.parent.mkdir(parents=True,exist_ok=True)
    h=hashlib.sha256();total=0
    with p.open('wb') as w:
        for part in f['parts']:
            b=(root/part['path']).read_bytes()
            assert len(b)==part['bytes'] and hashlib.sha256(b).hexdigest()==part['sha256'],part['path']
            w.write(b);h.update(b);total+=len(b)
    assert total==f['bytes'] and h.hexdigest()==f['sha256'],f['path']
    print('VERIFIED',f['path'],total,f['sha256'])
print('All 14 originals verified:',m['originalBytes'],'bytes')
