import sys,numpy as np
exec(open('../../planA-verify/glbcmp.py').read().split('def h(')[0].replace("A=load","#"))
P='/workspace/yiqifengle/previews/角色建模bot/planB/'
A=load(P+'planB_cand3.glb');B=load(P+'planB_cand2.glb');aa,ab=anims(A),anims(B);ch=set()
for c in aa:
  for k in aa[c]:
    (ia,oa,_),(ib,ob,_)=aa[c][k],ab[c][k]
    if ia.shape!=ib.shape or np.abs(oa-ob).max()>0 or np.abs(ia-ib).max()>0: ch.add(k)
print('changed channels',ch)
ja,jb=A[0],B[0];ia=acc(A,ja['skins'][0]['inverseBindMatrices']);ib=acc(B,jb['skins'][0]['inverseBindMatrices'])
print('IBM rows differing',[i for i in range(29) if np.abs(ia[i]-ib[i]).max()>1e-7])
print('rest diff nodes',[ja['nodes'][i]['name'] for i in ja['skins'][0]['joints'] if ja['nodes'][i].get('translation')!=jb['nodes'][i].get('translation') or ja['nodes'][i].get('rotation')!=jb['nodes'][i].get('rotation')])
r=[n for n in ja['nodes'] if n.get('name')=='ribbon'][0];print('ribbon rest',r.get('translation'),r.get('rotation'))
par=[n['name'] for n in ja['nodes'] if ja['nodes'].index(r) in n.get('children',[])];print('parent',par)
