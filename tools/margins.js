import { displayGeometry, displayMarginsToBox, mmToPt, placeContent } from "./geometry.js";

/**
 * Shrink each page's content so there is at least the given margin (in mm,
 * as the page is displayed) on every side. The page size stays the same.
 */
export function addMargins(pdfDoc, marginsMm) {
  const display = {
    top: mmToPt(marginsMm.top),
    right: mmToPt(marginsMm.right),
    bottom: mmToPt(marginsMm.bottom),
    left: mmToPt(marginsMm.left),
  };

  for (const page of pdfDoc.getPages()) {
    const { rotation } = displayGeometry(page);
    const m = displayMarginsToBox(display, rotation);
    const { width, height } = page.getCropBox();
    const innerWidth = width - m.left - m.right;
    const innerHeight = height - m.top - m.bottom;
    if (innerWidth <= 0 || innerHeight <= 0) {
      throw new Error("margins are larger than the page");
    }

    const s = Math.min(innerWidth / width, innerHeight / height);
    placeContent(page, {
      sx: s,
      sy: s,
      newWidth: width,
      newHeight: height,
      offsetX: m.left + (innerWidth - width * s) / 2,
      offsetY: m.bottom + (innerHeight - height * s) / 2,
    });
  }
}
