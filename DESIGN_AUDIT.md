# SEVEN DAYS — Design Audit (code vs. Master Bible)

Audited 24 Oct 2026 against the v2 build (after the visual and creature passes).
Method: read every design document in the project, searched Drive and past chats for anything else, then checked the source line by line. Nothing here comes from playing the game end to end; findings are from reading code, grepping required lines, and the capture/test runs I did earlier.

## Bottom line

The game is a **linear cinematic with all eight chapters present and almost all of the key dialogue in place**. The bible describes something bigger, and nearly all of that bigger part is missing:

- **There are no puzzles and no real interactivity.** The only thing the player can do is walk a ~20-second stretch of the Prologue beach. The "four stones" ritual is a 72-second timed cutscene, including its "failure and retry".
- **The second cycle is not a different experience.** Nothing makes the tapes explorable on the second pass. The friends become "hostile" only as a saved flag; no hostile friend ever appears.
- **Whole story beats are absent**: the Prologue chase, giant hole, bunker and SPLICEMASTER's "There you are. We've been waiting"; Alan's Day 2 disappearance; the lost child and flyers; the witch's basement and Big Brother.
- **Eight named characters are not built** (listed below).

The bible itself says this honestly in places ("not yet built"), but several of its status lines are out of date or too generous, so I list the real state below.

## What I audited against

| Source | Role |
| --- | --- |
| `SEVEN_DAYS_MASTER_BIBLE.md` | Authority; says it overrides everything else |
| `TAPE_AGENT_HANDOFF/templates/*` (brief, protocol, story summary) | Written for a separate tape builder; mostly mirrors the bible |
| `TAPE_HANDOFF.md` | Linking this game to the separate search game |
| `STORY_OUTLINE_REVISED.md`, `STORY_RUNDOWN.md`, `AUDIT_REPORT.md` | Older, history only |

Searched Drive and past chats: no other Seven Days design material exists there (hits were your Fading Age book, That Time Again and Showrunner files). **The search game's files and the missing `STORY_DECISIONS.md` / `SEARCH_STATUS.md` named in the tape brief are not available**, so the search-game side cannot be audited.

## 1. Interactive features and puzzles

| Bible requirement | State |
| --- | --- |
| First passage: authored footage with limited agency ("run/stop and constrained movement") | **Not built.** Only control is the Prologue beach walk (WASD or stick, drag to look, E to use the radio), about 20 s, then the script takes over. No run/stop control anywhere. |
| Second passage: the same tapes freely explorable, friends hostile | **Not built.** `loopCount` only changes the Hospital routing, Day 7's branch and the friend flags. No chapter changes behaviour on a second cycle. |
| Four-stone ritual puzzle (north/south/east/west, fire must stay lit, fail → place stones again) | **Cutscene only.** Stones appear on a timer, a radio says "It has failed. Place the stones again", they reappear, and the chapter ends at 72 s regardless. Nothing is placed by the player and a retry cannot actually happen. |
| Day 2 puzzles (the bible flags "puzzles... not yet built") | **Not built.** Warehouse, false exit and lift are watch-only. |
| Day 6 three doors, each a wrong answer | **Scenery plus one title and one "Try again."** No door can be chosen. |
| Interactive Story Mode: enemy AI, checkpoints, capture/recovery | **Not built**, and no hook for it exists in the engine. |
| Hidden pulse ending (stand still at the start) | **Built** (`pulse.ts`, idle trigger in the engine). Not played end to end by me. |
| Cycle-dependent endings (1st: living room advances, hospital fatal; 2nd: living room fatal, hospital true) | **Built as cutscenes** (`day7.ts`, `hospital.ts`, `hospitalFatal.ts`, routing in `GameCanvas`). |
| Tape handoff to the search game | **Built on this side** (`src/story`, return button). Never tested against the real search game, which has no ID yet. |

## 2. Chapter by chapter

Authored length is the last `finish()` cue in each file. Real time is that divided by the 0.7 campaign speed. These are arithmetic estimates, not timed playthroughs.

| Chapter | Authored → real time (est.) | Present | Missing against the bible |
| --- | --- | --- | --- |
| Prologue | ~142 s → ~3.4 min | Plane crash with all four friends talking, Sloppy lost, island, campfire, radio "day one of seven", tape, watcher, beach walk | **Cleaverback hunt, giant hole under the tree, Run Rabbit Run bunker, the TV, SPLICEMASTER's "There you are. We've been waiting."** (none of these strings exist in the code). Alan hurt on the shore is only implied. |
| Day 1 | ~232 s → ~5.5 min | Road approach, Hollowmere Galleria, dry fountain, dead escalators, directory line, shifting EXIT sign, terminal text as a title, Moppet takes Mitzi, chase, PA | Everything is a scripted chase; no free exploration or pursuit. Moppet is now a real model but still a placeholder performance. |
| Day 2 | ~125 s → ~3 min | Warehouse memories, false exit, Cleaverback returns, bedroom with SPLICEMASTER line, "RENDER DISTANCE" lift | **Alan's voice from a screen and his disappearance are missing, and his roster status is never set to missing.** The reflection is a line of dialogue and a glitch, no reflected figure. No puzzles. Very short against the 20–35 min target. |
| Day 3 | ~243 s → ~5.8 min | Unfinished world, signs, blue runner, debug chamber, 404 fall, Oliver lost; home-dream: kitchen, news report, "LAST SEEN", crawler, pentagram, figure in white | **Fennix (replaced by an unnamed voice).** Lost child, missing-person flyers, death certificates, growing siren, the "takeover" (the crawler just appears and vanishes; the player is never controlled), witch giving a puzzle. The figure says "Your room is exactly as you left it" and the player says "Mom?", a different idea from the bible's older witch. |
| Day 4 | ~199 s → ~4.7 min | 11:59 PM to 3:07 AM clock, NIGHT 01/02 counters, radio warning, "I'm outside", Speaker Tower, countdown, scratched warning, door | **Pale Thread (no guide character).** Bible says the six discoveries are still "brief narrated cues". Not verified in playback. |
| Day 5 | ~312 s → ~7.4 min | Crawlspace, the man speaking to bodies, Burned Accomplice chase, capture, hatch-room TV of the crash, ritual (timed), street, Grin Cat, Hound, Ink Man, film-editing exchange | **Big Brother and the basement; the instruction "say goodbye to all friends"**; Mr. Hush; the stones as a puzzle. The sequence does not play the sun/seals version in the tape brief (see conflicts). |
| Day 6 | ~220 s → ~5.2 min | Miss Merrily, doors, puppet warning, Tall Smile, control-room text, "Trapped? No. Preserved.", collapse, countdown, handoff card | **Buttonbell** (a nameless puppet), **Mr. Stillwell on screen** (sound only), **Keepsake drummer/usher/vocalist** (only Tall Smile). The control-room title reads THE STITCHING PROCESS, not THE SPLICEMASTERING PROCESS. |
| Day 7 | ~216 s → ~5.1 min | Core confrontation, all offer lines, mutation, living room, exact install sequence, loop to beach, second-cycle death branch | Splicemaster is a model now. I did not find the "cathedral of reels" growth or the camera being physically destroyed as authored set pieces (the camera is ended with a spoken "End recording."); worth checking in playback. |
| Hospital | ~81 s (fatal: 51 s) | True ending and first-cycle death | Lines are close but not exact ("He is too far gone" vs "He's just too far gone"). Wording is listed as open in the bible. |

Across the whole campaign: roughly **40 minutes** of authored footage, against a bible target that contradicts itself (about 22 minutes for the campaign in one place, 20–35 minutes per day in another). Either way it is far shorter than the per-day targets.

## 3. Characters

| Character | State |
| --- | --- |
| Hand-built models now | Watcher, Cleaverback, Velocity Wraith, fox, Long Neck, Speaker Tower, Grin Cat, Hound, Ink Man, Burned Accomplice, Miss Merrily, puppet lamb, Tall Smile, Splicemaster, Morrow Moppet, white figure, ritual presence |
| Humans | Protagonist is camera only. Friends use the shared humanoid builder; they appear in the crash only |
| **Not built at all** | **Fennix, Pale Thread, Buttonbell (as a character), Mr. Stillwell (visible), Mr. Hush, Big Brother, the witch (designed as "figure in white"), the Keepsake animatronics (other than Tall Smile)** |
| Friends in later chapters | Mitzi appears only until Day 1, Alan never appears after the crash, Oliver until Day 3. No friend appears on a second cycle as a hostile figure |
| "Lolo and Yuri" | Named in the tape handoff as helpers in the search game; not part of this game |

## 4. Exact-line check

I searched the source for about 80 quoted lines and titles from the bible. All present except those below.

| Missing or different | Where |
| --- | --- |
| "There you are." / "We've been waiting." | Prologue bunker scene (scene does not exist) |
| "Say goodbye to all friends" (radio instruction) | Day 5 ritual |
| THE SPLICEMASTERING PROCESS (title) | Day 6, currently THE STITCHING PROCESS |
| "She doesn't control the show." | Day 6, written "She does not control the show." (the speaker is unnamed) |
| "He's just too far gone." | Hospital, written "He is too far gone." |
| Alan's screen voice on Day 2 | Not present |

(Day 7's "You did finish the story. Now you get to tell it." is present, split over two subtitle cues.)

## 5. Conflicts between your own documents (need your call)

1. **Ritual content.** The bible keeps self-immolation, implied off-screen. The tape brief and story summary say the ritual is **non-violent**: Father, Son and Holy Ghost seals, the sun rises, one last deep cry, the protagonist is blinded and collapses. The code follows the bible (the radio says "Set yourself on fire").
2. **Ritual failure.** Bible: failing means retrying the stones, no game over. Tape brief: failing the stones leads to an **endless hallway**. The code has the retry line only.
3. **Voices.** The tape brief says captions only, no synthesized voice. The engine does render captions only, but the bible's status text still describes synthetic voices and "real voice acting" as a to-do.
4. **Chapter order and length.** Older outlines merge Days 5 and 6 and put the crawlspace in various places. The bible settles it (seven days; Day 5 expanded). The code matches the bible.
5. **Playtime targets** contradict each other (see above).
6. **Older files name characters the bible dropped or renamed** (Keeper Thatch, The Fog, Grinwick, Inkwright). None are in the code; the bible's names are used.

## 6. Suggested order of work

1. **Decide the three open calls above** (ritual violence, failure consequence, voices). Everything in the ritual depends on the first two.
2. **Prologue completion**: Cleaverback hunt, giant hole, bunker, TV, SPLICEMASTER's line. It sets up everything else and is the largest hole in the story.
3. **Alan's Day 2 disappearance** (small, and fixes the roster).
4. **Missing characters**: Fennix, Pale Thread, Buttonbell, Stillwell, Big Brother, the witch.
5. **Interaction layer**: start with the stone ritual as the first real interactive puzzle, since it already has a retry design; then run/stop and constrained movement for the first passage.
6. **Second cycle**: explorable tapes with hostile friend encounters (the biggest piece; needs enemy AI).
7. **Lengthen chapters** toward your pacing target, using the existing beats as anchors.
8. **A real playback pass** of the whole campaign. Nothing in the bible's "built" list has been seen played through; the AUDIT_REPORT, the bible and this audit all say so.
