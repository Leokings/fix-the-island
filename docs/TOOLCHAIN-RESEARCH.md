# Toolchain research and provenance

Research date: 2026-10-08. Publish: LOCKED.

The human supplied https://x.com/genex_games/status/2107148754633507237 as a development-workflow reference. Direct text retrieval of that post failed; its embedded video was not inspected. The official [Genex desktop page](https://genex.games/desktop) and [repository](https://github.com/genex-games/genex-desktop) were inspected instead. They describe browser Three.js projects, independent workers and visual judges, local Blender modelling/rigging/GLB export, and optional third-party asset services. The page lists macOS/Linux downloads and Windows as coming soon. Genex is a development harness, not GenLayer and not the game's runtime/backend. No Genex installation or paid asset service is necessary for this build.

## Three.js technical references

- [Official examples index](https://threejs.org/examples/) and [example inventory](https://github.com/mrdoob/three.js/blob/dev/examples/files.json).
- [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html): glTF 2.0 loading, scene/skin and animation clips; explicit addon import.
- [Animation system](https://threejs.org/manual/pages/animation-system.html) and [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html): time-based clip playback and action crossfades.
- [Walking example](https://threejs.org/examples/webgl_animation_walk.html) and [skinning/blending example](https://threejs.org/examples/webgl_animation_skinning_blending.html): technical references for articulated movement. Their demonstration character is not adopted as a game asset.
- [Ocean example](https://threejs.org/examples/webgl_shaders_ocean.html): water-rendering technical reference, not a background screenshot.
- [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) and [instancing example](https://threejs.org/examples/webgl_instancing_performance.html): repeated geometry with bounded draw calls for vegetation.

The official package registry reported `three` 0.186.1 and `genlayer-js` 1.1.8 on this date. Builder pins dependencies and validates actual installed APIs. Three.js is the rendering toolkit, not a blanket-licensed art catalogue; code and demonstration-asset licences must be checked separately.

## Asset and runtime options

- [Kenney Nature Kit](https://kenney.nl/assets/nature-kit): official page identifies CC0; optional environmental pack, not yet a declared shipped asset. The observed official download link https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip was retrieved to the task-specific asset-research cache. Archive SHA256: `fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d`. The included `License.txt` was read in full and confirms CC0. Adoption still requires actual filenames, consistent scale and modifications in the asset ledger. Flat pack materials do not replace the game's surface/material pass. No research file has been placed in public assets by the Orchestrator.
- Final hero: an original Blender-authored skinned GLB with its own source script and turnaround; no reference-derived character.
- Portable Blender 4.5.14 LTS downloaded from https://download.blender.org/release/Blender4.5/blender-4.5.14-windows-x64.zip into a task-specific local runtime cache, not system-installed. Archive SHA256 independently matched https://download.blender.org/release/Blender4.5/blender-4.5.14.sha256: `b9533d2397ac1984db4466fb23a7a4649391cca93f6e84209f9bcc60d071c8b9`. Executable reported 4.5.14 LTS, build 62c1db4208e8. No public game upload occurred.

Game rendering uses real terrain/objects, never any research screenshot as the map. Shipped-game references stay in `refs-locked/` solely for internal visual comparisons.
