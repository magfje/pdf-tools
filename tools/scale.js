import { A4, displayGeometry, placeContent } from "./geometry.js";

/**
 * Resize every page to A4.
 *  - "smart":   fit inside A4 in the page's own orientation (portrait or landscape)
 *  - "fit":     fit inside portrait A4
 *  - "stretch": fill portrait A4 exactly (distorts content)
 * Content is scaled uniformly and centred for "smart" and "fit".
 */
export function scaleToA4(pdfDoc, { mode = "smart" } = {}) {
  for (const page of pdfDoc.getPages()) {
    const view = displayGeometry(page);
    const landscapeTarget = mode === "smart" && view.isLandscape;
    // Target in display orientation...
    const target = landscapeTarget
      ? { width: A4.height, height: A4.width }
      : { width: A4.width, height: A4.height };
    // ...converted to the unrotated page box.
    const sideways = view.rotation === 90 || view.rotation === 270;
    const newWidth = sideways ? target.height : target.width;
    const newHeight = sideways ? target.width : target.height;

    const { width, height } = page.getCropBox();
    let sx = newWidth / width;
    let sy = newHeight / height;
    if (mode !== "stretch") sx = sy = Math.min(sx, sy);

    placeContent(page, {
      sx,
      sy,
      newWidth,
      newHeight,
      offsetX: (newWidth - width * sx) / 2,
      offsetY: (newHeight - height * sy) / 2,
    });
  }
}
