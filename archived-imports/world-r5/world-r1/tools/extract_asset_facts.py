"""Read-only extraction from frozen source. Writes only world-r1 generated facts."""
import json, hashlib, pathlib, struct
ROOT=pathlib.Path(__file__).resolve().parents[1]
ASSET=pathlib.Path('/workspace/shared/grok-takeover/assets/portable-firstslice-v0.1')
BASE=pathlib.Path('/workspace/shared/grok-takeover/mac-recovery/reconstructed/COCOS-FIRSTSLICE-COMPAT/creator-build-project')
j=json.loads((ASSET/'combined_anchors_m.json').read_text())
anchors={x['name']:{'path':x['node_path'],'position':x['position_world_m'],'matrix':x['world_matrix_column_major'],'properties':x.get('properties',{})} for x in j['anchors']}
b=(ASSET/'combined_visual_m.glb').read_bytes(); n,t=struct.unpack_from('<II',b,12); gltf=json.loads(b[20:20+n])
parents={c:i for i,node in enumerate(gltf['nodes']) for c in node.get('children',[])}
def path(i): return (path(parents[i])+'/' if i in parents else '')+gltf['nodes'][i]['name']
def group(name):
 if name=='env_lighthouse_door': return 'door'
 if name in ['env_sea_surface','env_sea_foam','env_sky_dome','env_cloud_layer']: return 'backdrop'
 if name.startswith('env_int_') or name.startswith('env_interior_') or name=='env_window_blind_cards': return 'interior'
 return 'exterior'
renders=[{'path':path(i),'name':x['name'],'layer':group(x['name'])} for i,x in enumerate(gltf['nodes']) if 'mesh' in x]
collision=json.loads((ASSET/'combined_collision_proxies.json').read_text())
door=next(x for x in collision['proxies'] if x['name']=='col_lighthouse_door_leaf')
vertices=[v for p in door['primitives'] for v in p['positions_local_m']]
facts={'schema':1,'units':'m','up':'+Y','outdoorForward':'+Z','anchors':anchors,'renderers':renders,'door':{'path':'scene_root/env_lighthouse_door','hinge':gltf['nodes'][4]['translation'],'bounds':[[min(v[i] for v in vertices),max(v[i] for v in vertices)] for i in range(3)],'openDeg':86.4,'maxDeg':105},'source':{name:hashlib.sha256((ASSET/name).read_bytes()).hexdigest() for name in ['combined_visual_m.glb','combined_anchors_m.json','combined_collision_proxies.json']}}
(ROOT/'evidence/asset-facts.json').write_text(json.dumps(facts,indent=2)+'\n')
# Deliberately no generated .meta: a single Cocos integrator owns all imported UUIDs.
(ROOT/'components/FirstsliceFacts.ts').write_text('// Generated from immutable metre-space GLB and sidecars. Do not hand-edit.\nexport const FIRSTSLICE = '+json.dumps(facts,indent=2)+' as const;\n')
paths=list(BASE.rglob('*'))+list(ASSET.rglob('*'))
snapshot={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}
(ROOT/'evidence/source-before.json').write_text(json.dumps(snapshot,indent=2)+'\n')
print(f'Extracted {len(anchors)} anchors, {len(renders)} mesh nodes, {len(snapshot)} frozen-source hashes')
