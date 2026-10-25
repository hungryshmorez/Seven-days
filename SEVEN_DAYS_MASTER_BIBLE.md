# SEVEN DAYS — MASTER BIBLE

This is the single reference for the project: the story from start to finish, the characters, the level-by-level breakdown, the production rules, the open decisions, and the current implementation status. Where this document and an older file disagree, this document wins. Older files (`STORY_RUNDOWN.md`, `STORY_OUTLINE_REVISED.md`, `AUDIT_REPORT.md`) are kept for history.

---

## 0. Latest creator direction — two separate games, one layered story

**Latest approved handoff:** Keep the games separate, with their existing engines. Search Day One finishes → a tape is found and inserted → this game opens its Day One recording → completion returns to Search Day Two. Repeat for the numbered days. Do not merge the engines or keep both games rendering at once. Day Seven needs an explicit finale/loop handoff rather than inventing a Day Eight. A normal replay is not a new cycle.

**Latest approved setting:** Day One is an original abandoned mall, **Hollowmere Galleria**, not the Backrooms setting. The names, signs, layout and Morrow Moppet design are original to this project; this is creative direction, not a legal clearance claim. The original road/station recording stays as an exterior approach; the mall adds shuttered shops, a drained fountain, bricked-up escalator landings, a changing directory, a food court and a former children's display. Mitzi disappears here and the reassignment reveal remains.

**Authority:** This clarification takes precedence over older passages that describe the project as only a linear film or only a free-roaming game. It changes how the existing story is experienced, not permission to delete or shorten it.

**The campaign remains the Prologue plus SEVEN distinct days, with seven friends' tapes.** Consolidating activities inside a day is not permission to remove a numbered day or collapse the campaign into one night. Day Four's forest is one continuous nightmare night with all its encounters retained. The combined Day Five activities make a longer Day Five; Day Six remains The Broadcast, with its own identity and complete story. Day Seven retains the Core and the cycle-dependent endings. Reorganising a sequence must preserve its dialogue, scenes, discoveries and consequences; it is not a shorter edit of the story.

### The two layers

- **The search:** The separately developed, more freely playable version follows someone returning to find their friends. Completing each search level leads to finding a tape. The player inserts that tape, experiences it, and then continues the search. The identity of this returning person and the exact search-level sequence are not assigned here.
- **The recordings:** This project is the cinematic/original-tape side. The seven tapes are the friends' recordings. Existing Prologue and day material is retained. The creator has now matched numbered recordings to numbered search days: Search Day N discovers the tape that opens this game's Day N. Prologue placement remains separate; do not invent a physical tape for it.
- **The intended rhythm:** search a location → complete its level → discover a friend's tape → insert and experience it → return to the search. Seven tapes does not imply seven different friends; the established named friends remain Mitzi Goins, Alan the movie guy, Sloppy the 1980s rodeo clown, and Oliver the priest and glitch exploiter.

### First passage through the recordings

The tape follows an authored recording. The viewer has limited influence, including run/stop and constrained movement, but cannot freely explore or choose unrelated directions. This is experienced footage with a little agency, not unrestricted first-person roaming and not a flat video. It must preserve the recorded scenes, performances, scares and dialogue. Do not turn the first viewing into a freely explorable version by default.

### After the loop — second passage

After completing the first cycle and returning, the same tapes become freely explorable. The change is encountered through the experience, not announced with a RUN 2 title card. Friends become enemies on this second cycle, as previously directed. An ordinary replay of an individual tape before completing the first cycle must not be confused with reaching the second cycle.

The difference between the first and second passages is intentional: first the recording leads the viewer; later the viewer can move around inside it. Keep the underlying story and locations continuous instead of replacing the recordings with unrelated levels.

### Combining the projects

Keep both games separate. RUN's game-to-game navigation supports unloading one game and launching the other with a small context message. This side now accepts a validated numbered-tape request and returns a tape-result message to the search game supplied by that request; no target game ID has been invented. See `TAPE_HANDOFF.md` for the agreed message format and the other side's required behavior. The other game's navigation and save handling are NOT available or verified here. Actual connection requires its game ID and matching behavior in that project, not a merged engine. Completing a tape and completing a search level are separate pieces of progress; a chapter selection must not silently stand in for discovering its physical tape.

**Status:** This side's incoming-tape selection, single-tape stop, saved return state and return-to-search button are authored using RUN navigation. Normal standalone chapter playback remains available, with all seven days unlocked. The actual two-game round trip, guided first-viewing controls, second-cycle exploration and hostile-friend performances are not certified complete. No connection to the other game has been tested.

---

## 0b. The governing reveal and cycle-dependent endings (creator-directed)

**Title:** SE7EN D4¥§ (the stylised title as written by the creator; the working title remains SEVEN DAYS until approved).

**The reveal:** The protagonist has been in a coma the whole time. The search for friends, the island, the days and the tapes are a dream or recursion inside that coma. The protagonist believes they are trying to bring friends home and escape. In truth, each attempt to escape carries them deeper into the coma.

**The friends were at the hospital.** The named friends, Mitzi Goins, Alan, Sloppy and Oliver, are fragments of the protagonist's own life and past. Every character is a part of the protagonist. The world's monsters, SPLICEMASTER included, are parts of the same mind.

**How it is planted (must be done subtly, never announced early):**

- Medical sounds, the accident reports, the repeated siren and apparent memory gaps foreshadow the coma. The hospital is not an interchangeable extra route: reaching it follows the cycle-dependent outcomes below.
- The loop (waking on the beach and asking "Am I already dead?") and the repeated siren are the mechanism: each cycle is the mind replaying the dream.
- The friends' disappearances mirror the protagonist's losses over time.
- The living-room finale's hands and reflection (a mismatch in the mirror) hint at a body that is not whole.

**Both established endings remain.** The living room closes the first cycle and the hospital concludes the second. The friends are at the hospital while the nightmare portrays their remembered counterparts; searching for them inside the nightmare leads deeper into the coma. Keep the entire living-room sequence and its exact INSTALLATION SUCCESSFUL text. The hospital does not replace or erase it.

**Canon structure (creator-approved):**

1. **First run — living room advances; hospital is fatal.** The protagonist reaches the living room, is told "Welcome back," and the story seems to end with INSTALLATION SUCCESSFUL / PLAY AGAIN?. The protagonist begins to understand the dream/coma and enters the next cycle. Reaching the hospital in this first cycle instead causes death.
2. **Second run — hospital (true ending).** The living room is now fatal. Taking that route on the second run kills the protagonist. The protagonist must go to the hospital instead.
3. **The hospital ending.** The protagonist hears the staff pull the plug: he is too far gone, letting him go is better, he wouldn't have wanted this. The protagonist screams at the top of their lungs and no one can hear. The family gave him seven more days; everyone begged him to wake up.

**Dark content note:** The first-run death is an outcome, not a gratuitous scene. The plug-pulling is emotionally heavy, so its tone should be restrained and human, not gory.

**Open detail to confirm later:** The exact wording of the hospital staff's and family's lines, and whether "seven more days" is spoken aloud or only shown on screen.

### Creator decisions on the combined structure (supersede earlier notes)

- **The story handoff does not depend on seeing the other version's search map.** Its exact locations and tape placements are not prerequisites for agreeing the story. Connecting the working games remains a separate task once their files are available; this document does not claim that combining files alone completes that task.
- **Seven days remain.** Only the forest's repeated-night structure is consolidated into one long night inside Day Four. The whole search, the seven tapes and the seven-day campaign are NOT a single-night campaign.
- **Day Five combines activities; Day Six is not deleted.** The crawlspace, studio and added ritual/stone activities form the expanded Day Five. The Broadcast remains Day Six. Consolidation makes room for a distinct following chapter rather than reducing the chapter count.
- **Both aesthetics and all story material are retained.** The horror and show-world material work within the found-footage presentation; consolidating a sequence does not discard either world or its encounters.

These are story-structure decisions, not claims that the reorganised scenes are already built.

### Hidden Easter egg: the pulse (the survival ending)

- **Trigger:** In the interactive version, the player stands still at the very beginning of the game and waits for a long time without moving or acting.
- **Effect:** The protagonist feels a shock. A doctor says, "I've got a pulse."
- **Result:** The protagonist wakes in the hospital the next morning. They were pulled out of the coma and survive.
- **Status:** Not built. This is a secret ending that exists alongside the canon endings and does not change them. It is not a required scene and must not be shown in cinematic playback as the main story.
- **Note:** This ending conflicts with the bleak plug-pulling ending on the second run, so it should be reached only by the idle trigger, not as a normal route.

---

## 1. Creative rules (apply to every scene)

1. **Nothing existing is removed.** Every scene, line and beat already written stays. New material is inserted before, between or after existing beats.
2. **Found footage.** The camera is the protagonist's bodycam. Mostly it sits at chest height, moving with the protagonist's breathing and steps. Occasionally a scripted shot follows the protagonist or looks over a shoulder, as if from a second device or surveillance feed. Never a third-person cut.
3. **VHS is a readable layer, not a wall.** Normal footage shows a thin rolling scan line, a little colour bleed, and rare dropouts. Heavy distortion is reserved for story corruption: the crash, reality breaks, the finale.
4. **Horror is earned.** Mix quick jolts with slow psychological dread. Build with silence, then a sudden hit, then release. Never three jumps back to back. Every scare has a readable cause.
5. **Original characters only.** No copied franchise designs, names or silhouettes. Each creature needs its own shape, sound and movement.
6. **Dark content is the creator's call.** Graphic self-harm and similar material are open decisions (section 9) and are not implemented until approved.
7. **Playtime.** Chapters should be longer and more immersive, not shorter. Pacing targets: Prologue 15–25 min, each day 20–35 min.

---

## 2. Story start to finish

### Prologue — The Island

The protagonist boards a small charter plane with four friends: **Mitzi Goins**, **Alan** (the movie guy, with a camera), **Sloppy** (an 80s rodeo clown) and **Oliver** (a priest and glitch exploiter). The engine fails, a warning light flashes, and the plane goes down on a remote island. **Sloppy is lost** in the wreckage. The survivors wake on the shore; Alan is hurt. The island is disorienting, like being drunk. A radio plays "day one of seven." At the empty campsite the protagonist finds a tape, and a figure watches from the treeline. A creature called **Cleaverback** (bark-plated shoulder hump, rope mane, split jaw, one rusted butcher blade) hunts through the forest. The chase ends at a giant hole under the largest tree, which drops into **Run Rabbit Run**. In the bunker the tape plays on the television and **SPLICEMASTER** speaks: "There you are. We've been waiting." The protagonist is pulled through the screen into Day One.

> Status: crash cabin and shore are built as cinematic beats. Exploration of the beach is partially built. The chase, the bunker and the tape are cinematic only.

### Day One — Hollowmere Galleria / The Abandoned Mall

An original abandoned shopping mall, replacing the former corridor setting at the creator's request. Preserve the existing forest-road, station clock, watcher and impossible day-sign beats as the approach, then enter the galleria. Slate-and-terracotta tiles, shuttered storefronts, a dry fountain, dead escalators ending at a wall, empty food-court furniture and the Little Lantern Playhouse display. An EXIT sign shifts between storefronts. The directory says **YOU ARE HERE / NO EXITS ON THIS LEVEL**. A terminal reads: **"THE SYSTEM DOES NOT KILL USERS. / IT REASSIGNS THEM."** **Morrow Moppet** retains its original teal drapery, uneven wooden legs, overlong hands and horizontal porcelain-tooth mouth. **Mitzi is taken behind the playhouse shutter and is missing.** The bodycam flees through the food court to service access; the PA repeats the reassignment rule.

> Status: original approach retained, with a new approximately 167-second mall act after it. Mall geometry, signage, a simple Mitzi figure, a procedural Morrow Moppet performance, disappearance and authored chase are present. These are cinematic placeholders, not free exploration or pursuit AI, and have not been verified in playback.

### Day Two — The Nostalgia Warehouse

Shelves of childhood memories on glowing screens. "These are my memories." "They belong to us now." A false exit opens onto a sunlit campsite that slams shut. The **Cleaverback returns**: "You didn't get away. You just changed channels." A childhood bedroom where SPLICEMASTER says, "The best memories are the ones we can use again." **Alan's voice comes from a screen, then stops — Alan is missing.** The protagonist descends in a freight elevator labeled **RENDER DISTANCE**.

> Status: cinematic prototype with the warehouse, reflection beat, Alan's disappearance and lift. Puzzles, bedroom and chase are **not yet built**.

### Day Three — Render Distance

An unfinished game world: checkerboard floors, half-loaded geometry, floating frozen objects. Signs: **WELCOME TO THE LAST LEVEL / YOU HAVE ALREADY LOST**. **Velocity Wraith** (faceless, angular, afterimage ribbon) says "The world hasn't finished loading." **Fennix** (a corrupted guide with a cracked visor) warns, "He can hear your footsteps." A debugging chamber shows the alternate outcomes. The protagonist falls through a door marked **404 — WORLD NOT FOUND**.

**[NEW] Oliver is lost in a broken section of the level.**

**[NEW] The protagonist feels oddly at home, as if waking in their own house after a dream. A siren repeats and grows more distorted. News reports about the accident, death certificates and missing-person flyers play. A small lost child asks for help finding safety; the protagonist follows the child. Late in the day the Burned Accomplice takes over the protagonist: no control, led into a burning pentagram surrounded by forgotten souls. An older witch in white gives the ritual: place four stones north, south, east and west. If the fire goes out, the attempt fails.**

> Status: cinematic prototype through the 404 fall and Oliver's loss. The home-dream, siren, news, child, pentagram and witch are **not yet built**.

### Day Four — 404 Forest / One Long Night

**One continuous night within Day Four—not ninety-nine literal nights and not the entire campaign compressed into one night.** The forest loops and contradicts itself without advancing the campaign to another day. The old **NIGHT 01 / 99**, **NIGHT 02 / 99** and milestone markers survive as impossible counters or recorded fragments inside this night: "No. I was just there."

All forest encounters remain: the radio warns, "Do not follow voices from the treeline," a copy of the protagonist's voice says "I'm outside. Open the door," and the Broadcast Giant calls "Remain where you are." The river looping to its source, cabin furniture on the ceiling, backward footprints, the voice counting breaths, total silence and recordings hanging from branches become substantial discoveries during this same night, not deleted scenes or ninety-nine repetitive full-length loops. **Pale Thread** guides the protagonist to the root tunnel, photographs and the scratched warning **"THEY ARE NOT ALL HUNTERS. / SOME REMEMBER WHAT HAPPENED."** The countdown and cartoon-decorated doorway remain, connecting the forest to the show-world material.

> Status: the cinematic timeline has been restaged with clock-time titles from **11:59 PM to 3:07 AM**, keeping all six milestone discovery lines and the existing tunnel/countdown/show-world transition. The chapter-menu subtitle now matches **404 Forest / One Long Night**. This is a partial restaging, **not verified in playback**: the six discoveries are still brief narrated cues, not substantial staged encounters, and the old impossible-counter fragments are not yet visibly presented.

### Day Five — Everybody Smiles Here (crawlspace first, then the studio)

**[NEW] Bodies in the Crawlspace.** A claustrophobic crawlspace under a house. Bodies lie in the dark. A man speaks to them as if they were friends. He is a psychopath. The chaser is the **Burned Accomplice**: a small creature with burned-off skin, a round head, burned-off ears, a giant smile with sharp teeth and eyes. It crawls like a spider and chases the protagonist the whole way. The protagonist is captured and taken to a **hatch-room interlude**, where dead "homies" hang about and the protagonist is seated before a television that shows **the prologue plane crash**.

**The studio (existing beats, kept).** A painted cartoon street. **Grin Cat** (white-gloved, stretchy) blocks the way: "Leaving already? We haven't even started the show!" **Hound** turns its head while its body stays still: "You smell like the outside." Curtains open by themselves. The ink factory: a projector plays the protagonist's double being erased. **Ink Man** bursts through: "Every good story needs a permanent cast." A three-way pursuit. A film-editing machine: "You keep ruining the ending." "Then stop writing it." The film strip tears.

**The consolidated activities: the ritual and the stones.** Day Five also contains the added ritual material previously described across Day Five and Day Six; it is an expansion, not a replacement of the studio. The **south stone** sits in the basement of "Big Brother's" house. Placing it locks the protagonist in the room. A radio gives instructions: say goodbye to all friends, set yourself on fire, and perform the holy cleanse in the toilet, which Big Brother has prayed over. The creature inside can only be freed through the pain of the burning. The protagonist passes out. The four directions, the witch, the possession and the fire-failure condition remain part of the ritual thread introduced earlier. These are the nightmare's coercive claims, not trustworthy guidance. **How directly this fictional burning is depicted remains unresolved; do not add procedural real-world detail.**

This is the activity consolidation: Day Five grows to hold the crawlspace/studio/ritual material, while Day Six remains available for **The Broadcast**. No studio chase, film-tearing exchange, broadcast encounter or numbered day is removed. Their handoffs must be staged to preserve continuity rather than cutting either sequence.

> Status: the studio is a cinematic prototype. The full crawlspace, hatch interlude, ritual, stones, basement and interactive pursuits are **not yet implemented**.

### Day Six — The Broadcast

A children's-show set. **Miss Merrily** (a controlling presenter with a quilted coat and porcelain face plates): "Hi, friend! Are you ready to learn something new?" "Which door takes us home?" Three doors each lead to a wrong answer ("Try again."). **Buttonbell** (a nervous bell-and-felt assistant): "Listen carefully. She doesn't control the show." **Mr. Stillwell** (a tall neighbourhood greeter): "Someone is watching you through your own eyes." The Keepsake facility of animatronics: "You will be remembered forever." The control room: **THE SPLICEMASTERING PROCESS / INPUT: HUMAN MEMORY / PROCESS: RECURSIVE SIMULATION / OUTPUT: PERMANENT CHARACTER.** "Trapped? No. Preserved." SPLICEMASTER explains the replacement; the protagonist smashes the console. The sets collapse into a final channel, a countdown, and a black sub-bass chamber.

**Day Six remains a complete, distinct chapter.** Its identity is The Broadcast—not a missing day, a duplicate Day Five or an excuse to remove Miss Merrily, Buttonbell, Mr. Stillwell, the Keepsake Players or the control-room revelation. The added ritual/stone activities are consolidated into the expanded Day Five above; the broadcast performances, revelations, collapse and final-channel handoff remain here.

> Status: the broadcast beats exist as a cinematic prototype and lead toward Day Seven. The expanded Day Five-to-Day Six handoff still needs to be built and verified.

### Day Seven — The Sub-Bass Core and the endings

The Core: a colossal pulsing column of cables and reels. **SPLICEMASTER** (tape ribbons, lens housings, CRT circuitry): "You made it." "You still think there's an outside." "Most people break before the third day." "They become useful." "You didn't find the tape. The tape found you." The final offer: "No more running. No more fear." "Then I'd rather break the whole fucking thing." The Splicemaster mutates. "Don't turn it off!"

**Canon ending (kept).** Camera removed, white static, silence. The protagonist wakes in a clean living room, hands uninjured. The cassette reads **SEVEN DAYS / PLEASE WATCH UNTIL THE END.** SPLICEMASTER on the television: "Welcome back." The island plays again: "Hello? Anybody? Where the hell is everybody?" "You did finish the story. Now you get to tell it." The on-screen sequence, exactly:
**INSTALLING NEW HOST… / MEMORY TRANSFER COMPLETE. / IDENTITY REASSIGNED. / INSTALLATION SUCCESSFUL. / PLAY AGAIN?**

**Loop after the first-cycle living room.** The protagonist wakes on the beach: "What the hell do I have to do this again for? Am I already dead?" No RUN 2 caption explains the return. All four friends' nightmare counterparts become enemies during the second cycle.

**Hospital and living-room outcomes depend on the cycle.** Reaching the hospital in the first cycle is fatal; reaching the living room advances the story. During the second cycle, reaching the living room is fatal; the required final route is the hospital. There the protagonist hears the decision to withdraw life support: "He's just too far gone," and "He wouldn't have wanted this." The protagonist screams and nobody hears. Everyone begged them to wake up; they were given seven more days. This is not the old proposed discharge-and-siren escape.

**Separate hidden survival ending:** Only in the interactive opening, waiting at the starting point for a long time can trigger the shock "I've got a pulse," and waking in hospital alive the next morning. This Easter egg does not turn the normal first-cycle hospital route into a survival route.

> Status: the Core confrontation, final offer and living room are a cinematic prototype with the exact ending text. The loop is wired to the friend roster. The hospital path is **not built**. The Splicemaster is a placeholder silhouette.

---

## 3. Characters

Every character must be original. Recognizable franchise characters are not used.

| Character | Role | Appearance and behaviour | Status |
| --- | --- | --- | --- |
| **Protagonist** | Player's eyes | Never shown face. Voice anxious, then desperate. Injuries and fatigue show in hands and breathing. | Voice lines written; body is camera only |
| **Mitzi Goins** | Friend | Map-holder on the plane, calm and organised. Taken behind the abandoned mall's playhouse shutter on Day One. | Named; placeholder seat figure |
| **Alan** | Friend (movie guy) | Carries a camera, hurt in the crash, lost to the warehouse screens on Day Two. | Named; placeholder with camera |
| **Sloppy** | Friend (80s rodeo clown) | Yellow hat, lost in the crash on the island. Hostile on the loop. | Named; placeholder with hat |
| **Oliver** | Friend (priest, glitch exploiter) | White collar, sardonic about the smell of burning, lost in the broken level on Day Three. Hostile on the loop. | Named; placeholder with collar |
| **Cleaverback** | Island and warehouse hunter | Hulking six-limbed forest predator, bark-plated, rope mane, split jaw, rusted blade. Voice gravelly. | Placeholder shape |
| **SPLICEMASTER** | Broadcast intelligence | Figure of tape ribbons, lens housings and CRT circuitry. Layered recorded voice with one quiet original voice underneath. Grows into a cathedral of reels in the finale. | Placeholder shape |
| **Morrow Moppet** | Day One abandoned mall display marionette | Teal drapery, uneven wooden legs, overlong jointed hands, horizontal porcelain-tooth mouth. Dangling stops and taut-string lunges. | Procedural cinematic placeholder authored; playback unverified |
| **Velocity Wraith** | Day Three racer | Faceless angular specter, segmented torso, three running struts, red afterimage ribbon. Doppler-metallic voice. | Placeholder |
| **Fennix** | Day Three guide | Small corrupted automaton, folded glider fins, cracked amber visor, exposed memory core. | Placeholder |
| **Speaker Tower** | Day Four giant | Siren-headed tall figure with loudspeaker head. Calls "Remain where you are." | Placeholder |
| **Pale Thread** | Day Four guide | Gentle ribbon-bodied guide, lantern-shaped head, overlapping translucent bands. Silent, guides by bending shadows. | Placeholder |
| **Burned Accomplice** | Day Five crawlspace chaser | Small crawler, burned-off skin, round head, burned-off ears, giant toothed smile and eyes. Moves like a spider. | Not built |
| **Big Brother** | Ritual figure | Named in notes; needs an original design. The basement and the holy-cleanse setting belong to him. | Not designed |
| **The witch in white** | Ritual guide | Older woman in white; gives the four-stone ritual. | Not designed |
| **Grin Cat** | Day Five studio | White-gloved, stretchy, grin past its face. Blocks the street. | Placeholder |
| **Hound** | Day Five studio | Hunched dog-like shape, head turns while body is still. | Placeholder |
| **Ink Man** | Day Five factory | Dripping living-ink figure with fixed smile. | Placeholder |
| **Miss Merrily** | Day Six host | Quilted coat, geometric hair, lacquered changeable face plates. Brittle warmth. | Placeholder |
| **Buttonbell** | Day Six puppet friend | Quilted felt, brass bells that ring only when it lies. Nervous. | Placeholder |
| **Mr. Stillwell** | Day Six neighbour | Long wooden face, glass-bead eyes, paper eyelids, waistcoat of house numbers. | Placeholder |
| **Keepsake animatronics** | Day Six facility | Ceramic-faced drummer, ribbon-armed usher, brass-bell vocalist. | Placeholder (Tall Smile) |
| **Morrow / Mr. Hush** | Day Five | Mr. Hush (folding silent performer) appears in the original brief; not yet built as a separate figure. | Not built |

**Scare pass on the existing models (creator direction: keep the models, make them scarier):** `src/cinema/scary.ts` adds features on top of each current shape without replacing it. Eyes glow through fog and dark, with uneven or one-eyed blinks; some faces get jagged teeth; tall ones get long hanging arms with thin fingers; crawlers and the Cleaverback get jointed legs. Bodies twitch suddenly, sometimes holding a wrong pose, breathe unevenly, and some briefly vanish like a tape skip. These features have been applied to the prologue watcher, road watcher, mall marionette, Cleaverback, bedroom presence, the blue runner, fox figure, both Burned Accomplices, the white figures, Speaker Tower, Long Neck, Grin Cat, Hound (with its body kept still), Ink Man, the ritual presence, the Host, Tall Smile and SPLICEMASTER. The friendly puppet is deliberately unchanged.

**Naming rule (creator direction):** the frightening, unidentified figures are never named on screen. Their subtitle tag is `???`, so the player does not know who they are. The protagonist and the named friends (Mitzi, Alan, Sloppy, Oliver) keep their names. Announcer and device sources (radio, PA, system voice, staff, family) are unchanged.

**Design rule for every entry:** turntable concept, front and side silhouette, colour and material, rig plan, unique locomotion and attack signature, voice notes, and an originality review against existing franchise characters before release.

---

## 4. Friends roster (the thread that runs through the story)

| Friend | Prologue | Day One | Day Two | Day Three | Loop (Day Seven) |
| --- | --- | --- | --- | --- | --- |
| Mitzi Goins | with you | **taken behind the mall shutter: missing** | — | — | hostile |
| Alan | hurt, with you | — | **voice from screen, then gone: missing** | — | hostile |
| Sloppy | **lost in the crash** | — | — | — | hostile nightmare counterpart |
| Oliver | with you | — | — | **lost in the broken level** | hostile |

Roster values: `with-you`, `missing`, `lost`, `hostile`. Saved with progress. On the second cycle all four named friends have hostile nightmare counterparts, including friends previously marked missing or lost; the real friends remain at the hospital.

> Gap: the on-screen appearances of friends between their disappearances (and their hostile second-run encounters) are not built.

---

## 5. Level and chapter breakdown

| Chapter | Environment | Core mechanic | Monsters | Playable today? |
| --- | --- | --- | --- | --- |
| Prologue | Plane cabin, shore, island, camp, bunker | Walk the beach (partial); cinematic chase and tape | Cleaverback (partial), watcher | Cinematic; beach walk is partial |
| Day One | Forest-road approach, Hollowmere Galleria, food court, playhouse and service access | Authored bodycam recording and chase | Watcher; original Morrow Moppet placeholder | Cinematic; new mall act unverified |
| Day Two | Warehouse, screens, lift | Watch, listen | Cleaverback (cinematic) | Cinematic |
| Day Three | Unfinished world, debug chamber, forest | Watch, listen | Velocity Wraith, Fennix | Cinematic |
| Day Four | Forest, ranger station, root tunnel; clock-time staging within one night | Watch, listen, countdown; retain every forest discovery | Broadcast Giant, Pale Thread | Cinematic prototype; clock-time pass authored, playback and expanded discoveries pending |
| Day Five | **Crawlspace and ritual/basement (not built)**, painted street, theatre, ink factory, editing room | Consolidated chase, film and ritual activities | Grin Cat, Hound, Ink Man, Burned Accomplice (not built) | Cinematic prototype (studio only) |
| Day Six | Set, neighbourhood, facility, control room | Cinematic | Miss Merrily, Buttonbell, Stillwell, Tall Smile | Cinematic |
| Day Seven | Core, living room, beach loop | Cinematic | SPLICEMASTER | Cinematic |

Recorded as its own chapter in the menu: Prologue, Day One, Day Two, Day Three, Day Four, Day Five, Day Six, Day Seven. The Day Six episode is currently listed as a separate chapter after Day Five.

---

## 6. Progression and saving

- Creator preview access: Prologue and all seven days are selectable in any order; unlocking is not completion. In linked playback, the incoming tape selects one numbered day and completion stops for the return to the search rather than automatically starting this game's next day.
- Completed chapters can be replayed.
- Saves hold: completed chapters, continuous-play setting, subtitle setting, reduced-motion setting, loop count, friend roster, and the current linked tape request/completion status. Tape completion does not write a search checkpoint as completed.
- Corrupt or malformed saves recover to safe defaults; skipped chapters are never inferred as completed.

---

## 6a000000. Hospital routing and Day Seven branch

- Menu now lists The Hospital on every cycle. The engine routes it by loop: first cycle plays the fatal hospital (no completion); second cycle plays the true ending.
- Day Seven's second-cycle branch ends in the living-room death, then hands off to the hospital.

## 6a00000. Day Six structure and handoff

- Day Six runs 0–220s in order and ends on its finish after the 'DAY SEVEN — THE SUB-BASS CORE' card (213s), which hands off to Day Seven.

## 6a0000. Day Five structure and handoff

- Crawlspace 0–100s, ritual 100–172s, painted studio from 172s, finishing about 312s. Day Five hands off to Day Six through its finish, which starts the next chapter via the menu continuation.

## 6a000. Day Four impossible counters

- After the midnight reset, `NIGHT 01 / 99` and `NIGHT 02 / 99` cards flicker on screen (35.5s and 38.5s), contradicting the clock.

## 6a00. Day Four discoveries (staged)

- The six milestone discoveries in `day4.ts` (river loop, ceiling furniture, backward footprints, counting breaths, silence, recordings on branches) each now have a visible or audible beat, with their original clock tags and lines unchanged. Cleared at 110s. Playback unverified.

## 6a0. Day Three home-dream (cinematic insert)

- `day3Home.ts`: home, news reports, flyer, the siren, the lost child, the Burned Accomplice takeover and the burning pentagram with the unnamed figure in white. Runs after Oliver is lost (~150–243s). Cinematic only; playback unverified.

## 6a. Day Two bedroom (cinematic insert)

- `day2Bedroom.ts`: the childhood bedroom and SPLICEMASTER's line, inserted before the RENDER DISTANCE lift (Day Two now ~126s). This is a cinematic insert, NOT an interactive puzzle. Playback unverified.

## 6b. Pacing (creator direction)

- First seven days (Prologue through Day Seven) retain a timeline speed of **0.7** (`CAMPAIGN_SPEED` in `engine.ts`). The director advances 0.7 authored seconds per real second; this slows playback; it does **not** trim 30% off the viewing time. No speed was changed in the creature-sound pass. Target: about **22 minutes** for the whole campaign; a timed playthrough and any resulting pacing decision are still outstanding.
- Speed scales the director clock, so cues, tweens, subtitles and titles stay in sync.
- Hospital endings and the pulse keep their authored pace.

## 7. Presentation and accessibility

- Subtitles on by default, toggle in the HUD.
- Reduced motion (pause menu) reduces head bob, shake, roll and sudden FOV changes.
- Synthetic browser voices are a **development fallback only**, not final voice acting.
- Target: stable 60 FPS on capable desktops. Not yet measured.

---

## 8. Implementation status (honest summary)

**Built:**

- Chapter menu with prerequisites, playback, completion and return to menu.
- Cinematic engine, timeline director, bodycam rig, VHS post-process (tuned to light grain in this pass).
- All eight chapters exist as cinematic prototypes with the principal dialogue lines and the ending text.
- Friend roster, loop trigger, save/load of progress.
- Partial free exploration on the Prologue beach.

**Built this pass (cinematic prototypes, NOT verified in playback):**

- Day Five crawlspace opening act (`day5Crawl.ts`): bodies in the dark, the man who speaks to them, Burned Accomplice chase, capture, hatch-room TV showing the prologue crash, then the existing studio beats run after it (`day5.ts`, offset 100s).
- Hospital true ending (`hospital.ts`): staff withdraw life support, family's seven-more-days lines, protagonist screams unheard. Hidden in the menu until the second cycle (loopCount >= 1).
- Second-cycle branch in Day Seven: the living room is fatal and ends into the hospital route.
- Hidden pulse ending (`pulse.ts`): standing idle for 60+ seconds at the opening triggers the doctor's "I've got a pulse" epilogue; it does not complete the Prologue.

**Still not built:**

- (First-cycle hospital death is now authored as `hospitalFatal.ts`; playback unverified.)
- Day One free exploration, pursuit AI and final Morrow Moppet artwork (the abandoned-mall cinematic placeholder act is now authored).
- Ritual act (`day5Ritual.ts`, authored, playback unverified): self-immolation implied off-screen (light and sound only, camera cut away); a failed fire retries the stones with NO game over; the figures are unnamed by design (frightening because unexplained). Brisk first round (~72s). Final designs still to be drawn.
- The Burned Accomplice, Big Brother, and the witch in white are placeholder shapes (not final designs).
- Ritual thread introduced in Day Three and expanded into the consolidated Day Five activities: stones, pentagram, witch and Big Brother's basement.
- Completing Day Four's continuous-night presentation: clock-time titles are authored, but substantial staging of the six discoveries and visible impossible-counter fragments remain pending.
- Hospital path (Day Seven).
- Real character models (all placeholders).
- Interactive Story Mode: enemy AI, puzzles, checkpoints, capture and recovery.
- Second-run exploration (the first run is cinematic; the second run should be explorable).
- Proper voice acting, spatial audio and subtitle sync.
- Horror scare pass across every chapter (only Day Two has a new psychological beat).

**Verification:**

- Source check (latest run): 13 of 14 passed, 0 critical; one warning about portrait orientation.
- Build: the last reported error (`explore` on `Env`) was addressed. The latest preview request reached the chapter menu, but returned no explicit build report; a clean build is not separately certified here.
- Latest preview attempt: the page displayed the HTML chapter menu (including Prologue and Day One), but the capture returned **No canvas found**. It did not enter a chapter.
- In-game playback: **not verified.** Prologue → Day One → Day Two → Day Three → Day Four has not been observed end to end; chapter transitions, Day Four's clock-time pass, audio, subtitles, and completion/saving remain unchecked in playback. Do not treat reaching the menu as a cinematic playthrough.

---

## 9. Open decisions (need the creator)

1. **Settled: seven days, with consolidated activities.** Day Five absorbs the added chase/ritual activities; Day Six remains The Broadcast. All existing story material stays. An earlier failed implementation attempt does not change this story decision.
2. **Settled: endings depend on the cycle.** First cycle: hospital is fatal; living room advances into the loop. Second cycle: living room is fatal; hospital reveals the withdrawal of life support. The opening idle/pulse Easter egg is the separate survival ending. These are not competing proposals requiring another canon vote.
3. **Self-immolation.** Shown directly, implied off-screen, or non-graphic? (Not yet implemented.)
4. **Ritual failure.** Game over, or a retry of the stone puzzle? Note that the screenplay forbids a generic game-over screen in the finale.
5. **Crawlspace order.** Before or after the painted studio in Day Five?
6. **Settled: Day Four is one long night.** Its old repeated-night discoveries remain within that night. This does not reduce the seven-day campaign or add a redundant second forest campaign.
7. **Original designs** for the unnamed ritual figures and the Burned Accomplice. Creator direction: they stay unnamed; the retry is the only consequence of failing the ritual.

---

## 10. Production gates before release

**Current mall/handoff pass:** The new mall sequence and the recording-side RUN navigation handoff are authored. The latest preview request reached the updated HTML menu, showing the abandoned Hollowmere Galleria description and selectable Day One, but returned **No canvas found**. It did not enter a recording; mall visuals, chase, subtitles, audio and completion are **unverified**. No other game has been launched from this project during verification; the request format, real counterpart ID, search saves and return routing must still be tested together. The existing section 8 build/capture history is historical, not evidence that these additions have run.

- Every chapter plays from start to finish in both cinematic and (where available) explorable form.
- Every named line in this bible appears in the game exactly as written.
- Saves survive restart, replay and malformed data.
- Horror pass: each chapter has at least one earned scare and a quiet build.
- Originality review of every character.
- Measured performance on low and mid settings.
- Browser playthrough logged with pass/fail notes.

Nothing in this document is marked complete unless it has been played in the browser.

---

## 11. Latest handoff — creature sounds and seven-day horror pass (authored, NOT playback-verified)

This section updates the older implementation summaries above. It does not certify a finished task or a release-ready chapter.

### Creature sound work

- `audio.ts` now synthesizes distinct signatures for all sixteen requested creatures: Cleaverback (heavy chest/bark rasp and blade scrape), Burned Accomplice (skitter and wet clicks), Hound (low throat breath), Grin Cat (warped purr/rubber stretch), Ink Man (bubbling clicks), Speaker Tower (distant horn feedback), Long Neck (thin wheezing descent), Morrow Moppet (wood joints and string twang), Velocity Wraith/blue runner (metallic Doppler rush), fox figure (broken electronic chirps), watcher (rising inhale), SPLICEMASTER (reel chatter and layered low tones), Miss Merrily (porcelain ticks), Buttonbell (felt rustle; brass bells only on its cover-story lie), Tall Smile (servo/ratchet), and Mr. Stillwell (wood creak and paper rustle).
- Unnamed ritual figures also have restrained breath cues. No audio files were added. All signatures are generated live.
- Scene cues introduce each sound before its associated reveal and at the reveal. Mr. Stillwell remains the existing **off-screen neighbour**: his sound precedes his dialogue, not a newly invented visible model. The Prologue still has only its existing watcher model; this pass does not claim a missing Cleaverback chase/model was added there.
- `scary.ts` connects creature identities to discrete twitch, blink and dropout transitions. Nearer figures have stronger accents; distant figures stay quiet. Incidental sounds have cooldowns and quiet holds to avoid stacking or overwhelming dialogue. Each played cue records `creature_sound_played` with creature, trigger and proximity; no analytics call runs unconditionally each frame.
- Reduced motion now suppresses the added horror-pass motion, blinking and visual dropouts without suppressing their sound timing. This is not a claim that every older scene-specific movement has received a separate accessibility audit.
- Older identifying speaker tags for unexplained figures were changed to `???`; all spoken lines remain, including canon dialogue. Device sources and named friends retain their tags.

### Horror rhythm authored this pass

| Recording | Quiet build | Main retained scare/reveal | Release |
| --- | --- | --- | --- |
| Prologue | Camp ambience drops; watcher inhale | Firelight catches the watcher | Beds settle before the existing tape break |
| Day One | Quiet road and distant watcher; silent playhouse with wood clicks | Existing watcher reveal and later playhouse shutter | Road breathing room; service access after the chase |
| Day Two | Quiet false-exit approach; audible Cleaverback; silence before reflection | False-exit slam retained; creature return softened into a reveal; reflection kept | Bedroom threshold and post-reflection lift settle |
| Day Three | Distant metallic rush; still hillside; quiet valley | Runner closes; later home takeover | Valley, debug chamber, kitchen return |
| Day Four | Distant horn before giant; discoveries no longer get loud repeated stings | Existing giant step; slower Long Neck reveal after silence | Forest discoveries and root tunnel; all clock tags/counters retained in the same night |
| Day Five | Crawlspace skitter; street purr; wet sounds behind factory door | Crawlspace pursuit, Cat and later Ink Man | Hatch pause, theatre threshold, projector and editing-room pauses; ritual retry retained |
| Day Six | Material sounds before presenter/puppet; quiet wrong-door approach | Existing presenter-at-lens moment is the main early hit | Puppet warning, control room and final-channel breathing room |
| Day Seven | Quiet Core/reel presence; near-silence around refused offer | Existing mutation and final recording break | Low beds after mutation; silence before the first-cycle living room |

- New authored rhythm cues record `horror_beat_started`. Later-act entrances and temporary-act returns record their own story events.
- Later room inserts now enter through `stageAct` at their actual timeline cue, hiding earlier scenery for the insert instead of constructing later rooms visibly over the opening. The Day Two bedroom returns to the warehouse/lift; Day Three home and Day Five ritual/studio enter at their existing authored times. Their lines and chapter end times are retained. These scene transitions require playback testing.
- The Day Six light dim now persists instead of being overwritten by its next animation frame.
- All seven days, Day Four's continuous night, ritual retry, hospital/pulse routing, cycle branches and exact installation text are unchanged. Hospital ending scenes were not restaged by this pass.

### Verification attempt

The requested `screenshot_preview` was attempted after the game changes. It returned **No screenshot: No canvas found in the preview**. No retry was made this turn. No chapter, sound, motion, transition or ending was observed running; there is no claim of a passed build, successful playback, correct loudness, animation or pacing. A canvas capture would still not establish audio quality by itself; listening through the recordings remains necessary.

### What remains after this pass

1. Playback/listening verification of all creature warnings, material accents, quiet holds, Day Two reflection, Day Four discoveries, Day Six presenter and Day Seven mutation; verify the newly staged room entrances and reduced-motion behavior.
2. Real voice acting in place of the robotic fallback voices.
3. Save testing: restart, replay, second-cycle progression and damaged saves.
4. A timed full-campaign check against the 22-minute target. The existing 0.7 speed was deliberately left alone; its actual slowing behavior is clarified in section 6b.
5. Interactive Story Mode and freely explorable second-cycle recordings, including hostile-friend encounters and the other larger interactive systems.
6. Final original character artwork/designs and release gates already listed above; Mr. Stillwell still has no separate visible neighbour performance.
7. Connect the separate search game through `TAPE_HANDOFF.md` **only when the creator explicitly authorizes it and supplies that game's details**. No connection was started in this pass.
