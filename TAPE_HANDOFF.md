# SEVEN DAYS — separate-game tape handoff

The master bible remains the story authority. This document specifies the recording-side handoff added for the creator's latest direction; it does not claim the search game has been connected.

## Player rhythm

Search Day 1 finishes → discover and insert Tape 1 → this game's Day 1 recording (Hollowmere Galleria) → return to Search Day 2. Repeat through the seven numbered days. Do not create a Day 8. Prologue placement and the final cycle/ending handoff need explicit treatment in the search game.

Both games keep their own engine, assets and saves. Use RUN's `navigateToGame` so the current game unmounts; do not embed a second live renderer, background iframe, or duplicate level. This is not a claim of measured performance.

## Recording-side implementation

- `src/story/tapeLink.ts`: validates the small incoming request.
- `src/story/tapeNavigation.ts`: reads `RundotGameAPI.context.g2gLaunch` after initialization and local-save loading. A valid request opens exactly `day1` through `day7`, not the Prologue or a normal continuous-play chain.
- `src/game/GameCanvas.tsx`: stops on that recording's completion and displays the return screen. Returning is a deliberate, thumb-sized button press.
- `src/ui/TapeReturnButton.tsx`: saves, waits for queued SDK device-cache writes, then calls RUN navigation. On failure the player stays here with a retry message.
- `src/state/store.ts`: keeps the request and completion state across reloads. Reloading the same finished request shows the return screen instead of replaying the tape. A normal menu selection ends the linked visit without inventing a tape result.
- Pause also offers return without finishing. That reports `tapeComplete: false`; it never advances a search day or marks a tape viewed.

There are no hard-coded search-game IDs or guessed URLs. A real counterpart must send the request and handle the result below. Without such a request, this game remains the ordinary standalone chapter menu with all seven days unlocked.

## Search game → recording game

Before leaving, the search game must durably save its completed search day, physically discovered tape, player location/checkpoint, cycle and unique request ID. Then call `navigateToGame` with this game's real ID and this `launchContext`:

```ts
{
  protocol: 'seven-days-tape-v1',
  role: 'tape-request',
  requestId,          // unique, persisted per insertion; letters/numbers/_/-; <=128 chars
  tapeDay: 1,        // integer 1..7; Search Day N finds recording Day N
  searchGameId,      // the real RUN game ID to return to, not a URL
  searchCheckpoint,  // nonempty opaque saved checkpoint ID, <=256 chars
  cycle: 0,          // 0 first passage, 1 actual second passage; NOT ordinary replay
}
```

No other game's credentials or complete save are needed or accepted. Invalid requests fall back safely to the menu. The incoming cycle selects the corresponding local narrative cycle, but does not mark any earlier recording, search level or physical tape complete.

## Recording game → search game

The return button sends this through `navigateToGame(searchGameId, { launchContext })`:

```ts
{
  protocol: 'seven-days-tape-v1',
  role: 'tape-result',
  requestId,
  tapeDay,
  tapeComplete,       // true only when this linked recording reaches its finish
  cycle,              // the request's passage
  searchCheckpoint,   // the original checkpoint ID, unchanged
  nextSearchDay,      // N+1 for a finished tape N<7, otherwise null
  finaleReached,      // true for a finished Tape 7; NOT proof of any particular ending
  loopCountAfterTape, // current local loop count; search game must reconcile its finale
}
```

The search game must validate this format, match the outstanding request ID/day/cycle to its saved request, and handle a duplicate result idempotently. Only `tapeComplete: true` allows it to mark that tape viewed. Only its own saved search-level completion permits it to enter the next search day. An unfinished return restores the original checkpoint and permits reinserting the tape; it does not skip ahead.

## Return/back behavior and saves

RUN G2G context is session-scoped and single-depth. Each explicit arrival is read from `g2gLaunch`; do not depend on a deep stack surviving repeated bounces. Save before every navigation on BOTH sides. The host's generic Back return is not a tape-completion message, and `g2gReturn` alone must never unlock the next search day.

The recording side saves before leaving and will not intentionally navigate if saving failed. The search game's own reload recovery, receipts and checkpoint persistence are still its responsibility. Neither game may infer the other's progress from its chapter menu or local completion list.

## Still required to connect and verify

1. Real RUN IDs for both games, and the matching sender/receiver in the search project.
2. Search-side save and outstanding-request handling; no search-game files have been changed here.
3. Prologue handoff and explicit Day Seven/cycle/ending reconciliation. The existing ending prototypes are not certified correct by this bridge.
4. Test a full Search Day 1 → Tape 1 → Search Day 2 round trip on desktop and phone.
5. Test interrupted tapes, host Back, duplicate results, malformed messages, save/navigation failure, reload, ordinary replay vs. second cycle, and Tape 7 without a Day 8.
6. Verify the new mall act itself in the running preview. Authored geometry and a successful compile alone do not prove the recording plays correctly.
