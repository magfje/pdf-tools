import { parsePageRanges, rangesToIndices } from "./ranges.js";

/** Remove the pages described by a range string such as "1, 4-6". */
export function removePages(pdfDoc, rangeText) {
  const count = pdfDoc.getPageCount();
  const indices = rangesToIndices(parsePageRanges(rangeText, count));
  if (indices.length >= count) {
    throw new Error("remove pages: that would remove every page");
  }
  // Remove from the end so earlier indices stay valid.
  indices.sort((a, b) => b - a).forEach((i) => pdfDoc.removePage(i));
  return indices.length;
}
