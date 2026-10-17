import json,glob,sys,os
sys.path.insert(0,'.'); import render_v1 as R
A=[0,-15.9,-52.54,-93.33,-121.68,-122.89,-114,-118]
for m in ['day','night']:
    os.makedirs('frames/'+m,exist_ok=True)
    fs=sorted(glob.glob('json/%s/f_*.json'%m)); prev=None
    for i,f in enumerate(fs):
        d=json.load(open(f)); a=d['angle']
        # choose by sequence position near the end pose to avoid the overshoot ambiguity
        k=min(range(len(A)),key=lambda j:abs(A[j]-a))
        if d['state']=='claimed' and a<=-117.5: k=7
        img='chest/lid_%02d.png'%k
        note='v2 · %s · %s · SPEC v2.1 布局/动效预览（harness 合成，非实机）'%(m,'点击前' if d['state']=='ready' else '打开后')
        R.main(f,'frames/%s/%03d.png'%(m,i),'','',note)
    print(m,len(fs))
