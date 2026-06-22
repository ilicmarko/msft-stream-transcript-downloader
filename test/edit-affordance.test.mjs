import assert from "node:assert/strict";
import test from "node:test";

import { loadScript } from "./helpers/load.mjs";

const { _private } = await loadScript();

const EDIT_ICON = "\ue70f"; // Fluent UI edit (pencil) glyph rendered by the active row.
const EDIT_TOOLTIP = "Use enter key to enable transcript edit mode";

test("removes the inline edit button icon, label and tooltip", () => {
  const raw = `OK, just give me a second.${EDIT_ICON}Edit${EDIT_TOOLTIP}`;

  assert.equal(_private.stripUiAffordances(raw), "OK, just give me a second.");
});

test("removes a leftover icon glyph anywhere in the text", () => {
  assert.equal(_private.stripUiAffordances(`Hello${EDIT_ICON} world`), "Hello");
});

test("removes the tooltip even when the icon glyph is absent", () => {
  assert.equal(
    _private.stripUiAffordances(`Some text Edit${EDIT_TOOLTIP}`),
    "Some text"
  );
});

test("leaves text without UI chrome untouched", () => {
  assert.equal(_private.stripUiAffordances("Plain transcript text."), "Plain transcript text.");
});

test("stripTranscriptChrome removes the edit affordance end to end", () => {
  const raw = `Alex Example 0 minutes 5 secondsOK, just give me a second.${EDIT_ICON}Edit${EDIT_TOOLTIP}`;

  assert.equal(
    _private.stripTranscriptChrome(raw, "Alex Example", "0:05"),
    "OK, just give me a second."
  );
});

test("does not strip the word 'edit' when it is part of the sentence", () => {
  assert.equal(
    _private.stripUiAffordances("We need to edit the document."),
    "We need to edit the document."
  );
});
