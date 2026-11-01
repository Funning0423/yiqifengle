#!/usr/bin/env python3
"""Read-only proof for compress-only Creator output; never mutate package/assets."""
from pathlib import Path
import argparse,hashlib,json,zlib
p=argparse.ArgumentParser();p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('--report',type=Path,required=True);a=p.parse_args();rows=[]
for bundle in ['region_meadow','static_seat_preview']:
 for f in sorted((a.candidate/'subpackages'/bundle/'native').rglob('*.bin')):
  q=a.baseline/f.relative_to(a.candidate);before=q.read_bytes();stored=f.read_bytes();decoded=zlib.decompress(stored)
  if before!=decoded:raise RuntimeError('Lossless mismatch: '+str(f))
  rows.append({'path':str(f.relative_to(a.candidate)),'originalBytes':len(before),'storedBytes':len(stored),'originalSHA256':hashlib.sha256(before).hexdigest(),'decodedSHA256':hashlib.sha256(decoded).hexdigest(),'storedSHA256':hashlib.sha256(stored).hexdigest()})
if len(rows)!=72:raise RuntimeError('Unexpected current model mesh count: '+str(len(rows)))
for f in a.baseline.rglob('*'):
 if f.is_file() and f.suffix.lower() in {'.jpg','.png','.mp3'}:
  if f.read_bytes()!=(a.candidate/f.relative_to(a.baseline)).read_bytes():raise RuntimeError('Image/audio changed: '+str(f))
for f in (a.baseline/'subpackages/region_island/native').rglob('*'):
 if f.is_file() and f.read_bytes()!=(a.candidate/f.relative_to(a.baseline)).read_bytes():raise RuntimeError('Character/island native payload changed: '+str(f))
a.report.write_text(json.dumps({'meshCount':len(rows),'allDecodedSHA256Exact':True,'texturesAudioAndCharacterNativeUnchanged':True,'nativeMeshSavingBytes':sum(r['originalBytes']-r['storedBytes'] for r in rows),'rows':rows},indent=2)+'\n');print('PASS:72 meshes exact decoded bytes; all image/audio/character payloads unchanged.')
