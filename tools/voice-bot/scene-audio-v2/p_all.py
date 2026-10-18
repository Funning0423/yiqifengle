from mix import *
import random
V=dict(shore=0.7,sea=0.8,mbirds=0.8,insects=0.5,wind_soft=0.25,sky=0.75,lake=0.55,gull_near=0.6,gull_far=0.38,bird=0.5,creak=0.45)
O='out/'
BIRDS=[O+f'sfx_meadow_bird_{i}.mp3' for i in (1,2,3)];CREAK=[O+'sfx_windmill_creak_1.mp3',O+'sfx_windmill_creak_2.mp3']
T=45.0;res=[]
def gulls(m,ts):
    for at,k,far,p in ts: shot(m,G[k],at,V['gull_far'] if far else V['gull_near'],p)
def meadow_layers(T,off=0.0,t0=0.0):
    rnd=random.Random(7);m=np.zeros((int(T*SR),2))
    b,bs=loopify('mbirds',T,off);i,is_=loopify('insects',T,off);w,_=loopify('wind_soft',T,off)
    m+=b*V['mbirds']+i*V['insects']+w*V['wind_soft'];ev=[]
    t=t0+rnd.uniform(2,5)
    while t<T-3: k=rnd.randrange(3);shot(m,BIRDS[k],t,V['bird']*rnd.uniform(0.7,1.0),rnd.uniform(-.6,.6));ev.append(('bird',round(t,1)));t+=rnd.uniform(6,16)
    t=t0+rnd.uniform(5,9)
    while t<T-4: k=rnd.randrange(2);shot(m,CREAK[k],t,V['creak']*rnd.uniform(0.8,1.0),0.35);ev.append(('creak',round(t,1)));t+=rnd.uniform(9,18)
    return m,dict(birds_bed_seams=bs,insect_seams=is_,events=ev)
# 01 island
b,bs=loopify('bgm_island',T,62.0);w,ws=loopify('shore',T);m=b*BGM+w*V['shore']
gulls(m,[(4.0,2,1,-0.35),(15.5,1,0,0.3),(18.0,3,1,-0.2),(31.0,2,1,0.4),(40.5,3,0,-0.3)])
res.append(finish('01_island_45s',m,dict(scene='island',bgm_seams_s=bs,shore_seams_s=ws)))
# 02 sea / sailing (island -> sea -> meadow BGM handover at 22 s)
b1,_=loopify('bgm_island',T,10.0);b2,_=loopify('bgm_meadow',T,0.0);s,ss=loopify('sea',T);w,_=loopify('shore',T,5.0)
m=(b1*ep(T,20,24,False)*10**(-3/20)+b2*ep(T,22,26,True))*BGM + s*V['sea']*ep(T,0,6,True) + w*V['shore']*ep(T,0,8,False)
gulls(m,[(2.0,2,1,-0.4),(7.5,3,1,0.45)])
res.append(finish('02_sea_sailing_45s',m,dict(scene='sea/sailing',notes='shore fades 0-8s, sea bed in 0-6s, gulls far only first 10s, island BGM -3dB then 6 s dip handover to meadow BGM (island out 20-24 s, meadow in 22-26 s; F major vs G major so only 2 s overlap, under the sea bed)',sea_seams_s=ss)))
# 03 meadow
b,bs=loopify('bgm_meadow',T,50.0);L,info=meadow_layers(T);m=b*BGM+L
res.append(finish('03_meadow_45s',m,dict(scene='meadow',bgm_seams_s=bs,**info)))
# 04 lakeside (island BGM -3 dB + shipped lake loop)
b,bs=loopify('bgm_island',T,62.0);l,ls=loopify('lake',T);m=b*BGM*10**(-3/20)+l*V['lake']
res.append(finish('04_lakeside_45s',m,dict(scene='lakeside',bgm_seams_s=bs,lake_seams_s=ls)))
# 05 sky city
b,bs=loopify('bgm_sky',T,50.0);a,as_=loopify('sky',T);m=b*BGM+a*V['sky']
res.append(finish('05_skycity_45s',m,dict(scene='skycity',bgm_seams_s=bs,air_seams_s=as_)))
# 06 transition meadow -> balloon -> sky city
L,_=meadow_layers(T);b1,_=loopify('bgm_meadow',T,20.0);b2,_=loopify('bgm_sky',T,0.0);a,_=loopify('sky',T)
m=(b1*ep(T,18,22,False)+b2*ep(T,20,24,True))*BGM + L*ep(T,6,16,False) + a*ep(T,8,20,True)*np.interp(np.arange(int(T*SR))/SR,[0,30,36,45],[0.5,0.5,V['sky'],V['sky']])[:,None]
res.append(finish('06_transition_meadow_balloon_sky_45s',m,dict(transition='meadow->balloon->skycity',notes='take-off 6s: meadow layers fade 6-16s; sky air in 8-20s at 0.5 (balloon), up to 0.75 on landing 30-36s; BGM 6 s dip handover (meadow out 18-22 s, sky in 20-24 s; G major vs D minor)')))
# 07 (sky city -> balloon descent -> lakeside, plan B) and 12a/12b, 13a/13b are rendered by p3.py
json.dump(res,open(OUT+'/previews.json','w'),indent=1,ensure_ascii=False)
