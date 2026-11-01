from mix import *
import os
A.update(lakebgm=('out/bgm_lakeside.mp3','bgm'),fall=('out/amb_sky_waterfall_loop.mp3',16.0),ring=('out/amb_sky_starring_loop.mp3',16.0))
res=[]
def dist_gain(T,path,near,far):
    tt=np.arange(int(T*SR))/SR;d=np.interp(tt,[p[0] for p in path],[p[1] for p in path])
    g=np.where(d<=near,1.0,near/np.maximum(d,1e-3));g=g*np.clip((far-d)/(far*0.25),0,1);return g[:,None]
# 07 sky city -> balloon descent -> lakeside (dip handover D minor -> F major, ambience bridges the gap)
T=45.0;sky,_=loopify('bgm_sky',T,offset=20);lb,_=loopify('lakebgm',T);air,_=loopify('sky',T);lk,_=loopify('lake',T)
a,b=18.0,20.0   # sky out 18-22, lakeside in 20-24 (2 s overlap)
m=BGM*(sky*ep(T,a,a+4,False)+np.roll(lb,int(b*SR),0)*ep(T,b,b+4))
airg=env(T,[(0,0.75),(8,0.75),(12,0.5),(24,0.5),(34,0.0),(T,0.0)])
lkg=env(T,[(0,0),(20,0),(32,0.55),(T,0.55)])
m+=air*airg+lk*lkg
for t0,f in [(3,'out/sfx_sky_chime_1.mp3'),(14,'out/sfx_sky_chime_2.mp3')]: shot(m,f,t0,0.4*(1 if t0<8 else 0.5),-0.3)
res.append(finish('07_transition_skycity_balloon_lakeside_45s',m,dict(transition='sky city -> balloon descent -> lakeside (plan B)',notes='0-8 s sky city (bgm_skycity + high wind 0.75, a glass chime); 8 s balloon lifts off: wind 0.75->0.5 over 4 s, a fainter chime behind; dip handover: bgm_skycity out 18-22 s, bgm_lakeside in from bar 1 at 20-24 s (2 s overlap; D minor and F major are relative keys, same key signature, so the short overlap stays consonant); ambience bridge: high wind holds 0.5 through the dip then fades out 24-34 s, lake bed fades in 20-32 s to 0.55; landing 34-45 s')))
# 12a / 12b lakeside without / with water birds (40 s)
T=40.0;lb,_=loopify('lakebgm',T,offset=8);lk,_=loopify('lake',T);base=BGM*lb+0.55*lk
res.append(finish('12a_lakeside_no_waterbirds',base.copy(),dict(scene='lakeside, pending layer comparison A',notes='bgm_lakeside + shipped lake bed 0.55; nothing else')))
m=base.copy();W='out/sfx_lake_waterbird_'
for t0,k,v,p in [(4,1,0.32,-0.55),(13,3,0.5,0.35),(24,2,0.3,0.6),(31,4,0.45,-0.25)]: shot(m,f'{W}{k}.mp3',t0,v,p)
res.append(finish('12b_lakeside_with_waterbirds',m,dict(scene='lakeside, pending layer comparison B',notes='same as 12a + water-bird scatter: distant tundra swans (vol 0.30-0.32, far left/right) and a mid-distance coot group (0.45-0.5), one every ~9-11 s here (the table would use 14-30 s); all public-domain US NPS / USFWS recordings')))
# 13a / 13b sky city without / with gardener + star ring (40 s)
T=40.0;sk,_=loopify('bgm_sky',T,offset=5);air,_=loopify('sky',T);base=BGM*sk+0.75*air
for t0,f in [(9,'out/sfx_sky_chime_1.mp3'),(27,'out/sfx_sky_chime_2.mp3')]: shot(base,f,t0,0.3,-0.3)
res.append(finish('13a_sky_no_gardener_starring',base.copy(),dict(scene='sky city, pending layer comparison A',notes='bgm_skycity + high wind 0.75 + two distant glass chimes')))
m=base.copy();rg,_=loopify('ring',T);m+=0.45*rg*dist_gain(T,[(0,22),(14,3),(24,3),(40,20)],3,25)
for t0,f,v,p in [(6,'out/sfx_sky_gardener_water_1.mp3',0.5,0.4),(11,'out/sfx_sky_gardener_boop_1.mp3',0.45,0.35),(30,'out/sfx_sky_gardener_water_2.mp3',0.5,0.45)]: shot(m,f,t0,v,p)
res.append(finish('13b_sky_with_gardener_starring',m,dict(scene='sky city, pending layer comparison B',notes='same as 13a + star-ring landmark loop (walk from 22 m to 3 m and away again) + robot gardener watering (2 sprinkles) and one soft hum-boop; all own synthesis')))
json.dump(res,open('/tmp/p3.json','w'),ensure_ascii=False,indent=1,default=float)
