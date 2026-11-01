# Voice Bot: footstep surface map of the home/island ground, from the SHIPPED world GLB
# (creator-build-project/assets/bundles/static_seat_preview/room/room_no_original_chair.glb).
# usage: blender -b --python ground_map_blender.py -- <glb> <out.json>
# Top-down rays (glTF Y-up = Blender Z-up, z_gltf = -y_blender) on a 0.1 m grid; the first ground hit below 0.03 m decides
# the cell (doors, furniture, roofs and props are skipped, except the room rug: a props_merged face at < 0.02 m).
# Ground colour = Principled Base Color texture (env_palette_256) at the face's mean UV.
#   W wood   env_interior_shell (plank colours)        R rug    env_interior_props_merged, h < 0.02 m
#   S stone  env_lighthouse_ext doorstep / cream sill  P path   env_island_main, sand-coloured palette row
#   G grass  env_island_main, green (g > r)            .        nothing walkable
import bpy,sys,json,hashlib
from mathutils import Vector
glb,out=sys.argv[sys.argv.index('--')+1:sys.argv.index('--')+3]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=glb)
dg=bpy.context.evaluated_depsgraph_get()
def base_color(mat,uv):
    if not mat or not mat.use_nodes: return None
    b=[n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED']
    if not b or not b[0].inputs['Base Color'].links: return None
    n=b[0].inputs['Base Color'].links[0].from_node
    if n.type!='TEX_IMAGE' or not n.image: return None
    im=n.image; w,h=im.size; x=int((uv[0]%1)*w); y=int((uv[1]%1)*h); i=(y*w+x)*4
    return list(im.pixels[i:i+3])
SKIP=('env_lighthouse_door','env_island_props','env_cloud','env_sky','env_int_anim','env_sea')
X0,Z0,CELL,NX,NZ=-4.0,-5.0,0.1,60,115
rows=[]
for k in range(NZ):
    row=''
    for i in range(NX):
        x=X0+(i+0.5)*CELL; z=Z0+(k+0.5)*CELL; o=Vector((x,-z,1.5)); c='.'
        for _ in range(8):
            hit,loc,nor,idx,ob,mw=bpy.context.scene.ray_cast(dg,o,Vector((0,0,-1)))
            if not hit: break
            nm=ob.name
            if nm.startswith(SKIP) or loc.z>0.03 or (nm.startswith('env_interior_props') and loc.z>=0.02) or (not nm.startswith(('env_interior_shell','env_interior_props','env_lighthouse_ext','env_island_main'))):
                o=loc+Vector((0,0,-0.0005)); continue
            ev=ob.evaluated_get(dg); me=ev.to_mesh(); poly=me.polygons[idx]
            mat=ev.material_slots[poly.material_index].material if ev.material_slots else None
            uvs=[me.uv_layers.active.data[li].uv for li in poly.loop_indices]; uv=[sum(u[0] for u in uvs)/len(uvs),sum(u[1] for u in uvs)/len(uvs)]
            col=base_color(mat,uv) or [0,0,0]; ev.to_mesh_clear()
            if nm.startswith('env_interior_props'): c='R'
            elif nm.startswith('env_lighthouse_ext'): c='S'
            elif nm.startswith('env_interior_shell'): c='S' if (col[0]>0.79 and col[1]>0.69 and col[2]>0.5) else 'W'
            else: c='G' if col[1]>col[0] else 'P'
            break
        row+=c
    rows.append(row)
sha=hashlib.sha256(open(glb,'rb').read()).hexdigest()
json.dump({'glb':glb.split('creator-build-project/')[-1],'glbSHA256':sha,'x0':X0,'z0':Z0,'cell':CELL,'nx':NX,'nz':NZ,'rows':rows},open(out,'w'),indent=0)
print('ground map',NX,'x',NZ,sha[:12])
