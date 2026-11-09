import { PDFDocument } from "./pdflib.js";
import { parsePageRanges } from "./ranges.js";

/**
 * Split a document into parts. Returns [{ name, pdf }].
 *  - "individual": one file per page
 *  - "ranges":     one file per range in `ranges` (e.g. "1-3, 4-")
 *  - "every":      chunks of `every` pages
 *  - "evenodd":    odd pages and even pages
 */
export async function splitPDF(pdfDoc, { type, ranges = "", every = 1 }) {
  const count = pdfDoc.getPageCount();
  const groups = []; // { name, indices }

  switch (type) {
    case "individual":
      for (let i = 0; i < count; i++) groups.push({ name: `page_${i + 1}`, indices: [i] });
      break;

    case "ranges":
      for (const { start, end } of parsePageRanges(ranges, count)) {
        groups.push({
          name: start === end ? `page_${start}` : `pages_${start}-${end}`,
          indices: Array.from({ length: end - start + 1 }, (_, k) => start - 1 + k),
        });
      }
      break;

    case "every": {
      const size = Math.floor(Number(every));
      if (!(size >= 1)) throw new Error("split: pages per file must be 1 or more");
      for (let s = 0; s < count; s += size) {
        const e = Math.min(s + size, count);
        groups.push({
          name: e - s === 1 ? `page_${s + 1}` : `pages_${s + 1}-${e}`,
          indices: Array.from({ length: e - s }, (_, k) => s + k),
        });
      }
      break;
    }

    case "evenodd": {
      const all = [...Array(count).keys()];
      const odd = all.filter((i) => i % 2 === 0);
      const even = all.filter((i) => i % 2 === 1);
      if (odd.length) groups.push({ name: "odd_pages", indices: odd });
      if (even.length) groups.push({ name: "even_pages", indices: even });
      break;
    }

    default:
      throw new Error(`unknown split type "${type}"`);
  }

  const parts = [];
  for (const { name, indices } of groups) {
    const part = await PDFDocument.create({ updateMetadata: false });
    const pages = await part.copyPages(pdfDoc, indices);
    pages.forEach((p) => part.addPage(p));
    parts.push({ name, pdf: part });
  }
  return parts;
}
