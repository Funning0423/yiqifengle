# Rebuild the PR #56 (d317b2f) sailboat camera per frame, mirroring SailboatTransitionDriver.syncCamera + SailboatTransitionModel.presentation.
import json,math,sys
TJ=sys.argv[1]; out=sys.argv[2]
T=json.load(open(TJ)); ev=T['events']; sh={s['id'][:2]:s for s in ev['shots']}
start={'position':[-15.5,9.0,14.0],'target':[-2.0,2.5,1.0],'fov':60.0}  # B5.3
end=ev['cameraEndPose']; swap=ev['sceneSwapFrame']; last=sh['S5']['endFrame']
ROOT=[-2.1135,0,5.2814]  # REGION_CAMERA.islandCharacter.root = exit outbound final root (track_cur.json)
def prog(s,f):
    sp=s['endFrame']-s['startFrame']; u=(f-s['startFrame'])/sp if sp>0 else 1; return min(1,max(0,u))
frames=[]
for f in range(0,last+1):
    S2=sh['S2']; dep=1 if f>=S2['endFrame'] else (prog(S2,f) if f>=S2['startFrame'] else 0)
    fov=start['fov'] if f<S2['startFrame'] else (start['fov']+(end['fovVerticalDeg']-start['fov'])*prog(S2,f) if f<S2['endFrame'] else end['fovVerticalDeg'])
    scene='island' if f<swap else 'meadow'
    if scene!='island': frames.append({'frame':f,'t':f/30,'scene':scene}); continue
    P,Tg=start['position'],start['target']; d=[P[i]-Tg[i] for i in range(3)]; L=math.hypot(*d); k=dep*8/L
    pos=[P[i]+d[i]*k for i in range(3)]
    frames.append({'frame':f,'t':f/30,'scene':scene,'phase':'outbound','departure':dep,'position':pos,'target':Tg,'fovVerticalDeg':fov,'root':ROOT,'actorVisible':dep==0})
json.dump({'source':'d317b2f SailboatTransitionDriver/Model + resources/cine/transition_island_to_meadow.timing.json','frames':frames},open(out,'w'),indent=0)
