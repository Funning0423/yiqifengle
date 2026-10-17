import sys,json,os,shutil;sys.path.insert(0,'.')
from calib import *;import night as NT
from PIL import Image,ImageDraw
OUT=sys.argv[1];REFD=sys.argv[2];os.makedirs(OUT+'/renders',exist_ok=True);os.makedirs(REFD,exist_ok=True)
B8=json.load(open('boxes_844.json'));B6=dict(B);B6.update(BX);B6['STRIPE']=STRIPE
def sm(a,b):x0,y0,x1,y1=b;return np.median(a[y0:y1,x0:x1].reshape(-1,3),0)
def st(a,b):x0,y0,x1,y1=b;return float(a[y0:y1,x0:x1].mean(1).std(0).mean())
REF={k:np.load(f'ref/r{k}_graded_tmed.npy') for k in ('640','844')};PRE={k:np.load(f'ref/r{k}_pre_tmed.npy') for k in ('640','844')}
pts=list(B)+list(BX)
TG={'844':{n:sm(REF['844'],B8[n]).round().astype(int).tolist() for n in pts},'640':{n:sm(REF['640'],B6[n]).round().astype(int).tolist() for n in pts}}
TP={'844':{n:sm(PRE['844'],B8[n]).round().astype(int).tolist() for n in pts},'640':{n:sm(PRE['640'],B6[n]).round().astype(int).tolist() for n in pts}}
STR={'844':[st(REF['844'],B8['STRIPE']),st(PRE['844'],B8['STRIPE'])],'640':[st(REF['640'],STRIPE),st(PRE['640'],STRIPE)]}
# r4 stand-in (code values) day + night, both poses, median of 4 wave phases
x=json.load(open('final_day.json'))['x'];NW=json.load(open('nw1.json'));V=NT.build(x,NW)
S4={(md,k):NT.render(V,md,None,'360x640' if k=='640' else '390x844') for md in ('day','night') for k in ('640','844')}
# calibration: r3 stand-in (f3d3614 values + Cocos linear:true squaring + vc double decode) vs the Mac r3 shots at the fitted wave phase
T=json.load(open('calib_t.json'));CAL={}
for md in ('day','night'):
  res,sm_,se,em=per_mode(md,T[md][1]);CAL[md]=dict(t=T[md][1],pts={n:[np.round(a).astype(int).tolist(),np.round(b).astype(int).tolist()] for n,(a,b) in res.items()},stripe=[round(sm_,2),round(se,2)])
  Image.fromarray(em.astype(np.uint8)).save(f'{OUT}/renders/calib_r3_standin_{md}_360x640.png')
for (md,k),im in S4.items(): Image.fromarray(np.clip(im,0,255).astype(np.uint8)).save(f'{OUT}/renders/standin_r4_{md}_{"360x640" if k=="640" else "390x844"}.png')
for k in ('640','844'):
  for kind in ('graded','pre'):shutil.copy(f'ref/r{k}_{kind}_tmed.png',f'{REFD}/ref_{"360x640" if k=="640" else "390x844"}_{kind}.png')
# table
L=['# Sample table: new targets | Mac r3 | stand-in r4','','Targets = graded engine-camera r5h3 reference (pre-grade in REFERENCE.md). Mac r3 exists only at 360x640 (bg-only shots); the 390x844 points are the same world points re-projected (boxes_390x844.json). Bar: every point within ±12 per channel, mid stripe std ≤ 10. Night has no r5h3 reference: judged by hue (lake B ≥ G > R, dark blue-teal), Mac r3 shown for the before.','']
summ={}
for md in ('day','night'):
  for k in ('844','640'):
    L+=[f'## {md} - {"390x844 (primary pose)" if k=="844" else "360x640 (Mac calibration frame)"}','','| point | target | Mac r3 | stand-in r4 | r4 - target | pass |','|---|---|---|---|---|---|']
    mac=MAC[md] if k=='640' else None;mx=0
    for n in B:
      b=B8[n] if k=='844' else B6[n];r4=sm(S4[(md,k)],b).round().astype(int);tg=np.array(TG[k][n]);mc='%d/%d/%d'%tuple(sm(mac,b).round()) if mac is not None else '-'
      if md=='day':e=r4-tg;ok=abs(e).max()<=12;mx=max(mx,abs(e).max());L.append(f'| {n} | {"/".join(map(str,tg))} | {mc} | {"/".join(map(str,r4))} | {"/".join("%+d"%v for v in e)} | {"yes" if ok else "NO"} |')
      else:
        hue=n.startswith('bridge') or (r4[2]>=r4[1]-2 and r4[1]>r4[0]);L.append(f'| {n} | (no ref) | {mc} | {"/".join(map(str,r4))} | - | {"hue ok" if hue else "WARM"} |')
    s4=st(S4[(md,k)],B8['STRIPE'] if k=='844' else STRIPE);sm_=st(mac,STRIPE) if mac is not None else None
    L+=[f'| STRIPE std | {STR[k][0]:.1f} | {"%.1f"%sm_ if sm_ is not None else "-"} | {s4:.1f} | | {"yes" if s4<=10 else "NO"} |','']
    summ[(md,k)]=(mx,s4)
  L+=['Land (regression only, not in the bar), '+md+' 360x640: target | Mac r3 | r4','']
  for n in BX:L.append(f'- {n}: {"/".join(map(str,TG["640"][n])) if md=="day" else "-"} | {"/".join(map(str,sm(MAC[md],B6[n]).round().astype(int)))} | {"/".join(map(str,sm(S4[(md,"640")],B6[n]).round().astype(int)))}')
  L.append('')
L+=['## Stand-in calibration (r3 stand-in vs Mac r3, 360x640)','','| mode | point | Mac r3 | r3 stand-in | max abs diff |','|---|---|---|---|---|']
for md in ('day','night'):
  for n,(a,b) in CAL[md]['pts'].items():L.append(f'| {md} (t={CAL[md]["t"]}) | {n} | {"/".join(map(str,a))} | {"/".join(map(str,b))} | {max(abs(np.array(a)-np.array(b)))} |')
  L.append(f'| {md} | STRIPE std | {CAL[md]["stripe"][0]} | {CAL[md]["stripe"][1]} | |')
open(f'{OUT}/SAMPLE_TABLE.md','w').write('\n'.join(L)+'\n')
json.dump(dict(targets_graded=TG,targets_pregrade=TP,stripe_graded_pre=STR,boxes_390x844=B8,boxes_360x640=B6,calibration=CAL,summary={f'{a}_{b}':v for (a,b),v in summ.items()}),open(f'{OUT}/samples.json','w'),indent=1,default=float)
json.dump(dict(boxes_390x844=B8,boxes_360x640=B6,targets_graded=TG,targets_pregrade=TP,stripe=STR),open(f'{REFD}/targets.json','w'),indent=1)
# images
def ann(a,boxes,path,lab=True):
  im=Image.fromarray(np.clip(a,0,255).astype(np.uint8));d=ImageDraw.Draw(im)
  for n,b in boxes.items():
    c=(255,0,0) if n in B else ((255,255,0) if n=='STRIPE' else (0,255,255));d.rectangle(b,outline=c,width=2)
    if lab:d.text((b[0],max(0,b[1]-11)),n,fill=c)
  im.save(path);return im
B8a={n:B8[n] for n in list(B)+list(BX)+['STRIPE']}
ann(REF['844'],B8a,f'{REFD}/ref_390x844_graded_boxes.png');ann(REF['640'],B6,f'{REFD}/ref_360x640_graded_boxes.png');ann(MAC['day'],B6,f'{REFD}/mac_r3_day_360x640_boxes.png');ann(MAC['night'],B6,f'{REFD}/mac_r3_night_360x640_boxes.png')
def sbs(ims,labels,path):
  h=max(i.shape[0] for i in ims);W=sum(i.shape[1] for i in ims);c=Image.new('RGB',(W,h+30),(0,0,0));x=0;d=ImageDraw.Draw(c)
  for i,l in zip(ims,labels):c.paste(Image.fromarray(np.clip(i,0,255).astype(np.uint8)),(x,30));d.text((x+8,8),l,fill=(255,255,255));x+=i.shape[1]
  c.save(path)
sbs([REF['844'],S4[('day','844')]],['engine-cam r5h3 reference (graded) 390x844','r4 stand-in day 390x844'],f'{OUT}/side_by_side_ref_vs_r4_day_390x844.png')
sbs([REF['640'],S4[('day','640')],MAC['day']],['reference 360x640','r4 stand-in day','Mac r3 day (before)'],f'{OUT}/side_by_side_ref_vs_r4_day_360x640.png')
sbs([S4[('night','640')],MAC['night']],['r4 stand-in night 360x640','Mac r3 night (before)'],f'{OUT}/side_by_side_night_r4_vs_mac_r3_360x640.png')
print({f'{a}_{b}':v for (a,b),v in summ.items()})
