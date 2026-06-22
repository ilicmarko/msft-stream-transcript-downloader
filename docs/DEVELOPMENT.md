# Developer Guide

This document explains how the project is structured, how the transcript
extraction works, and how to develop, test, and release changes.

## Overview

The project is a single self-contained browser script that scrapes the visible
Microsoft Stream / Teams transcript pane and downloads it as a `.txt` file. It
ships in two forms, both generated from the same source:

- a **bookmarklet** (`javascript:` URL), and
- a **DevTools snippet** / plain script.

There is no runtime framework and no bundler. The build step is a small Node
script that inlines the source into the generated artifacts.

## Repository layout

```text
src/ms-stream-transcript-downloader.js  Main browser script (the only runtime code)
scripts/build-bookmarklet.mjs           Build script: generates dist/ artifacts
test/                                   Node test runner specs (*.test.mjs)
test/helpers/load.mjs                   Loads the script in a VM sandbox for tests
test/fixtures/                          HTML fixtures mirroring the real Stream DOM
docs/DEVELOPMENT.md                     This file
dist/                                   Generated output (gitignored)
.github/workflows/pages.yml             Builds and deploys the install page to Pages
```

## How extraction works

The script is an IIFE that attaches a small public API to
`window.MSStreamTranscriptDownloader`. High-level flow:

1. **Idempotent load.** If the same `SCRIPT_VERSION` is already loaded in the
   page, the bookmarklet just calls `extractTranscript()` again instead of
   re-injecting. A version bump forces a reload of updated code in an open tab.
2. **Find the scroll container.** `findScrollableContainer()` tries known
   transcript root selectors, then falls back to locating the nearest scrollable
   ancestor of a transcript row.
3. **Scroll and harvest.** Stream virtualizes the transcript list (only rendering
   on-screen rows), so `extractTranscript()` scrolls in steps and repeatedly
   calls the harvester until no new rows appear for several rounds.
4. **Read each row.** `readEntry()` extracts the speaker, timestamp, and text
   using the selector lists, and `getEntryIndex()` derives a stable order key
   from `data-list-index` / `listItem-<n>` ids. Text is read from the dedicated
   `<span id="text-N">` element (see "Why the text selector matters" below).
5. **Clean the text (fallback).** `stripTranscriptChrome()` is a defensive safety
   net for older/other Stream layouts where chrome leaks into the text element.
   With the precise `#text-N` selector it is effectively a no-op.
6. **Deduplicate and order.** The harvester keys entries by list index (or by
   content when no index exists) and sorts by index then discovery order.
7. **Format and download.** `formatTranscript()` builds the text file and
   `downloadText()` triggers a local download via a `Blob` URL.

### Why the text selector matters

Each transcript row wraps the spoken text in a dedicated span:

```html
<div class="baseEntry-695" id="entry-1" ...>
  <span id="timestampSpeakerAriaLabel-1" class="screenReaderFriendlyHiddenTag-619">Alex Example 0 minutes 5 seconds</span>
  <div id="sub-entry-1" class="entryText-696" role="listitem">
    <span id="edit-aria-div-1"><span id="text-1">OK, just give me a second.</span></span>
    <!-- on the active row only: -->
    <button>…Edit</button>
    <span class="screenReaderFriendlyHiddenTag-619">Use enter key to enable transcript edit mode</span>
  </div>
</div>
```

The speaker name, the screen-reader spoken-timestamp label, and the inline edit
button are all **siblings** of `#text-1`, not inside it. So `textSelectors`
prefers `[id^='text-']`: reading that span yields only the spoken text and
avoids the chrome entirely. The visible clock timestamp comes from
`[id^='Header-timestamp-']`; same-speaker continuation rows omit that element, so
their timestamp is empty by design (and the speaker-grouped output does not print
a header for them anyway).

### The text-cleaning fallback

If `#text-N` is ever absent and a fallback selector returns text that includes
chrome, `stripTranscriptChrome()` cleans several patterns observed historically:

- **Speaker / timestamp prefixes.** Accessibility text such as
  `"Speaker Name 1 minute 2 secondsYeah."` is stripped down to `"Yeah."`.
  `timestampToSpokenText()` converts `1:02` to the spoken form so it can be
  matched and removed; `parseSpokenTimestampPrefix()` recovers a clock timestamp
  from a leading `"1 minute 9 seconds…"`.
- **Inline edit button.** `stripUiAffordances()` cuts everything from the first
  Private Use Area glyph (e.g. `U+E70F`) to the end of the string (real
  transcript text never contains icon-font glyphs), with a regex fallback for the
  `Use enter key to enable transcript edit mode` tooltip when the glyph is absent.

If you find new chrome leaking into the output, first prefer a more precise
selector; only add cleanup cases as a fallback, and cover them with a test that
uses the exact observed string.

## Updating selectors

Microsoft periodically changes the Stream DOM. Selectors are centralized at the
top of `src/ms-stream-transcript-downloader.js`:

- `entrySelectors` – transcript row containers
- `speakerSelectors` – speaker name element
- `timestampSelectors` – timestamp element
- `textSelectors` – the spoken-text element

Prefer adding a new selector to the relevant list rather than replacing an
existing one, so older Stream variants keep working.

## Build

```bash
npm run build
```

`scripts/build-bookmarklet.mjs` reads `src/ms-stream-transcript-downloader.js`,
extracts `SCRIPT_VERSION`, and writes:

- `dist/browser-snippet.js` – the raw script for DevTools snippets
- `dist/bookmarklet.txt` – the `javascript:` URL (URL-encoded payload)
- `dist/index.html` / `dist/bookmarklet.html` – the install page
- `dist/site.js` – the copy-button script for the install page

The bookmarklet payload guards on the loaded version so an already-open tab
re-runs the new code after a version bump.

## Test

```bash
npm run check   # node --check on sources + node --test on test/*.test.mjs
```

Tests run on the **Node test runner**. Because the script is a browser IIFE,
`test/helpers/load.mjs` evaluates it inside a `node:vm` sandbox with a minimal
fake DOM and sets `window.__MS_STREAM_TRANSCRIPT_DOWNLOADER_TEST__ = true`. That
flag makes the script expose its pure helpers on `_private` for unit testing; the
helpers are **not** exposed in normal browser use.

There are two kinds of specs:

- **Unit** specs exercise the pure helpers (filename sanitising, timestamp
  formatting, text cleanup) directly against `_private`.
- **DOM integration** specs (`test/dom-extraction.test.mjs`) parse an HTML
  fixture from `test/fixtures/` with [`linkedom`](https://github.com/WebReflection/linkedom)
  (the project's only devDependency) and call `_private.readEntry()` on real
  Stream-shaped markup to prove the selectors extract clean text.

### Writing tests

- Put new specs in `test/<name>.test.mjs`.
- Load helpers via `loadScript()` and assert against `_private`.
- For DOM-shaped behavior, add/extend a fixture in `test/fixtures/` that mirrors
  the real Stream structure (ids/classes) and parse it with `linkedom`.
- Use **fictional** names and data only (e.g. `Alex Example`, `Alice`/`Bob`).
  Never include real people's names, secrets, or other real personal data —
  including in fixtures copied from real pages.
- Objects returned from the sandbox come from a different realm, so compare
  individual properties instead of using `assert.deepEqual` on whole objects.

## Versioning and releases

`SCRIPT_VERSION` in the source and `version` in `package.json` should be kept in
sync. Bump them whenever runtime behavior changes so that:

- the bookmarklet reloads the new code in already-open tabs, and
- the install page reflects the new build after Pages deploys.

After bumping, run `npm run check && npm run build` and commit the source and
config changes. `dist/` is gitignored and rebuilt by CI for Pages.

## Security model

- The script only **reads** visible DOM text (`textContent`) and writes a local
  text `Blob`; it never sends transcript content anywhere.
- It has no dependencies and makes no network requests. Keep it that way:
  bookmarklets run with the host page's privileges.
- Transcript text is treated as plain text, never injected as HTML.
- The generated install page uses a restrictive Content Security Policy and an
  external `site.js` (no inline event handlers) for the copy button.

See the "Security notes" section of the README for the user-facing summary.
