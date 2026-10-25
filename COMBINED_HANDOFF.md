# SEVEN DAYS — combined build (one app, two games)

No iframes, no `navigateToGame`. The cinematic game (found-footage tapes) and the interactive game (first-person
search) are one Vite bundle. A small state machine (`src/journey/`) decides which one is on screen and hands the player
back and forth. Same save, same menu, same audio unlock.

## The route

**Pass 1 — the interactive game leads, the cinematic game is the tape you watch**

1. Boat → beach → prologue → interactive Day 1
2. After Day 1: tape room → **cinematic Day 1** → back to interactive Day 2
3. Repeat: interactive Day N → tape N → cinematic Day N → interactive Day N+1
4. Interactive Day 7 + living room → `return_seven_days` → pass 2

**Pass 2 — the cinematic game leads, the interactive game is the tape**

1. Cinematic prologue (the boat, then the plane crash, then the beach — free to walk, holds at the camp until you get there)
2. Cinematic Day 1 (free-roam) → **VCR room**: take the tape from the coffee table, put it in the VCR
3. Interactive Day 1 plays as a guided tape (see below) → "END OF TAPE" → cinematic Day 2 → VCR → interactive Day 2 tape → …
4. Cinematic Day 7 → VCR → interactive Day 7 tape → **MERGE ENDING**

## Interactive game as a tape (pass 2)

`PrologueGame` with `autostart: 'tapeDay'`. It is the same world, but:
- all four friends are alive and the flashlight is in your hand (things are slightly "wrong" on purpose: it is a dream)
- VHS filter, tracking band, `▶ PLAY` badge, no compass, no E prompts
- you cannot explore: an autopilot walks the day's interactables in order. Hold **Shift / W** (or drag the stick) to fast-forward x2.3; mouse/touch looks around freely
- if it stalls (stuck 1.5 s or idle 9 s) it glitch-jumps to the next beat; the tape ends when the route is finished, after 3 captures, or at the time cap (120 s, 190 s on Day 7)
- `END OF TAPE` → `opts.onTapeDayEnd` → journey continues

Mapping (cinematic Day N ↔ tape N): the interactive game offers tape 1 after its Day 1, 2 after Day 2, 3 after Day 3, 4 after Day 4, 5 after Day 5's film, 6 after the sun ritual, 7 after the Day 7 core.

## The two endings

### Wake-up ending (the dog)
On the opening beach of pass 1 the boatman is standing by the boat with his dog. Walk up, press **E** ("Sit down with the dog") and stay seated. The dog lies against you. A few lines of narration; from ~7 minutes a faint monitor beep starts under the waves and the screen slowly whitens. At 10 minutes of sitting you wake in the hospital (`hospital_wake` passage in `src/search/passages.ts`): "Oh my God, he is awake" / "It is a miracle" / "Seven days. You were gone for seven days." → `journey.credits('wake')`. Any movement stands you up and resets the timer.

### Merge ending (the tape)
`src/journey/mergeScene.ts`. One WebGL renderer, two live rooms composited by a full-screen shader: the VCR living room (left, smooth, warm, `● REC`) and the grey tape room (right, rendered at PSX resolution, `▶ PLAY`). **One input drives both walkers**: they start apart, drift together as you approach the televisions, and press E together. The tape goes in, the divider tears, the two pictures fold into a double exposure, a tornado of picture spins (camera roll + twist shader), flash, and the view pulls back from the bed: family around it, nurse at the foot, a steady tone, no heartbeat. Fade to black → `journey.credits('death')` ("THE LINE HOLDS STEADY").

The cinematic game's own idle "pulse" ending still exists and routes to `credits('pulse')`.

## Where things live

| Piece | File |
| --- | --- |
| Route state machine, persistence (`sevendays_journey_v1`) | `src/journey/journey.ts` |
| Mounts each stage, tape-loading bridge, credits | `src/journey/JourneyRoot.tsx` |
| Menu (NEW GAME / CONTINUE / TAPE ARCHIVE) | `src/journey/JourneyMenu.tsx` |
| Merge ending | `src/journey/mergeScene.ts`, `MergeEnding.tsx` |
| Interactive game (all of it) | `src/search/*` — `game.ts` has the options (`SearchOptions`), tape mode, dog ending |
| Beach dog + boatman | `src/search/beachDog.ts` |
| Cinematic engine free-roam / VCR options | `src/cinema/engine.ts` (`EngineOptions`), `src/cinema/vcrRoom.ts` |
| On-screen walk stick + USE button | `src/ui/RoamControls.tsx` |

## Testing

`npm run typecheck`, then Playwright scripts in `tests/combined/` (build with the fake host: `OUT=dist-test npx vite build --config tests/ui/vite.fakehost.config.mjs`, then `node tests/combined/<script>.cjs dist-test shots`):

- `flow0.cjs` first pass handoff · `flow1.cjs` second pass chain · `vcr.cjs` VCR room · `tapes.cjs` (`DAYS=2,3`) every tape day · `dog.cjs` dog ending · `hosp.cjs` wake scene · `merge.cjs` merge ending beat by beat.
- Debug hooks: `window.__journey` (`go`, `get`), `window.__sd_search` (interactive game; `clock += n` time-warps it), `window.__sd_cine` (cinematic engine; `finish()`), `window.__merge` (`skipTo('insert'|'hospital')`, `step(dt)`), `window.__sd_norender = true` (skip drawing, for slow machines).
- These tests ran in software GL, where the interactive game draws about 0.4 fps. On real hardware it runs normally. Nobody has played this on a real GPU yet.

## Known limits (first pass)

- Free-roam on the cinematic side is a tether around the camera rail, not full collision. You can walk through some set dressing.
- Tape mode is an autopilot over the existing interactables, not a re-authored "tape version" of each day. Cycle-2 differences are mostly: friends alive, flashlight, VHS treatment, coma-aware lines. Per-day tuning (different props, altered dialogue, monsters swapped) still to do.
- Hostile-friend behaviour in tape mode is only wired for Days 2 and 3.
- The merge scene is built from boxes and the existing companion figures; it wants art (real faces for the family, a proper bed).
- Mobile: walk stick + USE button exist for roam, VCR and merge; tape-mode fast-forward is "touch the stick".

## Static hosting (no RUN.world needed)

`npm run build:static` → `dist-static/`. It swaps the RUN SDK for `src/static/sdkShim.ts` (saves in localStorage, ads/leaderboards/etc. are no-ops). Upload the folder to any static host (GitHub Pages, Netlify, itch.io, S3). It uses relative paths, so a subfolder works. It must be served over http(s); opening `index.html` from disk (file://) is blocked by the browser for module scripts. The normal `npm run build` stays the RUN.world build.
