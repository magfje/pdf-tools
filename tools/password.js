/**
 * Password-protect a document (AES-128, readable by every common PDF viewer).
 * Must be called right before pdfDoc.save().
 */
export async function encryptPDF(pdfDoc, password) {
  if (!password) throw new Error("password: enter a password");
  await pdfDoc.encrypt({
    userPassword: password,
    ownerPassword: password,
    pdfVersion: "1.7", // V4 / AESV2. The library's default is 40-bit RC4.
    permissions: {
      printing: "highResolution",
      modifying: true,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true,
    },
  });
}
