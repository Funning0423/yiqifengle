#!/usr/bin/env python3
"""b19 basket obstacles -> transition-anchors.json "basketObstacles" (format of creator-build-project/assets/scripts/region/BasketObstacles.ts).
Centre = the parked balloon root (stances.json; region model-local x,z). The basket mesh is centred on the root (bbox centre 0,0), so yaw
does not move the disc. r = max horizontal radius of everything in transport_balloon.glb below y 1.6 (basket body + both closed door
leaves) rounded up to 1 cm; clearM 0.4 m = her body clearance (same as the old baked disc). Not baked into the walkable data (baked:false);
bake-region-nodes routes node paths round r+clearM+0.25 m.
Usage: python3 tools/transition-spaces/gen-basket-obstacles.py [--check]"""
import json,math,os,sys
import numpy as np
H=os.path.dirname(os.path.abspath(__file__));R=os.path.normpath(H+'/../..');sys.path.insert(0,H)
from glbread import GLB
g=GLB(R+'/creator-build-project/assets/bundles/region_transit_balloon/transport_balloon.glb')
P=g.all_tris().reshape(-1,3);low=P[P[:,1]<1.6]
ctr=(low.min(0)+low.max(0))/2;assert abs(ctr[0])<.01 and abs(ctr[2])<.01,ctr
r=math.ceil(float(np.hypot(low[:,0],low[:,2]).max())*100)/100
SG=json.load(open(H+'/stances.json'))['segments']
def at(seg):b=SG[seg]['balloon'];return [round(b['root'][0],3),round(b['root'][2],3)]
OB=[
 {'id':'meadow_basket','region':'meadow','at':at('3_meadow_balloon_in'),'r':r,'clearM':.4,'initial':False,'on':['node:M4'],'off':['balloon:B3-flight','balloon:released'],'baked':False},
 {'id':'skycity_landing_basket','region':'skycity','at':at('4_skycity_balloon_out'),'r':r,'clearM':.4,'initial':False,'on':['balloon:B4-settle'],'off':['balloon:released'],'baked':False},
 {'id':'skycity_5a_basket','region':'skycity','at':at('5a_skycity_balloon_in'),'r':r,'clearM':.4,'initial':False,'on':['lakeside:C1-basket-in'],'off':['lakeside:C3-flight','lakeside:released'],'baked':False},
]
F=R+'/tools/transitions-continuous/transition-anchors.json';j=json.load(open(F))
if '--check' in sys.argv:
    assert j.get('basketObstacles')==OB,'BASKET OBSTACLES DRIFT';print('ok');sys.exit()
j['basketObstacles']=OB
j['basketObstaclesNote']=('场景设计部 b19: state-toggled basket discs (BasketObstacles.ts). at = region model-local [x,z] of the parked balloon root '
 '(stances.json), r = basket body + closed door leaves max radius from transport_balloon.glb (%.2f m), clearM = body clearance. '
 'baked:false: not in RegionWalkableData/RegionNodes cells; RegionNodes edge paths keep >= r+clearM+0.25 m. tools/transition-spaces/gen-basket-obstacles.py'%r)
json.dump(j,open(F,'w'),ensure_ascii=False,indent=1);open(F,'a').write('\n') if False else None
print(json.dumps(OB))
