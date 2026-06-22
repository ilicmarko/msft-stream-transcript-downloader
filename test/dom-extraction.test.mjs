import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import { parseHTML } from "linkedom";

import { loadScript } from "./helpers/load.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, "fixtures", "transcript-cells.html");

const { _private } = await loadScript();
const html = await readFile(fixturePath, "utf8");
const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);

function cell(index) {
  return document.querySelector(`.ms-List-cell[data-list-index="${index}"]`);
}

test("getCandidateItems returns one item per transcript cell, not inner elements", () => {
  // The fixture's sub-entries and item headers also carry role="listitem"; the
  // harvester must not collect those as separate entries (that caused duplicate,
  // header-less rows appended at the end of the transcript).
  const candidates = _private.getCandidateItems(document.body);

  assert.equal(candidates.length, 4);

  for (const item of candidates) {
    assert.ok(item.getAttribute("data-list-index") !== null, "candidate is a top-level cell");
  }
});

test("harvesting the whole fixture yields no duplicate utterances", () => {
  const candidates = _private.getCandidateItems(document.body);
  let lastSpeaker = "";
  const texts = [];

  for (const item of candidates) {
    const entry = _private.readEntry(item, lastSpeaker);
    if (!entry) continue;
    if (entry.speaker) lastSpeaker = entry.speaker;
    texts.push(entry.text);
  }

  assert.deepEqual(texts, [
    "started transcription",
    "OK, just give me a second.",
    "OK, can you see the presentation?",
    "Let me share my screen."
  ]);
});

test("reads clean text from the active row even with inline edit-button chrome", () => {
  const entry = _private.readEntry(cell(1), "");

  assert.equal(entry.text, "OK, just give me a second.");
  assert.equal(entry.speaker, "Alex Example");
  assert.equal(entry.timestamp, "0:05");
});

test("extracted text contains no spoken-timestamp aria label", () => {
  const entry = _private.readEntry(cell(1), "");

  // The screen-reader label looks like "0 minutes 5 seconds"; the spoken sentence
  // may still legitimately contain the word "second".
  assert.doesNotMatch(entry.text, /\d+\s+minutes?\s+\d+\s+seconds?/i);
  assert.doesNotMatch(entry.text, /Alex Example\s+\d/);
});

test("extracted text contains no edit-button chrome or icon glyph", () => {
  const entry = _private.readEntry(cell(1), "");

  assert.doesNotMatch(entry.text, /Edit|enable transcript edit mode/i);
  assert.doesNotMatch(entry.text, /[\ue000-\uf8ff]/);
});

test("reads a normal speaker row", () => {
  const entry = _private.readEntry(cell(2), "");

  assert.equal(entry.text, "OK, can you see the presentation?");
  assert.equal(entry.speaker, "Alex Example");
  assert.equal(entry.timestamp, "0:34");
});

test("reads a system event row and trims leading whitespace", () => {
  const entry = _private.readEntry(cell(0), "Fallback Speaker");

  assert.equal(entry.text, "started transcription");
  assert.equal(entry.speaker, "Sam Tester");
});

test("a same-speaker continuation row reads clean text with no visible timestamp", () => {
  // Stream omits the repeated header/timestamp for continuation rows, so the
  // timestamp is empty by design while the text stays clean.
  const entry = _private.readEntry(cell(3), "Alex Example");

  assert.equal(entry.text, "Let me share my screen.");
  assert.equal(entry.timestamp, "");
});

test("getTranscriptText prefers the dedicated text span", () => {
  // Even though the entry container also holds the edit chrome, the text span wins.
  assert.equal(_private.getTranscriptText(cell(1)), "OK, just give me a second.");
});
