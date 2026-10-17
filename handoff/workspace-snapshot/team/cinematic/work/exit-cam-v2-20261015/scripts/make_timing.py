import json,math,sys
V=sys.argv[1]
for x,label in [('before','5c54f7a as is'),('A','after A: distanceRate 1.0, settle 1.2, yunjing-final pose, door 86.4'),('B','after B: A + arc flipped (camera on her right), radial 2.2, climb 2.0, settle 2.0'),('B3','after B3 (FAIL: 5 wall crossings): A + crossOutEnd side +1 (camera on her right in the doorway) + depart.turn 1, settle 1.6'),('B4','after B4: new exit path (2 m forward-right off the door), camera on her right, distanceRate 1.176 (original), settle 1.0, ramp 1.03, depart turn +1 aim 22 straightM 0.45 rayMps 1.15, crossOutEnd 0.25, X2/O x -0.5, final pose y15.5 fov59.3, door 86.4'),('B2','after B2 (BEST ATTEMPT, still clips wall 3x): A + flipped arc + 2.5 m straight exit at 1.0 m/s, radial 2.6, climb 2.4, settle 4.0')]:
  if len(sys.argv)>2 and x not in sys.argv[2:]: continue
  d=json.load(open(f'{V}/out/frames_{x}.json'));F=d['frames'];fps=30;T=F[-1]['t'];last=round(T*fps)
  at=lambda t:min(F,key=lambda f:abs(f['t']-t))
  fr=lambda t:round(t*fps)
  mv=[f for a,f in zip(F,F[1:]) if math.dist(a['root'],f['root'])>1e-6];walkEnd=mv[-1]['t']
  w1=[f['t'] for f in F if f['wind']>=0.999];wb=[f['t'] for f in F if f['wind']>=0.149]
  ev={e['kind']+(':'+e['place'] if e['place'] else ''):e['t'] for e in d['events']}
  j={"clip":f"exit_outbound_{x}","variant":label,"fps":fps,
   "frameConvention":"frames 0..lastFrame inclusive; frameCount=lastFrame+1; durationSec=lastFrame/fps; frame 0 = WorldFlow state 'crossing-out' starts (door already open 86.4 deg)",
   "cameraAuthored":True,"doorStartFrame":None,"doorEndFrame":None,"handOnDoorFrame":None,
   "rootConvention":"world game coords (Cocos, m / deg); rootStart/rootEnd = her controller root at frame 0 / lastFrame",
   "lastFrame":last,"frameCount":last+1,"durationSec":round(last/fps,4),
   "events":{"walkEndFrame":fr(walkEnd),"craneStartFrame":fr(ev.get('crane-start',0)),"settledIslandFrame":fr(ev.get('settled:island',T)),
     "windBaseFrame":fr(wb[0]) if wb else None,"windFullStartFrame":fr(w1[0]) if w1 else None,"windFullEndFrame":fr(w1[-1]) if w1 else None,
     "doorDeg":{"start":F[0]['door'],"end":F[-1]['door']},
     "cruise":("7.26 m/s on game walk-distance clock (test_camera_frames exit-cruise-real)" if x=='B4' else "~7 m/s (measured, see README)") if x!='before' else "5.92 m/s measured",
     "note":"frame numbers from flow_sim 60 fps CONSTANT walk (0.7 m/s), resampled to 30 fps; not re-timed with the real walk driver (its cruise speed matches, start offset not measured)"},
   "fovVerticalDeg":[round(at(i/fps)['fov'],3) for i in range(last+1)],
   "note":"OFFLINE flow_sim (5c54f7a code + proposed patch); NOT native. Candidate only until Funning picks.",
   "rootStart":{"position":F[0]['root'],"yawDeg":round(math.degrees(F[0]['yaw']),3)},
   "rootEnd":{"position":F[-1]['root'],"yawDeg":round(math.degrees(F[-1]['yaw']),3)}}
  json.dump(j,open(f'{V}/timing/exit_outbound_{x}.timing.json','w'),indent=1,ensure_ascii=False)
  print(x,j['durationSec'],j['events'])
