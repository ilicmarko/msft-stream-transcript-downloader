import assert from "node:assert/strict";
import test from "node:test";

import { loadScript } from "./helpers/load.mjs";

const { _private } = await loadScript();

const entries = [
  { speaker: "Alice", timestamp: "0:05", text: "Hello." },
  { speaker: "Alice", timestamp: "0:10", text: "Second line." },
  { speaker: "Bob", timestamp: "0:20", text: "Bob speaking." },
  { speaker: "Bob", timestamp: "", text: "Bob continues." }
];

test("includes a header with the title and entry count", () => {
  const output = _private.formatTranscript("My Title", entries);

  assert.match(output, /^TRANSCRIPT: My Title\n/);
  assert.match(output, /\nTotal entries: 4\n/);
});

test("groups consecutive same-speaker rows under one header", () => {
  const output = _private.formatTranscript("My Title", entries);

  // Alice's two rows share a single "[0:05] Alice:" header.
  assert.match(output, /\[0:05\] Alice:\nHello\.\nSecond line\./);
});

test("does not repeat the speaker header for continuation rows", () => {
  const output = _private.formatTranscript("My Title", entries);

  assert.equal((output.match(/Alice:/g) || []).length, 1);
  assert.equal((output.match(/Bob:/g) || []).length, 1);
});

test("uses the first row's timestamp for the group header", () => {
  const output = _private.formatTranscript("My Title", entries);

  assert.match(output, /\[0:20\] Bob:\nBob speaking\.\nBob continues\./);
});

test("never emits an empty timestamp bracket", () => {
  const output = _private.formatTranscript("My Title", [
    { speaker: "Sam", timestamp: "", text: "started transcription" },
    { speaker: "Alice", timestamp: "0:05", text: "Hello." }
  ]);

  assert.doesNotMatch(output, /\[\]/);
  // A speaker whose first row has no timestamp still gets a plain header.
  assert.match(output, /\nSam:\nstarted transcription/);
});

test("ends with a single trailing newline", () => {
  const output = _private.formatTranscript("My Title", entries);

  assert.match(output, /[^\n]\n$/);
});

test("does not interpret transcript text as markup", () => {
  // The transcript is read with textContent and written verbatim into a text Blob,
  // so any HTML-looking content is preserved literally, not executed.
  const output = _private.formatTranscript("T", [
    { speaker: "X", timestamp: "0:01", text: "<script>alert(1)</script>" }
  ]);

  assert.match(output, /<script>alert\(1\)<\/script>/);
});
