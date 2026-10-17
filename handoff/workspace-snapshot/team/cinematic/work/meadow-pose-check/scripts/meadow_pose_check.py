# 运镜bot meadow pose cross-check. Blender headless, read-only on the .blend (never saved).
# usage: blender -b meadow_greybox_v0_8.blend --python meadow_pose_check.py -- '<json args>'
import bpy, json, sys, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
A=json.loads(sys.argv[sys.argv.index('--')+1])
S=bpy.context.scene; O=bpy.data.objects
def c2b(v): return Vector((v[0],-v[2],v[1]))          # cocos -> blender
def b2c(v): return [v[0],v[2],-v[1]]
pose=A['pose']; P=c2b(pose['position']); T=c2b(pose['target']); FOV=math.radians(pose['fovVerticalDeg'])
TH=math.tan(FOV/2); NEAR=A.get('near',1.0); FAR=1000.0
# render-hidden helpers (templates, preview morph, placeholder) are not in the game: hide for raycasts
excluded=[o.name for o in O if o.hide_render]
for o in O:
    if o.hide_render: o.hide_viewport=True
dome=O['meadow_sky_dome']; dome_follow=A.get('dome_follow',True)
if dome_follow: dome.location.x=P.x; dome.location.y=P.y    # SkyFollowCamera: dome XZ = camera XZ
bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get()
# camera basis (blender), lookAt with world up +Z(blender)=+Y(cocos)
fwd=(T-P).normalized(); right=fwd.cross(Vector((0,0,1))).normalized(); up=right.cross(fwd)
R=Matrix((right,up,-fwd)).transposed()
fc=b2c(fwd); rc=b2c(right); uc=b2c(up)
def cam(v):
    d=v-P; return Vector((d.dot(right),d.dot(up),-d.dot(fwd)))   # z negative in front
def ndc(v,asp):
    c=cam(v); z=-c.z
    if z<=1e-6: return None,z
    return (c.x/z/(TH*asp), c.y/z/TH), z
def cls(name):
    if name is None: return 'VOID'
    if name.startswith('grass_'): return 'grass'
    if name.startswith('flowers_'): return 'flowers'
    m={'meadow_sky_dome':'sky','meadow_clouds_near':'cloud','meadow_far_hills':'far_hills','meadow_terrain':'terrain','meadow_path':'path',
       'meadow_river':'river','meadow_river_bank':'river_bank','meadow_trees_merged':'trees','meadow_fence_merged':'fence'}
    if name in m: return m[name]
    if name.startswith('windmill') : return 'windmill'
    if 'bell' in name: return 'bells'
    return 'other:'+name
res={'input':{'pose':pose,'near_used_m':NEAR,'far_m':FAR,'dome_follows_camera':dome_follow,'excluded_render_hidden':excluded}}
# ---------- check 1: format / basis
ent=A['pose_entry_keys']
res['c1_format']={'pose_keys':ent,'only_allowed_keys':sorted(ent)==sorted(['position','target','fovVerticalDeg']),
 'all_finite':all(math.isfinite(x) for x in pose['position']+pose['target']+[pose['fovVerticalDeg']]),
 'forward_cocos':fc,'right_cocos':rc,'up_cocos':uc,'right_y':rc[1],'roll_ok':abs(rc[1])<=0.001,
 'pitch_deg':math.degrees(math.asin(fc[1])),'yaw_deg_from_-Z_toward_+X':math.degrees(math.atan2(fc[0],-fc[2])),
 'pitch_ok_not_near_90':abs(math.degrees(math.asin(fc[1])))<80,'target_distance_m':(T-P).length}
# ---------- check 2: inside / near / occlusion
def rc_(o,d,dist=FAR):
    h,loc,n,i,ob,m=S.ray_cast(dg,o,d,distance=dist); return (ob.name if h else None, loc if h else None, n if h else None)
down=rc_(P,Vector((0,0,-1))); upr=rc_(P,Vector((0,0,1)))
# nearest geometry distance (all visible meshes, evaluated), excl. sky dome
near_d=1e9; near_o=None
for o in O:
    if o.type!='MESH' or o.hide_viewport or o.name=='meadow_sky_dome': continue
    oe=o.evaluated_get(dg); me=oe.to_mesh(); mw=o.matrix_world
    if len(me.vertices)==0: oe.to_mesh_clear(); continue
    bvh=BVHTree.FromPolygons([mw@v.co for v in me.vertices],[p.vertices[:] for p in me.polygons]); oe.to_mesh_clear()
    r=bvh.find_nearest(P)
    if r[0] is not None and r[3]<near_d: near_d=r[3]; near_o=o.name
# inside test: parity along 6 axis rays for closed meshes is overkill; use: below=terrain, above=sky/cloud, nearest>near
ot=rc_(P,fwd); 
res['c2_inside_near_occlusion']={'ray_down_first_hit':down[0],'height_above_ground_m':(P.z-down[1].z) if down[1] else None,
 'ray_up_first_hit':upr[0],'nearest_geometry_m':near_d,'nearest_object':near_o,
 'near_plane_clear_at_1m':near_d>1.0,'near_plane_clear_at_0.05m':near_d>0.05,
 'optical_axis_first_hit':ot[0],'optical_axis_hit_cocos':b2c(ot[1]) if ot[1] else None,
 'optical_axis_hit_minus_target_m':(ot[1]-T).length if ot[1] else None}
# occlusion of key points
pts={}
for n in ['player_spawn','windmill_door_point','region_interaction_point','windmill_sail_hub']+['walk_path_%02d'%i for i in range(23)]:
    if n in O: pts[n]=O[n].matrix_world.translation.copy()
pts['target']=T.copy(); pts['bell_01']=O['bell_01'].matrix_world.translation.copy()
occ={}
for n,v in pts.items():
    vv=v+Vector((0,0,0.3)) if (n.startswith('walk_path') or n in('player_spawn','windmill_door_point','region_interaction_point','target')) else v   # 0.3 m above ground for ground anchors
    d=(vv-P); L=d.length; h=rc_(P,d.normalized(),L-0.05)
    occ[n]={'occluded_by':h[0]} if h[0] else {'occluded_by':None}
res['c2_inside_near_occlusion']['key_point_occlusion(0.3m above ground anchors)']=occ
# character bbox at player_spawn (1.73 m with hat, 0.6 m wide/deep) + placeholder
def box(c,w,h,z0=0.0): return [c+Vector((dx,dy,dz)) for dx in(-w/2,w/2) for dy in(-w/2,w/2) for dz in(z0,h)]
chars={'girl_at_player_spawn_1.73m_hat':box(pts['player_spawn'],0.6,1.73)}
ph=O['ref_girl_height_placeholder_1p626m']; chars['ref_girl_placeholder_1p626m(+hat->1.73m)']=box(Vector((ph.location.x,ph.location.y,ph.location.z)),0.6,1.73)
# character occlusion: rays to 9 points of the box
def char_occ(bx):
    # samples lifted 0.1 m off the ground so the floor under her feet does not count as an occluder
    smp=[v+Vector((0,0,0.1)) if v.z==min(b.z for b in bx) else v for v in bx]; c=sum(smp,Vector())/len(smp); smp=smp+[c]; hits=[]
    for v in smp:
        d=v-P; h=rc_(P,d.normalized(),d.length-0.05)
        if h[0]: hits.append(h[0])
    return {'samples':len(smp),'occluded_samples':len(hits),'by':sorted(set(hits))}
# ---------- check 3/4 per aspect
asp_out={}
gr=[o for o in O if o.name.startswith('grass_') and o.parent and o.parent.name=='meadow_grass_instances']
fl=[o for o in O if o.name.startswith('flowers_') and o.parent and o.parent.name=='meadow_flower_instances']
pathv=[O['meadow_path'].matrix_world@v.co for v in O['meadow_path'].data.vertices]
for tag,asp,(gw,gh) in [('0.46',0.46,(92,200)),('0.75',0.75,(150,200))]:
    a={}
    # ray grid
    counts={}; grid=[]; edge_hits=0; below_horizon_sky=0; maxdist=0; mindist=1e9; terrain_far=[]
    skyline=[]
    for j in range(gh):
        y=1-(j+0.5)*2/gh; row=[]
        for i in range(gw):
            x=-1+(i+0.5)*2/gw
            d=(R@Vector((x*TH*asp,y*TH,-1))).normalized()
            n,loc,_=rc_(P,d); k=cls(n); counts[k]=counts.get(k,0)+1; row.append(k)
            if loc is not None:
                dist=(loc-P).length; maxdist=max(maxdist,dist); mindist=min(mindist,dist*(-cam(loc).z)/dist if dist>0 else 0)
                if k=='terrain' and (abs(loc.x)>78 or abs(loc.y)>78): edge_hits+=1
            if k in('sky','VOID') and d.z<0: below_horizon_sky+=1
        grid.append(row)
    N=gw*gh
    frac={k:round(v/N,4) for k,v in sorted(counts.items())}
    meadow_k=['terrain','path','grass','flowers','windmill','bells','fence','trees','river','river_bank']
    # skyline: per column, lowest NDC y that is sky/cloud with all above also sky/cloud
    sk=[]
    for i in range(gw):
        jj=0
        while jj<gh and grid[jj][i] in('sky','cloud','VOID'): jj+=1
        sk.append(1-jj*2/gh)
    # bottom band content
    band=[grid[j][i] for j in range(gh) for i in range(gw) if 1-(j+0.5)*2/gh < -0.5]
    bc={}
    for k in band: bc[k]=bc.get(k,0)+1
    a['screen_fraction_by_class']=frac
    a['meadow_fraction(ground+path+grass+flowers+props+trees+river)']=round(sum(counts.get(k,0) for k in meadow_k)/N,4)
    a['far_hills_fraction']=frac.get('far_hills',0); a['sky_fraction(sky+cloud)']=round((counts.get('sky',0)+counts.get('cloud',0))/N,4)
    a['void_fraction(no hit)']=round(counts.get('VOID',0)/N,4)
    a['terrain_edge_hits(|x|or|y|>78m)']=edge_hits
    a['sky_or_void_seen_below_true_horizon_rays']=below_horizon_sky
    a['true_horizon_ndc_y']=math.tan(-math.asin(fc[1]))/TH
    a['skyline_ndc_y(min/mean/max over columns)']=[min(sk),sum(sk)/len(sk),max(sk)]
    a['max_hit_distance_m']=maxdist; a['far_plane_ok']=maxdist<FAR
    a['bottom_band_y<-0.5_content']={k:round(v/len(band),4) for k,v in sorted(bc.items())}
    # projections
    pj={}
    for n,v in pts.items():
        q,z=ndc(v,asp); pj[n]=[round(q[0],3),round(q[1],3)] if q else 'behind'
    a['points_ndc']=pj
    def bb(vs):
        q=[ndc(v,asp)[0] for v in vs]; q=[t for t in q if t]
        return [round(min(t[0] for t in q),3),round(max(t[0] for t in q),3),round(min(t[1] for t in q),3),round(max(t[1] for t in q),3)] if q else None
    a['path_mesh_bbox_ndc[xmin,xmax,ymin,ymax]']=bb(pathv)
    wp=[pts['walk_path_%02d'%i] for i in range(23)]
    a['walk_path_00_22_bbox_ndc']=bb(wp)
    def inst(objs):
        q=[ndc(o.matrix_world.translation,asp)[0] for o in objs]
        inn=[t for t in q if t and abs(t[0])<=1 and abs(t[1])<=1]
        return {'count':len(objs),'origins_in_frame':len(inn),'origins_in_frame_above_-0.5':sum(1 for t in inn if t[1]>=-0.5),
                'in_frame_bbox_ndc':[round(min(t[0] for t in inn),3),round(max(t[0] for t in inn),3),round(min(t[1] for t in inn),3),round(max(t[1] for t in inn),3)] if inn else None}
    a['grass_instances']=inst(gr); a['flower_instances']=inst(fl)
    # terrain corners/edges projection (which terrain edges are in front & in frame)
    ter=O['meadow_terrain']; tb=[ter.matrix_world@Vector(c) for c in ter.bound_box]
    edges={}
    for nm,(p0,p1) in {'north(+Z_b y=+80 / cocos z=-80)':((-80,80),(80,80)),'west(x=-80)':((-80,-80),(-80,80)),'east(x=+80)':((80,-80),(80,80))}.items():
        inframe=0
        for s in range(101):
            xx=p0[0]+(p1[0]-p0[0])*s/100; yy=p0[1]+(p1[1]-p0[1])*s/100
            hz=rc_(Vector((xx*0.999,yy*0.999,50)),Vector((0,0,-1)))
            zz=hz[1].z if hz[1] else 0
            q,_=ndc(Vector((xx,yy,zz)),asp)
            if q and abs(q[0])<=1 and abs(q[1])<=1:
                # is that edge point actually visible (not occluded)?
                d=Vector((xx,yy,zz))-P; h=rc_(P,d.normalized(),d.length-0.5)
                if h[0] is None: inframe+=1
        edges[nm]='%d/101 sample points visible in frame'%inframe
    a['terrain_edge_visibility']=edges
    # characters
    ch={}
    for nm,bx in chars.items():
        b=bb(bx); ch[nm]={'bbox_ndc[xmin,xmax,ymin,ymax]':b,'above_ui_band(ymin>=-0.5)':b[2]>=-0.5,'margin_to_-0.5':round(b[2]+0.5,3),
          'within_|x|<=0.7':max(abs(b[0]),abs(b[1]))<=0.7,'center_x':round((b[0]+b[1])/2,3),'height_px_at_1000h':round((b[3]-b[2])/2*1000,1),
          'occlusion':char_occ(bx)}
    a['characters']=ch
    target_q=ndc(T,asp)[0]
    a['key_content_above_-0.5']={'path_mesh':a['path_mesh_bbox_ndc[xmin,xmax,ymin,ymax]'][2]>=-0.5,'walk_path_anchors':a['walk_path_00_22_bbox_ndc'][2]>=-0.5,'target':target_q[1]>=-0.5}
    asp_out[tag]=a
    with open(A['outdir']+'/grid_%s_%s.json'%(A.get('tag','x'),tag),'w') as f: json.dump({'w':gw,'h':gh,'grid':grid},f)
res['per_aspect']=asp_out
json.dump(res,open(A['out'],'w'),indent=1,default=str)
print("WROTE",A['out'])
