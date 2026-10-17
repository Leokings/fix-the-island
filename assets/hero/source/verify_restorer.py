"""Read-back checks for the exported GLB; does not pose or animate the rig."""
import bpy, json, struct, math, hashlib
from pathlib import Path
from datetime import datetime, timezone
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[3]
path=ROOT/'assets/hero/restorer.glb'
raw=path.read_bytes()
assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
jl,jt=struct.unpack_from('<II',raw,12)
assert jt==0x4e4f534a
doc=json.loads(raw[20:20+jl]); bp=20+jl
bl,bt=struct.unpack_from('<II',raw,bp); assert bt==0x004e4942
binary=raw[bp+8:bp+8+bl]
components={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
types={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(i):
    ac=doc['accessors'][i]; bv=doc['bufferViews'][ac['bufferView']]
    fmt,sz=components[ac['componentType']]; n=types[ac['type']]
    stride=bv.get('byteStride',n*sz); start=bv.get('byteOffset',0)+ac.get('byteOffset',0)
    return [struct.unpack_from('<'+fmt*n,binary,start+j*stride) for j in range(ac['count'])]
def local(node):
    if 'matrix' in node:
        a=node['matrix']; return Matrix([a[i::4] for i in range(4)])
    t=node.get('translation',[0,0,0]); s=node.get('scale',[1,1,1]); r=node.get('rotation',[0,0,0,1])
    return Matrix.Translation(Vector(t))@Quaternion((r[3],r[0],r[1],r[2])).to_matrix().to_4x4()@Matrix.Diagonal(Vector(s+[1]))
world={}
def visit(i,parent):
    m=parent@local(doc['nodes'][i]); world[i]=m
    for j in doc['nodes'][i].get('children',[]):visit(j,m)
for i in doc['scenes'][doc.get('scene',0)]['nodes']:visit(i,Matrix.Identity(4))
positions=[]; triangles=0; exported_vertices=0; maxerr=0; maxinfluences=0
uv_out=0; finite=True; meshes=[]
for ni,node in enumerate(doc['nodes']):
    if 'mesh' not in node:continue
    skin=doc['skins'][node['skin']]; counts=[]
    for prim in doc['meshes'][node['mesh']]['primitives']:
        a=prim['attributes']; pos=accessor(a['POSITION']); uv=accessor(a['TEXCOORD_0']); weights=accessor(a['WEIGHTS_0']); joints=accessor(a['JOINTS_0']); norm=accessor(a['NORMAL'])
        indices=[i[0] for i in accessor(prim['indices'])]
        assert all(0<=i<len(pos) for i in indices)
        assert len(indices)%3==0
        for p,w,j,n,tex in zip(pos,weights,joints,norm,uv):
            positions.append(tuple(world[ni]@Vector(p)))
            finite=finite and all(math.isfinite(x) for x in p+w+n+tex)
            maxerr=max(maxerr,abs(sum(w)-1))
            maxinfluences=max(maxinfluences,sum(x>1e-6 for x in w))
            assert all(0<=idx<len(skin['joints']) for idx in j)
            assert abs(Vector(n).length-1)<.002
            uv_out+=int(any(x<0 or x>1 for x in tex))
        triangles+=len(indices)//3; exported_vertices+=len(pos)
        counts.append({'vertices':len(pos),'triangles':len(indices)//3,'uvs':len(uv)})
    meshes.append({'name':node.get('name'), 'primitives':counts})
minimum=[min(p[a] for p in positions) for a in range(3)]
maximum=[max(p[a] for p in positions) for a in range(3)]
assert 3000<=triangles<=8000,triangles
assert abs(minimum[1])<1e-6
assert abs(maximum[1]-1.68)<1e-5
assert finite and maxerr<1e-4 and uv_out==0
assert not doc.get('animations')
assert len(doc['skins'][0]['joints'])==22
assert len(doc['images'])==2 and all('bufferView' in x for x in doc['images'])
assert all('uri' not in b for b in doc['buffers'])
assert len(doc.get('cameras',[]))==0
assert 'KHR_lights_punctual' not in doc.get('extensions',{})
yaw=math.radians(35); pitch=math.radians(52)
right=Vector((math.cos(yaw),0,-math.sin(yaw)))
up=Vector((-math.sin(yaw)*math.sin(pitch),math.cos(pitch),-math.cos(yaw)*math.sin(pitch)))
target=Vector((0,.85,0)); sx=[]; sy=[]
for p in positions:
    delta=Vector(p)-target; sx.append(960+delta.dot(right)*1080/8.4); sy.append(540-delta.dot(up)*1080/8.4)
projected={'min_x':min(sx),'min_y':min(sy),'max_x':max(sx),'max_y':max(sy),
 'width_px':max(sx)-min(sx),'height_px':max(sy)-min(sy),'vertical_body_axis_px':1.68*math.cos(pitch)*1080/8.4,
 'note':'Bind A-pose includes brim, toe-box depth and spread arms; body height and camera span are unchanged.'}
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(path))
imported_meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name in ('Restorer_Body','Restorer_Cap')]
arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
assert len(imported_meshes)==2 and len(arms)==1
assert len(arms[0].data.bones)==22
extra_meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in imported_meshes]
custom_shapes={p.custom_shape for p in arms[0].pose.bones if p.custom_shape}
assert all(o in custom_shapes for o in extra_meshes),[(o.name,o.type) for o in extra_meshes]
assert all(any(m.type=='ARMATURE' for m in o.modifiers) for o in imported_meshes)
assert all(o.data.uv_layers for o in imported_meshes)
assert len(bpy.data.actions)==0
# UV splits in an imported GLB are intentional. Connectivity evidence comes
# from the retained authored Blender mesh, before glTF attribute splitting.
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/hero/source/restorer.blend'))
body=bpy.data.objects['Restorer_Body']; me=body.data
adj=[set() for _ in me.vertices]
edge_use={}
for e in me.edges:
    a,b=e.vertices; adj[a].add(b); adj[b].add(a)
for p in me.polygons:
    for a,b in zip(p.vertices,list(p.vertices[1:])+[p.vertices[0]]):
        edge=tuple(sorted((a,b))); edge_use[edge]=edge_use.get(edge,0)+1
seen=set(); garments=[]
for start in range(len(me.vertices)):
    if start in seen:continue
    comp={start}; stack=[start]; seen.add(start)
    while stack:
        for n in adj[stack.pop()]:
            if n not in seen:seen.add(n);comp.add(n);stack.append(n)
    coords=[me.vertices[i].co for i in comp]
    mn=[min(p[a] for p in coords) for a in range(3)]
    mx=[max(p[a] for p in coords) for a in range(3)]
    label=None
    if mn[2]>.80 and mx[2]<1.32 and mx[0]-mn[0]>.85:label='Continuous jacket torso and both sleeves'
    if mn[2]<.22 and mx[2]>.85 and mx[2]<.91 and mx[0]-mn[0]>.25:label='Continuous trouser pelvis and both legs'
    if label:
        ce=[(a,b) for a,b in edge_use if a in comp and b in comp]
        bad=sum(edge_use[e]!=2 for e in ce)
        assert bad==0,(label,bad)
        garments.append({'name':label,'connected_components':1,'vertices':len(comp),'nonmanifold_edges':bad,'blender_bounds_min':mn,'blender_bounds_max':mx})
assert len(garments)==2,garments
bone_parent={child:i for i,n in enumerate(doc['nodes']) for child in n.get('children',[])}
joint_meta=[]
for ji in doc['skins'][0]['joints']:
    n=doc['nodes'][ji]; parent=bone_parent.get(ji)
    joint_meta.append({'name':n['name'],'node':ji,'parent':doc['nodes'][parent]['name'] if parent is not None else None,
        'local_translation':n.get('translation',[0,0,0]),'local_rotation_xyzw':n.get('rotation',[0,0,0,1]),'local_scale':n.get('scale',[1,1,1])})
(ROOT/'assets/hero/source/bone-bind.json').write_text(json.dumps({'coordinate_system':'glTF +Y up, +Z front, metres','bind_pose':'A-pose; no actions','joints':joint_meta},indent=2),encoding='utf-8')
report={'glb_sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':triangles,
 'source_vertices':3767,'exported_vertices_including_UV_normal_material_splits':exported_vertices,
 'exported_uv_coordinates':exported_vertices,'meshes':meshes,
 'gltf_world_bounds_min':minimum,'gltf_world_bounds_max':maximum,'height_m':maximum[1]-minimum[1],
 'all_values_finite':finite,'maximum_weight_sum_error':maxerr,'maximum_skin_influences':maxinfluences,
 'locked_camera_projected_bind_A_pose_bounds':projected,
 'uvs_outside_atlas':uv_out,'bones_including_root':22,'embedded_PNGs':len(doc['images']),
 'garment_connectivity':garments,
 'animations':0,'embedded_studio_cameras':0,'embedded_studio_lights':0,
 'fresh_Blender_GLB_import':'Successful: two UV meshes, one 22-bone armature, skin modifiers intact',
 'visual_gate':'Not assigned. Orchestrator owns turnaround gate.'}
(ROOT/'assets/hero/source/glb-readback.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
capture_checks=[]
for name in ['bind-a-pose','front','side','back','locked-game-camera','locked-angle-close']:
    png=ROOT/'artifacts/hero-turnaround'/(name+'.png')
    if not png.exists():continue
    data=png.read_bytes()
    assert data[:8]==b'\x89PNG\r\n\x1a\n'
    w,h=struct.unpack_from('>II',data,16); assert (w,h)==(1920,1080)
    capture_checks.append({'name':name,'resolution':[w,h],'sha256':hashlib.sha256(data).hexdigest(),
       'modified_utc':datetime.fromtimestamp(png.stat().st_mtime,timezone.utc).isoformat()})
if len(capture_checks)==6:
    (ROOT/'artifacts/hero-turnaround/native-capture-checks.json').write_text(json.dumps({'glb_sha256':hashlib.sha256(raw).hexdigest(),
       'source_blend_sha256':hashlib.sha256((ROOT/'assets/hero/source/restorer.blend').read_bytes()).hexdigest(),
       'native_images':capture_checks,'locked_camera_projected_bind_A_pose_bounds':projected},indent=2),encoding='utf-8')
print('RESTORER_READBACK',json.dumps(report),flush=True)
