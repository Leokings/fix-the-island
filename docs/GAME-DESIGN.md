# Fix the Island — Full Game Design

**Status:** working design baseline for the full game and the first playable end-to-end pilot.  
**Game:** Fix the Island  
**Deadline:** none set by the user (2026-10-13); target is the full eight-site game.  
**Audience:** players and the visual, gameplay, and GenLayer/backend builders.  
**Authority:** this document defines the intended player experience and site designs. `docs/GENLAYER.md` remains the authority for the current contract envelope, adapter, and network behavior. If a planned physical design cannot be represented by the current catalog/fixture, it is a documented implementation gap—not a feature that should be faked in the UI.  
**Ownership:** Codex owns backend/contract sections; Claude owns visual sections (§11 build-view interaction, §12 visual direction, §9 council staging) and may revise them. Revision 2026-10-13 (Claude): added visual direction, away-from-site restoration, direct-manipulation build view, pump habitat wording, pilot-first visual order, two open decisions.

## 1. The game in one paragraph

Fix the Island is a short, landscape 3D exploration-and-repair game. After a violent storm, the player arrives as an island restorer. They walk a connected island, inspect damaged infrastructure, physically assemble and tune repair parts, run a visible test, and submit a bounded design for a GenLayer review in connected mode. Approved repairs restore real machinery, water, light, vegetation, and routes. The player can explore other open jobs while a review is pending. The island gradually changes from storm-damaged and quiet to functioning and alive. The final beacon repair completes the expedition.

This is a systems-thinking adventure, not a trading game, a dashboard, an essay-writing exercise, or a set of one-click checklists. It teaches players to diagnose a fault, understand connected systems, allocate limited parts, and weigh practical needs against habitat and maintenance.

## 2. Design pillars and player promise

1. **The player does the repair.** A repair is a visible construction: selecting and placing parts, making compatible connections, setting controls, and testing the result. Selecting a named solution alone never counts as building it.
2. **The island reacts.** Water visibly flows, machinery turns, lamps illuminate, damaged paths reopen, and nearby habitat recovers only when the relevant repair is actually finalized.
3. **Different sensible designs can work.** Deterministic game rules verify physical coherence and safety. GenLayer judges the bounded contextual question: does this design suit this island, its people, and its habitat?
4. **Waiting does not strand the player.** A pending review is saved and recoverable; the player can walk away, explore, and work on independent sites.
5. **Failure teaches and is recoverable.** Tests and reviews point to an actionable issue. Draft parts are not consumed; a player can revise and retry without losing the expedition.
6. **Honest proof.** Local practice, submitted, pending, finalized, rejected, and timed-out states are distinct. No mock animation or local score is presented as a GenLayer approval.

## 3. Target experience, platform, and controls

- **Session:** about 15–25 minutes of active play, excluding network review time. Intro about 1 minute; eight repairs about 1–2 minutes each; exploration/traversal about 4–7 minutes; ending about 1 minute.
- **Platform:** browser, Three.js + TypeScript, desktop and landscape phone. Portrait gets a rotate-to-landscape prompt while retaining save/settings access.
- **View:** third-person, high-angle near-orthographic camera following the restorer. The island is traversable 3D terrain built from connected surfaces and props, not a flat image or a non-walkable background.
- **Keyboard:** WASD/arrows to walk; interact to inspect/use; context actions for select, rotate, connect, and test; Escape pauses.
- **Touch:** left virtual joystick to walk; large interact/action controls on the right; tap a part then a socket/port; large controls for rotate/connect/test. No task should require fine mouse dragging or fast reflexes.
- **Movement:** ordinary grounded walking and optional brisk walking. No jump, swim, climb, combat, survival clock, lives, hunger, or arbitrary timer. The player cannot enter water, cliff faces, closed gates, or visually solid buildings. Ramps connect elevation changes.
- **Accessibility:** pause freezes player control and minigames; mute/settings are always available. Labels accompany color-coded states. Hints progressively explain a repeated construction/test error. Text and controls remain readable on phone.

## 4. The island and its opening state

The island has three legible regions: a low coastal settlement and pier, a creek/reedbed and woodland middle, and an upland ridge. A creek runs through the island toward an eastern tidal outlet. Paths, ramps, bridge, shoreline, and gates form one understandable route network; visible paths have matching collision and clearance.

At the start, storm damage is obvious but the scene remains readable: a tilted pier fitting, a leaking pump, blocked tidal flow, a broken creek bridge, a stalled windmill, a dark path light, a damaged upland water system, and a dead beacon. Water is misrouted or absent, the bridge approaches are hazardous, the upland return is waterlogged, and vegetation/ambience is subdued. The player spawns beside the pier workshop. An always-open shore path means no pending first repair can trap them.

Repairs restore the island in stages, not with one global color filter:

- A mechanism stops juddering or moves correctly.
- The repaired water/power/light route becomes visible and follows the actual configuration.
- Its local route, gate, or work area changes state.
- Nearby plants, reeds, wildlife ambience, and color recover in proportion to that system's effect.
- Other distant sites remain damaged until their own approved repairs.
- Separately, the island's weather calms in gentle steps with the number of finalized repairs: storm cloud thins, wind and surf settle, light warms. This is ambience only; it never substitutes for a site's own local recovery and never moves ahead of finalized approvals.

## 5. The complete eight-site expedition

The eight-site scope is the full intended game. The village pump is the first vertical-slice/pilot site because it clearly demonstrates a real construction, a human/habitat trade-off, a GenLayer decision, and a visible world consequence. It is not the whole game.

| Order / site | Starts available? / prerequisite | Main player activity | Successful world change |
|---|---|---|---|
| 1. Landing Hoist (`pier_hoist`) | Yes | Balance and brace a load-lifting mechanism | Gangway levels; bridge-brace stock reaches the rack; west workshop shortcut opens. |
| 2. Spring Pump (`village_pump`) | Yes | Choose a physical water design, assemble its actual parts, route and regulate water | Leak stops; village/upland supply begins; bridge approach drains; habitat outcome reflects chosen design. |
| 3. Reedbed Sluice (`tidal_sluice`) | Yes | Place flow baffles and nursery gate, redirect debris, balance water branches | Backflow no longer erodes the bank; reed pools refill; tidal boardwalk opens. |
| 4. Splitbank Bridge (`creek_bridge`) | After hoist + pump + sluice are finalized | Assemble a supported, braced crossing and test its load path | Deck is safe and continuous; woodland crossing opens. |
| 5. Headland Windmill (`coast_windmill`) | After bridge | Fit and guard a mechanical transmission | Guarded generation restarts and supplies power toward the woodland. |
| 6. Fern Path Light (`woodland_pathlight`) | After windmill | Wire a protected circuit and aim a shielded lamp | Path is lit without shining into habitat; maintenance gate unlocks. |
| 7. Ridge Cistern (`upland_waterworks`) | After bridge + pump | Filter, split, and route finite water to village and habitat | Upper walkway/return drains; clean village and habitat flows begin. |
| 8. Lookout Beacon (`ridge_beacon`) | After path light + cistern | Protect power, align lens/reflector, aim the signal | Safe coastal signal lights; completed-island ending begins. |

The three coastal jobs are independently accessible at the beginning. While an attempt is pending, the player can continue to other open sites. A site is available only when its required approvals exist in connected mode. A locked site shows its actual barrier/fault and says which finalized repairs open it; it never lets the player walk through an invisible wall.

### Route and progression logic

- Spawn at pier → the shore route to the reedbed sluice and the path to the village pump are always open.
- Pump and sluice approvals drain/normalize the creek approaches; the hoist supplies the bridge stock.
- Hoist + pump + sluice → splitbank bridge.
- Bridge → headland windmill; bridge + pump → ridge cistern branch.
- Windmill → fern path light; path light + cistern → ridge beacon.
- Cistern dries the western return/upper walkway. Beacon is the final repair.

The map keeps a field journal/objective list showing completed, open, pending, and locked jobs, with a short reason for each lock. It does not show a confusing numeric “weight” system as the primary objective.

## 6. How repair construction works everywhere

Each site follows the same readable sequence, with a different physical puzzle family:

1. **Approach and inspect:** identify the symptom from the machinery/environment; show the objective and relevant known facts.
2. **Choose a design (only where alternatives exist):** see a plain-language trade-off and the parts needed. A choice sets the allowed blueprint/part tray; it does not auto-build or earn approval.
3. **Build:** select/place real parts in sockets; orient/rotate them; connect compatible ports; set detented controls. A part appears in the assembly, and a valid connection is visible in the world/inset.
4. **Test locally:** animate the system and show measurable, bounded outputs such as flow, pressure, balance, load, rpm, or beam direction. This deterministic test is advisory and can say “needs adjustment.”
5. **Explain (optional):** the player may add a short rationale about the choice they actually constructed. Skipping is valid; the UI explicitly says “No note added — the council will assess the submitted build and site facts.” An empty rationale is not replaced with fabricated text.
6. **Review and submit:** show the frozen design summary and the exact question/evidence being assessed. In connected mode, the player explicitly approves wallet submission. Local practice is a separate labeled mode.
7. **Wait or continue:** pending review does not pause walking. A small crew prepares at the site; the broken system stays visibly broken. The player can inspect status in the journal.
8. **Resolve:** only a matching finalized successful contract decision restores a connected site. A revise/rejection exposes actionable feedback and loads the saved draft. Timeout/error remains unresolved and recoverable, not pass or fail.

Construction interactions are equivalent on keyboard and touch. No drag speed score, reflex test, hidden timer, stock loss, or freeform geometry is required. Site stock is fixed and replenishable after a failed test; the submitted artifact stays within the existing `repair-v1` envelope unless the backend and contract intentionally version it.

## 7. The first complete pilot: Spring Pump

### The problem and why it is interesting

The village spring pump leaks and delivers too little clean water. The creek also feeds a reedbed nursery downstream of the pump, where fish spawn and turtles nest on the bank in season (this is the `water-shortage-nesting-season` scenario; "nursery" and "nesting" name the same habitat). A design must provide reliable village water without creating an unsafe pressure condition, wasting water, or carelessly damaging habitat. There is not one mandatory “right” solution: the player can optimize a direct pump, a quieter protected pump, or a rain-fed cistern. The three are alternative real builds, not labels attached to the same single pump configuration.

### Pump design selection and physical parts

The player chooses one approach at inspection, then physically builds and tunes that approach. It is **not** a choice-only screen; it is the existing parts-and-ports construction interaction extended with design-specific parts. Only parts belonging to the selected design appear in its tray. A player can return to the choice before submission, but selecting another design clears incompatible draft-only parts after confirmation.

**A. Direct Pump — fast, dependable, more habitat/maintenance pressure**

- Required physical route: spring intake screen → inlet valve → pump body → pressure-relief branch/relief valve → outlet valve → village trunk.
- Separate bypass drain connects the relief/bypass branch to a safe soakaway, never straight into the reed nursery.
- Player places the screen, pump, relief valve, three valves, drain, and trunk connections; sets each valve to a detent; then tests flow and pressure.
- Current backend's known numeric example: inlet 4 gives 12 units; bypass 1 drains 2; outlet 3 delivers 6; calculated pressure 12 − 2 − 6 = 4. Valid pressure is 3–5, trunk delivery must be at least 6. Budget 14. The exact site fixture owns the final setting IDs and arithmetic.
- Trade-off: strong immediate supply; relief/bypass discharge and maintenance access must be responsibly managed. It is not an automatic habitat “fail”; the council judges the submitted arrangement against the fixed island facts.

**B. Quiet Pump — dependable supply with lower disturbance, more parts to maintain**

- Required physical route: screened spring intake → low-noise pump → acoustic housing → inlet control → pressure relief/soakaway branch → outlet control → village trunk.
- The housing must be placed around—not disconnect—the pump, and must have a service opening. A vibration-isolating mount connects the pump to the base; it does not count as a water pipe.
- Player assembles the complete water path, seats the isolation mount/housing, chooses a safe relief route, and tunes delivery/pressure.
- Functional criteria: continuous screened water path; serviceable pump (housing access and isolating mount); pressure in the fixture's safe range; village flow at or above its fixed minimum; no relief discharge into the nursery; within the quiet-design part budget. Acoustic benefit is established by the design rubric/known housing configuration, not an invented live decibel oracle.
- Trade-off: less disturbance near the reedbed/village, but extra housing and isolation components require accessible maintenance. Exact part IDs, capacities, budget, and test values must be frozen in the site fixture before this can be submitted live.

**C. Rain Cistern — low creek impact and habitat-friendly, weather/storage dependent**

- Required physical route: roof catchment → gutter → leaf/debris screen → first-flush diverter → covered cistern/tank → filter → village delivery outlet. A separate overflow runs to a safe soakaway; there is no creek-intake connection.
- Player places roof/gutter/catchment, screen, diverter, storage tank, filter, delivery outlet, and overflow/soakaway; connects the water path and sets the diverter/outlet. A roof is a physical catchment part in the assembly, not decorative scenery assumed by the contract.
- Functional criteria: every route segment is connected in order; first-flush and filter are not bypassed; cistern is covered; overflow reaches the soakaway and not the nursery/path; stored supply meets the scenario's fixed demand reserve; delivery stays within safe capacity; no creek is drawn down. The puzzle test uses a fixed “recent rain/storage” scenario so weather randomness cannot decide approval.
- Trade-off: protects creek habitat and creates a buffer, but has finite capacity and needs debris/filter maintenance. Exact catchment/storage values, part IDs, budget, and minimum reserve must be frozen in the fixture before live submissions.

### Pump test, rationale, and GenLayer judgment

The local test checks the real submitted parts, topology, settings, budget, and deterministic operating limits. It must not certify ecological suitability by itself. The contract checks schema, site/caller/dependencies, allowed part graph, budgets, safety, and fixed quantities; GenLayer validators then assess one bounded contextual question against frozen pump/site facts: **“Does this physically coherent pump design provide the village's stated water need while managing its stated reedbed, overflow, and maintenance constraints?”**

Optional rationale prompt: “What did you prioritize, and what trade-off did you accept?” If skipped, show the no-note message above and assess the artifact/facts only. The player never has to write an essay or claim something not present in the build.

The structured result is fixed and validated by contract code, not invented by the model. Proposed visual-facing outcome: `decision: approve | revise`; on approval `quality: acceptable | good | excellent`; fixed perspectives for fisher/farmer/engineer/elder with stance `supports | mixed | concerned` and short explanatory text; consequences drawn from bounded enums for water/habitat/maintenance; and the exact `chosenDesignId`. The contract determines approved consequence enums from the validated design class and finalized decision; prose cannot unlock a route or set a numeric reward. `revise` has no quality band and causes no world change. Timeout/error has no decision and no world change. `stance` and consequences must be schema-checked and consistent with the final verdict. Whether every perspective/stance is itself consensus-critical must be settled in the backend contract before integration; visuals must never claim each character is a validator.

### Pump outcomes on the island

| Final result | Water/infrastructure | Habitat and visuals | Progress |
|---|---|---|---|
| Direct pump approved | Leak stops, trunk runs, bridge approach drains | Pump operates; relief/soakaway route is visible; habitat response follows the fixed outcome for this design | Satisfies pump prerequisite for bridge/cistern. |
| Quiet pump approved | Same required village service; pump operates inside a serviceable housing | Lower-disturbance presentation; habitat response follows fixed design outcome | Satisfies same pump prerequisite. |
| Rain cistern approved | Stored water supplies the village under the fixed scenario; roof catchment and tank visibly route/store water; bridge approach drains only if the scenario's pump-site drain connection is part of the approved build | No creek drawdown; overflow feeds soakaway; reeds recover according to fixed outcome | Satisfies same pump prerequisite. |
| Revise/rejected | Leak and route remain in damaged state; no dependency unlock | Pending crew pauses; actionable issues appear; player may edit submitted snapshot | No completion/dependency credit. |
| Timed out/error/unfinalized | No assumed state change | Job remains recoverable/pending; no celebratory success | No completion/dependency credit until a verified finalized result. |

**Implementation honesty:** the current pump puzzle supports the direct pump route and its valve settings, not the quiet housing or rain catchment topology. Those two alternatives are a target design and require actual new catalog parts, deterministic fixture checks, and contract support before the UI offers connected submission for them. Until then, show only the implemented direct design in live mode, or clearly label other designs as non-submittable prototype previews. Do not map their names onto the direct-pump artifact.

## 8. Concrete design for the other seven sites

All conditions below are fixed scenario rules, not real-world engineering certification. Catalog IDs, enum values, and exact numeric limits belong to the immutable versioned fixture. The given current examples must be preserved where identified; any new exact threshold must be frozen and tested before connected play.

### 1) Landing Hoist — balance and safe lifting

- **Parts:** anchored base, boom, hinge/pivot, pulley, rope, load hook, counterweight blocks, hand crank, travel stop/guard, and bridge-stock rack.
- **Player does:** seat the pivot/base, route rope over the pulley to the hook, choose counterweight slots, connect crank/boom, add a travel stop, then operate a short lift test.
- **Deterministic checks:** anchored pivot and continuous rope/load path; guard/stop present; stock load moment balanced within the fixture tolerance; no collision with pier; fixed budget. Existing plan example: budget 16; load moment 6; balance within 0.25; three blocks at 1 m plus two at 1.5 m balance the example load.
- **Context question:** does the build lift the required brace stock safely and leave the pier/shore accessible for people and habitat?
- **Success:** gangway levels, stock visibly reaches the rack, workshop shortcut opens. It supplies bridge material but cannot itself approve the bridge.

### 2) Spring Pump — three alternatives

See section 7 for physical part lists, tests, tradeoffs, optional note, review, outcomes, and current implementation gap.

### 3) Reedbed Sluice — control erosion without starving nursery

- **Parts:** two movable deflector baffles, nursery gate, bank shield, debris rake, and debris rack; channel and branch sockets are part of the site geometry.
- **Player does:** orient baffles, set nursery gate to a detent, place bank shield, and move debris to the rack; run the flow test and observe all branches.
- **Deterministic checks:** source flow 8; nursery receives 2–3; creek remainder at least 5; erodible-bank flow 0; budget 14; `bank_shield` and `creek_open` must be set. The known example nursery 3 gives creek 5 and bank 0. The graph cannot isolate the nursery.
- **Context question:** does this routing protect the bank while retaining nursery water and a safe outlet for removed debris?
- **Success:** damaging backflow stops, nursery pools refill, tidal boardwalk opens, reeds recover. A closed nursery is a failed build even if it makes the bank look dry.

### 4) Splitbank Bridge — continuous supported crossing

- **Parts:** deck segments, two bank shoes/abutments, beam, opposing diagonal braces, rail sections, pins/fasteners, and a test trolley.
- **Player does:** place connected deck sections in sockets, seat both shoes, orient opposing braces, connect brace-to-beam joints, fit both rails, run the trolley across.
- **Deterministic checks:** continuous deck graph between both banks; both shoes engaged; load path and two opposing braces connected; fixed load capacity at least 8 units; safe clearance/rail rule; budget 18. A stable-looking deck without a load path fails.
- **Context question:** does the crossing support the stated load without obstructing creek flow or requiring unsafe work access?
- **Prerequisite:** finalized hoist + pump + sluice.
- **Success:** storm-broken section is replaced/braced and the woodland crossing opens.

### 5) Headland Windmill — geared, protected generation

- **Parts:** driver gear, driven gear, shaft coupling, generator, bearing mounts, protective guard, and mount/base.
- **Player does:** fit compatible gears, connect the shaft to generator, select an allowed bluff mount, add guard, hand-test rotation.
- **Deterministic checks:** fixed input 60 rpm; gear options 12/24/36 teeth; output 100–140 rpm; continuous shaft/coupling; guard present; fixed budget 16. The known example driver 24 / driven 12 gives 120 rpm.
- **Context question:** does the chosen transmission provide the needed generation while remaining guarded, maintainable, and sensibly sited near the bluff habitat?
- **Prerequisite:** finalized bridge.
- **Success:** guarded blades/shaft turn and a visible power route becomes available for woodland distribution.

### 6) Fern Path Light — illuminate path, shield night habitat

- **Parts:** 12 V source connection, fuse, regulator, insulated supply/return leads, 6 W lamp, mount, adjustable shade/shield, and sleeve/clip cable protection.
- **Player does:** connect source → fuse → regulator → lamp → return; route/sleeve cable; aim the shield down the path; test light footprint.
- **Deterministic checks:** 12 V supply, 6 W / 12 V lamp, 1 A fuse; complete circuit; no short or fuse bypass; budget 12; `path_edge`, `downshield`, and `sleeved_route` settings. Light must cover the safe path sector without entering fixed nesting/inland sectors.
- **Context question:** does this make the route legible while controlling spill and protecting/maintaining the cable?
- **Prerequisite:** finalized windmill.
- **Success:** path lights, cable is visibly protected, maintenance gate latch powers on.

### 7) Ridge Cistern — share filtered water fairly

- **Parts:** cistern/reservoir, inlet, filter, splitter, village outlet/valve, habitat outlet/valve, overflow route, and service access.
- **Player does:** connect the source through the filter to the splitter, set both outlet valves, route overflow to the safe channel, and test the two visible streams.
- **Deterministic checks:** supply 6; village allocation at least 4; habitat allocation at least 2; no filter bypass; overflow safe; budget 16; known accepted split is `village_4` / `habitat_2` with `filtered_split`. Fixture enforces pipe capacity/elevation rules.
- **Context question:** does the allocation meet village need while preserving habitat flow and filter/overflow maintenance?
- **Prerequisite:** finalized bridge + pump.
- **Success:** waterworks runs, habitat flow resumes, upper walkway/west return drains and becomes traversable.

### 8) Lookout Beacon — safe, useful coastal signal

- **Parts:** protected power feed, fuse/isolator, lamp, lens, reflector, adjustable shield, stable plinth, and maintenance access.
- **Player does:** complete protected power path, seat lens/reflector, choose a permitted beam detent, fit shield and plinth, test a visible beam sector.
- **Deterministic checks:** protected continuous circuit; mechanically seated optics; stable safe base; beam intersects the fixed coastal sector and excludes fixed inland/nesting sectors; budget 14.
- **Context question:** does this signal serve the coast without creating avoidable glare or unsafe maintenance conditions?
- **Prerequisite:** finalized path light + cistern.
- **Success:** beacon lights toward the coast, final island vista/field journal plays, expedition is marked complete.

## 9. GenLayer and the Island Council: precise trust boundary

The player-facing council is a story/presentation layer representing island priorities. Fisher, farmer, engineer, and elder are **not validators** and do not individually vote on-chain. GenLayer's validator network checks the contract's judgment. The contract emits one validated, structured assessment for the submitted repair.

**Ordinary code/contract responsibilities:** parse and bound inputs; enforce exact site/fixture version, allowed parts/ports/settings, graph connectivity, budgets, arithmetic, safety limits, caller, nonce, dependencies, digest, timeout/recovery, and deterministic state changes. Map a finalized approved design to its fixed quality/consequence enums. Never let model prose set arbitrary rewards, balances, costs, or progress.

**GenLayer contextual judgment:** one narrow question per site, against bounded frozen site facts and the normalized submitted construction: does this coherent design satisfy the relevant human/ecological trade-off? Validators must assess evidence and not accept hidden instructions from player-authored rationale. The rationale is optional and supplemental; the actual build is the primary evidence. The current four review flags in the existing system (grounded in artifact, explains tradeoff, protects habitat, safe use/maintenance) may be kept only if their wording matches the new narrower rubric and optional note behavior; backend owner must reconcile them in the versioned contract rather than silently changing semantics.

**Finality and effects:** pending, accepted/provisional, timeout, error, or an unverified client message cannot change the connected island. Only finalized successful execution with a matching caller/site/nonce/digest/version record grants restoration. Revise/reject changes no world state and gives actionable feedback. Each site grant is idempotent. Practice mode is visibly local and cannot be promoted into connected progress.

### Council/review staging for visuals

- The player is never forced into a full-screen wait. On broadcast, two workers/scaffold appear at the submitted site as preparation only; the machine remains broken and the site remains locked until finality.
- The **Island Council meets at the village commons/campfire next to the pump**. Once a result is finalized, the journal can offer “Hear the council” and present a short, skippable campfire reveal. The player may keep walking; opening the journal later replays the outcome, not a fabricated live vote.
- The council members react according to fixed, validated `stance` fields and read short assessment text as island perspectives. Do not animate them as GenLayer validator nodes or claim five humans/characters reached consensus.
- If no finalized result exists, the campfire cannot reveal a verdict. If the player is at the repair site when finality is reconciled, play the local completion response there and make the campfire reveal available in the journal; do not yank the camera away without player choice.
- Approval starts a short 2–4 second visible restoration sequence: workers finish, scaffold clears, parts activate, water/power/light effects change, then persistent route/material/scatter state updates. Rejection pauses crew and highlights the real issue. Timeout keeps a recoverable pending state.
- **When finality arrives while the player is elsewhere:** the persistent world state updates immediately (routes open, water runs), and a non-blocking toast names the result with two choices: "Hear the council" (campfire reveal, which ends on a camera move to the site playing the restoration sequence) or "Later" (the restoration sequence plays the first time the site comes on screen). The sequence plays once per grant; reload never replays it unprompted, though the journal can.
- The reveal order is fixed: the four perspectives in schema order (each character stands, reacts with its stance, and shows its text), then the verdict card. Skippable at every step; skipping never hides the decision, quality or consequences.

## 10. Progress, saves, practice, and ending

- The field journal lists all eight sites, their symptoms, part/design choices, requirements, dependencies, status, review transaction/evidence links when available, and completed consequences. It uses clear words, not unexplained “weights.”
- Save local position/surface, discovered clues, drafts, settings, and submission recovery tickets. Connected progress is re-read/verified from contract records; cached client flags alone are not authority.
- Practice and connected state use separate namespaces. Practice uses deterministic local checks and is labeled throughout; it cannot unlock a connected route or claim AI review.
- A broadcasted transaction/ticket is saved before waiting. Reload/reconnect reconciles public state. Never silently re-submit, invent transaction IDs, or transform a timeout into rejection/approval.
- Failed local tests preserve parts and allow hints/retry. A finalized revise response loads the submitted snapshot for editing and explains first concrete issue.
- When all eight connected approvals are reconciled and the beacon restoration completes, show the restored island vista and a concise causal field-journal summary (“water returned because…”, etc.). Practice can show the same narrative with a permanent practice label.
- Replay starts a fresh local practice expedition; it cannot erase or farm existing connected approvals.

## 11. UI and feedback rules

- Exploration HUD: objective/next open job, compact site-status journal/minimap, interaction prompt, honest mode and connected status. No permanent dashboard sidebar.
- Inspection: short fault description, relevant site facts, parts/design entry, visible prerequisites. It does not hide the landscape behind a form.
- Build view: the live site assembly stays visible and is the main control surface. The player taps a part in a small tray, the compatible sockets glow on the 3D assembly, and tapping one places it; ports connect by tapping port then port, and a valid link draws a visible pipe/shaft/cable. Settings are big detented dials on the selected part. A short step strip (Place → Connect → Set → Test) shows progress; it is guidance, not a mode switch. No ‹ › cycling through hidden lists as the primary interaction. Each part has a name/function label; water/shaft/electric connections have direction and compatibility feedback.
- Test feedback names cause and fix (“Outlet is blocked”; “Nursery gets 1; required minimum is 2”) instead of only displaying a score/weight.
- Submit view previews exact frozen build and optional note. Clearly state what GenLayer is asked to judge and what happens on approve/revise/timeout. Wallet approval is a separate explicit step.
- Pending: honest status and site crew; the player can leave. Never show a countdown as if it predicts finality.
- Final: decision, quality (if approved), fixed consequences, character-perspective text, evidence/transaction details, and next unlocked job. Distinguish live record from saved historical proof.

## 12. Visual direction

One coherent look, so the island reads as a single place rather than assembled assets. Reference build: the isolated council preview (`council.html`, mock data only), which already uses this style.

- **Style:** stylized low-poly, flat-shaded facets, chunky readable silhouettes, soft real shadows. Light texture use (palette textures only); detail comes from shape and colour, not noise.
- **Scale is fixed and shared:** the restorer is 1.65 m; doors about 2 m; a hut about 3 m tall; palms 4–6 m; repair parts sized for hands and shoulders. Every imported or authored asset is normalized to this before placement. Nothing at a site may dwarf the player unless it is meant to (the windmill, the ridge).
- **Characters:** one robot family (the restorer's model) for the hero, site crews and the four council members, told apart by body colour and a single prop each (fisher bucket hat and rod; farmer straw hat and sprout; engineer hard hat and wrench; elder shawl and cane). Their reactions use authored clips and face morphs only.
- **Palette and states:** storm state is desaturated olive-straw grass, brown dry creek beds, grey haze, cool flat light. Restored state is saturated green, clear teal water with foam, warm sun, flowers and wildlife. Each site shifts locally from one to the other on its own grant (§4); the global weather step is a small, separate layer.
- **Water is a hero material:** an animated faceted sea with a foam line at the real shoreline, creek water whose level shows supply, visible flowing streams/spouts on working systems. Never a flat repeating texture.
- **Lighting:** a single warm key sun, hemisphere fill, light fog; small emissive lamps and a subtle bloom only on fire, lamps and restoration glow. Night is not required.
- **Camera:** high-angle three-quarter view, pulled back enough to see the site, its approach and its habitat together. Tall foreground props near a site are cut away or faded so they never cover the interaction. Cinematic shots (council reveal, restoration) are short and skippable.
- **UI:** warm paper cards with rounded corners, a single rounded sans (Nunito), large touch targets, colour plus a word for every state (supports/mixed/concerned; better/worse). Side panels on wide screens and phone landscape so the 3D site stays visible; bottom sheets only on phone portrait. Plain, short, friendly copy; legal-style hedging belongs in the journal's technical details, not the main HUD. A persistent badge marks MOCK PREVIEW or PRACTICE.
- **Storm palette (decided 2026-10-13 by the user):** the storm state is moody autumn — deep olive-greens, rust and ochre crowns, warm ochre paths, pale stratified rock — not a washed-out grey-olive. It must read as damaged yet hold up beside the locked references. Restoration shifts each area toward fresh greens and flowers.
- **Hero (decided 2026-10-13 by the user):** the robot family stays for hero, crews and council. This knowingly overrides `art/BAR.md` C7's "clothed human restorer" wording; C7 is judged on silhouette readability, grounded gait and in-frame presence of the robot.
- **Restoration moments:** a light ring and rising sparkles from the site, machinery starting, water/light switching on, then the local colour shift over a few seconds. Revise and timeout never use celebratory effects.

## 13. Scope boundaries and implementation order

**In scope:** eight named repair sites, distinct puzzle families, connected island progression, final ending, persistent drafts/progress, local practice separation, GenLayer review boundary, fixed consequence enums, accessible desktop/touch controls, honest pending/recovery presentation.

**Out of scope for this game:** trading/financial competition, token rewards/NFTs, combat, survival meters, arbitrary timer, multiplayer shared-world state, real weather driving damage, free-form player-authored structures, player-created validator decisions, real engineering certification, SQL instruction.

**Parallel work and sync points:** visuals and backend proceed at the same time. Visuals: island rebuild → pump slice → other sites. Backend: quiet/rain pump parts and fixtures, stance-consensus decision, live-review timeout → live council adapter → other sites' contracts. Sync point 1: the pump build view needs the three designs' frozen part lists. Sync point 2: replacing council mocks needs the live adapter. Any change to a shared detail (part, result field, site rule) is written here first.

**Order of work:**

1. Freeze this game design and reconcile concrete catalog/fixture IDs with `docs/GENLAYER.md`.
2. Complete Spring Pump end to end with the currently supported direct-pump build first. Add quiet-pump and rain-cistern only after their physical parts, tests, schema, and fixture are implemented together.
3. Verify the visual build/review/result against real backend types, with clearly isolated mock-only previews if needed.
4. Reuse the same inspect → assemble → test → submit → pending → finalized consequence lifecycle for the other seven sites, each with its own immutable fixture and puzzle-family test.
5. Play the complete connected progression, recovery cases, saves, touch/keyboard controls, and final ending. Report local/mock checks separately from live finalized GenLayer proof.

## 14. Decisions still open

- **Deadline:** none; the user asked not to plan around one (2026-10-13). Scope is the full eight-site game, built pilot-first.
- **Quiet and rain design numeric capacities/budgets:** must be determined by the backend/gameplay owners, frozen in versioned fixtures, then reflected identically in the visual part catalog. They are intentionally not invented here.
- **Structured council fields and consensus criticality:** backend contract must decide whether per-perspective stance/consequence fields are consensus output or deterministic mappings from a single judgment; visual code consumes only the final validated schema.
- **Island base mesh (visual): DECIDED 2026-10-13 by the user.** Rebuild the walkable island in the §12 style, replacing the imported Poly island. Keep the eight site IDs, prerequisite graph, route logic and collision rules; gameplay authority stays independent of meshes.
- **Pilot designs: DECIDED 2026-10-13 by the user.** The pump pilot includes all three designs (direct, quiet, rain cistern). Backend owner defines their parts, fixtures and checks; visuals build all three parts kits and mark any not yet submittable as previews until the backend supports them.
- **Exact rationale token/character cap and evidence bundle:** retain current `repair-v1` bounds until a versioned change is agreed; optional rationale must be explicitly supported in the contract before UI omission is treated as valid.

## 15. Visual-team handoff checklist

- Work order: rebuild the island base in the §12 style first (so the pilot is not built on terrain that is about to be replaced), then the complete Spring Pump slice on it (site, build view, crew, council reveal, restoration, journal), then the other seven sites. The pump is the pilot, not the total scope.
- Implement pump design choice as a real construction branch. Direct pump can use the existing puzzle; quiet and rain require real housing/isolation parts and catchment/gutter/diverter/tank/filter/overflow parts respectively.
- For each of the other seven sites, model the listed pieces as interactive/visible parts and show the exact local test criterion and failure hint.
- Make lock geometry visible and collision truthful; show route opening only on finalized connected approval or explicitly local practice restoration.
- Put the council at the village commons/campfire beside the pump; never imply council characters are validators. Make the reveal optional after finality and preserve free exploration while pending.
- Crew is “preparing” only. Actual repair glow, open routes, flowing water/light/power, and restored environment require verified final success (or clearly labeled practice).
- Show rationale as optional and communicate what skip means. No essay gate.
- Use the fixed structured result schema when finalized; do not infer stance, quality, or island outcome by parsing prose.
- Label prototype/mock, practice, and connected states so a reviewer cannot confuse them.

