# Field-journal UI assets — isolated handoff

Supporting asset preparation only, 2026-10-08. Publish: LOCKED. Main remains
Orchestrator; primary Hooke owns the running game and integration. These files
are not imported by the current game. This is not Stage C4 completion or a
rendered verification. No browser, GPU, server, dependency installation, staging,
commit, game authority change or existing-file edit was performed for this handoff.

## Files and intent

- `src/ui/field-journal.css`: opt-in cream/ink skin for the existing DOM selectors.
- `src/ui/player-copy.ts`: presentation strings and pure label helpers, with type-only imports. No runtime dependency, network, DOM, command dispatch or state writes.
- `assets/fonts/Nunito-Variable.ttf` and `assets/fonts/NOTICE.md`: unmodified local variable font and immutable provenance/hash/ship notice.
- `public/licenses/Nunito-OFL.txt`: full, byte-identical upstream copyright and OFL 1.1 license.

Rounded, heavy warm-brown title lettering, cream paper, dark green ink, a rust
objective rule and teal primary actions form the original journal grammar.
Exploration has small labels at its existing HUD anchors. The repair dock becomes
transparent; only actual buttons, fields and text have opaque surfaces. Selected
tabs use an underline as well as colour. Disabled controls use dashed borders.
Focus rings sit inside clipped surfaces, and motion respects reduced-motion settings.
The stylesheet does not replace the actual rendered repair assembly with artwork.

Read inputs: `BRIEF.md`, `art/LOOK.md`, `art/BAR.md`, current HUD/panel/layout
sources, site plan, immutable catalog and local advisory implementation. Native
review: `artifacts/stage-b/reuse/2026-10-08T17-38-16-504Z/1920-idle.png`,
`1920-inspect.png`, `667-inspect.png`, plus `refs-locked/ref-05.png` at original
resolution. References were viewed only; no image copying, tracing, generation,
texture projection or reference bytes enter these assets.

## Primary integration, after the relevant gates

1. In `src/main.ts`, add `import './ui/field-journal.css';` **after the final UI import**, following the current import of `RepairPanel` and its types. `game.css` and the panel's imported `repair-panel.css` must precede it in the CSS cascade. Do not place it before `RepairPanel`'s side-effect stylesheet.
2. Before constructing the HUD/panel, add `document.body.classList.add('production-ui');`. The root token scope and every styling rule require this class. Removing it restores the existing CSS treatment; the font declaration alone changes no active font.
3. In `src/ui/game-hud.ts` and `src/ui/repair-panel.ts`, import the needed names from `./player-copy`. For the diagnosis model assembled in `src/main.ts`, import `siteCopy` from `./ui/player-copy` if choosing goals there. Choose one owner for goal composition to avoid doubling the site title.
4. Add the local font credit to the pause menu or credits using a real anchor with `href = import.meta.env.BASE_URL + 'licenses/Nunito-OFL.txt'`. Suggested visible text: “Nunito — The Nunito Project Authors · SIL Open Font License 1.1”. Retain the full license in the shipped bundle. CSS's `../../assets/fonts/Nunito-Variable.ttf` resolves from the stylesheet; do not change it to a root-relative public path.

These are integration instructions, not edits already made. Do not alter
`src/genlayer/catalog.ts`, contract fixtures, saved artifact IDs, validator logic,
approval/finality checks or wallet action semantics to use these labels.

## Selector map

| Existing surface | Styling / integration |
| --- | --- |
| `.expedition-menu h1` | Warm Nunito 1000 title; `PLAYER_COPY.title` and `.paused` supply text. |
| `.expedition-menu p` | Short `PLAYER_COPY.intro`, relevant controls and visible mode detail; replace the existing “In-progress build” paragraph as text, not by CSS-generated copy. |
| `.game-hud #mode`, `.rp-mode` | `MODE_COPY[mode].short`; single line in existing 240/220/196px box. |
| `.game-hud #diagnosis`, `.rp-diagnosis` | Current goal or actionable state message; no catalog solution example in the first header. |
| `.game-hud #prompt` | Real proximity prompt or `progressLabel(snapshot.restoredSiteIds.length)` plus exploration direction. Optional inline `.production-progress` span uses tabular figures; no new floating HUD rectangle. |
| `.game-hud #save-status` | Opaque small save notice; empty notices disappear. Do not put persistent progress here because repair-open hides it. |
| `.general-controls` | Compact pause/save controls; recovery controls retain real enable/visibility logic. |
| `#minimap`, `.map-route`, `.map-site`, `.map-player` | Rounded paper map, stronger paths/player; pending has a dashed outline. Existing SVG size, routes, positions and phases remain authoritative. |
| `.rp-tabs .rp-button` | `PLAYER_COPY.tabs[tab]`; underlying `data-tab`, `data-key`, roles and commands remain unchanged. |
| `.rp-socket-row`, `.rp-help` | Friendly socket/material labels within the unchanged 44px + 44px context rows. |
| `.rp-dock`, `.rp-content`, `.rp-tray`, `.rp-part` | Transparent dock, content-sized tray and individual paper controls. Existing scrolling/paging handles overflow. |
| `.rp-field-nav`, `.rp-detent`, `.rp-port-picker`, `.rp-endpoints` | Opaque selectable field/setting/connection text; real IDs remain command values. |
| `.rp-actions [data-key="test"]`, `.rp-drawer-actions [data-key="submit"]` | Teal primary controls. Submit text is mode-specific via `MODE_COPY[mode].submit`. Test stays advisory in connected mode. |
| `.rp-drawer`, `.rp-facts`, `.rp-rationale`, `.rp-details` | Journal page for explanation/review/feedback; exact facts remain available and scrollable. |
| `.rp-anchor`, `.rp-exit`, `.rp-status` | Opaque 44px anchor buttons and existing exit/status targets. No position, dimensions or marker translation overrides. |
| `.ending-journal` | Readable paper ending driven only by the existing real ending state. |

Optional new classes are hooks only: `.production-mode-detail` for visible mode
explanation, `.production-credits` for the local license link,
`.production-progress` for inline progress, `.production-hint` for a native
`details` element **inside the existing scrollable `.rp-details` area**.
No new panel, modal or working-area rectangle is required.

## Copy API and placement

`SITE_COPY` is exhaustively typed against the eight `IslandSiteId` values.
`siteCopy(id: string): SitePlayerCopy | undefined` safely handles snapshot strings.
Each site has `title`, `goal`, initial `fault`, `instruction`, three `tasks`, an
optional-to-show `hint`, and exact `requirements` for journal detail.
`COPY_FIXTURE_VERSION` records the catalog version checked; re-review copy if that
version or the authoritative facts change. Copy is not another validator.

Use the **goal alone** in the constrained `.rp-diagnosis` header, for example
`siteCopy(model.fixture.id)?.goal ?? model.fixture.title`. Do not prefix it with
the title a second time. Show title, initial fault, instruction and task list in
the inspect/Details flow as space permits. The initial fault describes the initial
artifact only: label it “On arrival” in a persistent journal, or stop showing it
after edits. Never override a live error, rejection, pending state or restored
state with stale fault copy. Dynamic status and feedback take priority; lengthy
messages need an accessible Details path rather than silent header truncation.

Keep `requirements` and authoritative facts in Details, not the first header.
Add a collapsed native `details.production-hint` with summary `PLAYER_COPY.hint`
and a paragraph containing the selected site's `hint`. It needs no new game
command. Retain existing feedback/metrics and let the scrollable Details region
hold the additional content. A future hint control must retain the 44px target
and fit the established dock; this handoff does not insert one.

| API | Use |
| --- | --- |
| `partLabel(siteId, optionId)` | `.rp-part-label`, part ARIA names, selected-part help and review text. Gear teeth and weight variants remain distinct. |
| `slotLabel(siteId, slotId)` | Socket cycler and anchor ARIA names. Use full label in accessible name even if the visible cycler ellipsizes. |
| `CONFIG_FIELD_LABELS[field]` | Setting/mount/mode/route heading in `configureContent()`. |
| `configLabel(valueId)` | Detent text and reviewed configuration. No replacement of stored value or action payload. |
| `portLabel(siteId, slotId, portId)` | `ports()` display label and review connections; find the artifact part by `endpoint.partId` and pass its **slotId**, not its instance ID. |
| `CHANNEL_LABELS[channel]` | Friendly mechanical/power/water link text. Keep channel IDs unchanged. |
| `factLabel(key, value)` | Supplied catalog fact entries; preserves `String(value)`, adds only known V/W/A units. No conversion or rounding. |
| `materialsLabel(used, budget)` | Render current material total and catalog budget without recomputing validity. |
| `progressLabel(restored, total = 8)` | Current restored count only; never count pending or cached connected approvals. |
| `MODE_COPY[mode]` | `.short` in HUD, `.detail` visibly in menu/Details, `.test` for advice explanation, `.review` before submission, `.submit` on the actual submit button. |
| `STATUS_COPY[phase]` | Exhaustively typed editing/testing/adapter statuses; `.label` for compact status and `.detail` in feedback. Append real upstream error detail. |
| `PLAYER_COPY` | Intro, controls, tab/action labels, rationale prompt and mode-specific ending sentences. |

The local label says “Local practice · local rules”; its visible detail explains
no wallet or independent review. Connected `accepted` is explicitly provisional;
`finalized` is still verifying the matching record; only `finalized-success`
reports final approval. The controller's existing restoration grant check remains
the authority. Do not derive approval from these strings or use connected status
labels to announce a local completion. `disabled.detail` is generic configuration
guidance; retain the actual invalid-configuration/network reason when supplied.

Numeric detail intentionally follows the immutable catalog's fixed units:
hoist load moment 6000/tolerance 250 and rails 1000/1500, rather than silently
mixing the site-plan shorthand 6/0.25 and metre examples. No unspecified flow,
capacity, mass or elevation unit is invented. All text describes this game's
rules and affords no actual engineering safety guarantee.

## Production and developer controls

`.production-ui:not(.production-developer-ui)` hides `.production-debug`,
`#style-toggle` and `#measure`. Primary should assign `.production-debug` to
additional authoring-only DOM, preferably in a dedicated developer menu. Toggle
`.production-developer-ui` on the body only from that developer UI. This releases
the skin's hiding rule; existing base CSS still controls features such as the
currently hidden measure button. The skin does not force those features open.

Keep pause, save, mode, pending/rejection/error states, required explanation,
wallet review/recovery and submit confirmation visible. Wallet activity/recovery
controls are operational recovery, not authoring debug. Keep existing mute
visibility until audio is actually wired. Do not use CSS to hide truthful mode
labels, replace status content, or imply completion. The old long solution header
and authoring intro require the explicit copy integration above; importing CSS
alone cannot fix their text.

## Bounds and expected integration checks

All values below are current layout expectations, not observed rendering of this
skin. The CSS sets no left/top/width/height/inset/transform on JS-positioned repair
outer nodes. It retains the 44px tabs, 88px context, 44px targets and assembly
offset of 132px. It leaves keyboard arrangement, hidden flags, pointer routing,
tab keyboard navigation, focus restoration and visualViewport logic intact.

| Viewport | Existing layout to preserve | Check after integration |
| --- | --- | --- |
| 1920×1080 | Side `(1392,612,504,444)`; assembly below its 132px controls; construct dock `(24,888,1344,168)`; scene `(560,140,820,720)`. Drawer changes dock width per `arrange()`. | Goal header, compact tray surfaces, no blank opaque dock, readable selected state, map and title. |
| 844×390 | Side `(8,64,196,240)`; assembly `(8,196,196,108)`; dock `(8,318,828,64)`; scene `(220,64,460,240)`. | 13–16px text, 44px targets, horizontal tray/field scrolling, action and exit reachability. |
| 667×375 | Side `(8,60,196,235)`; assembly `(8,192,196,103)`; dock `(8,303,651,64)`; scene `(216,60,390,235)`. | Goal fits two lines, 116px part buttons scroll instead of shrinking text, Details remains reachable with Test/Explain, drawer content scrolls. |

`repairRegions()` describes outer inset regions while `RepairPanel.layout.inset`
is the actual assembly region below the controls. Treat both existing owners as
intentional; do not “align” them by moving CSS. At other desktop sizes the two
existing implementations differ in scaling; this preparation does not change
that contract or claim its resolution.

Primary should check font-loaded and fallback states, keyboard focus, pointer and
touch, all eight sites, all three tabs, rationale/review/feedback, keyboard-open
drawer, pending/rejection/recovery, ending and pause. Long gear labels retain full
ARIA text; any remaining visible clipping must be resolved through shorter copy
or existing scroll/paging, not reduced font size or moved working rectangles.
Confirm primary actions remain reachable when Details appears after Test.

## Verification performed

- `npm run typecheck`: exit 0, including the new module through `src/**/*.ts`.
- Lightning CSS parsed the stylesheet with error recovery disabled: no warnings.
- Relative CSS font URL resolves to the new 276932-byte local file. Font signature and weight axis 200–1000 were read from the binary.
- Font SHA-256 and Git blob identity checked; full local OFL file equals immutable upstream bytes. Hashes and URLs are in `assets/fonts/NOTICE.md`.
- In-memory presentation checks covered all 8 site IDs, 62 part options, 67 configuration entries and 114 ports, plus budget/version agreement, numeric fact preservation, unknown-site lookup and provisional/final status wording. No test files or emitted bundles were created.

No rendered verification, image scores, stage verdicts or integration claims.
Primary integration and subsequent live capture/review remain outstanding.
