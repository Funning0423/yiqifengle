# NDC of her (Cocos lookAt up +Y, vertical FOV, portrait 402x874) + merge Blender distances -> per-frame CSV.
import json,math,csv,sys,numpy as np
O=sys.argv[1]; W,H=402,874; tr={f['frame']:f for f in json.load(open(O+'/track_sail.json'))['frames']}
def ndc(P,T,fov,X):
    P=np.array(P,float);f=np.array(T,float)-P;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f)
    th=math.tan(math.radians(fov)/2);d=np.array(X,float)-P;z=d@f;return (d@r)/(z*th*W/H),(d@u)/(z*th),z
summ={}
for c in sys.argv[2:]:
    rows=json.load(open(f'/tmp/scc/m_{c}.json'));out=[]
    for r in rows:
        f=tr[r['frame']]
        if r['scene']=='island':
            R=f['root'];fx,fy,_=ndc(f['position'],f['target'],f['fovVerticalDeg'],[R[0],1.55,R[2]]);_,ly,_=ndc(f['position'],f['target'],f['fovVerticalDeg'],[R[0],0,R[2]])
            r.update(face_ndc_x=round(fx,4),face_ndc_y=round(fy,4),feet_ndc_y=round(ly,4))
            r['clear_min']=min(r['dist_signpost'],r['dist_beach_palm_tall'])
        out.append(r)
    keys=[];[keys.append(k) for r in out for k in r if k not in keys]
    with open(f'{O}/sail_frames_{c}.csv','w',newline='') as fh: w=csv.DictWriter(fh,keys);w.writeheader();w.writerows(out)
    isl=[r for r in out if r['scene']=='island'];vis=[r for r in isl if r['actor_visible']]
    def mn(k):m=min(isl,key=lambda r:r[k]);return m[k],m['frame']
    summ[c]={'island_frames':f"{isl[0]['frame']}-{isl[-1]['frame']}",'min_sign':mn('dist_signpost'),'min_palm':mn('dist_beach_palm_tall'),'min_island':mn('dist_island'),
      'occluded_frames':[r['frame'] for r in isl if r['occl_face'] or r['occl_feet'] or r['occl_head']],'occluded_frames_actor_visible':[r['frame'] for r in vis if r['occl_face']],
      'actor_visible_frames':f"{vis[0]['frame']}-{vis[-1]['frame']}",'feet_ndc_y_min_visible':min(r['feet_ndc_y'] for r in vis),'face_ndc_visible':(vis[0]['face_ndc_x'],vis[0]['face_ndc_y'])}
json.dump(summ,open(O+'/summary.json','w'),indent=1);print(json.dumps(summ,indent=1))
