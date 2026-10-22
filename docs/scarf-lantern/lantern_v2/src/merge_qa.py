# QA 用整身 clip：<c>_lantern = 原 clip 全部通道（去掉右臂 3 旋转）+ 压缩后的 <c>_lanternarm 通道
import sys,json;sys.path.insert(0,'/workspace/yiqifengle/previews/角色动画bot/compress');from glb_io import *
src,out=sys.argv[1:3];J,B=load(src);A={a['name']:a for a in J['animations']}
for n in [k for k in A if k.endswith('_lanternarm')]:
    c=n[:-len('_lanternarm')];o=A[c];ar=A[n];armnodes={ch['target']['node'] for ch in ar['channels']}
    chs=[];sms=[]
    for src_a,keep in ((o,lambda ch:not(ch['target']['path']=='rotation' and ch['target']['node'] in armnodes)),(ar,lambda ch:True)):
        for ch in src_a['channels']:
            if keep(ch):s=src_a['samplers'][ch['sampler']];sms.append(dict(input=s['input'],output=s['output']));chs.append(dict(sampler=len(sms)-1,target=dict(ch['target'])))
    J['animations'].append(dict(name=c+'_lantern',channels=chs,samplers=sms))
save(out,J,B)
