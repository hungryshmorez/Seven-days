# Reconciliation notes

The exported source was a mixed-version snapshot: files referred to exports and members that didn't exist, and it did not compile. These are the changes made to get it compiling, building and booting while keeping the original logic. Guesses are marked.

| File | Change | Status |
|---|---|---|
| `src/cinema/day2Bedroom.ts` | Curly apostrophes inside single-quoted strings (TS1005); strings rewritten with typographic apostrophes | Certain |
| `src/cinema/engine.ts` | Added `EpisodeId`, `EPISODE_ORDER`, `HOSPITAL_AFTER` | Reconstructed from usage |
| `src/story/progression.ts` | Added `completeEpisode` | Reconstructed from usage |
| `src/cinema/rig.ts` | Added no-op `dragStart` / `dragEnd` | **Guess**: confirm intended drag behaviour |
| `src/cinema/day2.ts` | Remapped the legs shape; leg count set to 4 | **Guess**: count unknown |
| `src/story/tapeNavigation.ts` | Ported to `sharedStorage.open({namespace:'tape-handoff'})` and `RundotGameAPI.navigateToGame` | **Unverified**: the code and `TAPE_HANDOFF.md` describe different contracts, and the companion game isn't here |
| `src/state/store.ts` | `normalizeCompleted` rewritten: it let a save with skipped days fabricate unlocks. Now completed days must be a contiguous prefix of `EPISODE_ORDER` | Bug fix, covered by tests |

Everything else is the platform layer added on top (`src/sdk/platform.ts`, `src/ui/MenuExtras.tsx`, `src/ui/Survivors.tsx`, cloud save in `store.ts`, `rundot/*.config.json`).

## Visual pass

- `hospital.ts`, `hospitalFatal.ts`: the camera started at `yaw = Math.PI`, which faces away from the bed into an empty corner. Changed to `yaw = 0` so the scenes show the room. **Story-visible change**: revert it if the empty view was intentional.
