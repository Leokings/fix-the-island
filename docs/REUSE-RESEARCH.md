# Existing-source adaptation decision

2026-10-08. Publish: LOCKED.

The human requested an existing open-source Three.js foundation and reusable assets because the visible build remained a blockout after extensive custom traversal work. That request changes implementation strategy, not the repair loop, GenLayer approval boundary, locked references or Visual Bar. It explicitly permits licensed reuse; copied source must retain its notices and be disclosed. No borrowed project is evidence that this game has passed a gameplay or visual gate.

## Selected sources

| Source | Verified permission | Selected use | Exclusions |
| --- | --- | --- | --- |
| [Small World](https://github.com/paulrobello/small-world) | Root MIT license, copyright 2026 Paul Robello. Inspected local checkout `0416bbcf7dbc58b2782f13698c74ac1dde459613`. | Adapt selected procedural foliage, surface-detail, wind and environment techniques into scene-local modules. Its vanilla Three.js approach is compatible with the existing renderer. | Do not transplant its global app state, regeneration loop, camera, UI, logo, icons, analytics, screenshots or streamed music. No wholesale fork/rebrand. |
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | Downloaded Nature Kit 2.1 includes `License.txt`: Creative Commons Zero (CC0). Actual pack notice read in full. | Fit supporting nature meshes to human scale, shared terrain, palette, shadows and clearance. | Do not scatter props across walkways or treat the pack's default appearance as a final visual result. |

Small World's relevant source creates meshes and canvas detail textures rather than loading external model/texture files. The inspected environment modules contain no external asset loader or remote texture request. Its separate music module streams from an external host; that music is excluded because the repository license alone does not establish rights to the remotely hosted recordings.

MIT permits modification and redistribution subject to preserving its copyright and permission notice. The exact files/sections adapted, upstream commit, changes and shipped notice paths must be recorded by the Builder. Kenney inclusion must record the selected original filenames and hashes, copied pack notice and modifications. This document is a selection record, not a substitute for the shipped attribution inventory.

## Other investigated options

| Source | Finding | Decision |
| --- | --- | --- |
| [Island Survival](https://github.com/stateloop-connected/source-island-survival) | Root MIT license, copyright 2026 Alexander Angelov. Three.js/Rapier/TypeScript survival game. Its asset credits file is an unpopulated policy, not a complete provenance inventory. | Not selected: first-person survival/combat loop and broader physics rewrite are a poor fit for the existing third-person restoration game. Do not import its unknown asset collection. |
| [Bruno Simon Folio 2025](https://github.com/brunosimon/folio-2025) | MIT code, copyright 2025 Bruno Simon; vehicle-oriented interactive world. Separate music notice exists. | Not selected for the implementation foundation: tightly coupled driving/portfolio systems and extensive identity-specific content would expand the rewrite. Code license is not blanket permission for every third-party portfolio image or sound. |
| [Ecctrl](https://github.com/pmndrs/ecctrl) | MIT toolkit, copyright 2023–2026 Erdong Chen, for React Three Fiber and Rapier. | Reserve option if measured controller problems require it. Not adopting React and a new physics architecture simply to reuse a controller. |
| [Island Survival 3D](https://github.com/jojin1709/island-survival-3d-) | README explicitly reserves rights and forbids unauthorized reuse despite being public. | Excluded. Public visibility is not a reuse license. |

Primary sources checked: repository licenses, package/source files and official asset page. Small World's public demo was also opened in hardware Chrome at 1920×1080; local screenshots under `artifacts/reuse-research/` document the inspected source project, not Fix the Island or a visual verdict.

## Next visible checkpoint

Keep the existing immutable repair catalogs, distinct hands-on activities, saved drafts, local/connected separation and finalized matching-record approval checks. Preserve all in-flight traversal fixes and archived failure evidence.

Integrate the exact already-gated restorer and windmill assets, with grounded articulated locomotion and honest pending worker states. Replace the cone/capsule blockout presentation and broaden the actual island geography. Visible ground and walking must share vertices/support data; importing attractive scenery must not introduce invisible walls, false floors, route bypasses or disconnected background plates.

First verify boot, actual movement, inspection, phone framing and the current integrated scene. Then replay the full repair progression and resume independent gameplay/art checks. Imported assets can appear in this in-progress foundation checkpoint; this does not claim Stage C completion. Native captures of the delivered game, not source-project screenshots, are required for each later gate.

The original game layer must be identified separately from reused code/assets in any eventual hackathon submission. No eligibility or award guarantee is made here; applicable rules would need to be checked separately.

## Implementation checkpoint, 17:06 UTC

The bounded nature helper delivered three scene-local modules and the full MIT notice, then closed. [NATURE-PROVENANCE.md](NATURE-PROVENANCE.md) identifies the actual upstream excerpts and modifications. No Kenney binary was included; that pack remains a reserve option, not an implemented asset claim. The primary also adapted Small World's smoothstep falloff in shared land shaping, with an MIT source header.

The Orchestrator independently reproduced all eight upstream file hashes and the normalized shipped-notice hash. Generating the adapter against the broadened real level produced 60 prebuilt trees, 3,528 grass blades, 58 shrubs and 57 rocks in 99 batches; conditional batches require the caller's actual restored-site ID set before visibility. These are generation statistics, not GPU performance or visual parity.

The exact gated restorer and windmill GLB hashes remain unchanged. A native hardware-Chrome check observed the skinned hero's alternating leg poses, 3.29m of actual walking and pier inspection with no browser errors. The initial scene still had the previous cones/materials; nature integration is separate. Captures at this dirty-tree checkpoint retain their in-progress status: the preview's startup metadata predates the changes and does not satisfy an exact-commit gate.

The current game-unit suite passed 127 tests in eight files after a stale overhang test was replaced with a bounded shore fixture that still asserts centre support, unsupported foot and save recovery. None of these checks establishes the complete eight-site ending, current phone performance, live GenLayer consensus or an art verdict. Those remain required independent checks.

Human clarification retained: the windmill was an example. All eight distinct repair families remain in the product; it is not a single-machine game.

## Additional supporting assets, 8 October 2026

The official [Survival Kit](https://kenney.nl/assets/survival-kit) and [Factory Kit](https://kenney.nl/assets/factory-kit) pages identify their packs as CC0. Main downloaded the linked archives into the task cache and read each complete included `License.txt`; both allow personal, educational and commercial use. No payment or signup was involved.

| Pack | Exact archive | SHA-256 |
| --- | --- | --- |
| Survival Kit 2.0 | https://kenney.nl/media/pages/assets/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip | `c3586341b5932c87eb43d75d915434f47daed168b17ed36a03e8ca9977c7443e` |
| Factory Kit 3.0 | https://kenney.nl/media/pages/assets/factory-kit/edaac9d4f6-1777639602/kenney_factory-kit_3.0.zip | `7e31fb2308e90304672bd15cd18fa9d9f02c03731a8cbc57a8e3e1c181dfb0a7` |

The extracted sources are in `C:/Users/leoki/.cache/fix-the-island-tools/asset-research/kenney-survival-2.0` and `kenney-factory-3.0`. Useful candidates include a workbench, handheld hammer, signpost, barrels and plank stock from Survival, and pipes with valves, a machine casing, levers and pistons from Factory. Inspected GLBs are about 6–43KB apiece; some lever/piston files include toggle animations. This is an asset inventory, not a rendered craft or performance verdict.

Both packs use external `Textures/colormap.png` references, with different maps, so packaging must preserve or explicitly resolve those resources independently. Their source scales also differ. A bounded helper is preparing a curated library in new isolated files while the current eight-repair journey runs; it may not edit the frozen game, change repair rules, or claim integration. Actual selected file hashes, scales and shipped notices belong in `docs/PROP-PROVENANCE.md` on delivery. The already gated restorer and windmill remain unchanged.
