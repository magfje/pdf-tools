export function applyRotations(pdfDoc) {
  const enableRotation = document.getElementById("enableRotation").checked;
  if (!enableRotation) return {};

  const rotationAngle = parseInt(
    document.getElementById("rotationAngle").value
  );
  const rotationPages = document.getElementById("rotationPages").value;

  const pdfPages = pdfDoc.getPages();
  const rotationInfo = {};

  pdfPages.forEach((page, index) => {
    const { width, height } = page.getSize();
    const isLandscape = width > height;

    let shouldRotate = false;
    if (rotationPages === "all") shouldRotate = true;
    else if (rotationPages === "landscape" && isLandscape) shouldRotate = true;
    else if (rotationPages === "portrait" && !isLandscape) shouldRotate = true;

    if (shouldRotate) {
      page.setRotation(PDFLib.degrees(rotationAngle));
      rotationInfo[index] = rotationAngle;
    } else {
      rotationInfo[index] = 0;
    }
  });

  return rotationInfo;
}

export function isRotationEnabled() {
  return document.getElementById("enableRotation").checked;
}
