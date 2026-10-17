"""v2: <clip>.timing.json (+ rootStart/rootEnd per 0006 v1.2 A2) and reference root curve.
usage: python3 make_timing.py <outdir> <check.json> <glb.root_poses.json>"""
import json, sys, math
W='/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/'
outdir,chkf,rpf=sys.argv[1:4]; chk=json.load(open(chkf)); RP=json.load(open(rpf))
L=json.load(open(W+'probe/anim_build_log.json')); FPS=30
def g(b): return [round(b[0],5),round(b[2] if len(b)>2 else 0.0,5),round(-b[1],5)]
def contacts(seq):
    ev=[]; prev=None
    for f,c in enumerate(seq):
        for s in 'LR':
            if prev is not None and prev[s]!=c[s]: ev.append({'frame':f if c[s] else f-1,'bone':'foot.'+s,'anatomical':'right' if s=='L' else 'left','type':'contact' if c[s] else 'lift'})
        prev=c
    return ev
common=dict(fps=FPS,frameConvention='frames 0..lastFrame inclusive; frameCount=lastFrame+1; durationSec=lastFrame/fps',cameraAuthored=False,doorStartFrame=None,doorEndFrame=None,handOnDoorFrame=None,
            rootConvention='0006 v1.2 A2: root track in controller-local space, first frame XZ=0 & yaw=0; rootStart = controller world pose at clip start, rootEnd = controller world pose at the last frame (root XZ + yaw, y = floor 0; the seated hip drop stays in the root track, see rootEndRootBoneHeight_m) (game coords, m / deg)')
def wr(name,obj):
    obj.update(RP[name]); obj.pop('frames',None); json.dump(obj,open(f'{outdir}/{name}.timing.json','w'),indent=1)
st=L['stand_phase']; n=len(st)-1
touch=[x['frame'] for x in chk['clips']['cine_open_stand'] if sum(v.get('tri_pairs',0) for k,v in x['pairs'].items() if k.startswith('chair:') and k.split(':')[1].split('x')[0] in ('body','dress','apron'))]
seat_off=(max(touch)+1) if touch else 0
hold=[x['hold'] for x in st]
wr('cine_open_stand',{'clip':'cine_open_stand',**common,'lastFrame':n,'frameCount':n+1,'durationSec':round(n/FPS,4),
   'events':{'standUpStartFrame':min(e['frame'] for e in contacts([x['contact'] for x in st])),'footEvents':contacts([x['contact'] for x in st]),
             'handsSlideToKneesFrames':[15,40],'handsLiftOffFrame':next(i for i,h in enumerate(hold) if h<1.0)-1,'handsReleasedFrame':next(i for i,h in enumerate(hold) if h<=0.0),
             'seatOffFrame':seat_off,'sitCorrectiveWeightZeroFrame':next(i for i,x in enumerate(st) if x['skirt']>=1.0),'hipsFullHeightFrame':next(i for i,x in enumerate(st) if x['zprog']>=1.0),
             'standUpEndFrame':n,'continuesInto':'cine_open_turn (no rest hold; arms finish their swing in turn f0-10, velocities continuous)'},
   'fovVerticalDeg':[45.0]*(n+1),'note':'fovVerticalDeg placeholder (camera not authored in M1).'})
tu=L['turn']; n2=len(tu)-1; yaws=[x['yaw'] for x in tu]
wr('cine_open_turn',{'clip':'cine_open_turn',**common,'lastFrame':n2,'frameCount':n2+1,'durationSec':round(n2/FPS,4),
   'events':{'turnStartFrame':0,'turnEndFrame':next(i for i in range(len(yaws)) if abs(yaws[i]-yaws[-1])<1e-6),'footEvents':contacts([x['contact'] for x in tu]),
             'direction':'anatomical LEFT (counter-clockwise from above, yaw increasing)','turnDeg':round(math.degrees(yaws[-1]-yaws[0]),3),
             'note':'last foot contact f43; audio may overrun the clip (team 16:59)'},
   'fovVerticalDeg':[45.0]*(n2+1),'note':'fovVerticalDeg placeholder (camera not authored in M1).'})
for nm,use in (('cine_open_safe_end','skip target of the opening (M1 provisional: standingRoot + walkYaw; moves to the opening end at exit_path_17 in M3)'),('cine_home_safe_end','skip target of the return home (seated pose on the derived seated root)')):
    wr(nm,{'clip':nm,**common,'lastFrame':0,'frameCount':1,'durationSec':0.0,'events':{},'fovVerticalDeg':[45.0],'use':use})
R={'units':'m','space':'game world (+Y up, +Z outdoor)','fps':FPS,'note':'WORLD root trajectory as authored (export converts to controller-local per 0006 v1.2).',
   'cine_open_stand':[{'frame':i,'position':[round(p[0],5),0.0,round(-p[1],5)],'yawRad':-2.0} for i,p in enumerate(L['stand_root_frames'])],
   'cine_open_turn':[{'frame':i,'position':[round(L['stand_root'][0],5),0.0,round(-L['stand_root'][1],5)],'yawRad':round(y,6)} for i,y in enumerate(yaws)]}
json.dump(R,open(outdir+'/cine_m1_reference_root_curve.json','w'),indent=1)
print('timing ok')
