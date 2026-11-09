import { degrees } from "./pdflib.js";
import { displayGeometry, getRotation } from "./geometry.js";

/**
 * Rotate pages clockwise by `angle` (90, 180, 270), adding to any rotation the
 * page already has. `which` is "all", "landscape" or "portrait", judged by how
 * the page is displayed (so a portrait page stored with /Rotate 90 counts as
 * landscape).
 */
export function rotatePages(pdfDoc, { angle, which = "all" }) {
  let rotated = 0;
  for (const page of pdfDoc.getPages()) {
    const { isLandscape } = displayGeometry(page);
    const matches =
      which === "all" ||
      (which === "landscape" && isLandscape) ||
      (which === "portrait" && !isLandscape);
    if (!matches) continue;

    page.setRotation(degrees((getRotation(page) + angle) % 360));
    rotated++;
  }
  return rotated;
}
