// Password protection tool using PyScript + PyPDF (preferred) or pdf-lib-with-encrypt (fallback)
// Creates standard PDF encryption that works with any PDF viewer

export async function applyPasswordProtection(pdfBytes) {
  const enablePassword = document.getElementById("enablePassword").checked;

  if (!enablePassword) return pdfBytes;

  const passwordInput = document.getElementById("pdfPassword").value;
  const confirmPasswordInput = document.getElementById("confirmPassword").value;

  if (!passwordInput) {
    throw new Error("Password is required");
  }

  if (passwordInput !== confirmPasswordInput) {
    throw new Error("Passwords do not match");
  }

  // Try Python PyPDF first (more reliable)
  if (typeof window.encrypt_pdf_with_password === "function") {
    try {
      console.log("Using Python PyPDF for encryption");

      // Convert to Uint8Array if needed
      const uint8Array =
        pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);

      // Call the Python function
      const encryptedBytes = await window.encrypt_pdf_with_password(
        uint8Array,
        passwordInput
      );

      console.log("Python encryption successful");
      return encryptedBytes;
    } catch (error) {
      console.error("Python encryption failed:", error);
      // Fall through to JavaScript fallback
    }
  }

  // Fallback to JavaScript PDF-lib
  try {
    console.log("Falling back to JavaScript PDF-lib encryption");
    const { PDFDocument } = PDFLib;

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Save with standard PDF encryption
    const encryptedPdfBytes = await pdfDoc.save({
      encryption: {
        userPassword: passwordInput,
        ownerPassword: passwordInput,
        permissions: {
          printing: "highResolution",
          modifying: false,
          copying: true,
          annotating: false,
          fillingForms: false,
          contentAccessibility: true,
          documentAssembly: false,
        },
      },
    });

    console.log("JavaScript encryption successful");
    return encryptedPdfBytes;
  } catch (error) {
    console.error("JavaScript encryption error:", error);

    // Check if it's an encryption-related error
    if (
      error.message.includes("encryption") ||
      error.message.includes("not supported") ||
      error.message.includes("Unknown option") ||
      error.message.includes("save") ||
      error.stack?.includes("save")
    ) {
      throw new Error(`❌ PDF Password Protection Not Available

🔍 Both Python and JavaScript encryption methods failed.

✅ YOUR OPTIONS:

🖥️ Desktop Software:
• Adobe Acrobat Pro (paid)
• PDFtk Server (free)
• LibreOffice (free - export as encrypted PDF)

🌐 Online Services:
• SmallPDF (smallpdf.com/protect-pdf)
• iLovePDF (ilovepdf.com/protect-pdf)
• PDF24 (tools.pdf24.org/en/protect-pdf)

📋 How to use:
1. Process your PDF here first (rotation, page numbers, etc.)
2. Download the processed PDF
3. Upload to one of the services above
4. Add password protection
5. Download the encrypted PDF

✅ This tool excels at: rotation, page numbers, watermarks, merging, splitting, compression`);
    }

    throw new Error("Failed to encrypt PDF: " + error.message);
  }
}

export function isPasswordEnabled() {
  return document.getElementById("enablePassword").checked;
}

// Show/hide password fields with helpful guidance
document.addEventListener("DOMContentLoaded", function () {
  const enablePassword = document.getElementById("enablePassword");
  const passwordGroup = document.getElementById("passwordGroup");

  if (enablePassword && passwordGroup) {
    enablePassword.addEventListener("change", function () {
      passwordGroup.style.display = this.checked ? "block" : "none";
    });
  }
});
