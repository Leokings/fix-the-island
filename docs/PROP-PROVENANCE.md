# Supporting repair props

Prepared 2026-10-08. Publish: LOCKED. Isolated preparation for the existing eight-repair island, under the human's explicit licensed-reuse instruction. These are ordinary supporting assets, not the hero or main windmill. Integration, placement, socket/domain bindings, captures and gates remain with the primary. No existing source, dependency, level, authority, server or gate file was edited by this helper; nothing was committed or staged.

## Selected sources and retained notices

Both complete archive `License.txt` files were read. They identify the content as Creative Commons Zero (CC0) and permit personal, educational and commercial use; credit is encouraged but not required. The complete supplied notice text is retained below, with whitespace normalized (LF, indentation/blank-line cleanup). No source wording or links were removed. These files reproduce the notices supplied by Kenney, which link to the CC0 instrument.

| Pack | Official page | Local extracted source | Shipped notice |
| --- | --- | --- | --- |
| Survival Kit 2.0 | https://kenney.nl/assets/survival-kit | `C:/Users/leoki/.cache/fix-the-island-tools/asset-research/kenney-survival-2.0` | `public/licenses/kenney-survival-CC0.txt` |
| Factory Kit 3.0 | https://kenney.nl/assets/factory-kit | `C:/Users/leoki/.cache/fix-the-island-tools/asset-research/kenney-factory-3.0` | `public/licenses/kenney-factory-CC0.txt` |

The already-downloaded archives were hashed locally and match the primary's recorded source URLs/hashes:

| Archive/source URL | Local archive | SHA-256 |
| --- | --- | --- |
| https://kenney.nl/media/pages/assets/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip | `C:/Users/leoki/.cache/fix-the-island-tools/asset-research/kenney-survival-2.0.zip` | `c3586341b5932c87eb43d75d915434f47daed168b17ed36a03e8ca9977c7443e` |
| https://kenney.nl/media/pages/assets/factory-kit/edaac9d4f6-1777639602/kenney_factory-kit_3.0.zip | `C:/Users/leoki/.cache/fix-the-island-tools/asset-research/kenney-factory-3.0.zip` | `7e31fb2308e90304672bd15cd18fa9d9f02c03731a8cbc57a8e3e1c181dfb0a7` |

| License bytes | SHA-256 |
| --- | --- |
| Survival upstream `License.txt` | `62c8356876481204fa4d40dc59183dfed777adf987d7f2a1390fffe8a699f3ff` |
| Survival shipped whitespace-normalized notice | `24803a817362bf90ec92bb99c2ca5948e438178e28dd605ec9e8ad9886eccc81` |
| Factory upstream `License.txt` | `61e86565dd297e143ad631594980eda0a17fc81a4cd7c6d71acf2f5e0cad30b6` |
| Factory shipped whitespace-normalized notice | `799f3fd973f2decef3c01e0d42b7bd36805cd111555de0c15fb2111854c9545f` |

## Exact asset inventory

Every asset below is a byte-for-byte copy, verified against the extracted original. Source paths are relative to each pack's `Models/GLB format/`; destination paths retain the same suffix under `assets/props/kenney-survival/` or `assets/props/kenney-factory/`. Thus the table identifies both exact source and destination files. No source mesh, UV, material, animation or PNG bytes were edited.

| Pack | File suffix | Bytes | Source and copied SHA-256 |
| --- | --- | ---: | --- |
| Survival | `workbench.glb` | 26104 | `bf72d2d535fa29127e5078a6c4c2023a74fa5cd7d02d91ad550e897e088e1dc8` |
| Survival | `barrel.glb` | 34256 | `3a0d12f6bdd1badd361f64ce0fbbf878a4ccfc2de8ff1ac4ed4c1aea2a9ee04a` |
| Survival | `resource-planks.glb` | 8884 | `d3804257474a3baab7ac067be91de5c3d6d18d5803775dc876cb6d9442c30873` |
| Survival | `signpost.glb` | 5924 | `6d33757888c4ec9249610266ca8d60532b1138ae28fd37e93fa843ec4856fd25` |
| Survival | `tool-hammer.glb` | 6520 | `9b27f03c26dabd49a7ea358615e63fe65e1c3d0157887d4ee1ecdfa1f0e688f3` |
| Survival | `Textures/colormap.png` | 7440 | `6ca023be9f12e8c2358fcf94320c8a894b4c05a3dd0bad1f5c268312053caca1` |
| Factory | `machine.glb` | 25620 | `a39e3042bcb7789274428357383317d70e1c31906e5301c99e7d9e90ac584863` |
| Factory | `pipe-large-valve.glb` | 42604 | `57126374dce5b172e06d5d6f8cbaab97c9cffe3e5e726060eb14c50a5bd519b6` |
| Factory | `pipe-large-curve.glb` | 32156 | `5da8bbe6f74293df2cc57e743eeea0aee3e831531af1841aad0a49d47d1e1638` |
| Factory | `pipe-large-long.glb` | 27288 | `8e6650cc662695c28fffb1ffa10f190255f7d9c6c1d4a2a48d375e9bbb89b04f` |
| Factory | `lever-single.glb` | 17516 | `d7056a698ecb46c972d51848a77c8a9aca86f085cc5800347fce1c19c6c59477` |
| Factory | `piston-round.glb` | 37736 | `cd67c755d4ea6f53b5a5583447f45e9abb5d87f344d9f053820d1b09d719fcdd` |
| Factory | `hopper-round.glb` | 13700 | `8d4a49f1608b0cdb33d4506bed0ca0648df31437ae2b488a418fa15e5a65b278` |
| Factory | `Textures/colormap.png` | 11813 | `35d7bd6900dde0208429eeaec87fa17fbf024ed59f3f4eab54bc92802eba9dd7` |

Total: 12 GLBs and two palettes, 297,561 bytes before transfer compression. The workshop set provides a bench with its authored paper/hammer children, storage, plank stock, a sign and a separate handheld hammer. The machinery set provides a casing, valve/straight/elbow pipe segments, animated lever/piston and hopper. Alternate boxes, roofs, junctions and pack variants were omitted to keep this subset bounded. No stock scene, demo code or other pack files were copied.

## Measured dimensions and runtime modifications

Measurements use Three.js `Box3.setFromObject(scene, true)` on the parsed GLB, including child transforms and all positions in the default pose. Triples are X/Y/Z. Values below are rounded to six decimal places; they are render bounds, not collision shapes. Each instance has a uniformly scaled outer Group, with all source pivots, orientations and child transforms unchanged. No recentering, grounding offset or geometry rewrite occurs. The default Y minima are zero except `machine` (-4.106749e-10), `pipe-large-valve` (-9.023893e-16), and `pipe-large-curve` (-0.000239220). Those source offsets are retained, including the curve's asymmetric origin, so modular alignment is not silently altered.

| Kind / original filename stem | Source minimum | Source maximum | Uniform scale | Resulting X/Y/Z extent (metres) |
| --- | --- | --- | ---: | --- |
| `workbench` | (-0.147826, 0, -0.147826) | (0.177826, 0.286591, 0.147826) | 4 | (1.302610, 1.146363, 1.182610) |
| `barrel` | (-0.118250, 0, -0.118250) | (0.118250, 0.344000, 0.118250) | 2.5 | (0.591250, 0.860000, 0.591250) |
| `resource-planks` | (-0.186471, 0, -0.312977) | (0.186471, 0.093600, 0.312977) | 2 | (0.745882, 0.187200, 1.251908) |
| `signpost` | (-0.112277, 0, -0.018000) | (0.101845, 0.460080, 0.024978) | 3.5 | (0.749427, 1.610280, 0.150422) |
| `tool-hammer` | (-0.045000, 0, -0.020000) | (0.045000, 0.153480, 0.020000) | 2.5 | (0.225000, 0.383700, 0.100000) |
| `machine` | (-0.600000, 0, -0.750000) | (0.600000, 1.299752, 0.750000) | 1 | (1.200000, 1.299752, 1.500000) |
| `pipe-large-valve` | (-0.500000, 0, -0.515601) | (0.500000, 1, 0.500000) | 1 | (1, 1, 1.015601) |
| `pipe-large-curve` | (-1.002082, -0.000239, -0.746447) | (0.500000, 1, 0.500000) | 1 | (1.502082, 1.000239, 1.246447) |
| `pipe-large-long` | (-1, 0, -0.500000) | (1, 1, 0.500000) | 1 | (2, 1, 1) |
| `lever-single` | (-0.250000, 0, -0.170000) | (0.250000, 0.475000, 0.170000) | 1 | (0.500000, 0.475000, 0.340000) |
| `piston-round` | (-0.500000, 0, -0.500000) | (0.500000, 1, 0.500000) | 1 | (1, 1, 1) |
| `hopper-round` | (-0.559099, 0, -0.559099) | (0.559099, 1, 0.559099) | 1 | (1.118198, 1, 1.118198) |

The Survival adjustments produce a human-sized workshop surface (the bench child attachment plane at source Y=0.23655 becomes 0.9462m), a 0.86m barrel, a 1.25m plank bundle, a 1.61m sign and a 0.384m hammer. Factory already has metre-sized machinery and retains a common scale of 1 so its related pieces remain compatible. These are ordinary support components; their eventual framing and physical placement are primary-owned. The outer group's scale is already normalized: use a parent transform or multiply it if a later uniform size adjustment is needed.

All selected meshes are unskinned. The workbench's named `paper` and `hammer` children are preserved. The lever's `handle` and piston's `arm`/`top` tracks remain intact. Each animated kind exposes `toggle-on`, `toggle-off`, and `toggle` in `prop.animations`. Lever durations are 0.5/0.5/1 seconds; piston durations are approximately 0.2/0.2/0.5 seconds. Clips and track arrays are cloned per instance. Wrapper scaling applies to animated translation as well as static geometry. No mixer is started automatically.

Bounds change during animation. The sampled `toggle-on` endpoint has lever bounds (-0.315228, 0, -0.170000) to (0.250000, 0.374368, 0.170000); the piston endpoint is (-0.5, 0, -0.5) to (0.5, 2, 0.5). These endpoint measurements are not a full motion-envelope or clearance guarantee.

Materials retain the source palette, white base factor, metalness 0, default roughness 1 and double-sided rendering. No recolouring, shader patch, added map, shadow flag change or PBR conversion is applied. GLTFLoader retains sRGB colour-map handling and `flipY=false`. Survival uses nearest magnification / nearest-mipmap-nearest minification; Factory uses linear magnification / linear-mipmap-linear minification. Material objects are independent between instances; geometry and textures remain library-owned and shared by clones of the same source. Separate GLBs can retain separate texture objects even when they reference the same pack PNG; no cross-file texture deduplication is promised.

## Loader seam and ownership

`src/render/environment/repair-props.ts` exports `RepairPropKind`, `RepairPropLibrary` and:

```ts
loadRepairPropLibrary(): Promise<{
  create(kind: RepairPropKind): THREE.Group;
  release(prop: THREE.Group): void;
  dispose(): void;
}>;
```

All kinds are exactly the filename stems in the dimension table. Returned groups are detached, with `userData.repairPropKind` and their own `animations` array. Children retain authored names and pivots. The helper has no domain imports, state updates, approval inference, socket selection, collision generation, placement, picking, scene insertion or global singleton. Load one library per intended resource lifetime. Every explicit load returns a separate library; nothing is loaded merely by importing the module.

The caller may position groups and edit their cloned materials (for example colour/opacity) independently. Shared geometry and maps must remain read-only and must not be disposed by a per-mesh traversal. Keep the library alive until every instance and any additional caller-created references are finished. Avoid cloning a returned group with `Object3D.clone()` as a replacement for `library.create()`, since that would bypass material ownership. Caller-created replacements, geometry/texture clones, mixers and actions are caller-owned.

For optional motion, create `new THREE.AnimationMixer(prop)` and use a clip from that same `prop.animations`. Existing domain/socket state must choose when to play it. Stop actions and call `mixer.uncacheRoot(prop)` before release. `release(prop)` detaches the instance, clears children/animations and disposes only its tracked materials; it is idempotent and ignores foreign groups. `dispose()` releases all outstanding instances, source materials, shared geometries and textures once; subsequent `create()` throws. A disposed instance is invalid even if another reference still points to one of its former children. The helper never disposes materials/maps the caller introduced later.

The pack-specific LoadingManagers use TextureLoader for the known palette image, letting HTMLImage lifetime follow texture references without manually closing globally cached ImageBitmaps. Each load waits for all GLB promises to settle before either returning the library or cleaning up successfully parsed resources and rejecting. Image failures are explicitly rejected even when GLTFLoader would otherwise return a material with a missing map.

## Vite resource settlement

Every GLB and both PNGs are explicit source `?url` imports. The source folders preserve `Textures/colormap.png`, but that layout alone would not fix production: Vite copies GLB bytes opaquely and does not rewrite their internal image URIs. A separate LoadingManager for each pack maps its requested `Textures/colormap.png` to that pack's imported, deployment-base-aware PNG URL. Identical source filenames therefore resolve to distinct emitted palettes. All geometry buffers are embedded in the GLBs. No runtime asset depends on a public-folder copy, CDN, Kenney website or cache path; only the two notices live under `public/licenses/`.

The module is deliberately not imported by any existing game file. Its assets enter the application build only after the primary integrates this seam. The helper's separate in-memory build makes the module the entry point solely to verify its production asset graph.

## Actual verification and limits

- Archive SHA-256 values matched the provided records. All 14 copied assets matched their original source bytes. Both complete notice texts matched after whitespace normalization; source and shipped hashes are above.
- `npm run typecheck` ran and reported two TS18047 errors at `tests/unit/reuse.test.ts:19` (`data` possibly null). That existing file is outside scope and was not changed. This is not a project-wide typecheck pass.
- The final helper-only compiler invocation passed (exit 0): `node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --lib ES2022,DOM,DOM.Iterable --types vite/client,node src/render/environment/repair-props.ts`.
- Vite built the final helper as an isolated entry with `write:false`, `configFile:false`, `publicDir:false`, and nested base `/repair-props-check/`. All 12 emitted GLB URLs resolved in the in-memory output, as did both hashed PNG URLs. PNG bytes matched the expected pack-specific hashes through the actual manager mapping. No build directory or existing config was written.
- CPU-only checks used real GLTFLoader parsing, real TextureLoader material setup and AnimationMixer, substituting only emitted-file transport and image decoding. They created two instances of all 12 kinds, checked independent materials/clips/track arrays and animated transforms, retained workbench children, shared geometry/maps, source material/sampler settings, explicit release, detachment, create-after-dispose rejection, idempotent disposal, and rejection/cleanup after simulated image failures. The normal run disposed 65 distinct geometry/material/texture objects exactly once. These were ephemeral checks, not added tests.

No browser, GPU, image-rendering check, server restart, application integration, collision/clearance verification, full animation-envelope analysis, performance benchmark, capture or visual gate was performed. Image decoding and GPU upload remain unverified. The preparation makes no visual quality or gate claim. Game Builder's role separation informed this handback; the primary owns integration and all subsequent gates.

## Primary scenery extension — 2026-10-08

The primary integrated the earlier library and extended it with these eight unmodified GLBs from the same verified Survival Kit 2.0 archive above. Both original complete pack licenses were reread for this pass. Every new file was independently hashed against its cached source before integration. Source suffixes are relative to `Models/GLB format/`; shipped suffixes are identical under `assets/props/kenney-survival/`. They retain the Survival pack's own `Textures/colormap.png` resolver and the existing full CC0 notice. No additional download, custom island, hero, Blender export, source texture alteration or licensing change was involved.

| File | Bytes | SHA-256 | Uniform scale | Resulting X/Y/Z metres |
| --- | ---: | --- | ---: | --- |
| `tent-canvas.glb` | 16864 | `efc4bca46a22e4cc4fe391aeafba161c24bc39bfa75e192c57eaacaf686f9717` | 5 | 2.804 / 2.457 / 2.805 |
| `structure-canvas.glb` | 11276 | `f450f215599f8962b63737825c7d55d7be498742551ba21e5633d6459b194134` | 5.2 | 2.6 / 2.6 / 2.6 |
| `fence.glb` | 6428 | `5d8050e39c8b83b5835ea38b9b17429b4a03e289b566a1db771b7e1d9c6e4050` | 2 | 1 / 1.035 / 0.086 |
| `box.glb` | 14056 | `346eebd23986793b992ca6e05e9f98d6f5db96a9bfa3aa7c8360ac8b7920def8` | 2.4 | 0.6 / 0.6 / 0.6 |
| `box-large.glb` | 14072 | `69b4052f32b7b27e5d2ee27041b091a07d4a2dd4d877168a701607a97609f0f6` | 2.4 | 0.6 / 0.6 / 1.2 |
| `grass-large.glb` | 18848 | `68d23ba79b8b8c7a8fc5da6c4b688cce6d9a739720fbf9c3134e5388e91d6f07` | 2.2 | 1.047 / 0.313 / 1.072 |
| `patch-grass-large.glb` | 3508 | `458f467382babd3f0d075a8bef781119c8fead62f806366a274cbc0e7e65b3a1` | 1.8 | 2.52 / 0 / 2.16 |
| `tree-log-small.glb` | 9216 | `5b416addc4cb01d9d6ad30ec282606a8fefb018043d3253d5e42c1e353aab3c8` | 2.5 | 0.624 / 0.693 / 1.625 |

Runtime modifications are limited to uniformly scaled library wrappers, centered/grounded parent transforms, local yaw and alignment to sampled visible ground normals. Mesh/UV/texture bytes remain unchanged. Materials are per-instance clones with deliberately enabled cast/receive shadows, roughness 0.86 and environment response 0.45. The imported island's crown shader now makes a smaller deterministic view opening instead of a wide random pixel-discard halo; source island bytes are unchanged.

`src/content/imported-scenery.ts` authors bounded work-area candidates. `withImportedEquipment` accepts only supported, non-overlapping pieces that preserve public service stances. Rendering and collision share `createSceneryInstance`. Solid contact geometry is measured from actual transformed GLB components; tents/canopies use clipped individual faces to preserve doorway/post gaps and overhead headroom. Grass pockets have no collision. Specific storm-stock pieces disappear only when their real site enters the restored set; their measured colliders use the identical `blockedUntil` site condition. Local advisory tests and pending connected reviews do not perform cleanup.

The original eight site coordinates, imported terrain vertices, repair/catalog identifiers, save namespace, approval authority and UI are unchanged. The original helper-only verification above is historical; current build, unit, CPU zero-repair access and desktop/667 native comparisons are recorded separately in `artifacts/scenery-pass/2026-10-08-worksites/`. Those checks are implementation evidence, not a visual gate or connected-chain demonstration.
