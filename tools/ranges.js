/**
 * Parse a page range string like "1-3, 5, 8-" into 1-based inclusive ranges.
 * "8-" means page 8 to the last page. Throws an Error with a readable message
 * for anything invalid or outside 1..pageCount.
 */
export function parsePageRanges(input, pageCount) {
  const text = String(input ?? "").trim();
  if (!text) throw new Error("enter at least one page or range, e.g. 1-3, 5");

  const ranges = [];
  for (const raw of text.split(",")) {
    const part = raw.trim();
    if (!part) continue;

    const match = /^(\d+)\s*(?:(-)\s*(\d*))?$/.exec(part);
    if (!match) throw new Error(`"${part}" is not a page or range`);

    const start = Number(match[1]);
    const end = match[2] ? (match[3] ? Number(match[3]) : pageCount) : start;

    if (start < 1) throw new Error(`pages start at 1 ("${part}")`);
    if (end < start) throw new Error(`"${part}" ends before it starts`);
    if (start > pageCount) {
      throw new Error(`"${part}" is past the last page (${pageCount})`);
    }
    ranges.push({ start, end: Math.min(end, pageCount) });
  }

  if (ranges.length === 0) {
    throw new Error("enter at least one page or range, e.g. 1-3, 5");
  }
  return ranges;
}

/** 0-based page indices covered by the ranges, in order, without duplicates. */
export function rangesToIndices(ranges) {
  const seen = new Set();
  const indices = [];
  for (const { start, end } of ranges) {
    for (let p = start; p <= end; p++) {
      if (!seen.has(p - 1)) {
        seen.add(p - 1);
        indices.push(p - 1);
      }
    }
  }
  return indices;
}
