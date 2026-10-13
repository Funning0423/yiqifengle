from pathlib import Path
exec(Path(__file__).with_name('repair_boots.py').read_text().split('asset=P')[0])
from door_ik import worlds
before=Glb(OUT/'dynamic-before.glb');after=Glb(OUT/'dynamic-after.glb');names={n['name']:i for i,n in enumerate(after.j['nodes'])};rows=[]
for a in after.j['animations']:
 oa=next(x for x in before.j['animations'] if x['name']==a['name']);dur=max(float(after.accessor(s['input'])[-1,0]) for s in a['samplers']);maxerr=0;angles=0
 for t in np.linspace(0,dur,61):
  w,_=worlds(after,a,t);ow,_=worlds(before,oa,t)
  for name in ['foot.L','foot.R']:
   i=names[name];maxerr=max(maxerr,float(np.linalg.norm(w[i][:3,3]-ow[i][:3,3])));angles=max(angles,float(np.linalg.norm(w[i][:3,:3]-ow[i][:3,:3])))
 rows.append({'clip':a['name'],'foot_origin_max_difference_m':maxerr,'foot_rotation_matrix_max_difference':angles})
assert before.j['skins']==after.j['skins']
for a in after.j['animations']:
 if a['name'] in ['sit_hold','stand_up','sit_down']:continue
 oa=next(x for x in before.j['animations'] if x['name']==a['name']);assert a==oa
 for s in a['samplers']:
  for k in ['input','output']:assert np.array_equal(before.accessor(s[k]),after.accessor(s[k]))
json.dump({'samples_per_clip':61,'clips':rows,'unchanged_other_animation_bytes':True,'skin_inverse_bind_unchanged':True},open(OUT/'continuity-validation.json','w'),indent=2)
print(rows)
