export async function mergePDFs(pdfFiles) {
  if (!pdfFiles || pdfFiles.length < 2) {
    throw new Error("At least 2 PDF files are required for merging");
  }

  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const file of pdfFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  return mergedPdf;
}

export function isMergeEnabled() {
  return document.getElementById("enableMerge").checked;
}

export function getMergeFiles() {
  return document.getElementById("mergeFiles").files;
}
