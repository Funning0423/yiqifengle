import json,math,sys
O=sys.argv[1];d=json.load(open(O+'/out/camera_track_5c54f7a.json'))
F=[f for f in d['frames'] if f['phase']=='outbound']
print('events',d['events']);print('island idle',d['islandIdlePose'])
rows=[]
for a,b in zip(F,F[1:]):
  dt=b['t']-a['t'];v=math.dist(a['position'],b['position'])/dt;w=math.dist(a['root'],b['root'])/dt
  rows.append((b['t'],v,w,b['position'],b['fovVerticalDeg'],b['state']))
for r in rows[::12]:print('%.2f cam %.2f m/s walk %.2f pos %s fov %.1f %s'%(r[0],r[1],r[2],[round(x,2) for x in r[3]],r[4],r[5]))
vmax=max(rows,key=lambda r:r[1]);print('max',vmax[:3])
# cruise: frames with v within 10% of plateau
cr=[r for r in rows if r[1]>6.0];
if cr:
  vs=[r[1] for r in cr];print('cruise >6m/s: t %.2f-%.2f n=%d mean %.3f min %.3f max %.3f'%(cr[0][0],cr[-1][0],len(cr),sum(vs)/len(vs),min(vs),max(vs)))
L=sum(math.dist(a['position'],b['position']) for a,b in zip(F,F[1:]));print('outbound len %.2f m dur %.2f s'%(L,F[-1]['t']-F[0]['t']))
json.dump([dict(t=r[0],cam_mps=r[1],walk_mps=r[2],pos=r[3],fov=r[4],state=r[5]) for r in rows],open(O+'/out/outbound_speed.json','w'))
print('final',F[-1])
