import assert from "node:assert/strict";
import test from "node:test";

import { loadScript } from "./helpers/load.mjs";

const { _private } = await loadScript();
const sanitizeFilename = _private.sanitizeFilename;

test("replaces spaces and collapses repeats", () => {
  assert.equal(sanitizeFilename("Normal   Title"), "Normal_Title");
});

test("removes path separators so the name stays a single segment", () => {
  const result = sanitizeFilename("../../etc/passwd");

  assert.doesNotMatch(result, /[/\\]/);
});

test("never starts with a dot (no hidden files or traversal-looking names)", () => {
  for (const input of ["..", ".", "...", "./secret", ".bashrc"]) {
    const result = sanitizeFilename(input);

    assert.doesNotMatch(result, /^\./, `input ${JSON.stringify(input)} produced ${result}`);
  }
});

test("replaces Windows-reserved characters", () => {
  assert.equal(sanitizeFilename('a<b>c:d"e|f?g*h'), "a_b_c_d_e_f_g_h");
});

test("removes control characters", () => {
  assert.equal(sanitizeFilename("a\u0000\u0001b\tc\nd"), "a_b_c_d");
});

test("falls back to a default name for empty input", () => {
  assert.equal(sanitizeFilename(""), "microsoft-stream-transcript");
});

test("falls back to a default name when only invalid characters remain", () => {
  assert.equal(sanitizeFilename("///"), "microsoft-stream-transcript");
});

test("caps the length to keep filesystem limits in check", () => {
  assert.equal(sanitizeFilename("a".repeat(300)).length, 180);
});

test("output never contains characters that are unsafe in filenames", () => {
  const inputs = [
    "../../etc/passwd",
    "C:\\Windows\\system32",
    "a\u0000b",
    "<script>alert(1)</script>",
    "name\twith\nwhitespace"
  ];

  for (const input of inputs) {
    const result = sanitizeFilename(input);

    assert.doesNotMatch(result, /[<>:"/\\|?*\u0000-\u001f]/, `unsafe char left in ${result}`);
  }
});
