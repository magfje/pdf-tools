export async function addWatermark(pdfDoc) {
  const watermarkType = document.getElementById("watermarkType").value;
  const opacity = parseFloat(document.getElementById("watermarkOpacity").value);
  const position = document.getElementById("watermarkPosition").value;
  const pages = pdfDoc.getPages();

  if (watermarkType === "text") {
    await addTextWatermark(pdfDoc, pages, opacity, position);
  } else if (watermarkType === "image") {
    await addImageWatermark(pdfDoc, pages, opacity, position);
  }
}

async function addTextWatermark(pdfDoc, pages, opacity, position) {
  const text = document.getElementById("watermarkText").value;
  const fontSize = parseInt(document.getElementById("watermarkFontSize").value);
  const color = document.getElementById("watermarkColor").value;
  const rotation = parseInt(document.getElementById("watermarkRotation").value);

  if (!text) return;

  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  const rgb = hexToRgb(color);

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    const { x, y } = calculateWatermarkPosition(
      position,
      width,
      height,
      textWidth,
      textHeight
    );

    page.drawText(text, {
      x: x,
      y: y,
      size: fontSize,
      font: font,
      color: PDFLib.rgb(rgb.r / 255, rgb.g / 255, rgb.b / 255),
      opacity: opacity,
      rotate: PDFLib.degrees(rotation),
    });
  });
}

async function addImageWatermark(pdfDoc, pages, opacity, position) {
  const imageFile = document.getElementById("watermarkImage").files[0];
  if (!imageFile) return;

  const imageBytes = await imageFile.arrayBuffer();
  let image;

  if (imageFile.type === "image/jpeg") {
    image = await pdfDoc.embedJpg(imageBytes);
  } else if (imageFile.type === "image/png") {
    image = await pdfDoc.embedPng(imageBytes);
  } else {
    throw new Error("Unsupported image format. Please use JPEG or PNG.");
  }

  const imageScale = parseFloat(
    document.getElementById("watermarkImageScale").value
  );
  const scaledWidth = image.width * imageScale;
  const scaledHeight = image.height * imageScale;

  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const { x, y } = calculateWatermarkPosition(
      position,
      width,
      height,
      scaledWidth,
      scaledHeight
    );

    page.drawImage(image, {
      x: x,
      y: y,
      width: scaledWidth,
      height: scaledHeight,
      opacity: opacity,
    });
  });
}

function calculateWatermarkPosition(
  position,
  pageWidth,
  pageHeight,
  itemWidth,
  itemHeight
) {
  let x, y;

  switch (position) {
    case "center":
      x = (pageWidth - itemWidth) / 2;
      y = (pageHeight - itemHeight) / 2;
      break;
    case "top-left":
      x = 20;
      y = pageHeight - itemHeight - 20;
      break;
    case "top-right":
      x = pageWidth - itemWidth - 20;
      y = pageHeight - itemHeight - 20;
      break;
    case "bottom-left":
      x = 20;
      y = 20;
      break;
    case "bottom-right":
      x = pageWidth - itemWidth - 20;
      y = 20;
      break;
    case "top-center":
      x = (pageWidth - itemWidth) / 2;
      y = pageHeight - itemHeight - 20;
      break;
    case "bottom-center":
      x = (pageWidth - itemWidth) / 2;
      y = 20;
      break;
    default:
      x = (pageWidth - itemWidth) / 2;
      y = (pageHeight - itemHeight) / 2;
  }

  return { x, y };
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

export function isWatermarkEnabled() {
  return document.getElementById("enableWatermark").checked;
}
