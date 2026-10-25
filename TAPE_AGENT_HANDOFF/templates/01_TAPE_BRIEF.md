# Tape Brief

You are building the recordings ("tapes") that play inside the game **Seven Days**. When a player inserts a tape in the search game, the tape takes over the whole screen until it finishes. Everything inside the tape belongs to you. The game only needs one signal back: "this tape is finished."

## Which tape appears when

| Tape | Shown as | Cycle hint |
| --- | --- | --- |
| Tape 1 | Day 1 | — |
| Tape 2 | Day 2 | — |
| Tape 3 | Day 3 | — |
| Tape 4 | Day 4 | — |
| Tape 5 | The Day 5 film | — |
| Tape 6 | The sun ritual (Day 5–6 chapter) | — |
| Tape 7 | The Day 7 Core | — |

Until a tape is installed, the game shows a placeholder with a CONTINUE button.

## Story facts the tapes must respect

- The friends are **Alan, Sloppy, Mitzi Goins, and Oliver**.
- **Lolo and Yuri** are original helpers (one body, two heads). They are **not** friends from the recordings.
- **Dead friends stay dead.** Do not show a friend alive in a tape if they died earlier in the story.
- **The ritual is non-violent.** No self-immolation. The sequence is: Father, Son, and Holy Ghost seals; the sun rises; one last deep cry; the protagonist is blinded and collapses.
- **Failing the stones** leads to an endless hallway.
- **Dying** leads to the hospital ending.
- **Surviving** leads to the living room, then back into the seven days.
- **The plane crash** belongs to the friends' recordings (the tape game). The search game opens with a boat arrival at night, and the guide who meets the player is the stranded survivor killed in the prologue chase.
- Full decisions are in `STORY_DECISIONS.md` and open threads in `SEARCH_STATUS.md`. **Both are still missing** (see README).

## Rules

- Original characters only.
- Every interaction you add should send an analytics event named `<category>_<action>`, for example `tape_started`, `tape_choice_made`.
- Do not claim something works unless it has been seen running.
- Dialogue is shown as **captions only**. No synthesized voice playback.

## Bible reference

The master bible (`reference/SEVEN_DAYS_MASTER_BIBLE.md`) is the single source of truth for the story. Where another document disagrees with it, the bible wins unless the creator says otherwise.
