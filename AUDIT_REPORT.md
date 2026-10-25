# Seven Days — Audit Report (latest repair pass)

## Scope

This pass audited the current cinematic campaign's startup, chapter selection, saves, completion flow, timeline scheduling, and the reported Day Five failure. It is **not** a certification of full campaign playback, horror quality, finished character art, or Story Mode gameplay. No campaign chapter or dialogue sequence was removed to satisfy the test-room removal request.

## Requested cleanup — completed

- Removed the walk-around test-room menu button, its playback branch, its HUD/stamina state, and `src/game/slice/SliceGame.ts`.
- Added a shared prerequisite rule: each day requires **all** earlier episodes to be complete. Prologue is initially available; Day One requires Prologue; Day Two requires both; the same rule continues through Day Seven.
- Enforced the rule in the menu and again at playback startup. Locked chapters cannot be launched just by changing the selected episode.
- Completed chapters remain replayable. Continuous playback advances only into an unlocked next chapter.
- Old saves keep their contiguous, genuine completion history. An old save that contains skipped-day completions does not imply the missing chapters were finished; no completion is fabricated to unlock a later day.

## Day Five failure — root cause and fix

The street floor used `Object.assign` to replace a Three.js object's `position` and `rotation` properties. These are read-only object references; their values must be changed through the existing objects. Replaced this operation with `rotation.x` and `position.set(...)`. This was a concrete startup-exception source, not an assumed problem with combining chapters.

Also corrected Inkwright's existing world-space positions relative to the distant factory, and changed cloud movement to elapsed-time positions rather than accumulating a movement amount every frame.

## Crash/island visibility repair

The crash cabin and island used to remain visible together, and the crash overwrote the island's initial camera and background. The two environments now have explicit visibility handoffs, the shore restores its own camera/background/fog, and the 70-second timeline offset is scoped and restored. The post-impact wake-up shows the island instead of the intact cabin. Existing crash and island dialogue is retained.

Fixed the leftover Mara/Jonah spoken names. Oliver now answers on the shore, instead of Sloppy answering immediately before everyone asks where Sloppy went.

## Material defects found and addressed

### Timeline, dialogue and ordering

- Added absolute-time expiry scheduling for titles/subtitles so act offsets cannot add an extra delay.
- Browser development speech no longer builds an ever-growing queue behind the active subtitles. It remains **temporary synthetic VO**, not final recorded performances. Some source lines are still scheduled too closely; exact voice timing needs a listening pass.
- Day Two's descent no longer blacks out at its beginning; separated conflicting lines and extended its ending rather than deleting lines.
- Extended Day Three's ending to give Oliver's final line more time, and corrected the forest landing height to match the forest's actual location.

### Completion (previously unsafe)

- Stopped the finished episode's timeline/render loop while its completion overlay is showing.
- Removed the hard-coded “END OF PROLOGUE / Day One is still being recorded” message from every chapter ending; it now names the actual completed chapter and next unlock.
- Cleaned up the delayed menu-return timer when leaving/replacing an episode, preventing a stale timer from interrupting later playback.
- Added recoverable menu feedback for startup or frame-update failures, without marking the failed chapter complete.
- A build failure disposes the partially created cinema scene/canvas/audio instead of leaving it behind.

### Saves and progression

- Saved progress now includes loop count and the friend roster; previously `saveProgress()` silently omitted them.
- Filled partial friend rosters safely and kept hostile friend states from being reverted by first-run disappearance cues.
- The loop marks **all four** named friends hostile, including those previously recorded lost. This repairs state tracking; on-screen hostile companion performances are still incomplete.

### Camera, accessibility and presentation

- The pause-menu Reduced Motion setting now applies to cinematic bob, shake, roll and sudden FOV effects, rather than being limited to the removed test room.
- Used a standard colour render target for the VHS pass, avoiding reliance on float-colour render attachments.
- Moved the living-room background/fog change to the actual living-room entrance; it no longer changes the Core during startup.
- The final loop fade now reveals the reused Prologue island instead of the living-room scene while dialogue claims to be on a beach. There is no RUN 2 title.

## Checks that could actually be run

### Release-rules scan (source rules only)

This scan covers source-level release rules, not compilation, cutscene loading, dialogue accuracy, or visual quality.

- **13 of 14 checks passed**
- **0 critical findings**
- 1 warning: no explicit native screen orientation in `game.config.prod.json` (native hosts default to portrait). This pass did not invent a deployment configuration to suppress the warning.

### Searched-reference check

Searched active source references after removing the test room: no remaining SliceGame launch/state/HUD references were found. Lifecycle analytics remain registered once at GameCanvas module scope.

### What could not be verified

The live preview capture returned `ECAPTURE`: Studio did not return an image. It was not retried. **No episode was seen running during this pass**, and no claim is made that Day Five or the complete cinematic sequence has passed browser playback.

An attempted sandbox execution of progression/timeline logic was blocked because dynamic code execution is disabled. No unit-test pass result is claimed. The prerequisite cases below are a verification matrix, not falsely reported executed tests.

Also verify: finish with continuous playback on/off; replay without duplicate completion; pause/resume; leave during a completion delay; reload after an unlock; malformed save recovery; save failure/retry; Day Five startup; crash-to-shore camera/visibility; each title and last subtitle across a transition.

## Remaining gaps (not silently closed)

- These are short procedural cinematic prototypes, **not** the full master screenplay or an implemented survival-horror campaign.
- Day One currently depicts a ranger-station forest, not the requested complete Backrooms/crawlspace material. Its proper story expansion is still outstanding.
- Bodies in the Crawlspace, Run Rabbit Run, the new ritual/stones sequence, and the hospital route are not implemented in full.
- Day Two still lacks the full bedroom, memory-sorting performance, working memory footage and full elevator/catwalk set pieces. The claimed delayed reflection is not actually implemented as a reflected character.
- Day Three/Day Four/Day Five/Day Six contain simplified creature geometry and legacy draft character labels/designs that still require the original-character bible pass.
- Friend disappearance flags exist, but animated companion appearances, their actual disappearance performances and second-loop hostile encounters are not complete.
- The crash is not yet a finished plane-crash production: detailed airplane/wreckage, rigged friend performances and realistic destruction are missing. The end-loop beach likewise does not have finished plane wreckage.
- The finale still needs a fully authored pursuit, physical camera-removal/destruction performance, complete living-room set and hospital/escape path. The ending text remains intact.
- Synthetic browser voices are development fallback only. Original voice acting, reliable voice/subtitle synchronization and spatial voice audio remain incomplete.
- Reduced Motion is now connected, but a separate complete reduced-flash/distortion/audio-accessibility suite is still outstanding.
- Full Story Mode movement/AI/puzzles/checkpoints are not supplied by the cinematic engine; removing the test room does not convert cinematics into interactive campaign gameplay.
- Found-footage realism, final licensed/original art, horror pacing, end-to-end playback and device performance all require further measured production work.

## Modified areas

Menu, playback boundary, shared campaign progression, save store, HUD, loading screen, cinema engine, Director, camera rig, audio cleanup, VHS target compatibility, Prologue/crash staging, Day Two/Three/Five/Seven repairs. The test-room file was deleted. Existing Day One/Four/Six chapter content was retained.

## Release status

Not published in this pass. Do not deploy as a finished campaign until the playback matrix, full dialogue/scene manifest, character originality checks and manual horror/accessibility review have passed.
