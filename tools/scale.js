export function scaleToA4(pdfDoc) {
  const enableScaling = document.getElementById("enableScaling").checked;
  if (!enableScaling) return {};

  const scalingMode = document.getElementById("scalingMode").value;
  const pages = pdfDoc.getPages();
  const scalingInfo = {};

  // A4 dimensions in points (1 point = 1/72 inch, A4 = 210mm x 297mm)
  const A4_WIDTH = 595.276; // 210mm in points
  const A4_HEIGHT = 841.89; // 297mm in points

  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const isLandscape = width > height;

    let newWidth, newHeight, scaleX, scaleY;

    if (scalingMode === "fit") {
      // Scale to fit within A4 bounds while maintaining aspect ratio
      scaleX = A4_WIDTH / width;
      scaleY = A4_HEIGHT / height;
      const scale = Math.min(scaleX, scaleY);

      newWidth = A4_WIDTH;
      newHeight = A4_HEIGHT;
      scaleX = scale;
      scaleY = scale;
    } else if (scalingMode === "stretch") {
      // Stretch to exactly A4 size
      newWidth = A4_WIDTH;
      newHeight = A4_HEIGHT;
      scaleX = A4_WIDTH / width;
      scaleY = A4_HEIGHT / height;
    } else if (scalingMode === "smart") {
      // Smart scaling: use A4 portrait for portrait pages, A4 landscape for landscape pages
      if (isLandscape) {
        newWidth = A4_HEIGHT; // Use A4 height as width for landscape
        newHeight = A4_WIDTH; // Use A4 width as height for landscape
        scaleX = A4_HEIGHT / width;
        scaleY = A4_WIDTH / height;
      } else {
        newWidth = A4_WIDTH;
        newHeight = A4_HEIGHT;
        scaleX = A4_WIDTH / width;
        scaleY = A4_HEIGHT / height;
      }
    }

    // IMPORTANT: Scale the content FIRST, then resize the page
    page.scale(scaleX, scaleY);

    // Then resize the page to the target dimensions
    page.setSize(newWidth, newHeight);

    // For "fit" mode, center the content on the page
    if (scalingMode === "fit") {
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;
      const offsetX = (newWidth - scaledWidth) / 2;
      const offsetY = (newHeight - scaledHeight) / 2;

      // Translate the content to center it
      page.translateContent(offsetX, offsetY);
    }

    scalingInfo[index] = {
      originalWidth: width,
      originalHeight: height,
      newWidth: newWidth,
      newHeight: newHeight,
      scaleX: scaleX,
      scaleY: scaleY,
      mode: scalingMode,
    };
  });

  return scalingInfo;
}

export function isScalingEnabled() {
  return document.getElementById("enableScaling").checked;
}
