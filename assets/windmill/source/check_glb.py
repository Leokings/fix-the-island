"""Independent Blender import check of the actual exported GLB."""
import bpy, json, math, hashlib, struct
from pathlib import Path
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ASSET=HERE.parent
EXPECTED='7f35f2806560f0b01511e2e683fd5d717fdf3f3675c18077788f262ffe31552c'
raw=(ASSET/'headland-windmill.glb').read_bytes()
actual=hashlib.sha256(raw).hexdigest()
chunklen=struct.unpack('<I',raw[12:16])[0]
gltf=json.loads(raw[20:20+chunklen])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ASSET/'headland-windmill.glb'))
bpy.context.view_layer.update()
required=['HeadlandWindmill','SailRoot','GearCover','InputGearRoot','OutputGearRoot','Door','GroundHousing','StormDamage']
objects=list(bpy.context.scene.objects)
meshes=[o for o in objects if o.type=='MESH']
coords=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
bound=[[min(v[i] for v in coords) for i in range(3)],[max(v[i] for v in coords) for i in range(3)]]
report={
 'source':'actual GLB imported into empty Blender scene',
 'sha256':actual,'main_gated_sha256_matches':actual==EXPECTED,
 'required_nodes':{name:name in bpy.data.objects for name in required},
 'mesh_objects':len(meshes),'nodes':len(objects),
 'triangles_imported':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
 'triangles_glb':sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']),
 'all_meshes_have_uv':all(len(o.data.uv_layers)>0 for o in meshes),
 'uv_finite':all(math.isfinite(x) for o in meshes for uv in o.data.uv_layers for loop in uv.data for x in loop.uv),
 'bounds_blender_z_up':bound,
 'images':[{'name':im.name,'size':list(im.size),'packed':im.packed_file is not None} for im in bpy.data.images if im.type=='IMAGE'],
 'animations':len(bpy.data.actions),
 'non_asset_objects':[o.name for o in objects if o.type not in ['MESH','EMPTY']],
 'sail_pivot_blender':list(bpy.data.objects['SailRoot'].matrix_world.translation),
 'foundation_min_z':min(v.z for v in coords),
}
print('GLB_IMPORT_CHECK '+json.dumps(report),flush=True)
assert all(report['required_nodes'].values()),report
assert report['all_meshes_have_uv'] and report['uv_finite'],report
assert report['animations']==0 and not report['non_asset_objects'],report
assert report['triangles_glb']==19996,report
assert abs(report['foundation_min_z'])<.001,report
(HERE/'glb-import-check.json').write_text(json.dumps(report,indent=2))
print('GLB_IMPORT_CHECK '+json.dumps(report),flush=True)
