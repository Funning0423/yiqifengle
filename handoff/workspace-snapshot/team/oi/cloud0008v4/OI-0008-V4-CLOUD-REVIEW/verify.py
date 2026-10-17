#!/usr/bin/env python3
"""Read-only verification; no candidate code executed. Run from any directory."""
from pathlib import Path
import hashlib, json, re
root=Path(__file__).resolve().parent
checked=0
for name in ['SHA256SUMS.txt','SOURCE-SHA256SUMS.txt']:
    for line in (root/name).read_text().splitlines():
        digest, rel=line.split('  ',1)
        p=(root/rel).resolve()
        assert p.is_relative_to(root) and p.is_file(),rel
        assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,rel
        checked+=1
for group in ['previous-21','new-boundaries']:
    d=json.loads((root/'results'/group/'summary.json').read_text())
    for row in d['rows']:
        assert row['exit']=={'PASS':0,'FAIL':1,'BLOCKED':2,'PASS_WITH_ALLOWLISTED_IDE_NOTICE':3}[row['status']]
        assert row['manifest']['ok']
        case=root/'results'/group/row['scenario']
        for line in (case/'SHA256SUMS.txt').read_text().splitlines():
            digest,rel=line.split('  ',1)
            p=(case/rel).resolve()
            assert p.is_relative_to(case.resolve()) and p.is_file(), rel
            assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,(row['scenario'],rel)
    print(group,len(d['rows']),'status/exit and frozen-file manifests verified')
print('Verified',checked,'top/source hashes; this verifies evidence integrity, not real DevTools acceptance.')
