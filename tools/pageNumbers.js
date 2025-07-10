export async function addPageNumbers(pdfDoc, rotationInfo = {}) {
  const enablePageNumbers =
    document.getElementById("enablePageNumbers").checked;
  if (!enablePageNumbers) return;

  const position = document.getElementById("pageNumberPosition").value;
  const fontSize = parseInt(document.getElementById("pageNumberSize").value);
  const startPage = parseInt(document.getElementById("startPage").value);
  const keepNumbersAtBottom = document.getElementById(
    "keepNumbersAtBottom"
  ).checked;

  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const pdfPages = pdfDoc.getPages();

  pdfPages.forEach((page, index) => {
    const pageNumber = index + startPage;
    const { width, height } = page.getSize();
    const rotation = rotationInfo[index] || 0;

    let x, y;
    const text = pageNumber.toString();
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    // If keeping numbers at bottom after rotation, always use bottom-center with rotation-aware positioning
    if (keepNumbersAtBottom && rotation !== 0) {
      // Calculate position to appear at bottom-center in the final rotated view
      switch (rotation) {
        case 90:
          // 90° clockwise: to appear at bottom-center, place at right-center of original
          x = width - 30;
          y = (height - textWidth) / 2;
          break;
        case 180:
          // 180°: to appear at bottom-center, place at top-center of original
          x = (width - textWidth) / 2;
          y = height - 30;
          break;
        case 270:
          // 270° clockwise: to appear at bottom-center, place at left-center of original
          x = 30;
          y = (height + textWidth) / 2;
          break;
        default:
          // No rotation
          x = (width - textWidth) / 2;
          y = 20;
          break;
      }

      page.drawText(text, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: PDFLib.rgb(0, 0, 0),
        rotate: PDFLib.degrees(rotation),
      });
    } else {
      // Original positioning logic (not rotation-aware)
      switch (position) {
        case "bottom-center":
          x = (width - textWidth) / 2;
          y = 20;
          break;
        case "bottom-right":
          x = width - textWidth - 20;
          y = 20;
          break;
        case "bottom-left":
          x = 20;
          y = 20;
          break;
        case "top-center":
          x = (width - textWidth) / 2;
          y = height - 30;
          break;
        case "top-right":
          x = width - textWidth - 20;
          y = height - 30;
          break;
        case "top-left":
          x = 20;
          y = height - 30;
          break;
      }

      // Draw text without rotation
      page.drawText(text, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: PDFLib.rgb(0, 0, 0),
      });
    }
  });
}

export function isPageNumbersEnabled() {
  return document.getElementById("enablePageNumbers").checked;
}
