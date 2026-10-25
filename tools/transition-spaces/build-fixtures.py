#!/usr/bin/env python3
"""Crops the existing region meshes around the stance paths into fixtures/*.json.gz for the offline test (Draco decoded once
with dump-mesh.cjs; needs /tmp/draco3d). Re-run after a region glb changes."""
import json,gzip,os,subprocess,numpy as np
H=os.path.dirname(os.path.abspath(__file__));B=os.path.join(H,'../../creator-build-project/assets/bundles/')
SKIP=('instances','sky_dome','cloudsea','sea_surface','sea_foam','wave_line','surf_foam','anim_','far_hills','wet_sand')
jobs={'island':('static_seat_preview/room/room_no_original_chair.glb','-4,4,3,16'),'meadow_n':('region_meadow/env_meadow.glb','-3,-30,10,-14'),
 'meadow_s':('region_meadow/env_meadow.glb','-2,9,4,33'),'sky_s0':('region_skycity/env_skycity.glb','1,35,10,48'),'sky_s6':('region_skycity/env_skycity.glb','-3,-42,8,-25'),'sky_s6w':('region_skycity/env_skycity.glb','-19,-43,-3,-25'),'sky_lift5':('region_skycity/env_skycity.glb','-27,-72,10,-30')}
os.makedirs(os.path.join(H,'fixtures'),exist_ok=True)
for k,(f,box) in jobs.items():
    tmp=f'/tmp/b19ts/fx_{k}.json';subprocess.check_call(['node',os.path.join(H,'dump-mesh.cjs'),B+f,box,tmp])
    d=json.load(open(tmp));out={}
    for n,t in d.items():
        if any(s in n for s in SKIP):continue
        out[n]=[round(v,3) for v in t]
    with gzip.open(os.path.join(H,'fixtures',k+'.json.gz'),'wt') as g:json.dump(out,g,separators=(',',':'))
print('ok')
