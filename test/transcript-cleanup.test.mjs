import assert from "node:assert/strict";
import test from "node:test";

import { loadScript } from "./helpers/load.mjs";

const { _private } = await loadScript();

test("strips speaker and spoken timestamp prefixed by the speaker name", () => {
  const cleaned = _private.stripTranscriptChrome(
    "Alex Example 1 minute 2 secondsYeah.",
    "Alex Example",
    "1:02"
  );

  assert.equal(cleaned, "Yeah.");
});

test("strips a zero-minute spoken timestamp", () => {
  const cleaned = _private.stripTranscriptChrome(
    "0 minutes 5 secondsOK, just give me a second.",
    "Alex Example",
    "0:05"
  );

  assert.equal(cleaned, "OK, just give me a second.");
});

test("strips a spoken timestamp even when no visible timestamp was supplied", () => {
  const cleaned = _private.stripTranscriptChrome(
    "1 minute 9 secondsOK, just the text.",
    "Alex Example",
    ""
  );

  assert.equal(cleaned, "OK, just the text.");
});

test("strips an hour-long spoken timestamp", () => {
  const cleaned = _private.stripTranscriptChrome(
    "1 hour 2 minutes 3 secondsStill going.",
    "Speaker",
    "1:02:03"
  );

  assert.equal(cleaned, "Still going.");
});

test("leaves clean transcript text untouched", () => {
  const cleaned = _private.stripTranscriptChrome(
    "Just regular transcript content.",
    "Speaker",
    "2:00"
  );

  assert.equal(cleaned, "Just regular transcript content.");
});

test("does not strip numbers that are part of the spoken sentence", () => {
  const cleaned = _private.stripTranscriptChrome(
    "We have 3 issues to discuss today.",
    "Speaker",
    "5:00"
  );

  assert.equal(cleaned, "We have 3 issues to discuss today.");
});

test("parseSpokenTimestampPrefix returns the spoken text and clock timestamp", () => {
  const parsed = _private.parseSpokenTimestampPrefix("1 minute 9 secondsOK, just the text.");

  assert.equal(parsed.spoken, "1 minute 9 seconds");
  assert.equal(parsed.timestamp, "1:09");
});

test("parseSpokenTimestampPrefix parses hours", () => {
  const parsed = _private.parseSpokenTimestampPrefix("2 hours 5 minutes 7 secondsHello");

  assert.equal(parsed.spoken, "2 hours 5 minutes 7 seconds");
  assert.equal(parsed.timestamp, "2:05:07");
});

test("parseSpokenTimestampPrefix returns null for a bare seconds prefix", () => {
  // A lone "5 seconds..." is ambiguous and is not treated as a leading timestamp.
  assert.equal(_private.parseSpokenTimestampPrefix("5 secondsHello"), null);
});

test("parseSpokenTimestampPrefix returns null when there is no spoken timestamp", () => {
  assert.equal(_private.parseSpokenTimestampPrefix("Regular sentence."), null);
});
