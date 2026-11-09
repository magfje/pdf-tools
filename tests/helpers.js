import { PDFDocument, degrees } from "../tools/pdflib.js";

/** Create a document; each spec is [width, height, rotation?]. */
export async function makeDoc(specs, { title } = {}) {
  const doc = await PDFDocument.create();
  for (const [w, h, rot = 0] of specs) {
    const page = doc.addPage([w, h]);
    if (rot) page.setRotation(degrees(rot));
  }
  if (title) doc.setTitle(title);
  return doc;
}

/** Save and reload, like the real app does between runs. */
export async function roundTrip(doc) {
  return PDFDocument.load(await doc.save(), { updateMetadata: false });
}

export const approx = (a, b, eps = 0.01) => Math.abs(a - b) < eps;
