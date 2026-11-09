import { addMargins } from "./margins.js";
import { addPageNumbers } from "./pageNumbers.js";
import { applyMetadata, copyInfo } from "./metadata.js";
import { encryptPDF } from "./password.js";
import { getSaveOptions, recompressImages } from "./compress.js";
import { mergeDocuments } from "./merge.js";
import { removePages } from "./removePages.js";
import { rotatePages } from "./rotation.js";
import { scaleToA4 } from "./scale.js";
import { splitPDF } from "./split.js";
import { addWatermark } from "./watermark.js";

/**
 * Run every enabled tool, in a fixed order that makes geometric sense:
 *
 *   merge → remove pages → rotate → scale to A4 → margins
 *         → page numbers → watermark → compress images → split
 *         → metadata → password → save
 *
 * Rotation runs before scaling so "smart" A4 scaling sees the final
 * orientation, and stamps (numbers, watermark) go on last so they are not
 * shrunk by scaling or margins.
 *
 * @param docs     loaded PDFDocuments, in merge order (docs[0] alone if not merging)
 * @param options  { merge, removePages, rotate, scale, margins, pageNumbers,
 *                   watermark, compress, split, metadata, password } — each
 *                   either null/undefined (off) or that tool's settings
 * @param env      { imageEncoder, onProgress }
 * @returns { outputs: [{ suffix, bytes, pageCount }], report }
 */
export async function runPipeline(docs, options, env = {}) {
  const progress = env.onProgress || (() => {});
  const report = {};

  let doc;
  if (options.merge && docs.length > 1) {
    progress("merging");
    doc = await mergeDocuments(docs);
    report.merged = docs.length;
  } else {
    doc = docs[0];
  }

  if (options.removePages) {
    report.removedPages = removePages(doc, options.removePages.ranges);
  }
  if (options.rotate) {
    report.rotatedPages = rotatePages(doc, options.rotate);
  }
  if (options.scale) {
    scaleToA4(doc, options.scale);
  }
  if (options.margins) {
    addMargins(doc, options.margins);
  }
  if (options.pageNumbers) {
    await addPageNumbers(doc, options.pageNumbers);
  }
  if (options.watermark) {
    await addWatermark(doc, options.watermark);
  }
  if (options.compress && options.compress.level !== "none") {
    if (!env.imageEncoder) throw new Error("image compression is not available here");
    progress("compressing images");
    report.compression = await recompressImages(doc, options.compress.level, env.imageEncoder);
  }

  let parts = [{ suffix: "", pdf: doc }];
  if (options.split) {
    progress("splitting");
    const split = await splitPDF(doc, options.split);
    split.forEach((part) => copyInfo(doc, part.pdf));
    parts = split.map((part) => ({ suffix: part.name, pdf: part.pdf }));
  }

  const outputs = [];
  for (const [i, part] of parts.entries()) {
    if (parts.length > 1) progress(`saving ${i + 1} of ${parts.length}`);
    if (options.metadata) applyMetadata(part.pdf, options.metadata);
    if (options.password) await encryptPDF(part.pdf, options.password.password);
    const bytes = await part.pdf.save(getSaveOptions());
    outputs.push({ suffix: part.suffix, bytes, pageCount: part.pdf.getPageCount() });
  }

  return { outputs, report };
}
