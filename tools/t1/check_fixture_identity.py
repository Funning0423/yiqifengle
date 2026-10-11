#!/usr/bin/env python3
"""夹具身份门禁：当前工程 GLB 与已登记的解码身份必须逐项一致，否则 FIXTURE STALE（退出 1）。
用法: python3 check_fixture_identity.py <identity.json> <project GLB> [decoded.json]"""
import sys, json, hashlib
ident = json.load(open(sys.argv[1])); glb = open(sys.argv[2], 'rb').read(); sha = hashlib.sha256(glb).hexdigest()
if sha != ident['input']['sha256']: print(f"FIXTURE STALE: GLB {sha[:12]} != fixture {ident['input']['sha256'][:12]}; regenerate with decode_pick_geometry.cjs"); sys.exit(1)
if len(sys.argv) > 3:
    dec = json.load(open(sys.argv[3])); key = lambda d: [(n['name'], n['index'], [(p['vertexCount'], p['indexCount'], p['positionsSHA256'], p['indicesSHA256']) for p in n['primitives']]) for n in d['nodes']]
    if dec['input']['sha256'] != sha or key(dec) != key(ident): print('FIXTURE STALE: decoded streams differ from registered identity'); sys.exit(1)
print('FIXTURE OK', sha[:12]); sys.exit(0)
