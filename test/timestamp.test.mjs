import assert from "node:assert/strict";
import test from "node:test";

import { loadScript } from "./helpers/load.mjs";

const { _private } = await loadScript();

test("timestampToSpokenText handles minutes and seconds", () => {
  assert.equal(_private.timestampToSpokenText("1:02"), "1 minute 2 seconds");
});

test("timestampToSpokenText keeps zero minutes", () => {
  assert.equal(_private.timestampToSpokenText("0:05"), "0 minutes 5 seconds");
});

test("timestampToSpokenText handles hours", () => {
  assert.equal(_private.timestampToSpokenText("1:02:03"), "1 hour 2 minutes 3 seconds");
});

test("timestampToSpokenText returns empty string for invalid input", () => {
  assert.equal(_private.timestampToSpokenText("not-a-time"), "");
  assert.equal(_private.timestampToSpokenText("5"), "");
});

test("formatTimestamp pads seconds and omits hours when zero", () => {
  assert.equal(_private.formatTimestamp(0, 1, 9), "1:09");
});

test("formatTimestamp includes padded hours and minutes", () => {
  assert.equal(_private.formatTimestamp(1, 2, 3), "1:02:03");
});
