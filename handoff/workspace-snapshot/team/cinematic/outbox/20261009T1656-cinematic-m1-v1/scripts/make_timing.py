"""Write <clip>.timing.json + reference root curve from probe/anim_build_log.json (+ check json for seat-off)."""
import json, sys, math
W='/workspace/wechat-game/team/cinematic/work/m1/'
outdir=sys.argv[1]; chk=json.load(open(sys.argv[2])) if len(sys.argv)>2 else None
L=json.load(open(W+'probe/anim_build_log.json')); FPS=30
def g(b): return [round(b[0],5),0.0,round(-b[1],5)]   # blender (x,y,z) root on floor -> game (x,0,-y)
def contacts(seq):
    ev=[]; prev=None
    for f,c in enumerate(seq):
        for s in 'LR':
            if prev is not None and prev[s]!=c[s]: ev.append({'frame':f if c[s] else f-1,'side':s,'type':'contact' if c[s] else 'lift'})
        prev=c
    return ev
common=dict(fps=FPS,frameConvention='frames 0..lastFrame inclusive are sampled; frameCount = lastFrame+1; durationSec = lastFrame/fps (sfx length = durationSec)',
            cameraAuthored=False, doorStartFrame=None, doorEndFrame=None, handOnDoorFrame=None)
# stand
st=L['stand_phase']; n=len(st)-1
seat_off=None
if chk:
    fr=chk['clips']['cine_open_stand']
    for x in fr:
        p=x['pairs']; touch=sum(p[k].get('tri_pairs',0) for k in p if k.startswith('chair:') and k.split(':')[1].startswith(('body','dress','apron')))
        if touch: seat_off=x['frame']+1
first_motion=min(i for i,x in enumerate(st) if not (x['contact']['L'] and x['contact']['R']) or x['lean']>0 or x['yprog']>0)
last_motion=max(i for i in range(1,len(st)) if L['stand_root_frames'][i]!=L['stand_root_frames'][i-1] or st[i]['skirt']!=st[i-1]['skirt'] or st[i]['lean']!=st[i-1]['lean'] or st[i]['arms']!=st[i-1]['arms'] or st[i]['contact']!=st[i-1]['contact'])
T={'clip':'cine_open_stand',**common,'lastFrame':n,'frameCount':n+1,'durationSec':round(n/FPS,4),
   'events':{'standUpStartFrame':first_motion,'seatOffFrame':seat_off,'standUpEndFrame':last_motion+1 if last_motion<n else n,'restHoldFrames':[last_motion+1,n],
             'footEvents':contacts([x['contact'] for x in st]),'sitCorrectiveWeightZeroFrame':next(i for i,x in enumerate(st) if x['skirt']>=1.0)},
   'fovVerticalDeg':[45.0]*(n+1),
   'note':'seatOffFrame = first frame with no body/dress/apron triangle contact with the real chair mesh (from the per-frame check). fovVerticalDeg is a placeholder (camera not authored in M1); last frame = 45.'}
json.dump(T,open(outdir+'/cine_open_stand.timing.json','w'),indent=1)
# turn
tu=L['turn']; n2=len(tu)-1
yaws=[x['yaw'] for x in tu]
T2={'clip':'cine_open_turn',**common,'lastFrame':n2,'frameCount':n2+1,'durationSec':round(n2/FPS,4),
    'events':{'turnStartFrame':next(i for i in range(1,len(yaws)) if abs(yaws[i]-yaws[0])>1e-6)-1,'turnEndFrame':next(i for i in range(len(yaws)) if abs(yaws[i]-yaws[-1])<1e-6),
              'footEvents':contacts([x['contact'] for x in tu]),'direction':'left (yaw increasing)','turnDeg':round(math.degrees(yaws[-1]-yaws[0]),3)},
    'fovVerticalDeg':[45.0]*(n2+1),'note':'fovVerticalDeg placeholder (camera not authored in M1); last frame = 45.'}
json.dump(T2,open(outdir+'/cine_open_turn.timing.json','w'),indent=1)
# reference root curve (game coords) for Oi / fallback waypoint flow
R={'units':'m','space':'game world (+Y up, +Z outdoor)','fps':FPS,'note':'root bone world translation/yaw as baked (root motion on root bone per 0006 v1.1). yaw = game yaw rad (== Blender Z rot).',
   'cine_open_stand':[{'frame':i,'position':g(p),'yawRad':-2.0} for i,p in enumerate(L['stand_root_frames'])],
   'cine_open_turn':[{'frame':i,'position':g(L['stand_root']),'yawRad':round(y,6)} for i,y in enumerate(yaws)]}
json.dump(R,open(outdir+'/cine_m1_reference_root_curve.json','w'),indent=1)
print(json.dumps({'stand':T['events'],'turn':T2['events']},indent=0)[:2000])
