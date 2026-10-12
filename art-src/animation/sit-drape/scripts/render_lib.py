# Workbench / Eevee helpers for the seated drape previews (blender -b).
import bpy, math
from mathutils import Vector


def setup_workbench(bg=(0.16, 0.17, 0.19)):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'TEXTURE'
    sh.show_shadows = False
    sh.show_cavity = True
    sh.cavity_type = 'WORLD'
    sh.background_type = 'WORLD'
    wd = bpy.data.worlds.new('w')
    wd.color = bg
    sc.world = wd
    sc.view_settings.view_transform = 'Standard'
    sc.render.film_transparent = False


def flat_material(name, rgb, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], alpha)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    if b:
        b.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1)
        b.inputs['Roughness'].default_value = 0.85
    return m


def camera(name, loc, target, lens=50, ortho=None):
    cd = bpy.data.cameras.new(name)
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    else:
        cd.lens = lens
    c = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(c)
    c.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return c


def render(cam, path, w, h):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# seated framing: views around the seated root (Blender axes: -Y = her front, +X = her left)
SEAT_VIEWS = {
    'side': ((1.9, -0.25, 0.62), (0.0, -0.22, 0.48)),        # her left side
    'front': ((0.0, -2.0, 0.75), (0.0, -0.2, 0.5)),
    'q34': ((1.25, -1.45, 0.95), (0.0, -0.2, 0.5)),           # 3/4 front-left
    'back': ((-0.6, 1.9, 0.95), (0.0, 0.0, 0.55)),
    'other_side': ((-1.9, -0.25, 0.62), (0.0, -0.22, 0.48)),
    'low_front': ((0.35, -1.3, 0.25), (0.0, -0.2, 0.42)),
}
