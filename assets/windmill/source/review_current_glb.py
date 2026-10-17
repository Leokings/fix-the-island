"""Render the immutable delivered GLB, imported alone into a fresh studio.

Blender 4.5.14: --background --factory-startup --threads 4
--python-exit-code 1 --python assets/windmill/source/review_current_glb.py
No source mesh is opened, no material is edited, and no GLB is exported.
"""
import bpy
import hashlib
import json
import math
import struct
from datetime import datetime, timezone
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ASSET = HERE.parent
PROJECT = ASSET.parent.parent
GLB = ASSET / 'headland-windmill.glb'
OUT = PROJECT / 'artifacts' / 'windmill-turnaround' / 'current-export'
EXPECTED = 'd9eb34a14eec2784f7060372695281f59a6dfc091aadf061e7047ddbb291226a'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

before = digest(GLB)
assert before == EXPECTED, 'Delivered GLB differs from the requested immutable bytes'
protected = [p for p in ASSET.rglob('*') if p.is_file() and p != Path(__file__).resolve()]
protected_before = {str(p): digest(p) for p in protected}
started = datetime.now(timezone.utc).isoformat()

# Explicit empty reset; do not load the retained .blend or execute build source.
bpy.ops.wm.read_factory_settings(use_empty=True)
assert len(bpy.data.objects) == 0
result = bpy.ops.import_scene.gltf(filepath=str(GLB))
assert result == {'FINISHED'}, result
bpy.context.view_layer.update()
asset_objects = list(bpy.context.scene.objects)
meshes = [o for o in asset_objects if o.type == 'MESH']
assert len(asset_objects) == 40 and len(meshes) == 29
assert all(o.type in {'EMPTY', 'MESH'} for o in asset_objects)
assert 'HeadlandWindmill' in bpy.data.objects
assert all(len(o.data.uv_layers) > 0 for o in meshes)
triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
assert triangles == 19996
coords = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
lo = [min(v[i] for v in coords) for i in range(3)]
hi = [max(v[i] for v in coords) for i in range(3)]
materials = sorted({m.name for o in meshes for m in o.data.materials})
images = [{'name': im.name, 'size': list(im.size), 'packed': im.packed_file is not None}
          for im in bpy.data.images if im.type == 'IMAGE']
raw = GLB.read_bytes()
json_length = struct.unpack('<I', raw[12:16])[0]
doc = json.loads(raw[20:20 + json_length])
assert not doc.get('animations')
asset_inventory = {'nodes': len(asset_objects), 'meshes': len(meshes), 'triangles': triangles,
                   'materials': materials, 'material_count': len(materials), 'images': images,
                   'all_meshes_have_uv': True, 'node_names': sorted(o.name for o in asset_objects),
                   'bounds_blender_z_up_m': [lo, hi],
                   'bounds_gltf_y_up_m': [[lo[0], lo[2], -hi[1]], [hi[0], hi[2], -lo[1]]],
                   'import_result': sorted(result), 'animations': len(doc.get('animations', []))}
print('FRESH_GLB_IMPORT ' + json.dumps(asset_inventory), flush=True)

OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = False
world = bpy.data.worlds.new('Review neutral world')
world.color = (.28, .28, .28)
scene.world = world
scene.view_settings.view_transform = 'AgX'

# Reuse only the numeric studio/camera parameters from the original review.
studio = bpy.data.materials.new('Review studio neutral')
studio.diffuse_color = (.27, .28, .29, 1)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.015))
floor = bpy.context.object
floor.name = 'REVIEW_STUDIO_FLOOR'
floor.data.materials.append(studio)

def area(name, position, power, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, 2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

area('Review neutral key', (-4, -6, 10), 1600, 6)
area('Review neutral fill', (6, 1, 6), 1000, 7)
cd = bpy.data.cameras.new('ReviewIsolationCamera')
cam = bpy.data.objects.new('ReviewIsolationCamera', cd)
bpy.context.collection.objects.link(cam)
scene.camera = cam
cd.type = 'ORTHO'
cd.lens = 50
assert len([o for o in scene.objects if o.type == 'MESH']) == len(meshes) + 1
assert len(scene.objects) == len(asset_objects) + 4

def gltf_point(v):
    return [v[0], v[2], -v[1]]

def render(name, direction, target, span, yaw=None, pitch=None):
    assert digest(GLB) == EXPECTED
    cam.location = Vector(target) + Vector(direction).normalized() * 32
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cd.ortho_scale = span * 1920 / 1080
    path = OUT / (name + '.png')
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    png = path.read_bytes()
    assert png[:8] == b'\x89PNG\r\n\x1a\n'
    dimensions = list(struct.unpack('>II', png[16:24]))
    assert dimensions == [1920, 1080]
    assert digest(GLB) == EXPECTED
    print('NATIVE_RENDER_COMPLETE ' + str(path), flush=True)
    return {'path': str(path), 'sha256_png': hashlib.sha256(png).hexdigest(),
            'native_dimensions': dimensions, 'postprocessed': False,
            'source_sha256': EXPECTED, 'target_blender_m': list(target),
            'target_gltf_m': gltf_point(target), 'camera_position_blender_m': list(cam.location),
            'camera_position_gltf_m': gltf_point(cam.location), 'camera_distance_m': 32,
            'vertical_span_m': span, 'horizontal_span_m': cd.ortho_scale,
            'yaw_deg': yaw, 'downward_pitch_deg': pitch}

views = []
elevation = math.degrees(math.atan(.10))
for name, direction, yaw in [('front', (0, -1, .10), 0),
                             ('side', (1, 0, .10), 90),
                             ('back', (0, 1, .10), 180)]:
    views.append(render(name, direction, (0, -.15, 2.70), 7.0, yaw, elevation))
yaw = math.radians(35)
pitch = math.radians(52)
views.append(render('locked-yaw35-pitch52-span8p4',
                    (math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch)),
                    (0, -.10, 2.55), 8.4, 35, 52))
views.append(render('assembly-close', (.65, -1, .65), (1.25, -1.59, 1.25), 2.25,
                    math.degrees(math.atan2(.65, 1)),
                    math.degrees(math.atan2(.65, math.hypot(.65, 1)))))

after = digest(GLB)
assert before == after == EXPECTED
protected_after = {str(p): digest(p) for p in protected}
assert protected_before == protected_after, 'An existing owned asset/source file changed'
manifest = {
    'publish': 'LOCKED', 'status': 'native recapture complete; no specialist gate decision',
    'started_utc': started, 'completed_utc': datetime.now(timezone.utc).isoformat(),
    'source_glb': str(GLB), 'expected_sha256': EXPECTED,
    'sha256_before': before, 'sha256_after': after, 'source_bytes_unchanged': True,
    'existing_asset_source_files_unchanged': True,
    'protected_file_sha256': protected_before,
    'scene_setup': 'Factory-empty scene; exactly one GLB imported; no retained source meshes loaded',
    'asset_import': asset_inventory,
    'render': {'engine': 'Cycles', 'device': 'CPU', 'threads': 4, 'samples': 16,
               'denoising': 'native OpenImageDenoise', 'resolution_percentage': 100,
               'view_transform': 'AgX', 'world_color': [.28, .28, .28],
               'neutral_key': {'position_blender': [-4, -6, 10], 'power_w': 1600, 'size_m': 6},
               'neutral_fill': {'position_blender': [6, 1, 6], 'power_w': 1000, 'size_m': 7}},
    'views': views,
    'limits': ['Isolated Blender studio only; no live game, collision, animation or repair-state evidence',
               '16 samples with native denoising can soften very fine surface grain',
               'Front/side/back retain original 5.71-degree downward elevation',
               'Existing original gate does not authorize these bytes; main must review all five current views',
               'No GLB export, source mesh rebuild, imported material edit or new asset art performed']}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('REVIEW_COMPLETE_SHA_UNCHANGED ' + after, flush=True)
