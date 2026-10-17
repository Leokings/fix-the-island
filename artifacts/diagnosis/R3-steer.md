# R3 steer: island stuck-loop diagnosis

Diagnoser, files only. Publish stays LOCKED. Bar and refs unchanged.

## 1. Root cause

The loop is polishing surfaces when the problem is the layout. Under blur, every ref is a few big interlocking masses: about 20–30% vertical rock face, 30–40% connected canopy, narrow saturated ochre paths and only about a third open ground. Every game half is one walkable plane, about 55–65% open, with props spread across it. R1–R3 used rung 1–2 tactics (palette, grain, ripple strokes, small terrace raises), so the mass composition never changed.

- **Elevation is too small to see at pitch 48°.** A 1.7 m riser shows as about 70 px, less than one hero height, so blur removes it. Ref cliffs take 250–400 px. Widening ramps for walkability (R3 handback) flattened them further.
- **Upland is not upland.** Its 3.2–4.6 m trigger makes still-05 a low hump with the sea in view, so no cool, enclosed ref-05 frame is possible.
- **Features are small in the frame.** Hero size is close to the refs (about 90 px vs 100–150 px), but buildings and terrain are 2–3× smaller (ref-01 door about 150 px, still-02 doors about 60 px). Desktop span is 16.5 m (`three-renderer.ts:381`), twice the Stage-B candidate of 8.4 m, which was never locked. Span is adjustable; yaw and pitch are not.
- **Fine detail is lost under blur.** Grain, tuft glyph and dashes are all under 10 px and average to flat fill.
- **Capture slots repeat.** still-01/02/03 show the same village spot. Nothing on the island resembles ref-02 (dense meadow against a structure), ref-03 (ravine, water on a lower plane) or ref-04 (cove enclosed by cliffs).
- **Effort is spread too thin.** Stage C sub-gates were skipped for the rebuilt island, so each punch list covers all 11 criteria while C2/C3 block everything.
- **Not the cause:** pixel rendering. BAR and LOOK exclude the pixel filter, and blur removes it. A stack change (rung 4/5) is not justified, because the Critic confirms shadows, contact darkening, fog and grade in R1–R3.

**Correct rung:** rung 3 (terrain displacement and density) at the layout scale, with large-scale material patches from rung 2.

## 2. Evidence

- R01 #1, R02 #1 and R03 #1 say the same thing each round: "open olive/green/sand fields with isolated props".
- R02 #2 and R03 #2 say "one rolling plane without visible cliff faces", even after 1.15 m and then 1.7 m terraces.
- R03 #3: "one repeated stamped tuft glyph", despite R3's grain pass.
- sxs-01-blur across R1, R2 and R3: the hue drifts from straw to green, but the layout stays the same. The ref shows a cliff band, connected canopy and a cliff bowl.
- sxs-03-blur: ref is about 80% canopy and water. Game is the village again, with the creek level with its banks.
- sxs-04-blur: about 55% open sea with no cliff or foliage framing.
- sxs-05-blur and still-05: sea and palms are in view from the "upland", and a straight creek slab runs down the slope (R03 #8).

## 3. What to stop doing

- Do not add detail under 10 px (grain, tufts, dashes, ripple strokes) as a C1 or C3 fix.
- Do not raise terraces in small steps, and do not widen ramps until the terraces disappear.
- Do not do palette-only rounds.
- Do not spread props evenly across open ground.
- Do not capture several slots in one spot.
- Do not split effort across HUD, crews and manifest before the blur pairs change.
- Do not start a pixel-filter, outline or stack-change project.

## 4. Steer instructions (next 1–2 rounds, by blur impact)

1. **Cliffs as walls (rung 3).** Rebuild elevation as plateaus separated by impassable faces 4–8 m tall (about 260–500 px on screen). Put traversal on 2–3 m ramps or stairs only where paths cross. Keep the 38° and 0.22 m rules on those corridors, with collision on cliff edges. Give the faces large strata bands of 0.5–1.5 m in cream, rust and grey, with dark crevices. Aim for 20–30% of each slot in vertical rock.
2. **Real upland.** Raise the upland plateau to at least 10 m, enclosed by ridges or conifers so no sea is visible. Retune the cool-grade trigger and add mist in the valley below, never over the hero.
3. **Canopy massing.** Replace single trees with overlapping clumps of 4–12 crowns, 6–9 m tall in rust, ochre and olive, with dark bases. Line paths and cliff tops, and fill frame edges and foreground. Shrink the cutaway to the hero and the active interaction. Target 30–40% canopy and at most 35% open ground.
4. **Camera span.** The Orchestrator logs the decision. Change desktop span from 16.5 to about 12–13 m (narrow screens about 11 m), keeping yaw 35 and pitch 48. Expect the hero at about 110–130 px. Check that each site still shows its approach (GAME-DESIGN §12).
5. **Ground patches (rung 2).** Replace the tuft and grain with 2–6 m colour patches (yellow-green, olive, rust litter) and narrow 1.5–2.5 m saturated ochre paths. Widen the warm grade's saturation and value range, and cut the grey haze in coastal and woodland scenes.
6. **Water in channels.** Sink the creek 1.5–3 m below visible bank faces. Use stepped pools or a waterfall instead of tilted slabs, with cyan or teal values. Set the bridge shoes on raised banks. Shape the landing into a cove held by bluffs on two sides.
7. **Six distinct slot locations**, each captured once:
   - ref-01: settlement under a cliff.
   - ref-02: pump in a dense flower meadow.
   - ref-03: ravine bridge.
   - ref-04: enclosed cove.
   - ref-05: cool upland with a dialogue line.
   - ref-06: pier hoist over water and rocks.

   Fix the C4 manifest wording in the same capture.

## 5. Success check

In the next blurred side-by-sides:

- Each game half shows large dark-to-light masses (cliff band, canopy blocks, ochre path), with open ground at about a third of the frame or less.
- sxs-01, sxs-03 and sxs-05 show rock bands of at least about 250 px.
- sxs-04 water is enclosed on two or more sides.
- sxs-05 is cool lavender-blue with no sea.
- sxs-03 water sits below its banks.
- Buildings read about 1.3–1.5× larger.
- The six halves show six different places.

If R4 still reads as "isolated props on open fields", diagnose again before moving to rung 4 or 5.
