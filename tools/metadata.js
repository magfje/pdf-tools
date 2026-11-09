import { PDFHexString, PDFName } from "./pdflib.js";

const INFO_KEYS = ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate"];

export function readMetadata(pdfDoc) {
  return {
    title: pdfDoc.getTitle() || "",
    author: pdfDoc.getAuthor() || "",
    subject: pdfDoc.getSubject() || "",
    keywords: pdfDoc.getKeywords() || "",
  };
}

/** Remove the document info dictionary entries and the XMP metadata stream. */
export function stripMetadata(pdfDoc) {
  const info = pdfDoc.getInfoDict();
  for (const key of info.keys()) info.delete(key);
  pdfDoc.catalog.delete(PDFName.of("Metadata"));
}

/** Copy document info entries (title, author, dates, ...) from one doc to another. */
export function copyInfo(fromDoc, toDoc) {
  const from = fromDoc.getInfoDict();
  const to = toDoc.getInfoDict();
  for (const key of INFO_KEYS) {
    const value = from.get(PDFName.of(key));
    if (value) to.set(PDFName.of(key), value);
  }
}

/**
 * opts: { strip, title, author, subject, keywords }
 * With `strip`, everything is removed first; then any non-empty field is set.
 * Without `strip`, a field left empty clears that value, unless `keepEmpty`
 * is set (used when the same settings run on several files).
 */
export function applyMetadata(pdfDoc, opts) {
  if (opts.strip) stripMetadata(pdfDoc);
  const fields = { title: "Title", author: "Author", subject: "Subject", keywords: "Keywords" };
  const info = pdfDoc.getInfoDict();

  for (const [field, key] of Object.entries(fields)) {
    const value = (opts[field] ?? "").trim();
    if (value) {
      info.set(PDFName.of(key), PDFHexString.fromText(value));
    } else if (!opts.strip && !opts.keepEmpty) {
      info.delete(PDFName.of(key));
    }
  }
}
