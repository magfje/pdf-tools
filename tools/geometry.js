import { concatTransformationMatrix, popGraphicsState, pushGraphicsState } from "./pdflib.js";

// Helpers for working with pages as the reader *sees* them.
//
// A PDF page has a box (in unrotated "user space") plus a /Rotate value that
// viewers apply clockwise when displaying it. Tools that talk about
// "landscape", "bottom-center" or "left margin" must use the displayed
// orientation, otherwise pages that carry a /Rotate behave wrongly.

export const MM_TO_PT = 72 / 25.4;
export const A4 = { width: 595.28, height: 841.89 };

export function mmToPt(mm) {
  return mm * MM_TO_PT;
}

/** Page rotation normalised to 0, 90, 180 or 270. */
export function getRotation(page) {
  const angle = page.getRotation().angle || 0;
  const normalised = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return normalised;
}

/**
 * Geometry of the visible (crop) box as displayed.
 * `toPdf(dx, dy)` maps display coordinates (origin bottom-left of what the
 * reader sees) to the page's user space. Draw text/images at that point with
 * `rotate: degrees(rotation + angle)` to make them appear at `angle` (counter-
 * clockwise) in the displayed page.
 */
export function displayGeometry(page) {
  const box = page.getCropBox();
  const rotation = getRotation(page);
  const sideways = rotation === 90 || rotation === 270;
  const width = sideways ? box.height : box.width;
  const height = sideways ? box.width : box.height;

  const toPdf = (dx, dy) => {
    switch (rotation) {
      case 90:
        return { x: box.x + box.width - dy, y: box.y + dx };
      case 180:
        return { x: box.x + box.width - dx, y: box.y + box.height - dy };
      case 270:
        return { x: box.x + dy, y: box.y + box.height - dx };
      default:
        return { x: box.x + dx, y: box.y + dy };
    }
  };

  return { width, height, rotation, isLandscape: width > height, toPdf };
}

/**
 * Convert margins given in display terms ({top, right, bottom, left}) to
 * margins on the unrotated page box.
 */
export function displayMarginsToBox(margins, rotation) {
  const { top, right, bottom, left } = margins;
  switch (rotation) {
    case 90:
      return { left: top, top: right, right: bottom, bottom: left };
    case 180:
      return { left: right, top: bottom, right: left, bottom: top };
    case 270:
      return { right: top, top: left, left: bottom, bottom: right };
    default:
      return { top, right, bottom, left };
  }
}

/**
 * Scale a page's content (and annotations) by sx/sy and give it a new box of
 * newWidth x newHeight (unrotated user space) where the scaled content's
 * lower-left corner sits at (offsetX, offsetY) inside the new box.
 *
 * Moving the box instead of translating the content keeps links and other
 * annotations aligned with the content.
 */
export function placeContent(page, { sx, sy, newWidth, newHeight, offsetX, offsetY }) {
  const visible = page.getCropBox();
  scaleExistingContent(page, sx, sy);
  page.scaleAnnotations(sx, sy);
  const x = visible.x * sx - offsetX;
  const y = visible.y * sy - offsetY;
  page.setMediaBox(x, y, newWidth, newHeight);
  page.setCropBox(x, y, newWidth, newHeight);
  page.setBleedBox(x, y, newWidth, newHeight);
  page.setTrimBox(x, y, newWidth, newHeight);
  page.setArtBox(x, y, newWidth, newHeight);
}

/**
 * Wrap the page's existing content streams in `q sx 0 0 sy 0 0 cm ... Q`.
 *
 * pdf-lib's page.scaleContent() also wraps the stream that later drawText /
 * drawImage calls write to, so anything drawn afterwards (page numbers,
 * watermarks) would be scaled as well. Here only existing content is wrapped
 * and pdf-lib's cached drawing stream is dropped so new drawing goes into a
 * fresh stream after the wrapper.
 */
function scaleExistingContent(page, sx, sy) {
  const { context } = page.doc;
  const start = context.register(
    context.contentStream([pushGraphicsState(), concatTransformationMatrix(sx, 0, 0, sy, 0, 0)])
  );
  const end = context.register(context.contentStream([popGraphicsState()]));
  page.node.normalize();
  page.node.wrapContentStreams(start, end);
  page.contentStream = undefined;
  page.contentStreamRef = undefined;
}
