export async function compressPDF(pdfDoc) {
  const compressionLevel = document.getElementById("compressionLevel").value;
  const removeMetadata = document.getElementById("removeMetadata").checked;
  const optimizeImages = document.getElementById("optimizeImages").checked;

  // Note: PDF-lib has limited compression capabilities
  // This is a basic implementation that removes metadata and optimizes structure

  if (removeMetadata) {
    // Remove metadata to reduce file size
    pdfDoc.setTitle("");
    pdfDoc.setAuthor("");
    pdfDoc.setSubject("");
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());
  }

  // Return the modified PDF document
  return pdfDoc;
}

export function isCompressionEnabled() {
  return document.getElementById("enableCompression").checked;
}

export function getCompressionOptions() {
  return {
    level: document.getElementById("compressionLevel").value,
    removeMetadata: document.getElementById("removeMetadata").checked,
    optimizeImages: document.getElementById("optimizeImages").checked,
  };
}
