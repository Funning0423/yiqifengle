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
    sc.view_settings.view_transform = 'AgX'
    looks = [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items_static]
    sc.view_settings.look = next((k for k in looks if k.endswith('Medium High Contrast')), 'None')
    sc.render.film_transparent = False


def setup_eevee(bg=(0.86, 0.88, 0.90), sun_dir=(0.7, -0.9, 1.1), samples=64):
    """soft, clean preview light (key sun + sky fill, AgX medium-high contrast), for the settled-frame screenshot."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = samples
    wd = bpy.data.worlds.new('w')
    wd.use_nodes = True
    bgn = wd.node_tree.nodes.get('Background')
    bgn.inputs['Color'].default_value = (bg[0], bg[1], bg[2], 1)
    bgn.inputs['Strength'].default_value = 0.55
    sc.world = wd
    ld = bpy.data.lights.new('sun', 'SUN')
    ld.energy = 2.4
    ld.angle = math.radians(12)
    ld.color = (1.0, 0.96, 0.9)
    o = bpy.data.objects.new('sun', ld)
    sc.collection.objects.link(o)
    o.rotation_euler = Vector(sun_dir).to_track_quat('Z', 'Y').to_euler()
    sc.view_settings.view_transform = 'AgX'
    looks = [i.identifier for i in sc.view_settings.bl_rna.properties['look'].enum_items_static]
    sc.view_settings.look = next((k for k in looks if k.endswith('Medium High Contrast')), 'None')
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
