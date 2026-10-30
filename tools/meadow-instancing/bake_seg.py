#!/usr/bin/env python3
"""option (b)：非实例网格分段压缩（QFS1）。输入 seg_dump.js 导出的 JSON（struct + 解压后原始 data），
每个网格的原始 data 按字节连续切段（对齐顶点 stride），每段各自 zlib level 9。
用法: python3 bake_seg.py <segdump.json> <out.qfs> [mesh=segKB ...]"""
import json,sys,zlib,struct,base64
SEGKB={'meadow_far_hills':32,'meadow_terrain':56,'meadow_trees_merged':40,'meadow_clouds_near':76,'meadow_river_bank':52}  # meadow_river 不纳入：测得 <4 ms（3.2 手机），(b) 只省约 2.5 KB
def main(src,out,*kv):
  for x in kv:k,v=x.split('=');SEGKB[k]=int(v)
  d=json.load(open(src))['out'];hdr={'v':1,'meshes':[]};blobs=[];off=0
  for name,seg in SEGKB.items():
    if name not in d:continue
    v=d[name];raw=base64.b64decode(v['dataB64']);st=v['struct'];st['compressed']=False
    stride=st['vertexBundles'][0]['view']['stride'];step=max(stride,(seg*1024)//(stride*4)*stride*4)
    m={'name':name,'rawBytes':len(raw),'struct':st,'segs':[]}
    for r0 in range(0,len(raw),step):
      z=zlib.compress(raw[r0:r0+step],9);pad=(-len(z))%4;m['segs'].append([off,len(z),r0,len(raw[r0:r0+step])]);blobs.append(z+b'\0'*pad);off+=len(z)+pad
    hdr['meshes'].append(m)
  H=zlib.compress(json.dumps(hdr,separators=(',',':')).encode(),9)
  b=b'QFS1'+struct.pack('<I',len(H))+H+b'\0'*((-len(H))%4)+b''.join(blobs);open(out,'wb').write(b)
  print('file bytes',len(b),'header',len(H),'zip',len(zlib.compress(b,9)))
  for m in hdr['meshes']:print(m['name'],'raw',m['rawBytes'],'segs',len(m['segs']),'z',sum(s[1] for s in m['segs']),'orig bin',d[m['name']]['binBytes'])
if __name__=='__main__':main(*sys.argv[1:])
