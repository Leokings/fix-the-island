"""Original Headland Windmill. Run with Blender 4.5 in background mode.
All geometry and texture pixels are authored here; no external image inputs.
"""
import bpy, math, random, json, struct, sys
from pathlib import Path
from mathutils import Vector
import numpy as np

HERE = Path(__file__).resolve().parent
ASSET = HERE.parent
PROJECT = ASSET.parent.parent
OUT = PROJECT / 'artifacts' / 'windmill-turnaround'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(218)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)

# Blender Z-up, front -Y -> glTF Y-up, front +Z.
PALETTE = [(125,87,49),(196,178,140),(222,209,175),(64,126,119),
           (148,70,45),(177,161,130),(225,213,178),(145,112,59)]
KINDS = ['Oak','PaleTimber','Plaster','TealPaint','RussetShingle','Sandstone','Linen','Bronze']
N=1024
yy,xx=np.mgrid[0:N,0:N]
atlas=np.ones((N,N,4),dtype=np.float32)
rough=np.ones((N,N,4),dtype=np.float32)
normal=np.ones((N,N,4),dtype=np.float32)
normal[:,:,:3]=(0.5,0.5,1)
for k, rgb in enumerate(PALETTE):
    cx,cy=k%4,k//4
    X=xx[:512,:256]/256; Y=yy[:512,:256]/512
    rng=np.random.default_rng(91+k)
    noise=rng.normal(0,1,X.shape)
    broad=np.sin(X*17+np.sin(Y*9))*np.sin(Y*13+X*6)
    grain=np.sin(X*170+3*np.sin(Y*7)+np.sin(X*24+Y*14))
    pores=np.maximum(0,np.sin(X*270+Y*3)-.92)
    if k in [0,1,3,4]:
        detail=grain*4+np.sin(X*41+np.sin(Y*8))*5+broad*5+noise*1.4-pores*27
        knots=np.exp(-((X-.38)**2*330+(Y-.47)**2*160))
        detail-=knots*15
        edge=np.maximum(0,.06-np.minimum(X,1-X))/.06
        if k==3: detail+=edge*24; detail+=np.maximum(0,broad-.45)*23
    elif k==6:
        detail=np.sin(X*800)*2+np.sin(Y*1500)*2+broad*3+noise*.8
        edge=np.maximum(0,.03-np.minimum(X,1-X))/.03
        detail-=edge*16
    elif k==7:
        detail=broad*10+noise*2
        edge=np.maximum(0,.08-np.minimum(X,1-X))/.08
        detail+=edge*22
    else: detail=broad*8+noise*2.4+np.sin(X*53+Y*32)*2
    col=np.clip((np.array(rgb)[None,None,:]+detail[:,:,None])/255,0,1)
    if k==7:
        patina=np.maximum(0,broad-.35)[:,:,None]
        col=col*(1-patina*.5)+np.array([.21,.43,.36])*patina*.5
    sl=np.s_[cy*512:(cy+1)*512,cx*256:(cx+1)*256]
    atlas[sl][:,:,:3]=col
    rbase=[.76,.81,.88,.73,.84,.9,.91,.48][k]
    rough[sl][:,:,:3]=np.clip(rbase+detail[:,:,None]*.002,.28,.97)
    dx=np.gradient(detail,axis=1)*.012; dy=np.gradient(detail,axis=0)*.012
    normal[sl][:,:,0]=np.clip(.5-dx,.25,.75)
    normal[sl][:,:,1]=np.clip(.5-dy,.25,.75)

def save_image(name, arr, colorspace):
    im=bpy.data.images.new(name,width=N,height=N,alpha=True)
    im.colorspace_settings.name=colorspace
    im.pixels.foreach_set(arr.ravel())
    im.filepath_raw=str(HERE/(name+'.png')); im.file_format='PNG'; im.save()
    return im
albedo=save_image('windmill_albedo_1024',atlas,'sRGB')
roughness=save_image('windmill_roughness_1024',rough,'Non-Color')
norm=save_image('windmill_normal_1024',normal,'Non-Color')
M=[]
for k,name in enumerate(KINDS):
    mat=bpy.data.materials.new(name); mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Metallic'].default_value=.72 if k==7 else 0
    p.inputs['Roughness'].default_value=.8
    a=mat.node_tree.nodes.new('ShaderNodeTexImage'); a.image=albedo
    r=mat.node_tree.nodes.new('ShaderNodeTexImage'); r.image=roughness
    n=mat.node_tree.nodes.new('ShaderNodeTexImage'); n.image=norm
    nm=mat.node_tree.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value=.5
    mat.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])
    mat.node_tree.links.new(r.outputs['Color'],p.inputs['Roughness'])
    mat.node_tree.links.new(n.outputs['Color'],nm.inputs['Color'])
    mat.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
    M.append(mat)

def empty(name,pos,parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    o.location=pos
    if parent: o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted()
    return o
root=empty('HeadlandWindmill',(0,0,0))
root['asset']='Original Headland Windmill'; root['units']='metres'; root['front_axis']='+Z in glTF'
root['publish']='LOCKED'; root['gate']='Main review required before binding'
groups={}
def group(name,pos=(0,0,0)):
    o=empty(name,pos); o.parent=root; groups[name]=o; return o
shell=group('TowerShell'); roof=group('ShingleRoof'); base=group('Foundation')
sails=group('SailRoot',(0,-1.65,3.30)); sails['rotation_axis']='local +Z glTF; front axis +Z glTF'
door=group('Door',(-.50,-1.365,.47)); damage=group('StormDamage')
housing=group('GroundHousing'); cover=group('GearCover',(.58,-1.87,1.16))
inp=group('InputGearRoot',(1.12,-1.895,1.20)); outp=group('OutputGearRoot',(1.65,-1.895,1.20))
inp['role']='cosmetic removable inspection gear; Builder supplies puzzle pieces'
outp['role']='cosmetic removable inspection gear; Builder supplies puzzle pieces'
cover['hinge_axis']='local +Y glTF'; door['hinge_axis']='local +Y glTF'
parts=[]
def mesh(name,verts,faces,mat,parent=shell,uvs=None):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    o.data.materials.append(M[mat]); parts.append(o)
    if parent: o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted()
    layer=me.uv_layers.new(name='AtlasUV')
    cx,cy=mat%4,mat//4
    for poly in me.polygons:
        axis=max(range(3),key=lambda i:abs(poly.normal[i]))
        axes=[i for i in range(3) if i!=axis]
        pts=[me.vertices[me.loops[i].vertex_index].co for i in poly.loop_indices]
        mn=[min(v[a] for v in pts) for a in axes]; mx=[max(v[a] for v in pts) for a in axes]
        for j,li in enumerate(poly.loop_indices):
            if uvs: u,v=uvs[poly.index][j]
            else:
                u=(pts[j][axes[0]]-mn[0])/max(.001,mx[0]-mn[0]); v=(pts[j][axes[1]]-mn[1])/max(.001,mx[1]-mn[1])
            layer.data[li].uv=((cx+.035+.93*u)/4,(cy+.025+.95*v)/2)
    return o

def bevel(o,width=.02):
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    m=o.modifiers.new('Hand eased edges','BEVEL'); m.width=width; m.segments=1
    m.affect='EDGES'
    bpy.ops.object.modifier_apply(modifier=m.name)
    o.select_set(False)
    # Existing face UVs interpolate correctly through the bevel.
    return o
def box(name,pos,size,mat,parent=shell,b=.015,rot=None):
    x,y,z=[s/2 for s in size]
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    o=mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,None)
    o.location=pos
    if rot: o.rotation_euler=rot
    if b: bevel(o,b)
    bpy.context.view_layer.update()
    o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted()
    return o
def beam(name,a,b,width,depth,mat,parent=shell,soft=.012):
    mid=(Vector(a)+Vector(b))*.5; d=Vector(b)-Vector(a)
    o=box(name,mid,(width,depth,d.length),mat,parent,soft)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def cylinder(name,pos,radius,depth,mat,parent=shell,axis=(0,0,1),segments=16,r2=None):
    r2=radius if r2 is None else r2
    verts=[(r*math.cos(i*2*math.pi/segments),r*math.sin(i*2*math.pi/segments),z) for r,z in [(radius,-depth/2),(r2,depth/2)] for i in range(segments)]
    faces=[tuple(reversed(range(segments))),tuple(range(segments,2*segments))]
    faces += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
    o=mesh(name,verts,faces,mat,None); o.location=pos
    o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    bpy.context.view_layer.update(); o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted(); return o

# Eight gently tapered wall bays, supported by individual stanchions.
angs=[math.pi/8+i*math.pi/4 for i in range(8)]
verts=[(r*math.cos(a),r*math.sin(a),z) for r,z in [(1.37,.30),(1.29,.8),(1.10,3.13)] for a in angs]
faces=[tuple(reversed(range(8)))]
faces += [(j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for j in range(2) for i in range(8)]
faces.append(tuple(range(16,24)))
mesh('Tapered lime plaster bays',verts,faces,2)
for i,a in enumerate(angs):
    x,y=1.28*math.cos(a),1.28*math.sin(a)
    box('Sandstone stanchion %02d'%i,(x,y,.23),(.48,.46,.46),5,base,.05,rot=(0,0,a))
    beam('Corner oak upright %02d'%i,(1.39*math.cos(a),1.39*math.sin(a),.42),(1.13*math.cos(a),1.13*math.sin(a),3.13),.13,.13,0)
    for j in range(7):
        a1=angs[i]; a2=angs[(i+1)%8]
        t=(j+.5)/7
        p=Vector((1.38*math.cos(a1),1.38*math.sin(a1),.65)).lerp(Vector((1.38*math.cos(a2),1.38*math.sin(a2),.65)),t)
        box('Vertical skirt board %02d %02d'%(i,j),p,(.12,.07,.68),1,shell,.01,rot=(0,0,a+math.pi/8))
    a1=angs[i]; a2=angs[(i+1)%8]
    for z,r,mat in [(.43,1.39,0),(.97,1.34,3),(2.90,1.16,3),(3.13,1.17,0)]:
        beam('Perimeter belt',(r*math.cos(a1),r*math.sin(a1),z),(r*math.cos(a2),r*math.sin(a2),z),.12,.1,mat)
    if i not in [4,5]:
        beam('Diagonal bay brace',(1.33*math.cos(a1),1.33*math.sin(a1),1.03),(1.14*math.cos(a2),1.14*math.sin(a2),2.87),.065,.055,1)

# Dark eave underside and a watertight roof core beneath 432 overlapping shingles.
cylinder('Roof underlay',(0,0,3.80),1.55,1.35,0,roof,segments=8,r2=.04)
for side in range(8):
    a=angs[side]; b=angs[(side+1)%8]
    for row in range(9):
        t0=row/9; t1=min(1,(row+1.30)/9)
        z0=3.10+1.43*t0; z1=3.10+1.43*t1
        r0=1.60*(1-t0)+.035; r1=1.60*(1-t1)+.035
        count=6
        for col in range(count):
            u0=col/count+.004; u1=(col+1)/count-.004
            va=Vector((math.cos(a),math.sin(a),0)); vb=Vector((math.cos(b),math.sin(b),0))
            p0=(va.lerp(vb,u0)*r0); p1=(va.lerp(vb,u1)*r0)
            p2=(va.lerp(vb,u1)*r1); p3=(va.lerp(vb,u0)*r1)
            jitter=random.uniform(-.006,.006)
            ps=[(p.x,p.y,z+jitter) for p,z in [(p0,z0+.03),(p1,z0+.03),(p2,z1+.03),(p3,z1+.03)]]
            ps+= [(x,y,z-.028) for x,y,z in ps]
            mesh('Overlapping shingle %d %d %d'%(side,row,col),ps,[(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)],4,roof)
    beam('Teal eave fascia',(1.61*math.cos(a),1.61*math.sin(a),3.10),(1.61*math.cos(b),1.61*math.sin(b),3.10),.12,.10,3,roof)
    beam('Roof hip cap',(1.61*math.cos(a),1.61*math.sin(a),3.16),(.055*math.cos(a),.055*math.sin(a),4.58),.065,.06,4,roof)
cylinder('Copper roof crown',(0,0,4.55),.10,.10,7,roof,segments=8,r2=.07)

# Front door, inset pane, iron-bronze hinge straps and three 18 cm steps.
for j in range(7):
    box('Door vertical plank %02d'%j,(-.445+j*.135,-1.305,1.17),(.129,.11,1.38),0,door,.014)
for z in [.68,1.59]:
    box('Door bronze strap',(-.08,-1.382,z),(.68,.026,.055),7,door,.009)
    for x in [-.36,.17]: cylinder('Door strap rivet',(x,-1.410,z),.018,.015,7,door,axis=(0,-1,0),segments=8)
for x in [-.56,.48]: box('Door teal jamb',(x,-1.31,1.17),(.10,.18,1.55),3)
box('Door lintel',(-.04,-1.29,1.96),(1.16,.20,.14),3)
cylinder('Door handle boss',(.30,-1.399,1.19),.044,.029,7,door,axis=(0,-1,0))
beam('Door pull',(.30,-1.438,1.13),(.30,-1.438,1.27),.024,.025,7,door)
for j in range(3):
    box('Entry sandstone riser %d'%j,(-.06,-1.52-.25*j,.09*(3-j)),(1.12,.49,.18*(3-j)),5,base,.025)

# Recessed windows on three faces with mullions, deep sills and a timber hood.
for wi,(theta,z) in enumerate([(0,2.12),(math.pi,2.08),(math.pi/2,2.0)]):
    n=Vector((math.cos(theta),math.sin(theta),0)); tangent=Vector((-n.y,n.x,0))
    centre=n*1.225+Vector((0,0,z))
    for offs,w,h,k in [(0,.65,.77,0),(.034,.53,.63,3)]:
        p=centre+n*offs; box('Window recess %d'%wi,p,(w,.08,h),k,shell,.018,rot=(0,0,theta+math.pi/2))
    for du in [-.16,.16]:
        p=centre+n*.08+tangent*du
        box('Muted glass pane',p,(.245,.025,.52),6,shell,.005,rot=(0,0,theta+math.pi/2))
    p=centre+n*.10; box('Window central mullion',p,(.04,.06,.59),3,shell,.006,rot=(0,0,theta+math.pi/2))
    for dz in [-.42,.43]:
        p=centre+Vector((0,0,dz))+n*.09
        box('Window sill and hood',p,(.80,.24,.10),1,shell,.02,rot=(0,0,theta+math.pi/2))

# Working sail assembly: pitch-built timber ladder frames and bowed linen panels.
# Entire authored blade is healthy; storm damage is a separate cosmetic group.
def sail_pt(radial,lateral,depth,angle):
    return (math.sin(angle)*radial+math.cos(angle)*lateral,-1.75+depth,3.30+math.cos(angle)*radial-math.sin(angle)*lateral)
for si in range(4):
    a=math.radians(22)+si*math.pi/2
    beam('Sail %d leading spar'%si,sail_pt(.18,-.08,0,a),sail_pt(2.50,-.08,0,a),.09,.09,0,sails)
    beam('Sail %d trailing spar'%si,sail_pt(.66,.33,.04,a),sail_pt(2.44,.58,.17,a),.06,.06,1,sails)
    for j in range(7):
        r=.67+j*.292
        w=.33+(r-.66)*.14
        beam('Sail ladder rib',sail_pt(r,-.10,0,a),sail_pt(r,w,.08,a),.035,.036,0,sails,soft=.005)
    for j in range(6):
        r0=.69+j*.292; r1=r0+.278
        w0=.33+(r0-.66)*.14; w1=.33+(r1-.66)*.14
        vs=[]
        for t in range(4):
            r=r0+(r1-r0)*t/3; w=w0+(w1-w0)*t/3
            for q in range(4):
                u=q/3; lateral=-.035+(w+.012)*u
                depth=.015+.17*u+.046*math.sin(u*math.pi)*math.sin(t/3*math.pi)
                vs.append(sail_pt(r,lateral,depth,a))
        fs=[(t*4+q,t*4+q+1,(t+1)*4+q+1,(t+1)*4+q) for t in range(3) for q in range(3)]
        # Two-sided linen surfaces in the exact main-reviewed mesh.
        mesh('Sail linen sewn panel',vs,fs+[tuple(reversed(f)) for f in fs],6,sails)
    for j in [0,2,4,6]:
        p=sail_pt(.67+j*.292,-.08,-.055,a)
        cylinder('Sail bronze peg',p,.023,.014,7,sails,axis=(0,-1,0),segments=8)
cylinder('Sail oak hub',(0,-1.78,3.30),.22,.25,0,sails,axis=(0,-1,0),segments=12)
cylinder('Sail bronze nose',(0,-1.93,3.30),.12,.07,7,sails,axis=(0,-1,0),segments=12,r2=.08)
for i in range(4):
    a=i*math.pi/2; cylinder('Hub anchor',(math.sin(a)*.155,-1.917,3.30+math.cos(a)*.155),.021,.022,7,sails,axis=(0,-1,0),segments=8)
cylinder('Fixed front bearing',(0,-1.46,3.30),.17,.25,7,shell,axis=(0,-1,0),segments=12)
beam('Drive support corbel',(-.28,-1.11,2.84),(0,-1.49,3.24),.14,.16,0)
beam('Drive support corbel',(.28,-1.11,2.84),(0,-1.49,3.24),.14,.16,0)

# Exposed but guarded descending drive and reachable inspection cabinet.
beam('Upper mechanical shaft',(0,-1.42,3.25),(.87,-1.42,3.25),.085,.085,7)
cylinder('Vertical transmission shaft',(.87,-1.45,2.25),.055,1.84,7,housing,segments=12)
for z in [1.48,2.42,3.16]:
    box('Shaft bearing block',(.87,-1.41,z),(.23,.23,.13),3,housing,.025)
    cylinder('Shaft bearing collar',(.87,-1.45,z),.087,.10,7,housing,segments=12)
for x in [.73,1.01]: beam('Transmission guard rail',(x,-1.53,1.44),(x,-1.53,3.14),.028,.035,3,housing,.006)
for z in [1.62,1.91,2.20,2.49,2.78,3.08]: box('Guard rung',(.87,-1.56,z),(.32,.025,.027),7,housing,.004)

# Open recessed housing; gear interfaces are fit detail only, no game ports/validator.
box('Drivebox sandstone foot',(1.21,-1.42,.17),(1.52,.92,.34),5,base,.045)
box('Drivebox back wall',(1.28,-1.36,1.13),(1.47,.15,.91),0,housing,.025)
for x in [.53,2.03]: box('Drivebox side cheeks',(x,-1.59,1.13),(.11,.53,.95),3,housing,.025)
for z in [.67,1.60]: box('Drivebox top and bottom',(1.28,-1.59,z),(1.61,.55,.10),3,housing,.018)
for x in [.65,1.90]:
    beam('Drivebox leg',(x,-1.61,.32),(x,-1.61,.68),.14,.14,0,housing)
    beam('Drivebox rear brace',(x,-1.30,.31),(x,-1.52,.64),.08,.07,1,housing)
for x,z in [(1.12,1.20),(1.65,1.20)]:
    cylinder('Gear mounting sleeve',(x,-1.66,z),.085,.32,7,housing,axis=(0,-1,0),segments=12)
    box('Gear bearing plate',(x,-1.46,z),(.23,.06,.27),3,housing,.02)

def gear(name,x,teeth,radius,parent):
    seg=teeth*4; vs=[]
    for y in [-1.86,-1.95]:
        for i in range(seg):
            a=2*math.pi*i/seg
            r=radius*(1 if i%4 in [1,2] else .86)
            vs.append((x+r*math.cos(a),y,1.20+r*math.sin(a)))
    # Annular front/rear rings with visible open hub spokes.
    inner=len(vs)
    for y in [-1.86,-1.95]:
        for i in range(seg):
            a=2*math.pi*i/seg; vs.append((x+radius*.64*math.cos(a),y,1.20+radius*.64*math.sin(a)))
    fs=[]
    for i in range(seg):
        j=(i+1)%seg
        fs += [(i,j,j+seg,i+seg),(i,inner+i,inner+j,j),(i+seg,j+seg,inner+j+seg,inner+i+seg),(inner+i,inner+i+seg,inner+j+seg,inner+j)]
    mesh(name,vs,fs,7,parent)
    for i in range(5):
        a=i*2*math.pi/5
        beam('Gear forged spoke',(x,-1.905,1.20),(x+radius*.67*math.cos(a),-1.905,1.20+radius*.67*math.sin(a)),.05,.085,7,parent,.006)
    cylinder('Gear oak boss',(x,-1.907,1.20),.095,.13,0,parent,axis=(0,-1,0),segments=12)
    cylinder('Gear square axle cap',(x,-1.98,1.20),.038,.045,7,parent,axis=(0,-1,0),segments=4)
gear('Inspection driver 24 teeth',1.12,24,.36,inp)
gear('Inspection driven 12 teeth',1.65,12,.185,outp)
cylinder('Generator coupling',(1.83,-1.65,.90),.105,.26,7,housing,axis=(1,0,0),segments=12)
box('Fixed generator body',(1.76,-1.51,.84),(.30,.28,.24),3,housing,.045)
for z in [.79,.84,.89]: box('Generator cooling rib',(1.78,-1.66,z),(.31,.03,.018),7,housing,.004)

# Cover rests closed as a sparse inspection grille; detachable as one node.
for x in [.60,1.98]: box('Guard cover side rail',(x,-2.01,1.16),(.042,.05,.77),3,cover,.008)
for z in [.78,1.55]: box('Guard cover horizontal rail',(1.29,-2.01,z),(1.42,.05,.045),3,cover,.008)
for j in range(7): box('Guard vertical grille',( .72+j*.19,-2.018,1.16),(.014,.026,.73),7,cover,.002)
for z in [.90,1.42]: cylinder('Guard hinge barrel',(.58,-2.01,z),.035,.12,7,cover,segments=12)
box('Guard latch',(1.94,-2.055,1.18),(.08,.035,.15),7,cover,.014)

# Fastener pattern and small readable joinery at structure seams.
for a in angs:
    for z in [.60,2.80]:
        r=1.40 if z<1 else 1.17
        cylinder('Structural bronze pin',(r*math.cos(a),r*math.sin(a),z),.028,.025,7,shell,axis=(math.cos(a),math.sin(a),0),segments=8)
# Cosmetic storm timbers are overlays, removable as a group; no destroyed blades.
beam('Storm sagged trim',(-1.08,-1.24,2.59),(-.70,-1.29,2.51),.058,.065,1,damage)
beam('Storm split trim',(-.69,-1.29,2.52),(-.43,-1.27,2.57),.056,.064,1,damage)
for i in range(4):
    beam('Storm dark fissure',(-.93+i*.055,-1.32,2.57),(-.89+i*.056,-1.327,2.53),.009,.012,0,damage,.001)

# Merge per parent/material: retain interactive nodes, reduce export draw count.
bpy.context.view_layer.update()
for parent in list(groups.values()):
    for mat in M:
        obs=[o for o in bpy.data.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs: o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        bpy.ops.object.join()
        o=bpy.context.object; o.name=parent.name+'_'+mat.name
        # Apply geometry transforms, then put local origin exactly at parent pivot.
        world=o.matrix_world.copy()
        o.data.transform(world)
        o.matrix_world.identity()
        o.data.transform(parent.matrix_world.inverted())
        o.parent=parent; o.matrix_parent_inverse.identity(); o.matrix_basis.identity()
        for poly in o.data.polygons: poly.use_smooth=False

scene=bpy.context.scene
asset_objects=[root]+list(groups.values())+[o for o in bpy.data.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in asset_objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ASSET/'headland-windmill.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')

# Audit GLB container/accessors independently of the Blender mesh totals.
meshes=[o for o in asset_objects if o.type=='MESH']
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
coords=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
bounds=[[min(v[i] for v in coords) for i in range(3)],[max(v[i] for v in coords) for i in range(3)]]
pivots={o.name:[round(o.matrix_world.translation.x,5),round(o.matrix_world.translation.z,5),round(-o.matrix_world.translation.y,5)] for o in groups.values()}
glb=(ASSET/'headland-windmill.glb').read_bytes()
magic,ver,length=struct.unpack('<4sII',glb[:12]); chunklen=struct.unpack('<I',glb[12:16])[0]
doc=json.loads(glb[20:20+chunklen])
glb_tri=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
checks={'magic':magic.decode(),'version':ver,'header_length_matches':length==len(glb),'animations':len(doc.get('animations',[])),
        'missing_uv_primitives':sum('TEXCOORD_0' not in p['attributes'] for m in doc['meshes'] for p in m['primitives']),
        'embedded_images':len(doc.get('images',[])),'external_uris':[x['uri'] for table in ['images','buffers'] for x in doc.get(table,[]) if 'uri' in x]}
report={'asset':'Original Headland Windmill','publish':'LOCKED','triangles_authored':tri,'triangles_glb':glb_tri,
        'mesh_objects':len(meshes),'glb_meshes':len(doc['meshes']),'glb_nodes':len(doc['nodes']),'materials':len(doc['materials']),
        'uv_layers':sorted(set(uv.name for o in meshes for uv in o.data.uv_layers)),
        'bounds_blender_z_up':bounds,'bounds_gltf_y_up':[[bounds[0][0],bounds[0][2],-bounds[1][1]],[bounds[1][0],bounds[1][2],-bounds[0][1]]],
        'pivots_gltf_metres':pivots,'glb_bytes':len(glb),'glb_checks':checks}
(HERE/'asset-metadata.json').write_text(json.dumps(report,indent=2))
print('ASSET_REPORT '+json.dumps(report),flush=True)
if '--export-only' in sys.argv:
    import hashlib
    actual=hashlib.sha256(glb).hexdigest()
    expected='7f35f2806560f0b01511e2e683fd5d717fdf3f3675c18077788f262ffe31552c'
    print('LOCKED_EXPORT_SHA256 '+actual,flush=True)
    print('MAIN_GATED_SHA_MATCH '+str(actual==expected),flush=True)
    print('EXPORT_COMPLETE',flush=True)
    sys.exit(0)

# Neutral studio only. Backdrop/light/cameras are excluded from the exported GLB.
scene.render.engine='CYCLES'; scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.render.resolution_x=1920; scene.render.resolution_y=1080; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(.28,.28,.28)
scene.view_settings.view_transform='AgX'
studio=bpy.data.materials.new('Studio neutral'); studio.diffuse_color=(.27,.28,.29,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015)); floor=bpy.context.object; floor.name='STUDIO_only'; floor.data.materials.append(studio)
def area(name,pos,power,size,target):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=pos
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Neutral studio key',(-4,-6,10),1600,6,(0,0,2))
area('Neutral studio fill',(6,1,6),1000,7,(0,0,2))
cd=bpy.data.cameras.new('IsolationCamera'); cam=bpy.data.objects.new('IsolationCamera',cd); bpy.context.collection.objects.link(cam); scene.camera=cam
cd.type='ORTHO'; cd.lens=50
def view(name,direction,target,vertical_span):
    cam.location=Vector(target)+Vector(direction).normalized()*32
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cd.ortho_scale=vertical_span*1920/1080
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('RENDERED '+name,flush=True)
    return {'path':str(OUT/(name+'.png')),'native':[1920,1080],'target_blender':target,'vertical_span_m':vertical_span}
manifest=[]
for name,direction in [('front',(0,-1,.10)),('side',(1,0,.10)),('back',(0,1,.10))]:
    manifest.append(view(name,direction,(0,-.15,2.70),7.0))
yaw=math.radians(35); pitch=math.radians(52)
# PLAN game camera offset (+sin yaw, +sin pitch, +cos yaw), mapped to Blender.
manifest.append(view('locked-yaw35-pitch52-span8p4',(math.sin(yaw)*math.cos(pitch),-math.cos(yaw)*math.cos(pitch),math.sin(pitch)),(0,-.10,2.55),8.4))
manifest.append(view('assembly-close',( .65,-1,.65),(1.25,-1.59,1.25),2.25))
(OUT/'manifest.json').write_text(json.dumps({'publish':'LOCKED','gate':'Main reviews these originals before Builder binding; no specialist verdict','studio':'neutral key/fill only, no world or foliage','views':manifest},indent=2))
for im in [albedo,roughness,norm]: im.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'headland-windmill.blend'))
print('DONE',flush=True)
