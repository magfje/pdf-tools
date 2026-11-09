import test from "node:test";
import assert from "node:assert/strict";
import { parsePageRanges, rangesToIndices } from "../tools/ranges.js";

test("parses pages, ranges and open-ended ranges", () => {
  assert.deepEqual(parsePageRanges("1-3, 5, 8-", 10), [
    { start: 1, end: 3 },
    { start: 5, end: 5 },
    { start: 8, end: 10 },
  ]);
});

test("clamps the end of a range to the page count", () => {
  assert.deepEqual(parsePageRanges("4-99", 6), [{ start: 4, end: 6 }]);
});

test("rejects invalid input with a readable message", () => {
  assert.throws(() => parsePageRanges("", 5), /at least one/);
  assert.throws(() => parsePageRanges("abc", 5), /not a page/);
  assert.throws(() => parsePageRanges("0", 5), /start at 1/);
  assert.throws(() => parsePageRanges("4-2", 5), /ends before/);
  assert.throws(() => parsePageRanges("7", 5), /past the last page/);
});

test("rangesToIndices is 0-based and de-duplicated", () => {
  assert.deepEqual(rangesToIndices([{ start: 2, end: 3 }, { start: 3, end: 4 }]), [1, 2, 3]);
});
