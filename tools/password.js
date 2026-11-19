import { PDFArray, PDFDict, PDFHeader, PDFHexString, PDFStream, PDFString } from "./pdflib.js";

/**
 * Password-protect a document (AES-128, readable by every common PDF viewer).
 * Must be called right before pdfDoc.save(), and only once per document.
 * Pass the same `useObjectStreams` you will save with.
 */
export async function encryptPDF(pdfDoc, password, { useObjectStreams = true } = {}) {
  if (!password) throw new Error("password: enter a password");
  // The library ignores `pdfVersion` below and picks the cipher from the file's
  // header instead: RC4-128 for PDF 1.4/1.5, 40-bit RC4 for older files and
  // PDF 2.0. Declare 1.7 so every file gets AES-128.
  pdfDoc.context.header = PDFHeader.forVersion(1, 7);
  await pdfDoc.encrypt({
    userPassword: password,
    ownerPassword: password,
    pdfVersion: "1.7", // V4 / AESV2 (overwritten from the header, see above).
    permissions: {
      printing: "highResolution",
      modifying: true,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true,
    },
  });
  encryptLooseStrings(pdfDoc.context, useObjectStreams);
}

/**
 * pdf-lib-with-encrypt only encrypts stream data, never strings. Strings inside
 * an object stream are covered by that stream's encryption, but any object the
 * writer leaves outside one (streams' own dictionaries, objects with a nonzero
 * generation number, or everything when object streams are off) keeps its
 * strings in plain text. Acrobat then tries to AES-decrypt them, fails, and
 * calls the whole file damaged (lenient viewers like Chrome just shrug).
 * Mirror the writer's choice of loose objects and encrypt their strings here.
 */
function encryptLooseStrings(context, useObjectStreams) {
  const security = context.getSecurity();
  const encryptRef = context.trailerInfo.Encrypt;
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (ref === encryptRef) continue;
    const isStream = object instanceof PDFStream;
    const loose = !useObjectStreams || isStream || ref.generationNumber !== 0;
    if (!loose) continue;
    const encrypt = security.getEncryptFn(ref.objectNumber, ref.generationNumber);
    const root = isStream ? object.dict : object;
    const replaced = encryptStrings(root, encrypt);
    if (replaced !== root) context.assign(ref, replaced); // a bare string object
  }
}

/** Return `value` with every string in it encrypted (dicts/arrays edited in place). */
function encryptStrings(value, encrypt) {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    return PDFHexString.of(toHex(encrypt(value.asBytes())));
  }
  if (value instanceof PDFDict) {
    for (const [key, item] of value.entries()) {
      const next = encryptStrings(item, encrypt);
      if (next !== item) value.set(key, next);
    }
  } else if (value instanceof PDFArray) {
    for (let i = 0; i < value.size(); i++) {
      const item = value.get(i);
      const next = encryptStrings(item, encrypt);
      if (next !== item) value.set(i, next);
    }
  }
  return value;
}

function toHex(bytes) {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
