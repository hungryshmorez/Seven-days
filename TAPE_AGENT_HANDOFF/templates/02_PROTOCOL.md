# Protocol: How a Tape Plugs In

Follow these steps exactly. Do not edit the game's own files. Only add files under `public/tapes/tapeN/` and the manifest entry.

## 1. Put your page in place

- Location: `public/tapes/tapeN/index.html` (N = 1 to 7).
- Put any files it needs beside it in the same folder.
- Use **relative paths only** (no leading `/`).

## 2. Register the tape

Add N to the list in `public/tapes/manifest.json`:

```json
{ "tapes": [1, 2] }
```

## 3. How the game opens your tape

The game opens:

```
index.html?tape=N&cycle=1
```

and uses `cycle=2` after the loop. This is information only; use it or ignore it.

## 4. What the game does while your tape plays

- The game **mutes its own sound**.
- The game **releases the mouse**.
- **Your tape owns all sound** during that time.

## 5. Tell the game when you're done

When the tape ends, send exactly this message:

```js
parent.postMessage({ type: 'seven-days:tape-done' }, '*')
```

Send it once, at the true end of the recording.

## 6. Do not

- Do not edit the game's own files.
- Do not add anything outside `public/tapes/tapeN/` and the manifest entry.
- Do not use absolute paths.
