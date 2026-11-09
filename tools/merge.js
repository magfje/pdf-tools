import { PDFDocument } from "./pdflib.js";
import { copyInfo } from "./metadata.js";

/** Append all pages of `docs`, in order, into a new document. */
export async function mergeDocuments(docs) {
  const merged = await PDFDocument.create({ updateMetadata: false });
  for (const doc of docs) {
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  // Keep title/author etc. from the first document.
  if (docs[0]) copyInfo(docs[0], merged);
  return merged;
}
