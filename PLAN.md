# Fix the Island — Stage A implementation plan

Publish: LOCKED. Planner deliverable, 2026-10-08; no implementation or gate decision is recorded here.
Authority: revised BRIEF.md, locked art/BAR.md, all six native reference PNGs, and docs/GENLAYER.md.
Scope: eight repair sites, one island, one authored human hero, one complete ending. No combat, survival clock, funds or NFTs.
The contract/adapter specialist owns Python, immutable fixtures and SDK integration; Builder owns game implementation.
Main owns process gates and the hero turnaround gate. Planner owns only this file, art/LOOK.md and art/LEDGER.md v0.

## Loop, pacing and initial damage

Explore → inspect a physical fault → assemble/configure parts → run an advisory test → explain the design → submit → await decision → restore.
GenLayer is the central design judge in connected play. Submitted evidence is the construction, never a client completion flag or claimed score.
Target 15–25 minutes of active play: introduction 1 minute, eight repairs about 1–2 minutes each, traversal/inspection 4–7 minutes, ending 1 minute.
Network review can extend elapsed time. Save and return remain available; no invented review duration or automatic approval timer.
Three independent coastal jobs are available immediately, letting players work elsewhere while submitted jobs remain pending.
Start with storm debris, jammed mechanisms, leaking pipes, a tilted pier, a broken bridge, dark lamps and muted vegetation.
Retain readable warm daylight and coherent shadows in the damaged state; chaos comes from visible faults, clutter, gusts and intermittent malfunction.
Each accepted repair changes its actual assembly, local water/light/motion, route availability and nearby vegetation. A badge alone is insufficient.
Discovery reveals a diagnosis and relevant parts tray. Components are supplied at each site; mistakes never consume irreplaceable stock.
Hints progress from visible symptom to graph/setting explanation after repeated failed tests. No one-click solve or automatic rationale submission.

## Camera candidate: lock at Stage B

Coordinates: metres; +X east, +Z south, +Y up. Hero height 1.68 m. Use true orthographic projection for the requested near-orthographic view.
Main candidate: yaw 35°, downward pitch 52°, camera-target distance 32 m; near 0.1 m, far 140 m.
Vertical span candidate 8.4 m; top/bottom ±4.2, horizontal bounds ±4.2 × viewport aspect. Native desktop capture is 1920×1080; Stage B has not locked this candidate.
Target is hero feet + (0, 0.85, 0); movement lookahead follows ground velocity, capped at 0.8 m, with 0.24 s smoothing.
Position follows with an exponential 0.14 s time constant. Rotation stays fixed; no orbit, free zoom or camera shake during ordinary walking.
Ground control basis: screen-right (0.819, 0, -0.574), screen-up (-0.574, 0, -0.819); normalize diagonal input.
Landscape phone keeps the same angle/span and adapts horizontal coverage. Keep repair affordances at least 44 CSS px and frame the hero/assembly within the protected regions below.
Repair inspection uses a live secondary view of the same assembly: yaw 35°, pitch 58°, span 5.8 m, target at the station's working surface.
Its canvas/inset replaces the minimap while editing; it does not introduce a second mesh or pretend a drawing is the repair.
Fade only foreground foliage obstructing the hero/selected socket; solid cliffs and buildings cannot disappear to imply walkable space.
Builder records both camera presets at Stage B after framing coast, bridge and upland. Subsequent art/captures use those recorded presets.

## Six composition targets and framing checks

Ranges below describe the full live viewport before HUD occlusion: W/H are screen width/height, area means visible scene coverage; counts are visible objects in that crop, not island totals.
The 1.68 m upright hero at pitch 52°/span 8.4 m projects to about 133 px at 1080p; target 130–155 px high and 55–110 px wide including clothing/tool silhouette, without changing body scale.
Use the same span/yaw/pitch for all six main views; author structure dimensions and local placement to these ranges. Site overview/inspection may offset the camera target to the recorded composition, never use free zoom or resize the actor.

| Pair / live scene | Hero feet anchor (%W,%H); height | Structure framing | Terrain, water and local foliage density |
| --- | --- | --- | --- |
| ref-01 / workshop junction | (46–56,60–70); 12–14.5%H | Workshop 28–38%W × 35–50%H, roof/wall/stairs all visible | Path/ledge ground 35–50% area; foliage 25–40%; 14–22 overlapping crowns across three depth layers, 3–5 cliff bands, 12–24 ground clusters and 8–12 structural props. |
| ref-02 / windmill interaction | (40–52,58–68); 12–14.5%H | Tower/back structure 25–38%W × 40–62%H; working assembly 15–24%W × 18–32%H | Terraced ground 30–45% area; foliage 20–35%; 8–14 crowns, 16–28 grass/shrub clusters, 2–3 bank levels and 6–10 equipment subparts around the working surface. |
| ref-03 / bridge crossing | (46–58,56–68); 12–14.5%H | Deck long axis 40–65%W, deck narrow width 8–12%W; both shoes/rails visible | Lower channel 25–35% area; exposed banks 25–40%, foliage 25–35%; 12–20 crowns split across both banks, 6–10 rocks and 12–20 ground clusters. |
| ref-04 / reedbed shore | (28–40,48–62); 12–14.5%H | Boardwalk/baffle group 12–24%W × 12–25%H, grounded bank edge visible | Patterned water 40–55% area, sand/mud banks 15–25%, foreground foliage 20–30%; 6–10 substantial crowns, 6–12 rocks, 16–28 reed clusters and 3–5 distinct shore bends. |
| ref-05 / cool upland context | (46–58,60–72); 12–14.5%H | Cabin/cistern shelter 28–40%W × 35–52%H; working valves remain distinct | Cool path/stone 25–40% area, foliage 25–40%; 10–16 substantial trees, 3–4 visible ledge bands and 10–18 small growth/rock groups; dialogue occupies clear space above/aside the actor. |
| ref-06 / pier workshop | (44–56,58–70); 12–14.5%H | Deck 35–55%W; canopy/workshop 28–42%W × 38–60%H; hoist/rails/planks distinct | Water 30–45% area, shore/stone 10–20%, foliage 8–18%; 4–8 crowns, 6–10 grounded shore rocks and 10–16 visible structural fittings/rack groups. |

Repair-open main views retain hero height ≥12%H, an unoccluded working assembly ≥15%W × 18%H, and at least two surrounding depth layers; the secondary view magnifies selected joints, not the only evidence of the physical site.
At 844×390 and 667×375, keep the hero about 47–56 and 45–54 CSS px high respectively; original equipment must still show separate input/protection/output subparts in the main view.
Before Stage B camera lock, record all six scenes with repair closed/open at the three specified viewport sizes; annotate bounding boxes, coverage and local counts in separate review evidence, never retouch game captures.
Compare full frames and equally blurred pairs against their matched refs; record any out-of-range framing, hidden working surface or missing local layers for correction before recording the presets. These checks do not replace or soften BAR criteria.

## Geography, height and routes

Island land envelope is approximately X/Z ±64 m inside a 192×192 m ocean area; sea surface Y=0.
Coast occupies Z≥18, Y=2–4; woodland Z=-24..18, Y=6–12; upland Z≤-24, Y=14–22. Join bands with explicit ramps.
Creek centreline runs (0,-32) → (0,4) → (12,16) → (26,24) → (58,28), widening into the eastern tidal outlet.
Bridge crosses the creek east/west at Z=-2, from X=-5 to +5, deck Y=6; bank paths terminate visibly at the broken deck.
Spawn is (-38,44,2), beside the pier workshop. A shore footpath already reaches the mainland so a pending first job cannot trap the player.

| Site ID — display name | Position (X,Z; Y) | Required approved sites | Physical consequence |
| --- | --- | --- | --- |
| `pier_hoist` — Landing Hoist | (-38,40; 2) | none | Levels pier gangway, lifts bridge-brace stock into its rack, opens west workshop shortcut. |
| `village_pump` — Spring Pump | (-18,22; 4) | none | Stops leaks, supplies the upland trunk, drains the bridge approach. |
| `tidal_sluice` — Reedbed Sluice | (30,38; 2) | none | Diverts damaging backflow, refills reed pools, exposes the tidal boardwalk. |
| `creek_bridge` — Splitbank Bridge | (0,-2; 6) | hoist, pump, sluice | Replaces/braces the deck and opens the woodland crossing. |
| `coast_windmill` — Headland Windmill | (40,-14; 9) | bridge | Restarts guarded generation on the eastern coastal bluff; powers woodland distribution. |
| `woodland_pathlight` — Fern Path Light | (18,-24; 12) | windmill | Lights/shields the shaded path and powers its maintenance gate latch. |
| `upland_waterworks` — Ridge Cistern | (-26,-34; 17) | bridge, pump | Filters/distributes water, restores habitat flow, drains the upper walkway and west return. |
| `ridge_beacon` — Lookout Beacon | (12,-52; 22) | pathlight, waterworks | Restores a shielded coastal signal and triggers the completed-island ending. |

The shorthand dependency names above resolve to the exact site IDs in this table; freeze those IDs in all eight contract fixtures.
R1: spawn → (-12,44;2) → (12,48;2) → sluice; 2.4 m shore path, always open, safely south of the creek.
R2: spawn → (-30,32;3) → pump; 2.2 m path with a short visible ramp.
R3: pump → (-12,12;5) → (-8,-2;6) → bridge west shoe; last approach remains flooded until pump/sluice approvals.
R4: bridge east shoe (8,-2;6) → (20,-8;8) → windmill; 2.0 m headland path beside a visible cliff edge.
R5: east shoe → (12,-18;10) → pathlight → (8,-38;18); 2.2 m switchback, maintenance gate opens only after pathlight approval.
R6: east shoe → (4,-20;11) → (-8,-30;14) → waterworks; a fixed stone crossing upstream of the creek's water channel keeps this branch independent.
R7: waterworks → (-36,-18;12) → (-38,0;7) → (-32,24;3) → pier; waterlogged west return dries only after waterworks approval.
R8: (8,-38;18) → (12,-46;20) → beacon; its overflow-covered section dries after waterworks, and its gate depends on pathlight.
Show each lock as its physical flood/gap/gate plus an actionable diagnosis. Allow inspection/drafting at visible sites without faking access through hazards.

## Traversal, collision and height

Keep an engine-independent walk-surface mesh with connected triangles, plus tagged bridge/ramp patches enabled by restoration state.
Ground queries return surface ID, interpolated Y, normal and biome; renderer terrain is generated from the same authoring data.
Controller footprint radius 0.28 m, height 1.68 m; walk 2.6 m/s, optional brisk walk 3.6 m/s; acceleration 14 m/s².
Sweep the footprint against obstacle polygons, slide along walls, and reject disconnected surfaces, water, slopes above 38° or steps above 0.22 m.
Use visible 0.18 m risers or ramps for larger height changes. No jumping, swimming, climbing or full rigid-body simulation is needed.
Trees collide at trunks, not full canopies; shrubs remain soft decoration. Buildings, bridge rails, major rocks and closed gates have matching silhouettes.
World geometry and clearance must support the full hero footprint; an open-looking path must not hide a collision wall.
Save the last valid dry standing surface. Recovery from corrupt/out-of-bounds position returns there with an explanation, preserving repair drafts.
Animations follow actual velocity and sampled ground height; foot placement/stance cannot be replaced by translating the entire body up and down.

## Construction envelope and eight repair specifications

Use exactly the existing `repair-v1` envelope from docs/GENLAYER.md; do not create a competing wire format for different puzzle families.
`RepairDraft` contains `siteId`, `artifact`, `rationale`; caller, nonce, digest and fixture version belong to preparation/receipt, not claimed client authority.
Each part has `id`, `optionId`, `slotId`, `orientationQuarterTurns` (0–3), `settingId`.
Configuration contains only `mountZoneId`, `outputModeId`, `routeId`; each is a fixture-owned enum. Numeric dial stops are catalog setting IDs.
Connections contain `channel` (`mechanical`, `electrical` or `water`) and directed `from/to` part+port IDs. Mechanical also covers structural joints.
Bounds: 8 KiB artifact JSON, 24 parts, 48 connections, allowed ASCII identifiers; rationale 40–800 Unicode scalars and ≤2 KiB UTF-8.
All ratings, costs, permissible sockets and setting values come from immutable fixtures. Browser tests visualize those facts but are advisory in connected mode.
Gesture grammar: select a tray part, drag/snap or select a socket, rotate in quarter turns, turn a detented handle, join compatible visible ports, run test.
Keyboard and touch provide equivalent select/place/rotate/connect/test actions; neither precision dragging nor fast timed input is mandatory.
Use visible water tracers, shaft direction, sag, amperage or light cones to explain failure; the repair stays attached to its real world equipment.

| Site / family | Bounded construction and initial fault | Deterministic fixture requirements / example solution | Rationale focus |
| --- | --- | --- | --- |
| `pier_hoist` / load balance | Install pulley, rope, guard and 2/3-unit counterweights; choose rail detents and crank the tilted boom. | Mechanical path crank→pulley→boom, anchored rope/guard; budget 16 material units; load moment 6, counterweight moment within 0.25. 3-unit weight at 1 m + 2-unit at 1.5 m balances it. | Explain balanced load, guard/access and why the work zone avoids shoreline nests. |
| `village_pump` / pressure and routing | Rotate pipe sleeves; connect intake screen, pump, relief and trunk; turn three valve handles. Initial bypass is closed and discharge restricted. | Water path includes screen and relief, no trunk bypass; budget 14. Catalog inlet 4 gives 12 units, bypass 1 drains 2, outlet 3 sends 6; pressure 12−2−6=4, accepted 3–5, trunk flow ≥6. | Explain relief versus delivery, maintenance access and preventing dirty overflow into the reedbed. |
| `tidal_sluice` / ecological flow | Place two deflecting baffles and a nursery gate; move obstruction into an onsite rack; test visible branch flow. | Source 8, nursery 2–3, creek remainder ≥5, erodible bank 0; budget 14. `bank_shield`/`creek_open`, nursery stop 3 gives 3/5/0. Graph must not isolate the nursery. | Explain nursery retention versus creek drainage and where removed debris safely goes. |
| `creek_bridge` / structural assembly | Snap deck segments into sockets, orient two diagonals, connect shoes/beam joints, tension the handrail; test a load trolley. | Budget 18; continuous deck/support graph, both bank shoes and bracing load path, rated capacity ≥8 fixed load units, rail clearance. Two opposing diagonals form the accepted truss. | Explain why the braces carry the load and preserve the channel without new riverbed supports. |
| `coast_windmill` / mechanical transmission | Fit driver/driven gears, generator coupling and guard; rotate gear placement and select a permitted mounting zone. | Preserve backend example: fixed shaft 60 rpm; 12/24/36-tooth options; output 100–140 rpm, guard and full shaft path; budget 16. Driver 24 / driven 12 gives 120 rpm. | Explain ratio, guarded maintenance access and bluff mounting versus nearby nesting habitat. |
| `woodland_pathlight` / protected power and beam | Seat fuse/regulator/lamp/shield; physically join insulated leads and adjust shade direction. | Preserve backend example: 12 V source, 6 W / 12 V lamp, 1 A fuse; full source→fuse→regulator→lamp→return, no shorts/bypass; budget 12. `path_edge`, `downshield`, `sleeved_route`. | Explain visibility versus nocturnal habitat, shield direction and protected cable access. |
| `upland_waterworks` / distribution | Connect cistern, filter, split valves, village/habitat outlets and overflow; set valve stops and observe both streams. | Preserve backend example: supply 6, village 4 + habitat 2, no filter bypass; budget 16, fixed pipe capacities/elevation rules. `filtered_split`, settings `village_4`/`habitat_2`. | Explain balanced allocation, filter maintenance and keeping habitat water during dry periods. |
| `ridge_beacon` / signal alignment | Seat protected power parts, rotate reflector/lens detents and fit a shield; trace the actual light sector. | Budget 14; protected electrical path plus mechanically seated lens/shield; `coastal_sector` setting, beam excludes fixed inland/nesting sectors, safe plinth mount. | Explain coastal signal coverage, glare control and safe maintenance after water/power restoration. |

These are bounded game systems, not real-world engineering certification. Catalog option/slot/port IDs are finalized by the contract specialist from this table.
Use fixed-stock alternatives rather than arbitrary part geometry; common slots `source`, `input`, `protection`, `output`, `guard` are site-scoped.
Do not hard-code one guessed layout as the sole answer if another construction satisfies the fixture's graph, capacity, safety and contextual requirements.
Rationale UI asks about the actual selected settings and site tradeoff. It shows fixture facts, accepts original text and never sends hidden approval instructions.

## Repair HUD bounds and state transitions

Rects are (x,y,width,height) in CSS px at the named viewport; use safe-area insets inside them. Protected scene regions contain the hero and working assembly, with no panels, tooltips or action rails crossing them.

| Viewport | Persistent mode/diagnosis | Repair inset and control dock | Protected main scene / rationale or feedback drawer |
| --- | --- | --- | --- |
| 1920×1080 | Mode (24,20,240,32); diagnosis (288,20,1092,64), at most two lines | Same-assembly inset (1392,612,504,444); parts/action dock (24,888,1344,168) | Clear (560,140,820,720); temporary text drawer (24,624,504,432), replacing the dock's left content. |
| 844×390 | Mode (8,8,220,24); diagnosis (236,8,600,48), at most two lines | Inset/mode tabs (8,64,196,240); dock (8,318,828,64) | Clear (220,64,460,240); text drawer replaces inset at (8,64,196,240), leaving the main assembly visible. |
| 667×375 | Mode (8,8,196,24); diagnosis (216,8,443,44), at most two lines | Inset/mode tabs (8,60,196,235); dock (8,303,651,64) | Clear (216,60,390,235); text drawer replaces inset at (8,60,196,235), leaving the main assembly visible. |

Exploration → Inspect: minimap folds away; diagnosis names the actual fault; camera target offset fits hero/assembly in the protected region at unchanged span/angle. Exit returns joystick/walking and the previous follow target.
Inspect → Construct: Parts/Configure/Connect are mutually exclusive tabs (44 px high, phone tabs about 65 px wide); only the active tab's content is shown, with designed cream/ink controls rather than a stacked form.
Parts: dock is a horizontally paged tray showing 3–6 large part choices, budget and the selected part label; tap part then a world/inset socket. Selected sockets have ≥44 px hit targets and a keyboard next/previous alternative.
Configure: reuse the dock for one selected part detent or one of mount/output/route at a time; Previous/Next exposes all three configuration fields. Rotate/setting controls remain reachable without expanding a settings list over the scene.
Connect: focus source port, then a compatible target; dock shows both endpoint labels and Join/Remove. Main/inset displays the actual path; a 44 px port selector resolves tightly packed sockets without precision dragging.
Test: a persistent dock action runs the advisory simulation; flow/load/light feedback occurs in the assembly plus a two-line diagnosis. Longer fault details replace the left drawer, never stack over the work surface.
Test → Rationale: retain the selected assembly, collapse the parts tray/inset as needed, and open the text drawer with two concise fixture-fact lines, a scrollable input, character count and Back/Review actions; body type ≥16 px phone / 20 px desktop.
On software keyboard opening, retain the full-size world canvas clipped to the visual viewport, shift hero/assembly into an ≥88 px clear scene strip, and replace drawer/dock with a 52 px input+Done row; save text continuously. Done restores the previous construction focus and bounds.
Rationale → Review → Submit: show the frozen part/configuration summary and rationale in the same drawer with explicit Submit/Back; wallet approval is separate, and no full-screen application form replaces the island.
Submitted → Pending: close repair controls, restore walking, and show only mode plus a short genuine status chip; scaffold/crew remain at the site. Selecting status opens the same bounded feedback drawer without stopping exploration.
Rejected/recovery → Revision: feedback drawer shows rule flags and the first actionable issue; Details scrolls in place. Revise loads the original submitted snapshot into the construction tabs; accepted feedback collapses before the staged physical transformation.
Focus order is tabs → active tray/config/ports → Test → Rationale → Review/Submit → Exit; preserve selection across transitions and offer labeled 44 px Back/Exit actions. Verify every transition at all three sizes with hero, objective and working surface visible; no permanent sidebar or fullscreen form.

## Central judge, pending workers and restoration authority

Python independently checks schema, stock/budget, sockets, port compatibility, safety, connectivity, arithmetic, dependencies, caller nonce and previous approval.
Only technically valid constructs reach contextual judging against the contract's own immutable scenario/rubric, not browser-provided requirements.
Independent custom validators reevaluate the same normalized artifact and facts without the leader answer in their prompt.
Compare the four backend flags: `groundedInArtifact`, `explainsTradeoff`, `protectsHabitat`, `safeUseAndMaintenance`; feedback prose need not match.
All required flags must be true. Malformed outputs, execution errors, unknown execution evidence and missing records grant no restoration.
Bind every attempt to caller + site + nonce + digest + fixture version, and domain-bind digest to the contract/network as defined in docs/GENLAYER.md.
The contract reads its own caller progress for dependencies. Neither a browser prerequisite array nor practice progress is evidence.
Use the documented adapter states and apply `RestorationGrant` only after FINALIZED + execution SUCCEEDED + matching latest-final approved record.
Correlate the original transaction and frozen submitted snapshot; ACCEPTED/provisional status, elapsed time or a test animation cannot restore anything.
Before submission, show an honest advisory technical test. Submission is an explicit player action with wallet approval; never prompt/sign on boot or poll.
After recorded broadcast, add a small scaffold and two helmeted background workers with restrained tool motion; they represent pending preparation only.
Workers clone the final skinned restorer-family GLB after main's turnaround gate, with palette/helmet/tool variants, the same bones and grounded work poses; tool props may be procedural. Keep routes, leaks and broken assemblies unchanged while pending.
Player exits inspection and continues walking, drafts other jobs, saves, or reads status. Never lock the frame loop while awaiting the adapter.
Rejection stops the crew and exposes actionable flags/feedback plus the submitted artifact for revision. Wallet refusal means no submission, no reviewing crew.
Polling timeout stays pending/recoverable; disconnect/account change preserves tickets, invalidates prepared writes and prevents cross-caller grants.
Persist frozen snapshots and recovery tickets immediately at broadcast. Reconcile through public reads after reload; never silently rebroadcast or invent transaction IDs.
Restoration is idempotent per approved site: 2–4 s staged crew/assembly/flow changes, then persistent route/material/scatter state; no repeated reward on reload.
The receipt validates a design. It does not prove walking, physical repairs, worker activity, attendance or a client score.

## Ending, save, practice and touch

Connected win: all eight site approvals are reconciled for the active caller and beacon restoration finishes; show a live island vista and causal field-journal summary.
Practice ending uses the same world sequence with permanent “Local practice — deterministic checks” labeling and no chain/AI approval language.
No expedition failure state; faulty constructs reject/retry. Save errors, disconnects and missing configuration produce recoverable messages.
Save keys separate `practice:<scenario>` from `connected:<chain>:<contract>:<caller>:<fixture>`; never copy completions between namespaces.
Store version, position/surface, discovery, draft parts/settings/graphs/rationales, mode, settings and durable submission tickets. Treat cached approvals as untrusted.
Autosave after edits, broadcast, reconciled decisions and valid checkpoints. Resume connected progress from verified records; corrupted saves offer an explicit fresh local start.
Replay creates a fresh practice expedition; connected replay displays the existing caller's approvals and cannot farm or erase them locally.
Unconfigured installs visibly offer practice and disable connected submissions. Switching modes is explicit and loads the other namespace without migrating progress.
Desktop: WASD/arrows, interact, select/rotate/connect/test, Escape pause. Touch: left joystick, right interact, tap sockets, large rotate/connect/test controls.
Pause releases pointers and freezes movement/minigames; asynchronous results queue for reconciliation on resume. Mute/settings remain available during pending review.
Portrait shows concise rotate guidance with settings/save access; a tap starts audio. Account/status text stays compact and never occupies a permanent dashboard sidebar.

## Entities and input → command → state → render contract

Stable domain entities: Player, WalkSurface, Obstacle, RepairSite, RepairDraft, SubmittedAttempt, RestorationState, Progress, SaveSession, Notification.
Systems: input mapping, movement/collision, focus/inspection, assembly graph, advisory simulation, submission reconciliation, dependency resolution, save and ending.
Input produces semantic commands (`Move`, `Inspect`, `PlacePart`, `RotatePart`, `SetDetent`, `ConnectPorts`, `TestDraft`, `EditRationale`, `Submit`, `Pause`).
Fixed 60 Hz simulation validates commands and updates plain records; cap catch-up at four steps. Render interpolation must not change authoritative state.
Network callbacks enter a small reconciliation queue; only matching verified grants create connected `SiteRestored` events. Practice uses a separate event path.
Renderer consumes immutable snapshots: transforms/poses, terrain patches, asset/material IDs, site draft/approved assembly, repair effects, lights, atmosphere and HUD data.
Expose renderer-neutral initialize/resize/render/dispose operations and object-ID picking; domain modules contain no meshes, renderer vectors or scene references.
Animation gets velocity, heading, gait phase and ground samples; HUD gets mode, diagnosis, parts/budget, real review status and feedback.
Swappable layers: Three.js renderer, material/lighting/post presets, meshes/scatter, HUD skin and level data. Puzzle validators/dependency authority remain stable.
Stage A smoke scene must accept the same domain snapshot through a minimal renderer; swapping one material set/light must require no gameplay edits.

## Renderer and asset pipeline

Use the requested Three.js/TypeScript stack with real cast shadows, PBR albedo/normal/roughness inputs, contact AO, instancing, fog, grade and modest bloom.
Warm key candidate: directional light from (-36,55,12) relative to the viewed area; pale warm key, cool sky fill, muted ground bounce, stable exposure.
Shadow map 2048 desktop / 1024 phone, fitted around the visible terrain; include hero, structural props and selected vegetation as casters/receivers.
Use half-resolution screen AO plus baked/contact material AO where needed; no floating dark foot disc as the hero's grounding substitute.
Linear lighting, sRGB albedo/output, filmic tonemapping; low bloom for functioning lamps only, restrained grade, no compulsory depth-of-field or copied pixel filter.
Distance fog candidate 38–90 m with localized low-opacity valley mist; upland blends toward cool blue-grey without requiring snow or hiding the hero.
Water uses depth/shore-distance masks, shallow/deep colour, scrolling normal ripples, contour foam and grounded rock contact; no full planar reflection requirement.
Ground mixes authored biome/path/wetness masks, metre-scale patches and small normal/roughness detail. Wood has grain/end cuts; stone strata; cloth woven panels/seams.
Damage/accepted variants share geometry foundations but change actual faults, grime/wetness, motion, debris placement and growth; never recolour the entire island at once.
Geometry pipeline: original deterministic terrain/paths/cliffs; original procedural props with designed subparts; instanced varied tree/shrub/reed/grass families.
Target roughly 350 trees, 1,000 shrubs, 2,000 small ground clusters and 200 rocks across the island, chunked/culling; protect path clearance and site working surfaces.
Each reference crop needs foreground/midground/background layers rather than uniform scatter; initial budget ≤140 visible draws / 450k visible triangles desktop.
Phone target ≥30 fps, desktop ≥60 fps on measured hardware; DPR caps 1.5/2.0. Reduce far scatter, AO resolution and shadow range before removing core material response.
Hero: one original clothed restorer, 1.68 m, teal work jacket, sand cap, charcoal trousers, leather boots/tool belt; 3–8k triangles, continuous joint silhouettes.
One Blender specialist owns mesh/UV/skin plus 1024 albedo atlas, normal/roughness or ORM, bone map and isolated A-pose/front/side/back/locked-camera stills.
Rig: hips/spine/chest/neck/head; bilateral clavicle/upper-arm/forearm/hand and thigh/shin/foot/toe, optional root; shaped gloved thumbs, no sphere hands.
Main alone gates the turnaround before retarget/binding. Builder then uses the same GLB for idle, alternating walk and repair; remove the temporary hero completely.
HUD pipeline: original cream/ink field-journal panels, licensed redistributable type, original icons, compact minimap, contextual repair controls and honest decision labels.
LOOK.md provides six reference observations; LEDGER.md covers visible families, variants and intended sources. Record actual sources/licenses and generation steps later.
Optional CC0 nature meshes are supporting candidates only; use them only after scale/material/silhouette fitting. Refs remain review-only and never enter assets/prompts.

## Stages, verification and escalation

Stage A: main reviews brief/bar/plan; Builder implements domain/renderer abstractions and a smoke scene; specialist freezes eight fixtures/envelope catalogs.
Stage B: complete placeholder journey including distinct repair families, practice ending, camera lock, collision, saves and synthetic adapter-state tests; document boot/build.
Use test-only fixtures for pending/accepted/rejected/finalized/error states; a mock cannot be presented as a live judgment. Main dispatches the separate loop reviewer.
Stage C0–C5: LOOK → lighting/post → materials → layered geometry/hero gate → HUD → motion; refresh ledger/evidence at each required gate.
C11 crew motion coverage: capture the final skinned variants walking to work, planting feet, articulating arms/tools, pausing on rejection and performing staged approved restoration; use the same bones and grounded poses throughout.
Stage D: six native live 1920×1080 stills, all six matched equal-blur pairs, manifest and 45–90 s walkthrough with 8–12 extracted frames; fresh Critic only.
Pairs: ref-01 workshop/path; ref-02 windmill construction; ref-03 restored bridge; ref-04 sluice shore; ref-05 cool upland rationale/status; ref-06 pier workshop over water.
Capture damaged, pending and restored states honestly; practice demonstrations retain their label. Connected execution evidence requires separately authorized live use.
Verification: movement/height/route locks; one valid and invalid graph per family; save namespace isolation; nonce/digest vectors and caller/dependency checks by specialist.
Exercise ACCEPTED without restore, finalized execution failure, mismatched records, edited drafts, timeout/reload/account change, duplicate grants and idempotent route changes.
Verify keyboard/touch equivalent repairs, phone layout, gait on ramps, same idle/walk mesh, surface breakup and uninterrupted pending exploration.
Risks: a catalog/fixture mismatch disables submission; ambiguous finality leaves the site pending; missing hero export or rig blocks final hero integration, never substitutes primitives.
If timing creates stalls, open inspections/other independent jobs and preserve tickets; do not weaken dependencies or invent approval. Log measured network limitations.
If collision and visible terrain diverge, correct shared level data before adding scenery. If phone cost grows, profile shadows/AO/scatter before changing style or camera.
Repeated material/light/density issues escalate that pipeline; two unchanged criterion checks prompt a rung decision, three repeated hard failures prompt a separate diagnosis.
Main owns escalation/gates; refs and BAR stay locked. No signing, deployment, paid calls, global configuration writes or public publishing in this planning/build authorization.
