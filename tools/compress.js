import {
  PDFArray,
  PDFBool,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
} from "./pdflib.js";

// Re-encoding settings per level. maxSide caps the longest image side in
// pixels (1700 px is roughly 200 dpi across a full A4 page).
export const IMAGE_LEVELS = {
  high: { quality: 0.82, maxSide: 2400 },
  medium: { quality: 0.7, maxSide: 1700 },
  low: { quality: 0.5, maxSide: 1200 },
};

const MIN_IMAGE_BYTES = 20 * 1024; // not worth touching small images

/**
 * Re-encode large raster images as smaller JPEGs.
 *
 * `encoder(input, { quality, maxSide })` does the pixel work (a canvas in the
 * browser) and resolves to { bytes, width, height } or null. `input` is
 * { kind: "jpeg", bytes } or { kind: "raw", pixels, width, height, components }.
 *
 * Only images that can be re-encoded safely are touched: 8-bit RGB or gray,
 * no colour-key masks or decode arrays. An image is replaced only if the
 * result is at least 10% smaller. Returns { images, savedBytes }.
 */
export async function recompressImages(pdfDoc, level, encoder) {
  const settings = IMAGE_LEVELS[level];
  if (!settings) throw new Error(`unknown compression level "${level}"`);

  const { context } = pdfDoc;
  let images = 0;
  let savedBytes = 0;

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    if (obj.contents.length < MIN_IMAGE_BYTES) continue;

    const input = describeImage(obj, context);
    if (!input) continue;

    let result;
    try {
      result = await encoder(input, settings);
    } catch {
      continue; // undecodable image: leave it alone
    }
    if (!result || result.bytes.length >= obj.contents.length * 0.9) continue;

    const newDict = dict.clone(context);
    for (const key of ["Filter", "DecodeParms", "Length"]) newDict.delete(PDFName.of(key));
    newDict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
    newDict.set(PDFName.of("Width"), PDFNumber.of(result.width));
    newDict.set(PDFName.of("Height"), PDFNumber.of(result.height));
    newDict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
    // Browsers always encode 3-channel JPEGs; keep an RGB colour space (incl.
    // ICC profiles), otherwise fall back to DeviceRGB.
    if (input.components !== 3) {
      newDict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
    }

    savedBytes += obj.contents.length - result.bytes.length;
    context.assign(ref, PDFRawStream.of(newDict, result.bytes));
    images++;
  }

  return { images, savedBytes };
}

function describeImage(stream, context) {
  const dict = stream.dict;
  const lookup = (key) => context.lookup(dict.get(PDFName.of(key)));

  if (lookup("ImageMask") === PDFBool.True) return null;
  if (dict.has(PDFName.of("Mask")) || dict.has(PDFName.of("Decode"))) return null;
  const bpc = lookup("BitsPerComponent");
  if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) return null;

  const components = colorComponents(lookup("ColorSpace"), context);
  if (components !== 1 && components !== 3) return null;

  let filter = lookup("Filter");
  if (filter instanceof PDFArray) {
    if (filter.size() !== 1) return null;
    filter = context.lookup(filter.get(0));
  }

  const width = lookup("Width")?.asNumber?.();
  const height = lookup("Height")?.asNumber?.();
  if (!width || !height) return null;

  if (filter === PDFName.of("DCTDecode")) {
    return { kind: "jpeg", bytes: stream.contents, width, height, components };
  }

  if (filter === PDFName.of("FlateDecode")) {
    // pdf-lib's decoder doesn't undo PNG/TIFF predictors.
    let parms = lookup("DecodeParms");
    if (parms instanceof PDFArray) parms = context.lookup(parms.get(0));
    const predictor = parms?.get?.(PDFName.of("Predictor"));
    if (predictor && context.lookup(predictor).asNumber() > 1) return null;

    const pixels = decodePDFRawStream(stream).decode();
    if (pixels.length < width * height * components) return null;
    return { kind: "raw", pixels, width, height, components };
  }

  return null;
}

function colorComponents(cs, context) {
  if (cs === PDFName.of("DeviceRGB")) return 3;
  if (cs === PDFName.of("DeviceGray")) return 1;
  if (cs instanceof PDFArray && context.lookup(cs.get(0)) === PDFName.of("ICCBased")) {
    const profile = context.lookup(cs.get(1));
    const n = context.lookup(profile?.dict?.get(PDFName.of("N")));
    return n?.asNumber?.() ?? 0;
  }
  return 0;
}

/** pdf.save() options. Object streams make the file structure smaller. */
export function getSaveOptions() {
  return { useObjectStreams: true };
}
