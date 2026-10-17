# Original island restorer

Publish: LOCKED. Turnaround gate awaits the Orchestrator's personal review of every native view. No visual verdict is assigned here. No game binding, animation, retarget, worker variant or other model is included.

## Files and native review views

- `restorer.glb`: self-contained glTF 2.0 skin, original mesh and embedded PNG textures.
- `source/restorer.blend`: editable authored mesh, UVs, weighted humanoid armature in its actual rest A-pose, packed original images and a separate neutral review studio collection.
- `source/build_restorer.py`: reproducible Blender authoring, atlas painting, export and native studio rendering source.
- `source/verify_restorer.py`: binary/accessor and fresh Blender import checks; retained-source garment connectivity check.
- `source/restorer_albedo.png`, `source/restorer_orm.png`: original painted 1024×1024 atlases.
- `source/validation.json`: export and native render manifest.
- `source/glb-readback.json`: independent numeric read-back, bounds, skin/UV counts and garment connectivity.
- `source/bone-bind.json`: exact exported glTF bone parent and local rest TRS, quaternion components ordered XYZW.
- `../../artifacts/hero-turnaround/`: `bind-a-pose.png`, `front.png`, `side.png`, `back.png`, `locked-game-camera.png`, `locked-angle-close.png`, and `manifest.json`.
- `../../artifacts/hero-turnaround/native-capture-checks.json`: all six native PNG dimensions, timestamps and SHA-256 hashes, plus the GLB and retained Blender source hashes.

All six PNGs are native 1920×1080 Blender studio captures of the delivered bind A-pose. They are not live-game evidence. Studio ground, key/fill/rim lights and camera are excluded from the GLB. No reference image was fetched, traced, projected, textured or used as generation input; no external or paid generation service was used.

## Mesh, skin and UV counts

| Mesh | Authored vertices | Triangles | UV layers | Triangle-corner UVs |
| --- | ---: | ---: | ---: | ---: |
| Restorer_Body | 3,381 | 6,498 | 1 | 19,494 |
| Restorer_Cap | 386 | 760 | 1 | 2,280 |
| Total | 3,767 | 7,258 | 1 per mesh | 21,774 |

GLB attribute splitting at UV seams, normals and materials gives 4,697 exported vertices with 4,697 TEXCOORD_0 entries. Seven material primitives share the same two embedded atlas images. Body and cap share one skin containing 22 bones (21 deform bones and optional root). Every vertex is weighted; maximum three nonzero influences, weight sum error below 0.000001. Animations: zero. LOD0 only.

The jacket torso and both sleeves are one continuous closed surface with shared shoulder topology. The trousers have a shared crotch/pelvis and two continuous legs. Their closed connectivity is checked in `glb-readback.json`. Gloves have a fused flattened palm, four shaped fingers and an opposable thumb. Boots have broad shaped toe boxes, ankles, raised leather uppers, laces and ground-contact soles. Tailored pockets, collar, belt, pouch, facial features and tucked wrench are skinned details. They are not bone-parented primitive objects. All final geometry is in the two skin meshes.

## Scale, orientation and camera

Units: metres. Height: 1.68 m. GLB world bounds are X -0.592918..0.592922, Y 0..1.67999995, Z -0.126..0.269890. Both soles meet glTF Y=0. Origin is the centre between grounded feet. The armature and mesh object scales are 1.

Blender: +Z up, -Y forward. Exported glTF: +Y up, +Z forward, +X toward the character's anatomical left. `.L` is the anatomical left. The face, brim, toes and jacket zipper all face +Z in the GLB. Rotate a cloned actor around +Y to match movement heading; do not add a compensating 180° mesh turn unless the consuming controller explicitly uses -Z forward.

Locked isolation camera: yaw 35°, downward pitch 52°, distance 32 m, vertical span 8.4 m, target feet + (0,0.85,0). Full native frame is 1920×1080. `locked-angle-close.png` preserves yaw/pitch but uses a 2.12 m vertical span for inspection; it is not the scale gate. The close orthographic front/side/back views use span 2.05 m. `bind-a-pose.png` is a slight front three-quarter studio view at span 2.12 m.

The vertical 1.68 m body axis projects to 132.98 px at the locked camera. The complete bind A-pose bounds, including spread hands, brim and boot depth, are 125.50×164.47 px. This exceeds the plan's approximate full-silhouette framing range in the bind pose; record it for the Orchestrator's review. The requested metre scale and camera span have been retained, and no walking pose is substituted before the gate.

## Bone remap and binding

| Controller semantic | Exported bone | Parent |
| --- | --- | --- |
| Optional actor root | root | Restorer_Rig object |
| Pelvis / hips | hips | root |
| Lower torso | spine | hips |
| Upper torso | chest | spine |
| Neck | neck | chest |
| Head | head | neck |
| Left / right shoulder | clavicle.L / clavicle.R | chest |
| Left / right upper arm | upper_arm.L / upper_arm.R | corresponding clavicle |
| Left / right forearm | forearm.L / forearm.R | corresponding upper_arm |
| Left / right hand | hand.L / hand.R | corresponding forearm |
| Left / right thigh | upper_leg.L / upper_leg.R | hips |
| Left / right shin / lower leg | leg.L / leg.R | corresponding upper_leg |
| Left / right ankle / foot | foot.L / foot.R | corresponding leg |
| Left / right toe | toes.L / toes.R | corresponding foot |

Bone +Y runs head-to-tail in Blender, roll zero in the authored rig. Exported local bind rotations are not all identity. Save each loaded bone's rest quaternion and compose pose deltas with that baseline; do not overwrite rest rotations with a controller's assumed Euler angles. Exact glTF bind TRS is retained in `source/bone-bind.json`. The A-pose has arms down about 46° from horizontal and relaxed straight legs. There are no finger bones or IK controls. Finger geometry follows the hand bone; the toe bones are present for the later controller, with the boots currently weighted mainly to feet and lower legs.

After the Orchestrator accepts the turnaround, Builder may remap the existing gait/repair controller to these names and validate grounded alternating strides on the same skin. No animation result is claimed before that gate.

## Materials and worker reuse

| Material | Atlas cells (4×4, bottom-left row first) | Intended later control |
| --- | --- | --- |
| Restorer_Fabric | jacket 0, sleeve 1, trousers 2, trim 10 | Fabric tint; whole-material tint also affects trousers |
| Restorer_Cap | crown 3, brim/band 12 | Independent cap tint; removable cap mesh for later helmet attachment |
| Restorer_Skin | skin 4, eyes 11, mouth/ear 14 | Skin and face stay independent of clothing tint |
| Restorer_Leather | leather 5, sole 9 | Boots, belt and pouch response |
| Restorer_Glove | glove 6, ivory/laces 13 | Work glove tint |
| Restorer_Metal | brass 7, steel 15 | Buckle, clasp, zipper and tucked tool accent |
| Restorer_Hair | hair 8 | Hair and brows |

Albedo is sRGB. ORM is linear: R occlusion, G roughness, B metalness. Fabric has painted twin seams, interrupted stitches, woven breakup and bleached panel wear. Leather has pores, stitched edges, rubbing and small scratches; skin, hair, sole and metal have distinct colour/roughness response. UVs stay within the atlas. Textures are embedded and packed in the Blender source. No normal map is required for this LOD.

For workers, clone the complete skinned hierarchy using a skeleton-aware clone and retain metre scale. Clone materials per worker when changing colour; keep atlas textures shared. `Restorer_Cap` is a separate head-weighted mesh that can later be hidden for a Builder-authored helmet. A jacket-only tint can use the atlas-cell mask rather than tinting `Restorer_Fabric` wholesale. The pouch and tucked wrench are fixed belt accents; future hand tools bind to `hand.L` or `hand.R`. No helmet, alternate tool model or worker variants are authored here.

## Reproduction and checks

Run `blender.exe --background --factory-startup --python assets/hero/source/build_restorer.py` from any directory using the portable Blender installation provided for this project. The script resolves the project from its own location. It writes only `assets/hero/` and `artifacts/hero-turnaround/`. Then run the same command with `verify_restorer.py`.

Checks cover GLB headers/chunks, finite attributes, valid indices/joints, normalized normals/weights, triangle budget, UV bounds, embedded textures, unit height/ground, no animations/studio nodes, fresh Blender import and connected closed clothing surfaces. Numeric validation does not grant a visual or locomotion gate. Gate ownership and Publish LOCKED remain with the Orchestrator.
