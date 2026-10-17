import json,numpy as np,sys
D=json.load(open('frames_B51.json'));F=D['frames'];t=np.round(np.array([f['t'] for f in F])*60)/60
S=F[::2];ts=t[::2];fr=lambda x:int(round(x*30))
R=np.array([f['root'] for f in F]);mv=np.linalg.norm(np.diff(R,axis=0),axis=1);walkEnd=t[np.where(mv>1e-5)[0][-1]+1]
w=np.array([f['wind'] for f in F]);wb=t[np.argmax(w>0.01)];full=np.where(w>=0.999)[0]
sp=np.linalg.norm(np.gradient(np.array([f['pos'] for f in F]),t,axis=0),axis=1);pk=t[np.argmax(sp)]
ev={e['kind']:e['t'] for e in D['events']}
out={"clip":"exit_outbound_B5.1","variant":"B5.1 b12ff1f on cine/exit-cam-B5: single shared smootherstep ease, end pose (-2.3,7,11)->(-2,0.8,4.6) fov 48, settle 4.2","fps":30,
 "frameConvention":"frames 0..lastFrame inclusive; frameCount=lastFrame+1; durationSec=lastFrame/fps; frame 0 = WorldFlow state 'crossing-out' starts (door already open 86.4 deg)",
 "cameraAuthored":True,"lastFrame":len(S)-1,"frameCount":len(S),"durationSec":round(float(ts[-1]),4),
 "events":{"doorKeyFrame":fr(2.5409),"walkEndFrame":fr(walkEnd),"craneStartFrame":fr(ev['crane-start']),"peakSpeedFrame":fr(pk),"windBaseFrame":fr(wb),"windFullStartFrame":fr(t[full[0]]),"windFullEndFrame":fr(t[full[-1]]),"settledIslandFrame":fr(ev['settled']),
  "sailboatStartFrame":fr(ev['settled']),"doorDeg":{"start":86.4,"end":86.4},
  "note":"flow_sim 60 fps CONSTANT walk (0.7 m/s) resampled to 30 fps. Sailboat starts from settled pose = yunjing-final."},
 "endPose":{"position":[-2.3,7.0,11.0],"target":[-2.0,0.8,4.6],"fovVerticalDeg":48},
 "fovVerticalDeg":[round(f['fov'],3) for f in S],"position":[[round(x,4) for x in f['pos']] for f in S],"wind":[round(f['wind'],4) for f in S]}
json.dump(out,open(sys.argv[1],'w'),indent=1);print(out['events'],out['lastFrame'])
