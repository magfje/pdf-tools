import { StandardFonts, degrees, rgb } from "./pdflib.js";
import { displayGeometry } from "./geometry.js";

const EDGE = 24; // distance from the page edge, in points

export function formatPageNumber(format, number, total) {
  switch (format) {
    case "n-of-total":
      return `${number} / ${total}`;
    case "page-n-of-total":
      return `page ${number} of ${total}`;
    default:
      return String(number);
  }
}

/**
 * Stamp page numbers at `position` ("bottom-center", "top-right", ...) as the
 * page is displayed, so numbers stay upright and in place on rotated pages.
 * `start` is the number printed on the first numbered page; with `skipFirst`
 * the first page (e.g. a cover) gets no number.
 */
export async function addPageNumbers(
  pdfDoc,
  { position = "bottom-center", fontSize = 12, start = 1, format = "n", skipFirst = false }
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const numbered = skipFirst ? pages.slice(1) : pages;
  const total = numbered.length + start - 1;

  numbered.forEach((page, i) => {
    const text = formatPageNumber(format, start + i, total);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const view = displayGeometry(page);
    const [vertical, horizontal] = position.split("-");

    const dx =
      horizontal === "left"
        ? EDGE
        : horizontal === "right"
          ? view.width - EDGE - textWidth
          : (view.width - textWidth) / 2;
    const dy = vertical === "top" ? view.height - EDGE - fontSize : EDGE;

    const { x, y } = view.toPdf(dx, dy);
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      rotate: degrees(view.rotation),
    });
  });
}
