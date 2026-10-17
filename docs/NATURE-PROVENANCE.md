# Island nature adapter provenance

Publish: LOCKED. This bounded adapter uses explicitly authorized licensed reuse. It does not change the brief, plan, visual bar, reference images, ledger, renderer, level, dependencies, or game authority. No commit or staging was performed.

## Integration contract

Import both public factories from `src/render/environment/island-nature.ts`:

```ts
import { createIslandNature, createIslandSurfaceMaterials } from './environment/island-nature';

const nature = await createIslandNature(level);
scene.add(nature.group);
const surfaces = createIslandSurfaceMaterials();
// Assign surfaces.ground / wood / stone / water to the existing renderer meshes.
// Use metres-based UVs. Existing colours can still be set on these materials.

// Seconds; fraction supplied by the existing verified/practice restoration state.
nature.update(elapsedSeconds, restorationFraction, restoredSiteIds);

// On teardown:
nature.dispose();
surfaces.dispose();
```

`createIslandNature(level: LevelData)` returns `Promise<{ group: THREE.Group; update(time: number, restoration: number, restoredSiteIds?: ReadonlySet<string>): void; dispose(): void }>`; it does not add itself to a scene. Remove the previous renderer's tree instances during integration to avoid duplicate trees. The returned group owns its geometries, materials, maps, instance buffers, and shadow materials. Disposal is idempotent and detaches the group. `createIslandSurfaceMaterials()` returns independently owned `ground`, `wood`, `stone`, and `water` MeshStandardMaterials plus idempotent `dispose()`; its maps must stay alive while those materials or caller-created clones use them.

`update` accepts seconds and clamps finite restoration inputs to 0..1; nonfinite input becomes zero. Wind decreases monotonically from 0.85 at zero restoration to 0.50 at full restoration. This parameter never grants restoration, opens routes, changes collision, starts a timer, or submits a repair. The caller must supply existing verified/practice progress. There is no island-wide colour recovery.

Pass the same `ReadonlySet<string>` of genuine/practice restored IDs used to reveal the renderer's land triangles as the third argument every frame. Geometry on required land is prebuilt, initially hidden, and revealed only when that exact set contains all support requirements. Passing restoration fraction 1 without site IDs still leaves required batches hidden. Omitting the third argument uses the empty set: permanently available batches render, required batches hide. Readiness is not inferred from elapsed time or the fraction. No rebuild is needed when only restored IDs change; recreate the adapter only when the immutable level itself changes.

## Actual reused source

Source: [Paul Robello / SmallWorld](https://github.com/paulrobello/small-world), local checkout `C:/Users/leoki/.cache/fix-the-island-tools/reuse-research/small-world`.

Verified upstream HEAD: `0416bbcf7dbc58b2782f13698c74ac1dde459613`. License: MIT, Copyright (c) 2026 Paul Robello. The complete upstream permission and warranty notice is retained at `public/licenses/small-world-MIT.txt`; line endings are normalized to LF. Each adapted source file also retains the copyright, license identifier, revision, and notice location. No upstream instruction documents were copied.

| Upstream path / function | Destination / actual adaptation |
| --- | --- |
| `src/seed.js:11` / `mulberry32` | `small-world-detail.ts`: exact PRNG arithmetic, TypeScript annotations; scene ID seeds a private stream instead of replacing Math.random. |
| `src/pool.js:24` / `makePool` | `small-world-detail.ts`: retained get-or-create body; typed scene-local ownership, explicit resource disposal replacing regen/reset. |
| `src/util.js:163` / `buildLeafGeo` | `small-world-detail.ts`: original parametric positions, UVs, triangle indices, curl and rib formulas; 6×3 subdivisions, raised rib defaults. |
| `src/grass.js:119` / `makeGrassBladeGeometry` | `small-world-detail.ts`: original quadratic taper and `aTipFactor`; adapter merges two crossed copies and stretches another copy into reeds. No creature push or camera fade subsystem. |
| `src/flora/trees.js:65` / `leafballtree` trunk factory | `island-nature.ts`: retained bend, twist, ring/noise vertex shading; fitted 2.05m trunk with 0.16m base radius. |
| `src/flora/trees.js:65` / nested `orientLeaf`, `addLeafRing`, support branches | `island-nature.ts`: retained tangent/basis orientation and overlapping dome-ring placement; private RNG; 7 rings/110 leaf plates per crown, scene chunks, palette buckets replaced by per-instance colours. Five fitted branches. Outline duplicate draws omitted. |
| `src/flora/trees.js:369` / `snowpine` nested `makeBoughGeometry` | `small-world-detail.ts`: retained scalloped inner/outer/underside rings and indexing. Snow mask/tint removed; radial UVs and underside shading added. Adapter uses five staggered skirt tiers rather than stock cone geometry. |
| `src/util.js:19` / `jitterGeo` | `island-nature.ts`: retained weld-before-jitter technique and spherical UV formulas; geometry-private seeded stream, fitted small embedded stones. |
| `src/flora/_shared.js:184` / `applyLeafPlateWind` | `small-world-detail.ts`: retained phase, gust, flutter, anchored leaf-tip equations. Scene-local uniforms; reversed-edge smoothstep replaced with defined `1 - smoothstep(-0.42, -0.04, position.y)`. Same patch on colour/depth/distance passes. |
| `src/util.js:60` / `applyWindSway` | `small-world-detail.ts`: retained coherent world-space XZ motion and inverse instance-axis projection, quadratic root anchoring; scene-local uniforms and small grass/reed strengths. |
| `src/pbr.js:130,135,149` / `hashNoise`, `smoothHashNoise`, `detailNoise` | `surface-materials.ts`: original formula bodies, fixed texture-local seed; terrain detail affects textures only, never elevation. |
| `src/pbr.js:242` / `buildLeafballBarkTextures` ridge/grain formulas | `surface-materials.ts`: retained sine grain and bark ridge expressions. Typed scalar field, 128px DataTextures, fitted seed/sample coordinates, added albedo and finite-difference tangent normals. |
| `src/pbr.js:290` / `buildLeafballLeafTextures` edge/vein formulas | `surface-materials.ts`: retained edge falloff, central and secondary vein expressions; maps use the reduced scalar field and shared typed texture builder. |
| `src/pbr.js:527` / `rockDetailHeight` | `surface-materials.ts`: original domain warp, mottle, pore/crack and 1.55 detail-boost arithmetic. Normal/roughness/albedo derived locally. |

New adapter glue covers support/clearance, chunking, colours, property ownership, fitting, and diagnostics. Water ripple expressions and repeat-tile crossfading are local additions. There is no upstream state singleton, UI, music, creature game, world regeneration, camera controller, analytics, remote fetch, image, font, logo, or screenshot dependency. All maps are generated from code locally; none are external image assets.

## Upstream file hashes

These SHA-256 hashes describe the exact upstream checkout bytes read for adaptation, at the HEAD above:

| Source file | SHA-256 |
| --- | --- |
| `src/util.js` | `393889927d50ad21c5a406bfc10fa7cbd20f16ad75b6e0f9fb88dca6849b359c` |
| `src/flora/trees.js` | `8e73e7d36ce6fad04032ba4c7f568d551ea7e97907ab758814022a6759888490` |
| `src/flora/_shared.js` | `afa96b9cb9728d6b7cecd24b25024a10ecab938ad2d307812196ee15d704b712` |
| `src/grass.js` | `d3368a8cb84366834006f0649e758613bb9bf421bb1469bda098d847faa4dcf2` |
| `src/pbr.js` | `e76ee48c55278c40a8f545f3b40c6fd686710916b6758601cbffde509701cb81` |
| `src/seed.js` | `49d16e2acf6fcab22be4aa78c26d3257f99482431345e5f5eb6688756abdd4ac` |
| `src/pool.js` | `8124eb74b768a4c0456e92653eec99d6033136dac01cda876c364e7d71694f9c` |
| `LICENSE` | `853e0a7fbd2bb625489ec4c6809ee41322abe5875c8e4e36164420839ddb05a5` |

Included LF-normalized notice SHA-256: `1605cdfa94fa4cbe47338cf5d7db9769fe4e795992594667f27ec4fa31a0558a`.

No Kenney meshes, textures, or other binaries were selected, copied, or loaded. The optional Kenney CC0 pack therefore has no shipped-file hash list or redistributed notice in this change. The SmallWorld code excerpts supply the vegetation topology directly; no blind source vendoring was used.

## Placement, cost, and practical limits

Tree X/Z anchors come only from `level.trees`. The existing `sampleGround` supplies Y and support from `level.triangles`, in source order. An adapter-private set containing all triangle requirements is used only during placement to sample the physical underlying land, including currently hidden triangles. This set is never passed to gameplay/collision or exposed as approved state. Unsupported, submerged, steep, reserved, and out-of-bounds footprints are skipped. No terrain noise, invented support plane, collision, or path is generated.

Each centre and eight footprint support samples contribute their actual surface requirements. Trunks/crowns/branches inherit the root footprint requirements; every supporting prop additionally includes its own footprint requirements, and each grass/reed blade includes its separately sampled support. Batches are split by chunk, family, and the exact sorted requirement set, so a ready instance cannot reveal neighbours on closed land. Identical surface IDs conservatively union their requirements. `update` changes visibility only from the caller's site ID set. The primary remains responsible for displaying the same physical land and preserving collision/approval authority.

The adapter excludes `route:`, `join:`, `pad:`, `workshop-foundation:`, `bridge-`, `pier-apron`, and `landing` surfaces; non-tree obstacles, gates, and the spawn also have clearance. Whole crown clearance and conservative projected crown clearance at the existing WALK_CAMERA and INSPECT_CAMERA angles protect paths and site surfaces from foreground foliage. This intentionally leaves work pads empty. If the primary changes the reserved surface naming convention or camera presets, check these guards during integration. No camera or renderer is mutated.

Each supporting shrub, stone, tuft, and reed has its own sampled footprint and clearance check within about 2m of a supported tree. Every grass/reed blade is separately sampled. Reeds additionally use existing `level.banks` proximity on coastal ground. New trees are never scattered beyond the supplied slots. Small rocks are embedded, never used as invisible walking support.

Instances are grouped by 16m X/Z chunk and geometry/material family. Broadleaf and evergreen colours vary with warm coast/cool upland and leaf height. Trunks, branches, leaf plates, evergreen skirts and small stones cast shadows; grass/reeds do not. Leaf colour/depth/distance passes share deformation. Shader displacement is included in bounding volumes. Each material family uses three 128×128 maps with appropriate colour spaces and mipmaps. Rendering cost depends on visible chunks and caller lighting/postprocessing; phone frame time has not been measured by this bounded helper.

Read `nature.group.userData.natureStats` for prebuilt/skipped trees, grass/reeds/shrubs/rocks, batch/instance/triangle counts; `plantedTrees` includes prebuilt trees on required land. `nature.group.userData.visibleNatureBatches` is updated every frame. All meshes use `userData.category = 'foliage'`, with per-batch `natureKind`, frozen `requiredSiteIds`, and stable chunk names. This supports primary-owned picking/visibility diagnostics.

At the time of the initial runtime check, the then-current stage-B level supplied 103 slots and the adapter planted zero: all sampled locations were unsupported or reserved. The primary subsequently broadened shared land using `land:*` triangles. The adapter now supports prebuilding that physical land with per-site visibility, so initially required areas do not remain permanently empty after approval. Recreate the adapter after replacing immutable level data. This report does not claim renderer integration, captured visual parity, or a gate verdict.

The final current-level placement check against the broadened shared data supplied 96 slots: 60 trees prebuilt, 2 unsupported slots skipped, 34 crown/obstacle/corridor clearance conflicts skipped. It prebuilt 3,528 grass blades, 58 shrubs, 57 small stones, and no reeds in the current supported tree neighbourhoods. Total: 13,845 instances, 99 chunk/family/requirement batches, and 423,656 geometry triangles across the entire island before frustum culling. Initially 78 batches are visible; all 99 become visible when the caller supplies every actual triangle requirement ID. This diagnostic all-ID set was used only in the check, never stored as game progress. The reed family is available and exercised in the independent coastal-bank fixture; current-level reed placement depends on supported tree slots near coastal banks.

## Verification

`npm run typecheck` completed with exit 0 against the project and new files on Three.js 0.186.1. A temporary in-memory Node runtime check exercised an independently supported fixture: deterministic instances/colours, three supported slots and one unsupported rejection, evergreen/reed families, corridor rejection, normal/roughness/albedo maps, shader anchors on standard/depth/distance programs, nonfinite inputs, and exactly-once shared geometry/map disposal. No persisted tests or tool/config changes were made. Current-level placement statistics were also inspected as above.

A local in-memory HTTP harness and headless Chrome WebGL2 render exercised standard, directional depth-shadow, and point distance-shadow shaders with no browser/GLSL errors. Its supported fixture prebuilt 733 instances in 25 batches (22,922 geometry triangles); one 864×480 frame including shadow work reported 61 draws and 54,524 triangles. These fixture counts are not a phone frame-time benchmark. Compiled uniforms verified wind values 0.85, 0.675, and 0.50 at fractions 0, 0.5, and 1. The complete included MIT notice was compared with upstream after normalizing line endings/trailing whitespace and matched.

After the optional site-ID seam was added, a separate fixture split physical land into `site-a` and `site-b` requirements, including one tree whose footprint crosses both. It prebuilt three supported slots while all required batches remained hidden. Fraction 1 alone and unrelated IDs revealed none; supplying `site-a` revealed only batches requiring that ID, while mixed footprints stayed hidden until both IDs were supplied. Trunk Y matched sampled physical triangle Y=3 even with intentionally invalid slot Y=-999. Deterministic instance matrices/colours and unchanged input level data were checked again. No collision or authority module was edited.

Changed files are limited to the three new `src/render/environment/*.ts` files, the MIT notice, and this document. Integration and world/terrain changes remain with the primary builder.

## Primary integration after helper closure

The primary consumes the factory in boot preparation, before creating World. The adapter additionally returns an immutable `plantedTrees` position/required-ID result. `src/content/nature-layout.ts` reconciles this with the authored trunk footprints: rejected anchors have no invisible collider, and planted trunks inherit exactly the mesh's required site IDs. Renderer and World receive that one immutable result; the renderer never alters simulation geometry. This primary-owned integration adds conditional obstacle presence, not approval authority, and retains the existing 0.28m footprint, 0.22m step and 38-degree slope limits.

The renderer removes old cone instances and passes `new Set(snapshot.restoredSiteIds)` on every update. Ground/wood/stone/water use the returned map families; both shared terrain and extruded banks have metre UVs. The actual shared-land falloff in `src/content/coherent-land.ts` also adapts SmallWorld `src/terrain.js` smoothstep, retaining this same notice. No Kenney files have been integrated. Helper fixture results above remain isolated results, not current game performance or a visual decision.

The subsequent primary correction encodes all three tangent-normal components with the same signed remap `0.5*n+0.5`; upward height-field normals therefore have blue >=128. The prior Z-only `n.z*255` encoding was a real normal-map defect, not intentional shading. Construction wood now uses a local low-amplitude sawn-board field and normal scale 0.16, separate from the retained tree-bark family. All upstream copyright/permission notices are unchanged; no geometry, approval, route, collision or save authority changes accompany this material correction.
