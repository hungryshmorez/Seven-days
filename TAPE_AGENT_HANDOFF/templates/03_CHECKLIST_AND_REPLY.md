# Install Checklist and Reply

## Checklist before handing back

- [ ] Page is at `public/tapes/tapeN/index.html`.
- [ ] All other files for the tape sit in `public/tapes/tapeN/`.
- [ ] Every path is relative (no leading `/`).
- [ ] `N` is added to `public/tapes/manifest.json`.
- [ ] The tape sends `seven-days:tape-done` once, when it truly ends.
- [ ] Dead friends do not appear alive at that point in the story.
- [ ] Dialogue is captions only (no synthesized voice).
- [ ] Every interaction sends an analytics event named `<category>_<action>`.
- [ ] Nothing outside `public/tapes/tapeN/` and the manifest was edited.

## Reply to send back to the search side

- **Tape number and file path:** `public/tapes/tapeN/index.html`
- **Manifest entry added:** yes / no
- **Completion message confirmed:** `seven-days:tape-done` is sent when the tape finishes (yes / no)
- **Friend states assumed (who is alive or dead at that point):**
- **Questions about story order or a day this tape depends on:**
