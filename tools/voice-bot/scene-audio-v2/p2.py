from mix import *
import random
A.update(sail=('out/bgm_sail.mp3','bgm'),lakebgm=('out/bgm_lakeside.mp3','bgm'),
 river=('out/amb_meadow_river_loop.mp3',16.0),fall=('out/amb_sky_waterfall_loop.mp3',16.0),dock=('out/amb_island_dock_lap_loop.mp3',12.0))
res=[]
def dist_gain(T,path,near,far):  # path [(t,metres)]
    tt=np.arange(int(T*SR))/SR;d=np.interp(tt,[p[0] for p in path],[p[1] for p in path])
    g=np.where(d<=near,1.0,near/np.maximum(d,1e-3));g=g*np.clip((far-d)/(far*0.25),0,1);return g[:,None]
# 08 motif demo
x=load('wav/motif_demo.wav');T=len(x)/SR
res.append(finish('08_motif_demo_island_to_meadow',x*BGM,dict(scene='motif demo (preview only, not shipped)',notes='shared motif 「风起」: island arrangement (F major 92 BPM, ukulele + harmonica-like reed) then meadow arrangement (G major 76 BPM, guitar + flute + strings); 2.5 s crossfade at 18.3 s',durS=round(T,1))))
# 09 island -> sail -> meadow
T=16+35.56+16;isl,_=loopify('bgm_island',T,offset=40);sail,ss=loopify('sail',T);mea,_=loopify('bgm_meadow',T);sea,_=loopify('sea',T);sh,_=loopify('shore',T)
t1=14.0;t2=t1+35.56-2
m=BGM*(isl*ep(T,t1,t1+2,False)+np.roll(sail,int(t1*SR),0)*ep(T,t1,t1+2)*ep(T,t2,t2+2,False)+np.roll(mea,int(t2*SR),0)*ep(T,t2,t2+2))
m+=0.7*sh*ep(T,t1,t1+8,False)+0.8*sea*ep(T,t1,t1+6)*ep(T,t2,t2+4,False)
mb,_=loopify('mbirds',T);m+=0.8*mb*ep(T,t2-6,t2)
for i,a in enumerate([3,9,t1+2,t1+7]): shot(m,G[[1,2,2,3][i]],a,0.6 if a<t1 else 0.38,[-.4,.3,-.3,.4][i])
res.append(finish('09_bgm_sail_island_to_meadow',m,dict(scene='sail BGM candidate',notes=f'island bgm_main + shore (0-{t1}s) -> 2 s equal-power crossfade -> bgm_sail (C major 6/8) over the sea bed -> 2 s crossfade at {t2:.1f}s -> bgm_meadow + meadow birds; BGM x0.4 like the default slider',sailLoopS=35.5556)))
# 10 lakeside: full loop + 12 s past the seam
T=66.67+12;lb,ss=loopify('lakebgm',T);lk,_=loopify('lake',T)
res.append(finish('10_bgm_lakeside_with_lake_bed',BGM*lb+0.55*lk,dict(scene='lakeside BGM candidate',notes='bgm_lakeside (F major, piano + harp, motif variation) with the shipped amb_lake_loop at 0.55; plays past the loop seam',bgm_seams_s=ss)))
# 11 landmarks + footsteps sampler
T=70;m=np.zeros((int(T*SR),2))
mb,_=loopify('mbirds',T);ins,_=loopify('insects',T);rv,_=loopify('river',T);sk,_=loopify('sky',T);fl,_=loopify('fall',T);dk,_=loopify('dock',T);ws,_=loopify('wind_soft',T)
s1=ep(T,0,1)*ep(T,28,31,False)
m+=(0.8*mb+0.5*ins+0.25*ws)*s1
m+=0.55*rv*dist_gain(T,[(0,25),(12,3),(18,3),(28,25)],3,25)*s1
for a,f,v in [(6,'out/sfx_meadow_windbell_1.mp3',.45),(19,'out/sfx_meadow_windbell_2.mp3',.45),(9,'out/sfx_windmill_creak_1.mp3',.3),(15,'out/sfx_meadow_bird_2.mp3',.5)]: shot(m,f,a,v,0.3)
s2=ep(T,29,31)*ep(T,52,54,False)
m+=0.75*sk*s2+0.55*fl*dist_gain(T,[(29,35),(40,4),(46,4),(54,35)],4,35)*s2
for a,f in [(34,'out/sfx_sky_chime_1.mp3'),(45,'out/sfx_sky_chime_2.mp3')]: shot(m,f,a,0.4,-0.3)
s3=ep(T,52,54)*ep(T,68,70,False);m+=0.7*loopify('shore',T)[0]*0.5*s3+0.5*dk*dist_gain(T,[(52,12),(60,2),(70,2)],2,12)*s3
SD='/workspace/vbr5/wt-v2scene/creator-build-project/assets/bundles/region_island/audio_steps/'
t=55.0;random.seed(3)
for sfc,dirp,g,n in [('grass',SD,0.36,6),('sand','out/',0.34,6)]:
    for k in range(n): shot(m,f'{dirp}step_{sfc}_{k%4+1}.mp3',t,g*random.uniform(.85,1),[-.1,.1][k%2]);t+=0.48
    t+=0.6
t=42.0
for k in range(6): shot(m,f'out/step_cloud_{k%4+1}.mp3',t,0.34,[-.1,.1][k%2]);t+=0.5
res.append(finish('11_landmarks_and_footsteps',m,dict(scene='landmarks + footsteps sampler',notes='0-30 s meadow: three-layer bed, walking toward the river (25 m -> 3 m -> away), wind bells, windmill creak, a far bird. 30-53 s sky city: high wind, approaching the waterfall mist, glass chimes, cloud footsteps at 42 s. 53-70 s island: shore bed at half, walking onto the dock (lapping), grass steps then sand steps at 55 s')))
json.dump(res,open('/tmp/p2.json','w'),ensure_ascii=False,indent=1,default=float)
