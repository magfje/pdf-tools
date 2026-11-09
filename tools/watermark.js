import { StandardFonts, degrees, rgb } from "./pdflib.js";
import { displayGeometry } from "./geometry.js";

const EDGE = 20;

/**
 * Add a text or image watermark to every page.
 * opts: { type: "text"|"image", text, fontSize, color ("#rrggbb"), rotation
 *         (degrees, counter-clockwise), opacity, position, imageBytes, imageScale }
 */
export async function addWatermark(pdfDoc, opts) {
  const { type, opacity = 0.3, position = "center", rotation = 0 } = opts;
  let item; // { width, height, draw(page, x, y, rotate) }

  if (type === "image") {
    if (!opts.imageBytes) throw new Error("watermark: choose an image");
    const image = await embedImage(pdfDoc, opts.imageBytes);
    const width = image.width * opts.imageScale;
    const height = image.height * opts.imageScale;
    item = {
      width,
      height,
      draw: (page, x, y, rotate) =>
        page.drawImage(image, { x, y, width, height, opacity, rotate }),
    };
  } else {
    const text = (opts.text || "").trim();
    if (!text) throw new Error("watermark: enter some text");
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    try {
      font.encodeText(text);
    } catch {
      throw new Error(
        "watermark: the text has characters the built-in font can't draw (e.g. emoji)"
      );
    }
    const size = opts.fontSize;
    const color = hexToRgb(opts.color);
    item = {
      width: font.widthOfTextAtSize(text, size),
      // Cap height is what the eye sees as the text's height.
      height: font.heightAtSize(size, { descender: false }),
      draw: (page, x, y, rotate) =>
        page.drawText(text, { x, y, size, font, color, opacity, rotate }),
    };
  }

  for (const page of pdfDoc.getPages()) {
    const view = displayGeometry(page);
    const center = centerFor(position, view, item, rotation);
    // Anchor (bottom-left of the item) so that the item, rotated by
    // `rotation` around its own centre, is centred on `center`.
    const rad = (rotation * Math.PI) / 180;
    const hw = item.width / 2;
    const hh = item.height / 2;
    const ax = center.x - (hw * Math.cos(rad) - hh * Math.sin(rad));
    const ay = center.y - (hw * Math.sin(rad) + hh * Math.cos(rad));
    const { x, y } = view.toPdf(ax, ay);
    item.draw(page, x, y, degrees(view.rotation + rotation));
  }
}

// Centre point for the item in display coordinates, keeping its rotated
// bounding box EDGE points away from the page edges.
function centerFor(position, view, item, rotation) {
  const rad = (rotation * Math.PI) / 180;
  const bw = Math.abs(item.width * Math.cos(rad)) + Math.abs(item.height * Math.sin(rad));
  const bh = Math.abs(item.width * Math.sin(rad)) + Math.abs(item.height * Math.cos(rad));
  const [vertical, horizontal] = position === "center" ? ["center", "center"] : position.split("-");

  const x =
    horizontal === "left"
      ? EDGE + bw / 2
      : horizontal === "right"
        ? view.width - EDGE - bw / 2
        : view.width / 2;
  const y =
    vertical === "top"
      ? view.height - EDGE - bh / 2
      : vertical === "bottom"
        ? EDGE + bh / 2
        : view.height / 2;
  return { x, y };
}

async function embedImage(pdfDoc, bytes) {
  const b = new Uint8Array(bytes);
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return pdfDoc.embedPng(b);
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    return pdfDoc.embedJpg(b);
  }
  throw new Error("watermark: image must be a png or jpeg");
}

export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}
