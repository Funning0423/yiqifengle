import json,sys
R='/workspace/yiqifengle/'
A=json.load(open(R+'previews/角色建模bot/planA-final/anim_meta_planA.json'))
P=json.load(open('/workspace/u3/src/creator-build-project/assets/bundles/region_island/character/anim_meta.json'))
D=json.load(open(R+'work/角色建模bot/docs/r5/planA-final/anim_meta_planA.json'))
M=json.load(open(R+'previews/角色动画bot/sit-drape-stool/arm_seam/meta_patch.json'))
print('preview==docs copy:',A==D)
def walk(a,b,p=''):
    if isinstance(a,dict) and isinstance(b,dict):
        for k in sorted(set(a)|set(b)):
            if k not in a: print('ONLY_PROD',p+'/'+k)
            elif k not in b: print('ONLY_PLANA',p+'/'+k, json.dumps(a[k])[:160])
            else: walk(a[k],b[k],p+'/'+k)
    elif a!=b: print('DIFF',p, json.dumps(a)[:160],'| prod:',json.dumps(b)[:100])
walk(A,P)
print('--- patch check')
for c,d in M.items():
    for k,v in d.items(): print(c,k,'match' if A['clips'][c]['morph']['curves'].get(k)==v else 'MISMATCH')
print('BOW', json.dumps({k:v for k,v in A['clips']['sit_hold']['morph'].get('meshes',{}).items() if 'BOW' in k}))
# full patch for QA: all curves of 3 clips
json.dump({c:A['clips'][c]['morph']['curves'] for c in ('sit_down','sit_hold','stand_up')},open('qa_meta_patch_planA.json','w'))
