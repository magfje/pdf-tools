import { compressPDF, isCompressionEnabled } from "./tools/compress.js";
import { getMergeFiles, isMergeEnabled, mergePDFs } from "./tools/merge.js";
import { addPageNumbers, isPageNumbersEnabled } from "./tools/pageNumbers.js";
import {
  applyPasswordProtection,
  isPasswordEnabled,
} from "./tools/password.js";
import { applyRotations, isRotationEnabled } from "./tools/rotation.js";
import { isSplitEnabled, splitPDF } from "./tools/split.js";
import { addWatermark, isWatermarkEnabled } from "./tools/watermark.js";

let originalPdfDoc = null;
let processedPdfBytes = null;
let splitResults = [];
let fileName = "";

// File upload handling
const fileInput = document.getElementById("fileInput");
const uploadSection = document.getElementById("uploadSection");
const operationsGrid = document.getElementById("operationsGrid");
const processBtn = document.getElementById("processBtn");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const downloadBtn = document.getElementById("downloadBtn");

fileInput.addEventListener("change", handleFileSelect);
chooseFileBtn.addEventListener("click", () => fileInput.click());
processBtn.addEventListener("click", processPDF);
downloadBtn.addEventListener("click", downloadPDF);

// Drag and drop
uploadSection.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadSection.classList.add("dragover");
});

uploadSection.addEventListener("dragleave", () => {
  uploadSection.classList.remove("dragover");
});

uploadSection.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadSection.classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files.length > 0 && files[0].type === "application/pdf") {
    fileInput.files = files;
    handleFileSelect();
  }
});

// Checkbox handlers
document
  .getElementById("enableRotation")
  .addEventListener("change", function () {
    document.getElementById("rotationGroup").style.display = this.checked
      ? "block"
      : "none";
  });

document
  .getElementById("enablePageNumbers")
  .addEventListener("change", function () {
    document.getElementById("pageNumberGroup").style.display = this.checked
      ? "block"
      : "none";
  });

document.getElementById("enableMerge").addEventListener("change", function () {
  document.getElementById("mergeGroup").style.display = this.checked
    ? "block"
    : "none";
});

document.getElementById("enableSplit").addEventListener("change", function () {
  document.getElementById("splitGroup").style.display = this.checked
    ? "block"
    : "none";
});

document
  .getElementById("enableWatermark")
  .addEventListener("change", function () {
    document.getElementById("watermarkGroup").style.display = this.checked
      ? "block"
      : "none";
  });

document
  .getElementById("enableCompression")
  .addEventListener("change", function () {
    document.getElementById("compressionGroup").style.display = this.checked
      ? "block"
      : "none";
  });

// Split type handler
document.getElementById("splitType").addEventListener("change", function () {
  const rangesGroup = document.getElementById("splitRangesGroup");
  rangesGroup.style.display = this.value === "ranges" ? "block" : "none";
});

// Watermark type handler
document
  .getElementById("watermarkType")
  .addEventListener("change", function () {
    const textGroup = document.getElementById("textWatermarkGroup");
    const imageGroup = document.getElementById("imageWatermarkGroup");

    if (this.value === "text") {
      textGroup.style.display = "block";
      imageGroup.style.display = "none";
    } else {
      textGroup.style.display = "none";
      imageGroup.style.display = "block";
    }
  });

async function handleFileSelect() {
  const file = fileInput.files[0];
  if (!file) return;

  fileName = file.name.replace(".pdf", "");
  showStatus("Loading PDF...", "processing");

  try {
    const arrayBuffer = await file.arrayBuffer();
    originalPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    const pageCount = originalPdfDoc.getPageCount();
    document.getElementById("fileInfo").innerHTML = `
                <div class="file-info">
                    <strong>File:</strong> ${file.name}<br>
                    <strong>Size:</strong> ${(file.size / 1024 / 1024).toFixed(
                      2
                    )} MB<br>
                    <strong>Pages:</strong> ${pageCount}
                </div>
            `;

    operationsGrid.style.display = "grid";
    processBtn.style.display = "block";
    showStatus(
      "PDF loaded successfully! Configure your operations below.",
      "success"
    );

    // Update start page max value
    document.getElementById("startPage").max = pageCount;
  } catch (error) {
    showStatus("Error loading PDF: " + error.message, "error");
  }
}

async function processPDF() {
  if (!originalPdfDoc) return;

  const enableRotation = isRotationEnabled();
  const enablePageNumbers = isPageNumbersEnabled();
  const enablePassword = isPasswordEnabled();
  const enableMerge = isMergeEnabled();
  const enableSplit = isSplitEnabled();
  const enableWatermark = isWatermarkEnabled();
  const enableCompression = isCompressionEnabled();

  if (
    !enableRotation &&
    !enablePageNumbers &&
    !enablePassword &&
    !enableMerge &&
    !enableSplit &&
    !enableWatermark &&
    !enableCompression
  ) {
    showStatus("Please select at least one operation to perform.", "error");
    return;
  }

  showStatus("Processing PDF...", "processing");
  processBtn.disabled = true;

  try {
    let pdfDoc;

    // Handle merge operation first (if enabled)
    if (enableMerge) {
      const mergeFiles = Array.from(getMergeFiles());
      if (mergeFiles.length > 0) {
        // Combine original file with merge files
        const allFiles = [fileInput.files[0], ...mergeFiles];
        pdfDoc = await mergePDFs(allFiles);
        fileName = fileName + "_merged";
      } else {
        // Create a copy of the original document if no merge files
        pdfDoc = await PDFLib.PDFDocument.create();
        const pages = await pdfDoc.copyPages(
          originalPdfDoc,
          originalPdfDoc.getPageIndices()
        );
        pages.forEach((page) => pdfDoc.addPage(page));
      }
    } else {
      // Create a copy of the original document
      pdfDoc = await PDFLib.PDFDocument.create();
      const pages = await pdfDoc.copyPages(
        originalPdfDoc,
        originalPdfDoc.getPageIndices()
      );
      pages.forEach((page) => pdfDoc.addPage(page));
    }

    // Handle split operation (returns multiple PDFs)
    if (enableSplit) {
      splitResults = await splitPDF(pdfDoc);

      // Apply other operations to each split result
      for (const result of splitResults) {
        await applyOperationsToDocument(
          result.pdf,
          enableRotation,
          enablePageNumbers,
          enableWatermark,
          enableCompression
        );

        // Apply password protection to each split result
        if (enablePassword) {
          const tempBytes = await result.pdf.save();
          const protectedBytes = await applyPasswordProtection(tempBytes);
          // Store the encrypted bytes instead of trying to reload as PDFDocument
          result.encryptedBytes = protectedBytes;
        }
      }

      showSplitDownloads();
      showStatus("PDF split successfully!", "success");
    } else {
      // Apply operations to single document
      await applyOperationsToDocument(
        pdfDoc,
        enableRotation,
        enablePageNumbers,
        enableWatermark,
        enableCompression
      );

      // 4. Apply compression
      if (isCompressionEnabled()) {
        pdfDoc = await compressPDF(pdfDoc);
      }

      // 5. Apply password protection
      const saveOptions = getCompressionSaveOptions();
      if (isPasswordEnabled()) {
        showStatus("Applying password protection...", "processing");
        const tempBytes = await pdfDoc.save(saveOptions);
        const protectedBytes = await applyPasswordProtection(tempBytes);
        processedPdfBytes = protectedBytes;
      } else {
        processedPdfBytes = await pdfDoc.save(saveOptions);
      }

      // Store processed PDF
      // processedPdfBytes = await pdfDoc.save();

      document.getElementById("downloadSection").style.display = "block";
      showStatus("PDF processed successfully!", "success");
    }
  } catch (error) {
    showStatus("Error processing PDF: " + error.message, "error");
  } finally {
    processBtn.disabled = false;
  }
}

async function applyOperationsToDocument(
  pdfDoc,
  enableRotation,
  enablePageNumbers,
  enableWatermark,
  enableCompression
) {
  // Check if we should keep page numbers at bottom after rotation
  const keepNumbersAtBottom = document.getElementById(
    "keepNumbersAtBottom"
  ).checked;

  // Apply operations in the correct order
  if (enableRotation && enablePageNumbers && keepNumbersAtBottom) {
    // Apply rotation first, then add page numbers with rotation info
    const rotationInfo = applyRotations(pdfDoc);
    await addPageNumbers(pdfDoc, rotationInfo);
  } else {
    // Apply page numbers first, then rotation (original behavior)
    if (enablePageNumbers) {
      await addPageNumbers(pdfDoc);
    }
    if (enableRotation) {
      applyRotations(pdfDoc);
    }
  }

  // Add watermark
  if (enableWatermark) {
    await addWatermark(pdfDoc);
  }

  // Apply compression (metadata removal)
  if (enableCompression) {
    await compressPDF(pdfDoc);
  }
}

function getCompressionSaveOptions() {
  if (!isCompressionEnabled()) {
    return {};
  }

  const compressionLevel = document.getElementById("compressionLevel").value;
  switch (compressionLevel) {
    case "low":
      return {
        useObjectStreams: false,
        addDefaultPage: false,
      };
    case "medium":
      return {
        useObjectStreams: true,
        addDefaultPage: false,
      };
    case "high":
      return {
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false,
      };
    default:
      return {
        useObjectStreams: true,
        addDefaultPage: false,
      };
  }
}

function showSplitDownloads() {
  const downloadSection = document.getElementById("downloadSection");
  const splitSection = document.getElementById("splitDownloadSection");
  const linksContainer = document.getElementById("splitDownloadLinks");

  linksContainer.innerHTML = "";

  splitResults.forEach((result, index) => {
    const button = document.createElement("button");
    button.className = "download-btn";
    button.style.margin = "5px";
    button.style.padding = "10px 15px";
    button.style.fontSize = "14px";
    button.textContent = `Download ${result.name}.pdf`;

    button.onclick = async () => {
      // Use encrypted bytes if available, otherwise save the PDF document
      let pdfBytes;
      if (result.encryptedBytes) {
        pdfBytes = result.encryptedBytes;
      } else {
        const saveOptions = getCompressionSaveOptions();
        pdfBytes = await result.pdf.save(saveOptions);
      }

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}_${result.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    linksContainer.appendChild(button);
  });

  // Show both the parent download section and the split section
  downloadSection.style.display = "block";
  splitSection.style.display = "block";
}

function downloadPDF() {
  if (!processedPdfBytes) return;

  const blob = new Blob([processedPdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}_processed.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showStatus(message, type) {
  const statusDiv = document.getElementById("status");
  statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
}

// Make functions globally available
window.processPDF = processPDF;
window.downloadPDF = downloadPDF;
