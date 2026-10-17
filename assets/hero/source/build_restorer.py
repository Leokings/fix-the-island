"""Original Restorer: authored ring topology, painted atlas, bind rig and native studio.
Run with the provided Blender executable --background --python this_file.
Only assets/hero and artifacts/hero-turnaround are written.
"""
import bpy, math, json, os, struct, hashlib
import numpy as np
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'assets/hero/source'
OUT = ROOT / 'artifacts/hero-turnaround'
SRC.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
asset = bpy.data.collections.new('Restorer_Asset')
scene.collection.children.link(asset)
studio = bpy.data.collections.new('Neutral_Studio_REVIEW_ONLY')
scene.collection.children.link(studio)

# Original painted sixteen-cell atlas. Each panel has deliberate stitching,
# broad pigment variation, worn edges and a material-specific microstructure.
SIZE=1024
TILES = {'jacket':0,'sleeve':1,'pants':2,'cap':3,'skin':4,'leather':5,
         'glove':6,'brass':7,'hair':8,'sole':9,'trim':10,'eye':11,
         'brim':12,'ivory':13,'mouth':14,'steel':15}
COLORS = [(41,113,110),(43,118,113),(52,61,65),(204,180,127),
          (181,119,84),(113,66,39),(176,142,92),(185,135,66),
          (58,39,30),(48,41,34),(24,78,79),(33,29,26),
          (180,150,96),(223,217,190),(118,63,47),(138,153,151)]
yy,xx=np.mgrid[0:256,0:256].astype(np.float32)
u=(xx+.5)/256; v=(yy+.5)/256
rng=np.random.default_rng(2308)
pixels=np.ones((SIZE,SIZE,4),np.float32)
orm=np.ones((SIZE,SIZE,4),np.float32)
for tile,base in enumerate(COLORS):
    noise=rng.normal(0,.65,(256,256))
    broad=(np.sin(u*11+v*5)+.55*np.sin(v*23-u*7))
    fabric=tile in (0,1,2,3,6,10,12,13)
    weave=(np.cos(xx*math.pi)*np.sin(yy*math.pi/2)+np.sin(xx*math.pi/2)*np.cos(yy*math.pi))*.8
    c=np.array(base)[None,None,:]+(broad*2.4+noise+weave*int(fabric))[...,None]
    seams=np.zeros_like(u)
    wear=np.zeros_like(u)
    if tile in (0,1,2,3,6,10,12):
        # Curved tailored panel seams, twin needle runs and interrupted stitches.
        positions=[.02,.98,.25,.75] if tile==0 else [.025,.975,.5]
        for pos in positions:
            curve=pos+(.009*np.sin(v*7) if tile in (1,2,3) else 0)
            d=abs(u-curve)
            seams+=np.exp(-(d/.0045)**2)*13
            stitch=np.exp(-((d-.009)/.0018)**2)*(np.sin(v*256*.95)>0)*7
            c+=stitch[...,None]
            wear+=np.exp(-(d/.024)**2)*3
        for pos in (.055,.93):
            d=abs(v-pos)
            seams+=np.exp(-(d/.006)**2)*12
            c+=(np.exp(-((d-.011)/.0025)**2)*(np.sin(u*250)>.2)*9)[...,None]
        # Sun bleaching at shoulder/top, brushed cuffs/seat at bottom.
        wear+=4*np.exp(-((v-.88)/.14)**2)*(1+.25*np.sin(u*19))
        c+=(wear-seams)[...,None]
    if tile in (5,9):
        pores=1.5*np.sin(xx*.46+np.sin(yy*.13))*np.sin(yy*.82)
        polish=7*np.exp(-((u-.25)/.16)**2)*np.exp(-((v-.60)/.35)**2)
        c+=(pores+polish)[...,None]
        for pos in (.06,.94):
            d=abs(u-pos)
            c-=np.exp(-(d/.007)**2)[...,None]*15
            c+=(np.exp(-((d-.012)/.0025)**2)*(np.sin(v*170)>0)*16)[...,None]
        scratches=(np.sin(u*124+v*21)>.986)*np.exp(-((v-.18)/.08)**2)*10
        c+=scratches[...,None]
    if tile==4:
        c+=(2*np.sin(u*7)*np.sin(v*5))[...,None]
    if tile in (7,15):
        c+=(np.sin(xx*.58)*1.5+4*np.sin(u*9))[...,None]
        c-=((np.sin(u*73+v*31)>.991)*8)[...,None]
    if tile==8: c+=(np.sin(u*180+v*17)*2.5)[...,None]
    x0=(tile%4)*256; y0=(tile//4)*256
    pixels[y0:y0+256,x0:x0+256,:3]=np.clip(c/255,0,1)
    rough=.87 if fabric else (.56 if tile==5 else .68)
    if tile==4: rough=.72
    if tile in (7,15): rough=.38
    if tile==11: rough=.46
    orm[y0:y0+256,x0:x0+256,0]=np.clip(1-seams/90,.83,1)
    orm[y0:y0+256,x0:x0+256,1]=np.clip(rough+broad*.012+noise*.004,.2,.98)
    orm[y0:y0+256,x0:x0+256,2]=.75 if tile in (7,15) else 0

def save_image(name,arr,path,colorspace):
    im=bpy.data.images.new(name,width=SIZE,height=SIZE,alpha=True)
    im.colorspace_settings.name=colorspace
    im.pixels.foreach_set(arr.ravel())
    im.filepath_raw=str(path); im.file_format='PNG'; im.save(); im.pack()
    return im
albedo=save_image('Restorer_Albedo_1024',pixels,SRC/'restorer_albedo.png','sRGB')
packed=save_image('Restorer_ORM_1024',orm,SRC/'restorer_orm.png','Non-Color')
MATS={}
for label in ['Fabric','Cap','Skin','Leather','Glove','Metal','Hair']:
    mat=bpy.data.materials.new('Restorer_'+label)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes; links=mat.node_tree.links
    bs=nodes.get('Principled BSDF')
    bs.inputs['Specular IOR Level'].default_value=.3
    tex=nodes.new('ShaderNodeTexImage'); tex.image=albedo
    links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    rt=nodes.new('ShaderNodeTexImage'); rt.image=packed
    sep=nodes.new('ShaderNodeSeparateColor'); links.new(rt.outputs['Color'],sep.inputs[0])
    links.new(sep.outputs['Green'],bs.inputs['Roughness'])
    links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
    # Standard glTF occlusion hook; packed R/G/B remains one embedded image.
    group=bpy.data.node_groups.get('glTF Material Output')
    if not group:
        group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
        group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    occ=nodes.new('ShaderNodeGroup'); occ.node_tree=group
    links.new(sep.outputs['Red'],occ.inputs['Occlusion'])
    MATS[label]=mat

parts=[]
def atlas_uv(tile,uv):
    t=TILES[tile]
    return ((t%4+(0.018+uv[0]*.964))/4,(t//4+(0.018+uv[1]*.964))/4)

def mesh_obj(name,verts,faces,tile='jacket',material='Fabric',weights=None,uvs=None,cap=False):
    me=bpy.data.meshes.new(name+'_Mesh'); me.from_pydata(verts,[],faces); me.update()
    obj=bpy.data.objects.new(name,me); asset.objects.link(obj)
    me.materials.append(MATS[material])
    layer=me.uv_layers.new(name='Restorer_Atlas')
    for p in me.polygons:
        p.use_smooth=True
        for k,li in enumerate(p.loop_indices):
            vi=me.loops[li].vertex_index
            uv=uvs[p.index][k] if uvs else ((verts[vi][0]*2+.5)%1, (verts[vi][2]*1.4)%1)
            layer.data[li].uv=atlas_uv(tile,uv)
    if weights:
        for vi,w in enumerate(weights):
            for bn,val in w.items():
                if val>1e-6:
                    vg=obj.vertex_groups.get(bn) or obj.vertex_groups.new(name=bn)
                    vg.add([vi],val,'REPLACE')
    obj['original_authored']=True
    obj['atlas_region']=tile
    obj['cap_component']=cap
    parts.append(obj)
    return obj

def blend(z,points):
    if z<=points[0][0]: return {points[0][1]:1.0}
    if z>=points[-1][0]: return {points[-1][1]:1.0}
    for (a,ba),(b,bb) in zip(points,points[1:]):
        if a<=z<=b:
            t=(z-a)/(b-a)
            return {ba:1-t,bb:t} if ba!=bb else {ba:1.0}

def loft(name,rings,tile,material,wfun,n=16,cap=False):
    # rings are (z, rx, ry, cx, cy); analytic circumferential UVs avoid random islands.
    verts=[]; faces=[]; uvs=[]
    for z,rx,ry,cx,cy in rings:
        verts.extend([(cx+rx*math.cos(2*math.pi*i/n),cy+ry*math.sin(2*math.pi*i/n),z) for i in range(n)])
    for j in range(len(rings)-1):
        for i in range(n):
            ni=(i+1)%n
            faces.append((j*n+i,j*n+ni,(j+1)*n+ni,(j+1)*n+i))
            uvs.append([(i/n,j/(len(rings)-1)),((i+1)/n,j/(len(rings)-1)),((i+1)/n,(j+1)/(len(rings)-1)),(i/n,(j+1)/(len(rings)-1))])
    faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
    for ring in (0,len(rings)-1):
        inds=faces[-2] if ring==0 else faces[-1]
        uvs.append([(math.cos(2*math.pi*(k%n)/n)*.4+.5,math.sin(2*math.pi*(k%n)/n)*.4+.5) for k in inds])
    return mesh_obj(name,verts,faces,tile,material,[wfun(Vector(p)) for p in verts],uvs,cap)

body_weights=lambda p: blend(p.z,[(.84,'hips'),(.96,'spine'),(1.15,'chest'),(1.29,'chest')])
head_weights=lambda p:{'head':1.}

# Tailored torso and sleeves share their shoulder boundary vertices. No detached
# limb primitives and no boolean overlap at the shoulder or elbow.
N=16
rows=[(.83,.157,.108),(.86,.171,.116),(.91,.166,.119),(1.00,.177,.122),
      (1.105,.201,.127),(1.185,.219,.123),(1.255,.210,.106),(1.295,.090,.077)]
jv=[]; jf=[]; ju=[]
for z,rx,ry in rows:
    for i in range(N):
        a=2*math.pi*i/N
        jv.append((rx*math.cos(a),ry*math.sin(a),z))
for j in range(len(rows)-1):
    for i in range(N):
        if j in (4,5) and i in (15,0,7,8): continue
        jf.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
        ju.append([(i/N,j/7),((i+1)/N,j/7),((i+1)/N,(j+1)/7),(i/N,(j+1)/7)])
jf.extend([tuple(reversed(range(N))),tuple(7*N+i for i in range(N))])
ju.extend([[(.5,.03)]*N,[(.5,.96)]*N])
jw=[body_weights(Vector(p)) for p in jv]
for side,sgn in [('L',1),('R',-1)]:
    # Opening winding follows the torso's right/left side patch.
    boundary=[4*N+15,4*N,4*N+1,5*N+1,6*N+1,6*N,6*N+15,5*N+15]
    if sgn<0:
        boundary=[4*N+7,4*N+8,4*N+9,5*N+9,6*N+9,6*N+8,6*N+7,5*N+7]
    center=Vector((sgn*.206,0,1.1825))
    axis=Vector((sgn*.68,0,-.734)).normalized()
    ref=Vector((sgn*.734,0,.68)).normalized()
    # Project opening onto section basis to preserve ordering into the sleeve.
    angles=[]
    for vi in boundary:
        d=Vector(jv[vi])-center
        angles.append(math.atan2(d.y,d.dot(ref)))
        jw[vi]=blend(jv[vi][2],[(1.10,'chest'),(1.255,'upper_arm.'+side)])
    sleeve_rows=[(.260,1.165,.081,.088),(.303,1.127,.077,.080),(.351,1.079,.071,.074),
                 (.373,1.054,.069,.071),(.411,1.018,.061,.066),(.450,.979,.055,.059),
                 (.478,.950,.050,.052),(.489,.937,.050,.052)]
    previous=boundary
    for r,(cx,z,rx,ry) in enumerate(sleeve_rows):
        cur=[]
        for a in angles:
            p=Vector((sgn*cx,0,z))+ref*(rx*math.cos(a))+Vector((0,ry*math.sin(a),0))
            cur.append(len(jv)); jv.append(tuple(p))
            w=blend(cx,[(.20,'upper_arm.'+side),(.325,'upper_arm.'+side),(.385,'forearm.'+side),(.46,'forearm.'+side),(.51,'hand.'+side)])
            jw.append(w)
        for i in range(8):
            k=(i+1)%8
            f=(previous[i],previous[k],cur[k],cur[i])
            # Left and right openings wind oppositely.
            if sgn>0: f=tuple(reversed(f))
            jf.append(f)
            ju.append([(i/8,r/8),((i+1)/8,r/8),((i+1)/8,(r+1)/8),(i/8,(r+1)/8)])
        previous=cur
    jf.append(tuple(previous if sgn>0 else reversed(previous)))
    ju.append([(.5,.5)]*8)
jacket=mesh_obj('Continuous_Jacket',jv,jf,'jacket','Fabric',jw,ju)
# Two Catmull-Clark steps produce gentle garment turns without a brick silhouette.
bpy.context.view_layer.objects.active=jacket; jacket.select_set(True)
sub=jacket.modifiers.new('Tailored surface refinement','SUBSURF'); sub.levels=1
bpy.ops.object.modifier_apply(modifier=sub.name)
jacket.select_set(False)

# Continuous trouser pelvis with shared crotch edge, splitting into two legs.
pv=[]; pf=[]; pu=[]; pw=[]
for z,rx,ry in [(.887,.150,.105),(.842,.162,.112),(.788,.161,.111),(.757,.158,.105)]:
    for i in range(16):
        a=2*math.pi*i/16
        zz=z-(.018*abs(math.sin(a)) if z==.757 else 0)
        pv.append((rx*math.cos(a),ry*math.sin(a),zz)); pw.append({'hips':1.})
for j in range(3):
    for i in range(16):
        pf.append((j*16+i,j*16+(i+1)%16,(j+1)*16+(i+1)%16,(j+1)*16+i))
        pu.append([(i/16,1-j*.1),((i+1)/16,1-j*.1),((i+1)/16,.9-j*.1),(i/16,.9-j*.1)])
pf.append(tuple(reversed(range(16)))); pu.append([(.5,.98)]*16)
crotch=len(pv); pv.append((0,0,.719)); pw.append({'hips':1.})
for side,sgn,start in [('L',1,12),('R',-1,4)]:
    prev=[48+(start+i)%16 for i in range(9)]+[crotch]
    theta=[-math.pi/2+i*math.pi/8 for i in range(9)]+[math.pi]
    if sgn<0: theta=[a+math.pi for a in theta]
    rows=[(.694,.086,.079,.088),(.612,.090,.078,.084),(.522,.091,.071,.078),
          (.469,.092,.070,.076),(.431,.092,.069,.074),(.365,.094,.063,.069),
          (.282,.096,.058,.062),(.206,.096,.056,.056),(.181,.096,.057,.056)]
    for j,(z,cx,rx,ry) in enumerate(rows):
        cur=[]
        for a in theta:
            p=(sgn*cx+rx*math.cos(a),ry*math.sin(a),z)
            cur.append(len(pv)); pv.append(p)
            pw.append(blend(z,[(.18,'leg.'+side),(.38,'leg.'+side),(.51,'upper_leg.'+side),(.69,'upper_leg.'+side),(.81,'hips')]))
        for i in range(10):
            k=(i+1)%10
            pf.append((prev[i],prev[k],cur[k],cur[i]))
            pu.append([(i/10,.82-j*.086),((i+1)/10,.82-j*.086),((i+1)/10,.734-j*.086),(i/10,.734-j*.086)])
        prev=cur
    pf.append(tuple(reversed(prev))); pu.append([(.5,.04)]*10)
pants=mesh_obj('Continuous_Trousers',pv,pf,'pants','Fabric',pw,pu)
bpy.context.view_layer.objects.active=pants; pants.select_set(True)
sub=pants.modifiers.new('Trouser softness','SUBSURF'); sub.levels=1
bpy.ops.object.modifier_apply(modifier=sub.name); pants.select_set(False)

# Organic head with chin, shaped jaw, cheeks and flattened face.
head=loft('Sculpted_Head',[(1.327,.050,.054,0,-.008),(1.343,.078,.071,0,-.012),
      (1.379,.103,.088,0,-.009),(1.423,.120,.099,0,-.005),(1.467,.125,.105,0,0),
      (1.517,.119,.103,0,.004),(1.564,.107,.091,0,.010),(1.598,.077,.066,0,.015),
      (1.617,.033,.028,0,.012)],'skin','Skin',head_weights,n=24)
bpy.context.view_layer.objects.active=head; head.select_set(True)
sub=head.modifiers.new('Face planes softened','SUBSURF'); sub.levels=1
bpy.ops.object.modifier_apply(modifier=sub.name); head.select_set(False)
loft('Neck',[(1.253,.061,.060,0,0),(1.288,.062,.061,0,0),(1.34,.065,.062,0,0),(1.377,.066,.062,0,0)],'skin','Skin',lambda p:blend(p.z,[(1.26,'chest'),(1.30,'neck'),(1.355,'head')]),n=16)

def sculpt_ellipsoid(name,center,radii,tile,mat,bone,n=12,m=6,cap=False):
    # Original latitude mesh, used only for coherent organic facial details.
    verts=[]; faces=[]; uv=[]
    for j in range(m+1):
        a=-math.pi/2+.05+(math.pi-.1)*j/m
        for i in range(n):
            b=2*math.pi*i/n
            verts.append((center[0]+radii[0]*math.cos(a)*math.cos(b),center[1]+radii[1]*math.cos(a)*math.sin(b),center[2]+radii[2]*math.sin(a)))
    for j in range(m):
        for i in range(n):
            faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
            uv.append([(i/n,j/m),((i+1)/n,j/m),((i+1)/n,(j+1)/m),(i/n,(j+1)/m)])
    faces.extend([tuple(reversed(range(n))),tuple(m*n+i for i in range(n))]); uv.extend([[ (.5,.5)]*n,[ (.5,.5)]*n])
    return mesh_obj(name,verts,faces,tile,mat,[{bone:1}]*len(verts),uv,cap)

for s in [-1,1]:
    sculpt_ellipsoid('Ear_'+str(s),(s*.119,.003,1.444),(.021,.024,.037),'skin','Skin','head',12,6)
    sculpt_ellipsoid('Inner_Ear_'+str(s),(s*.135,-.009,1.447),(.006,.016,.022),'mouth','Skin','head',8,4)
# Nose is a little wedge with rounded softened corners, not a floating sphere.
nv=[(-.017,-.095,1.485),(.017,-.095,1.485),(-.020,-.113,1.438),(.020,-.113,1.438),
    (-.015,-.137,1.442),(.015,-.137,1.442),(0,-.129,1.471),(0,-.096,1.436)]
nf=[(0,1,6),(0,6,4,2),(1,3,5,6),(4,6,5),(2,4,5,3,7),(0,2,7,3,1)]
nose=mesh_obj('Nose',nv,nf,'skin','Skin',[{'head':1}]*8)
bpy.context.view_layer.objects.active=nose; nose.select_set(True)
be=nose.modifiers.new('Soft nose edges','BEVEL'); be.width=.003; be.segments=2
bpy.ops.object.modifier_apply(modifier=be.name); nose.select_set(False)

def ribbon(name,points,width,tile,mat,bone,cap=False):
    verts=[]; faces=[]; uv=[]
    for p in points: verts.extend([(p[0],p[1],p[2]-width/2),(p[0],p[1]-.001,p[2]+width/2)])
    for i in range(len(points)-1):
        faces.append((2*i,2*i+2,2*i+3,2*i+1)); uv.append([(i/(len(points)-1),.3),((i+1)/(len(points)-1),.3),((i+1)/(len(points)-1),.7),(i/(len(points)-1),.7)])
    return mesh_obj(name,verts,faces,tile,mat,[{bone:1}]*len(verts),uv,cap)
for s in [-1,1]:
    # Fitted almond eyelids on the head surface; whites restrained at game scale.
    x=s*.046
    ev=[(x-.018,-.100,1.476),(x,-.108,1.484),(x+.018,-.097,1.476),(x,-.107,1.468)]
    mesh_obj('Almond_Eye_'+str(s),ev,[(0,1,2,3)],'eye','Skin',[{'head':1}]*4)
    ribbon('Brow_'+str(s),[(x-.022,-.093,1.501),(x,-.101,1.508),(x+.020,-.090,1.504)],.009,'hair','Hair','head')
    ribbon('Cheek_mark_'+str(s),[(s*.070,-.094,1.438),(s*.080,-.087,1.443)],.003,'mouth','Skin','head')
ribbon('Quiet_Smile',[(-.025,-.086,1.395),(-.013,-.094,1.390),(0,-.096,1.389),(.014,-.093,1.391),(.025,-.085,1.396)],.0035,'mouth','Skin','head')
loft('Nape_Hair',[(1.481,.121,.109,0,.014),(1.524,.122,.108,0,.012),(1.563,.109,.095,0,.012)],'hair','Hair',head_weights,n=24)
# Hide front hair faces to create a cropped nape/sideburn silhouette only.
hair=parts[-1]
import bmesh
bm=bmesh.new(); bm.from_mesh(hair.data)
remove=[f for f in bm.faces if f.calc_center_median().y<-.045]
bmesh.ops.delete(bm,geom=remove,context='FACES'); bm.to_mesh(hair.data); bm.free()

# Sand six-panel cap with a separately sculpted, thick curved brim.
loft('Cap_Crown',[(1.541,.128,.113,0,.008),(1.564,.131,.117,0,.008),(1.607,.119,.111,0,.012),
     (1.645,.087,.083,0,.014),(1.668,.046,.044,0,.014),(1.680,.006,.006,0,.014)],'cap','Cap',head_weights,n=24,cap=True)
loft('Cap_Band',[(1.539,.129,.114,0,.008),(1.549,.133,.118,0,.008),(1.560,.130,.116,0,.008)],'brim','Cap',head_weights,n=24,cap=True)
bv=[]; bf=[]; bu=[]
# Cross-section rows follow the forehead then sweep out in front, downward.
for depth in range(5):
    t=depth/4
    for i in range(17):
        a=-math.pi/2+math.pi*i/16
        x=.139*math.sin(a)*(1-.10*t)
        y=-.095-.157*t*math.cos(a)-.016*t
        z=1.550-.026*t+.009*abs(math.sin(a))-.009*t*t
        bv.append((x,y,z))
for j in range(4):
    for i in range(16):
        bf.append((j*17+i,j*17+i+1,(j+1)*17+i+1,(j+1)*17+i))
        bu.append([(i/16,j/4),((i+1)/16,j/4),((i+1)/16,(j+1)/4),(i/16,(j+1)/4)])
brim=mesh_obj('Cap_Curved_Brim',bv,bf,'brim','Cap',[{'head':1}]*len(bv),bu,True)
bpy.context.view_layer.objects.active=brim; brim.select_set(True)
sol=brim.modifiers.new('Brim cloth thickness','SOLIDIFY'); sol.thickness=.008; sol.offset=-1
bpy.ops.object.modifier_apply(modifier=sol.name); brim.select_set(False)

# Authored boot sections: broad toe box, heel and sculpted upper, both wider
# than trouser calves. Soles touch Z=0 in Blender / Y=0 in glTF.
footprint=[(.071,-.191),(.090,-.154),(.088,-.077),(.076,.032),(.058,.075),
           (0,.083),(-.058,.075),(-.076,.032),(-.088,-.077),(-.090,-.154),(-.071,-.191),(0,-.211)]
for side,sgn in [('L',1),('R',-1)]:
    cx=sgn*.096
    def boot(name,sections,tile,mat):
        vs=[]; fs=[]; us=[]; ws=[]; n=len(footprint)
        for z,scale,ankle in sections:
            for i,(x,y) in enumerate(footprint):
                ang=2*math.pi*i/n
                ax=.061*math.cos(ang); ay=.060*math.sin(ang)
                px=x*scale*(1-ankle)+ax*ankle
                py=y*scale*(1-ankle)+ay*ankle
                vs.append((cx+px,py,z))
                ws.append(blend(z,[(0,'foot.'+side),(.13,'foot.'+side),(.215,'leg.'+side)]))
        for j in range(len(sections)-1):
            for i in range(n):
                fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
                us.append([(i/n,j/(len(sections)-1)),((i+1)/n,j/(len(sections)-1)),((i+1)/n,(j+1)/(len(sections)-1)),(i/n,(j+1)/(len(sections)-1))])
        fs.extend([tuple(reversed(range(n))),tuple((len(sections)-1)*n+i for i in range(n))]); us.extend([[ (.5,.5)]*n,[ (.5,.5)]*n])
        ob=mesh_obj(name,vs,fs,tile,mat,ws,us)
        # Recalculate winding for the deliberately clockwise sole outline.
        bm=bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(ob.data); bm.free()
        return ob
    boot('Boot_Sole.'+side,[(0,.93,0),(.012,1,0),(.037,1,0),(.044,.97,0)],'sole','Leather')
    boot('Boot_Upper.'+side,[(.035,.97,0),(.065,.99,.04),(.106,.91,.15),(.145,.90,.64),(.191,1,1),(.227,1.10,1)],'leather','Leather')
    # Broad lace tongue and stitched heel tab reinforce leather reading.
    ribbon('Boot_Tongue.'+side,[(cx,-.151,.103),(cx,-.112,.128),(cx,-.072,.177),(cx,-.068,.210)],.035,'leather','Leather','foot.'+side)
    for k in range(3):
        z=.128+k*.018; y=-.109+k*.014
        ribbon('Lace.'+side+str(k),[(cx-.023,y,z),(cx+.023,y,z+.002)],.003,'ivory','Glove','foot.'+side)

# Gloved hands: palm, four tapering fingers and opposable thumb are fused using
# Blender voxel remesh, then reduced. No sphere mitts or parented final shapes.
def tube_between(name,points,radii,tile,mat,bone,n=8):
    vs=[]; fs=[]; us=[]
    axis=(Vector(points[-1])-Vector(points[0])).normalized()
    e=axis.cross(Vector((0,1,0))).normalized(); f=axis.cross(e).normalized()
    for j,(p,r) in enumerate(zip(points,radii)):
        for i in range(n):
            a=i*2*math.pi/n
            vs.append(tuple(Vector(p)+e*r[0]*math.cos(a)+f*r[1]*math.sin(a)))
    for j in range(len(points)-1):
        for i in range(n):
            fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
            us.append([(i/n,j/(len(points)-1)),((i+1)/n,j/(len(points)-1)),((i+1)/n,(j+1)/(len(points)-1)),(i/n,(j+1)/(len(points)-1))])
    fs.extend([tuple(reversed(range(n))),tuple((len(points)-1)*n+i for i in range(n))]); us.extend([[ (.5,.5)]*n,[ (.5,.5)]*n])
    return mesh_obj(name,vs,fs,tile,mat,[{bone:1}]*len(vs),us)
for side,sgn in [('L',1),('R',-1)]:
    local_parts=[]
    origin=Vector((sgn*.485,0,.944))
    along=Vector((sgn*.68,0,-.734)); wide=Vector((sgn*.734,0,.68)); depth=Vector((0,1,0))
    def hp(t,w,d=0): return tuple(origin+along*t+wide*w+depth*d)
    # Palm has an elongated flattened section, with a natural taper at wrist.
    palm=tube_between('Glove_Palm.'+side,[hp(-.008,0),hp(.021,0),hp(.064,0),hp(.091,0)],[(.038,.023),(.043,.024),(.043,.026),(.036,.021)],'glove','Glove','hand.'+side,n=12)
    local_parts.append(palm)
    for i,w in enumerate([-.029,-.010,.011,.030]):
        length=[.039,.055,.051,.037][i]
        finger=tube_between('Glove_Finger', [hp(.072,w),hp(.095,w),hp(.10+length*.5,w,-.002),hp(.087+length,w,-.009)],[(.010,.012),(.009,.010),(.008,.009),(.0045,.006)],'glove','Glove','hand.'+side,n=8)
        local_parts.append(finger)
    thumb=tube_between('Glove_Thumb',[hp(.026,-.028,-.002),hp(.050,-.052,-.012),hp(.077,-.056,-.018),hp(.084,-.047,-.021)],[(.016,.017),(.014,.015),(.011,.012),(.006,.007)],'glove','Glove','hand.'+side,n=10)
    local_parts.append(thumb)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in local_parts: ob.select_set(True)
    bpy.context.view_layer.objects.active=palm; bpy.ops.object.join()
    palm.name='Sculpted_Glove.'+side
    rem=palm.modifiers.new('Fused palm fingers thumb','REMESH'); rem.mode='VOXEL'; rem.voxel_size=.0038; rem.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=rem.name)
    sm=palm.modifiers.new('Glove contour relax','SMOOTH'); sm.factor=.65; sm.iterations=3
    bpy.ops.object.modifier_apply(modifier=sm.name)
    de=palm.modifiers.new('Hand silhouette budget','DECIMATE'); de.ratio=.16
    bpy.ops.object.modifier_apply(modifier=de.name)
    # Restore clean UVs and rigid hand ownership after remesh.
    palm.vertex_groups.clear(); vg=palm.vertex_groups.new(name='hand.'+side); vg.add(list(range(len(palm.data.vertices))),1,'REPLACE')
    if not palm.data.uv_layers: palm.data.uv_layers.new(name='Restorer_Atlas')
    for p in palm.data.polygons:
        for li in p.loop_indices:
            co=palm.data.vertices[palm.data.loops[li].vertex_index].co
            d=co-origin
            palm.data.uv_layers.active.data[li].uv=atlas_uv('glove',(.5+d.dot(wide)*8,.08+d.dot(along)*5))
    palm.select_set(False)
    # Cloth cuff overlaps the glove wrist while the jacket skin remains whole.
    tube_between('Cuff.'+side,[hp(-.017,0),hp(-.003,0),hp(.013,0)],[(.049,.048),(.048,.047),(.039,.028)],'trim','Fabric','forearm.'+side,n=12)

# Tailored jacket details are authored polygon patches following the torso.
def bevel_patch(name,verts,tile,mat,bone,thickness=.004,bevel=.003,cap=False):
    ob=mesh_obj(name,verts,[tuple(range(len(verts)))],tile,mat,[{bone:1}]*len(verts),[[((p[0]-min(v[0] for v in verts))/(max(v[0] for v in verts)-min(v[0] for v in verts)+1e-6),(p[2]-min(v[2] for v in verts))/(max(v[2] for v in verts)-min(v[2] for v in verts)+1e-6)) for p in verts]],cap)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True)
    so=ob.modifiers.new('Sewn thickness','SOLIDIFY'); so.thickness=thickness
    bpy.ops.object.modifier_apply(modifier=so.name)
    if bevel:
        be=ob.modifiers.new('Soft patch edge','BEVEL'); be.width=bevel; be.segments=2
        bpy.ops.object.modifier_apply(modifier=be.name)
    ob.select_set(False)
    return ob
for s in [-1,1]:
    x=s*.092
    bevel_patch('Chest_Pocket_'+str(s),[(x-.040,-.112,1.109),(x-.038,-.120,1.183),(x+.034,-.112,1.181),(x+.038,-.111,1.118),(x+.023,-.116,1.103)],'sleeve','Fabric','chest')
    bevel_patch('Pocket_Flap_'+str(s),[(x-.041,-.124,1.188),(x+.035,-.116,1.186),(x+.024,-.122,1.164),(x-.029,-.129,1.164)],'trim','Fabric','chest',.003,.002)
    bevel_patch('Collar_'+str(s),[(s*.017,-.084,1.294),(s*.073,-.086,1.300),(s*.104,-.092,1.257),(s*.047,-.123,1.228)],'trim','Fabric','chest',.005,.003)
    bevel_patch('Lower_Pocket_Welt_'+str(s),[(s*.063,-.118,.934),(s*.132,-.083,.967),(s*.138,-.091,.949),(s*.070,-.128,.921)],'trim','Fabric','spine',.003,.002)
ribbon('Jacket_Zip',[(0,-.117,.895),(0,-.127,1.00),(0,-.132,1.13),(0,-.109,1.255)],.013,'brass','Metal','chest')
# Zip weights follow the torso rather than rigidly moving its lower end.
zipper=parts[-1]
zipper.vertex_groups.clear()
for vi in zipper.data.vertices:
    for bn,w in body_weights(vi.co).items():
        vg=zipper.vertex_groups.get(bn) or zipper.vertex_groups.new(name=bn); vg.add([vi.index],w,'REPLACE')
loft('Belt',[(.851,.169,.119,0,0),(.877,.172,.120,0,0),(.888,.168,.116,0,0)],'leather','Leather',lambda p:{'hips':1},n=24)
bevel_patch('Buckle',[(-.024,-.127,.854),(.024,-.127,.854),(.025,-.127,.884),(-.025,-.127,.884)],'brass','Metal','hips',.006,.004)

# Pouch: six curved cross sections, tailored flap and brass fastener.
pouch=loft('Belt_Pouch',[(.701,.036,.032,.198,-.068),(.711,.055,.043,.198,-.069),
     (.760,.060,.049,.198,-.070),(.821,.058,.045,.195,-.068),(.849,.048,.039,.191,-.064)],'leather','Leather',lambda p:{'hips':1},n=12)
bevel_patch('Pouch_Flap',[(.145,-.112,.843),(.241,-.112,.843),(.239,-.121,.803),(.211,-.127,.787),(.171,-.127,.787),(.149,-.122,.803)],'leather','Leather','hips',.006,.004)
bevel_patch('Pouch_Clasp',[(.187,-.132,.799),(.206,-.132,.799),(.206,-.132,.818),(.187,-.132,.818)],'brass','Metal','hips',.006,.003)
tool=tube_between('Pouch_Tool_Shank',[(.220,-.035,.799),(.221,-.035,.880),(.224,-.035,.947)],[(.012,.009),(.012,.009),(.015,.010)],'steel','Metal','hips',n=8)
# Open jaw head gives the tucked tool a wrench silhouette at large views.
bevel_patch('Tool_Jaw',[(.205,-.035,.932),(.201,-.035,.963),(.209,-.035,.981),(.218,-.035,.982),(.217,-.035,.962),(.229,-.035,.956),(.240,-.035,.967),(.241,-.035,.983),(.251,-.035,.977),(.254,-.035,.958),(.243,-.035,.938)],'brass','Metal','hips',.018,.003)

# Ensure all final parts have outward normals. Then join into one skinned body
# and one removable skinned cap, retaining material slots for worker tinting.
for ob in list(asset.objects):
    if ob.type!='MESH': continue
    bm=bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(ob.data); bm.free()
finals=[]
for iscap,name in [(False,'Restorer_Body'),(True,'Restorer_Cap')]:
    bpy.ops.object.select_all(action='DESELECT')
    objs=[ob for ob in asset.objects if ob.type=='MESH' and bool(ob.get('cap_component',False))==iscap]
    for ob in objs: ob.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
    ob=bpy.context.object; ob.name=name; ob.data.name=name+'_AuthoredMesh'
    # Flat corners and smoothed authored facets. Apply triangulation once.
    tri=ob.modifiers.new('Final explicit triangles','TRIANGULATE'); tri.quad_method='BEAUTY'
    bpy.ops.object.modifier_apply(modifier=tri.name)
    if not iscap and len(ob.data.polygons)>6500:
        de=ob.modifiers.new('LOD0 silhouette budget','DECIMATE')
        de.ratio=6500/len(ob.data.polygons)
        bpy.ops.object.modifier_apply(modifier=de.name)
    finals.append(ob)
    ob.select_set(False)

# Humanoid bind A-pose. Names are explicit, with an optional non-deforming root.
armdata=bpy.data.armatures.new('Restorer_Humanoid')
rig=bpy.data.objects.new('Restorer_Rig',armdata); asset.objects.link(rig)
bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bone_specs=[('root',(0,0,0),(0,0,.20),None,False),
 ('hips',(0,0,.78),(0,0,.94),'root',True),('spine',(0,0,.94),(0,0,1.09),'hips',True),
 ('chest',(0,0,1.09),(0,0,1.26),'spine',True),('neck',(0,0,1.26),(0,0,1.36),'chest',True),
 ('head',(0,0,1.36),(0,0,1.63),'neck',True)]
for side,s in [('L',1),('R',-1)]:
    bone_specs += [('clavicle.'+side,(0,0,1.24),(s*.205,0,1.23),'chest',True),
     ('upper_arm.'+side,(s*.205,0,1.23),(s*.360,0,1.078),'clavicle.'+side,True),
     ('forearm.'+side,(s*.360,0,1.078),(s*.488,0,.940),'upper_arm.'+side,True),
     ('hand.'+side,(s*.488,0,.940),(s*.566,0,.856),'forearm.'+side,True),
     ('upper_leg.'+side,(s*.085,0,.780),(s*.092,0,.450),'hips',True),
     ('leg.'+side,(s*.092,0,.450),(s*.096,0,.170),'upper_leg.'+side,True),
     ('foot.'+side,(s*.096,0,.170),(s*.096,-.134,.065),'leg.'+side,True),
     ('toes.'+side,(s*.096,-.134,.065),(s*.096,-.210,.060),'foot.'+side,True)]
for name,h,t,parent,deform in bone_specs:
    b=armdata.edit_bones.new(name); b.head=h; b.tail=t; b.use_deform=deform
    if parent: b.parent=armdata.edit_bones[parent]
    b.use_connect=False
    # Blender bone +Y follows head->tail. Default roll documented, use bind
    # quaternions plus local deltas, never overwrite with assumed world angles.
    b.roll=0
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True; armdata.display_type='OCTAHEDRAL'
rig['front_convention']='Blender -Y forward; glTF +Z forward, +Y up'
rig['bind_pose']='A-pose, authored rest, no animation actions'
for ob in finals:
    # Normalize all exported vertex weights and reject unweighted vertices.
    missing=[]
    for vtx in ob.data.vertices:
        groups=[(g.group,g.weight) for g in vtx.groups if g.weight>1e-7]
        total=sum(w for _,w in groups)
        if not total: missing.append(vtx.index); continue
        for gi,w in groups: ob.vertex_groups[gi].add([vtx.index],w/total,'REPLACE')
    assert not missing,(ob.name,'UNWEIGHTED',missing[:10])
    mod=ob.modifiers.new('Humanoid skin','ARMATURE'); mod.object=rig
    ob.parent=rig
rig.select_set(False)

# Enforce requested 1.68 m height and ground precisely, including cap thickness.
maxz=max(v.co.z for ob in finals for v in ob.data.vertices)
minz=min(v.co.z for ob in finals for v in ob.data.vertices)
assert abs(maxz-1.68)<1e-5, maxz
assert abs(minz)<1e-6, minz

# Neutral studio is an independent collection, omitted from the GLB export.
def studio_link(ob):
    for co in list(ob.users_collection): co.objects.unlink(ob)
    studio.objects.link(ob)

bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002))
ground=bpy.context.object; ground.name='Studio_Ground_REVIEW_ONLY'; studio_link(ground)
gm=bpy.data.materials.new('Studio_WarmGrey'); gm.diffuse_color=(.24,.27,.28,1); gm.use_nodes=True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.24,.27,.28,1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.95; ground.data.materials.append(gm)
scene.world.color=(.18,.18,.18); scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.40,.45,.50,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
def area(name,pos,power,size,color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color
    ob=bpy.data.objects.new(name,data); studio.objects.link(ob); ob.location=pos
    ob.rotation_euler=(Vector((0,0,.85))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Studio_Key',(-3,-4,6),420,4,(1.0,.91,.78))
area('Studio_Fill',(3,-1,3),180,3,(.76,.88,1.))
area('Studio_Rim',(0,4,4),270,3,(1.,.95,.85))
camd=bpy.data.cameras.new('Review_Orthographic'); cam=bpy.data.objects.new('Review_Orthographic',camd); studio.objects.link(cam)
camd.type='ORTHO'; scene.camera=cam
scene.render.engine='CYCLES'; scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED'; scene.render.threads=8
scene.render.resolution_x=1920; scene.render.resolution_y=1080; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'; scene.render.image_settings.color_depth='8'
scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
scene.render.film_transparent=False

def camera_at(pos,target,vertical_span):
    cam.location=pos; cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    # Blender ortho_scale is horizontal width in landscape; game locks vertical.
    camd.ortho_scale=vertical_span*scene.render.resolution_x/scene.render.resolution_y
    camd.lens=50; camd.clip_start=.1; camd.clip_end=200

views=[('bind-a-pose',(2.6,-5.7,2.5),(0,0,.84),2.12),
       ('front',(0,-6,.84),(0,0,.84),2.05),
       ('side',(6,0,.84),(0,0,.84),2.05),
       ('back',(0,6,.84),(0,0,.84),2.05)]
yaw=math.radians(35); pitch=math.radians(52); distance=32
# glTF camera offset (+sin yaw,+sin pitch,+cos yaw) transforms to Blender
# (+X,-Y,+Z). Screen-right maps (cos yaw,sin yaw,0) in Blender.
offset=(distance*math.sin(yaw)*math.cos(pitch),-distance*math.cos(yaw)*math.cos(pitch),.85+distance*math.sin(pitch))
views.append(('locked-game-camera',offset,(0,0,.85),8.4))
views.append(('locked-angle-close',offset,(0,0,.85),2.12))

stats={'asset':'Original island restorer','publish':'LOCKED','gate':'Awaiting Orchestrator review',
       'bind_pose':'Authored rest A-pose','animations':0,'height_m':maxz-minz,
       'blender_front':'-Y','gltf_front':'+Z','gltf_up':'+Y','gltf_ground_y':0,
       'bones':len(bone_specs),'deforming_bones':sum(int(b[4]) for b in bone_specs),
       'textures':[{'name':im.name,'width':im.size[0],'height':im.size[1]} for im in [albedo,packed]],
       'mesh':[],'camera':{'yaw_deg':35,'downward_pitch_deg':52,'vertical_span_m':8.4,'distance_m':32,'target_height_m':.85},
       'renders':[]}
for ob in finals:
    me=ob.data; me.calc_loop_triangles()
    counts={'name':ob.name,'vertices':len(me.vertices),'triangles':len(me.loop_triangles),'uv_layers':len(me.uv_layers),'uv_loops':len(me.uv_layers.active.data),
            'materials':[m.name for m in me.materials],'unweighted_vertices':0,
            'max_influences':max(len([g for g in v.groups if g.weight>1e-5]) for v in me.vertices)}
    stats['mesh'].append(counts)
stats['total_triangles']=sum(m['triangles'] for m in stats['mesh'])
stats['total_vertices']=sum(m['vertices'] for m in stats['mesh'])
print('RESTORER_STATS',json.dumps(stats),flush=True)

# Export only rest rig and final skin. Embedded PNGs, no actions or studio.
bpy.ops.object.select_all(action='DESELECT')
for ob in finals+[rig]: ob.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/hero/restorer.glb'),export_format='GLB',use_selection=True,
                         export_animations=False,export_skins=True,export_yup=True,export_apply=False,
                         export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
bpy.ops.object.select_all(action='DESELECT')
camera_at(*views[0][1:])
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'restorer.blend'))

for name,pos,target,span in views:
    camera_at(pos,target,span)
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    stats['renders'].append({'path':'artifacts/hero-turnaround/'+name+'.png','resolution':[1920,1080],
        'source':'Native Blender Cycles studio render; no compositing or retouching','pose':'Rest A-pose','vertical_span_m':span})
    print('RENDER_SAVED',name,flush=True)

# GLB structural read-back validates payloads, skins, bones and texture packing.
glb_path=ROOT/'assets/hero/restorer.glb'
raw=glb_path.read_bytes(); magic,version,length=struct.unpack_from('<III',raw,0)
assert magic==0x46546C67 and version==2 and length==len(raw)
jl,jt=struct.unpack_from('<II',raw,12); doc=json.loads(raw[20:20+jl])
assert not doc.get('animations')
assert len(doc.get('skins',[]))>=1
assert len(doc.get('images',[]))==2
assert all('bufferView' in i and not i.get('uri') for i in doc['images'])
assert all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] and 'TEXCOORD_0' in p['attributes'] for m in doc['meshes'] for p in m['primitives'])
stats['glb']={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'version':version,
              'meshes':len(doc['meshes']),'skins':len(doc['skins']),'joint_counts':[len(s['joints']) for s in doc['skins']],
              'embedded_images':len(doc['images']),'animations':len(doc.get('animations',[])),
              'all_primitives_skinned_and_uv_mapped':True}
(SRC/'validation.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
(OUT/'manifest.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
print('RESTORER_COMPLETE',json.dumps(stats['glb']),flush=True)
