#!/usr/bin/env python3
"""Read-only package verification. Never executes archive content."""
import sys,zipfile,hashlib,json,re,stat
from pathlib import Path,PurePosixPath
zpath,sidecar=map(Path,sys.argv[1:3]); expected='278b8d0775b03e83a483974c69caf6f303e0cdf677c7115c30feacfabba1284d'
data=zpath.read_bytes(); digest=hashlib.sha256(data).hexdigest()
assert len(data)==1695803 and digest==expected, 'size/hash mismatch'
assert re.search(r'\b'+expected+r'\b',sidecar.read_text()),'sidecar mismatch'
with zipfile.ZipFile(zpath) as z:
 seen=set();fold=set();total=0
 for i in z.infolist():
  p=PurePosixPath(i.filename); assert not p.is_absolute() and '..' not in p.parts and '\\' not in i.filename and ':' not in i.filename,'unsafe path'
  assert i.filename not in seen and i.filename.casefold() not in fold,'duplicate path'
  seen.add(i.filename);fold.add(i.filename.casefold());assert not stat.S_ISLNK(i.external_attr>>16),'symlink'
  total+=i.file_size;assert total<32*1024*1024,'oversize'
 assert z.testzip() is None,'CRC failure'
 sums=next(n for n in seen if n.endswith('/SHA256SUMS.txt'));prefix=sums[:-len('SHA256SUMS.txt')];n=0
 for line in z.read(sums).decode().splitlines():
  if not line.strip():continue
  sha,name=line.split(None,1); name=name.lstrip('*');full=prefix+name
  assert hashlib.sha256(z.read(full)).hexdigest()==sha,'internal hash mismatch '+name;n+=1
 print(json.dumps({'bytes':len(data),'sha256':digest,'sidecar':'pass','CRC':'pass','paths':'pass','entries':len(seen),'uncompressed_bytes':total,'internal_manifest_entries_verified':n},indent=2))
