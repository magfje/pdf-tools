import { compressPDF, isCompressionEnabled } from "./tools/compress.js";
import { getMergeFiles, isMergeEnabled, mergePDFs } from "./tools/merge.js";
import { addPageNumbers, isPageNumbersEnabled } from "./tools/pageNumbers.js";
import {
  applyPasswordProtection,
  isPasswordEnabled,
} from "./tools/password.js";
import { applyRotations, isRotationEnabled } from "./tools/rotation.js";
import { isScalingEnabled, scaleToA4 } from "./tools/scale.js";
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

// Theme switcher
const themeSwitcher = document.getElementById("themeSwitcher");
const themes = [
  "theme-cyberpunk",
  "theme-powershell",
  "theme-ocean",
  "theme-sunset",
  "theme-forest",
  "theme-midnight",
  "theme-aurora",
];

// Load saved theme from localStorage or default to forest (index 4)
let currentThemeIndex =
  parseInt(localStorage.getItem("selectedThemeIndex")) || 1;

// Initialize theme
document.body.classList.add(themes[currentThemeIndex]);

themeSwitcher.addEventListener("click", () => {
  // Remove current theme
  document.body.classList.remove(themes[currentThemeIndex]);

  // Select random theme (different from current)
  let newIndex;
  do {
    newIndex = Math.floor(Math.random() * themes.length);
  } while (newIndex === currentThemeIndex && themes.length > 1);

  currentThemeIndex = newIndex;

  // Apply new theme
  document.body.classList.add(themes[currentThemeIndex]);

  // Save selected theme to localStorage
  localStorage.setItem("selectedThemeIndex", currentThemeIndex.toString());

  // Add a subtle animation effect
  themeSwitcher.style.transform = "scale(0.95)";
  setTimeout(() => {
    themeSwitcher.style.transform = "scale(1)";
  }, 100);
});

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

document
  .getElementById("enableScaling")
  .addEventListener("change", function () {
    document.getElementById("scalingGroup").style.display = this.checked
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

// Helper function to get page size information
function getPageSizeInfo(pdfDoc) {
  const pages = pdfDoc.getPages();
  const pageCount = pages.length;

  if (pageCount === 0) return "No pages";

  // Get dimensions of first page
  const firstPage = pages[0];
  const { width: firstWidth, height: firstHeight } = firstPage.getSize();
  const firstIsLandscape = firstWidth > firstHeight;

  // Check if all pages have the same size
  let allSameSize = true;
  let minWidth = firstWidth,
    maxWidth = firstWidth;
  let minHeight = firstHeight,
    maxHeight = firstHeight;

  for (let i = 1; i < pages.length; i++) {
    const { width, height } = pages[i].getSize();
    if (width !== firstWidth || height !== firstHeight) {
      allSameSize = false;
    }
    minWidth = Math.min(minWidth, width);
    maxWidth = Math.max(maxWidth, width);
    minHeight = Math.min(minHeight, height);
    maxHeight = Math.max(maxHeight, height);
  }

  // Convert points to mm (1 point = 0.3528 mm)
  const pointsToMm = (points) => (points * 0.3528).toFixed(1);

  // Detect common paper sizes (tolerance of ±2mm)
  function detectPaperSize(width, height) {
    const tolerance = 2; // mm

    // A4: 210 × 297 mm
    if (
      Math.abs(width - 210) <= tolerance &&
      Math.abs(height - 297) <= tolerance
    )
      return "A4";
    if (
      Math.abs(width - 297) <= tolerance &&
      Math.abs(height - 210) <= tolerance
    )
      return "A4 (landscape)";

    // Letter: 216 × 279 mm
    if (
      Math.abs(width - 216) <= tolerance &&
      Math.abs(height - 279) <= tolerance
    )
      return "Letter";
    if (
      Math.abs(width - 279) <= tolerance &&
      Math.abs(height - 216) <= tolerance
    )
      return "Letter (landscape)";

    // Legal: 216 × 356 mm
    if (
      Math.abs(width - 216) <= tolerance &&
      Math.abs(height - 356) <= tolerance
    )
      return "Legal";
    if (
      Math.abs(width - 356) <= tolerance &&
      Math.abs(height - 216) <= tolerance
    )
      return "Legal (landscape)";

    // A3: 297 × 420 mm
    if (
      Math.abs(width - 297) <= tolerance &&
      Math.abs(height - 420) <= tolerance
    )
      return "A3";
    if (
      Math.abs(width - 420) <= tolerance &&
      Math.abs(height - 297) <= tolerance
    )
      return "A3 (landscape)";

    // A5: 148 × 210 mm
    if (
      Math.abs(width - 148) <= tolerance &&
      Math.abs(height - 210) <= tolerance
    )
      return "A5";
    if (
      Math.abs(width - 210) <= tolerance &&
      Math.abs(height - 148) <= tolerance
    )
      return "A5 (landscape)";

    return null;
  }

  if (allSameSize) {
    const widthMm = pointsToMm(firstWidth);
    const heightMm = pointsToMm(firstHeight);
    const orientation = firstIsLandscape ? "landscape" : "portrait";
    const paperSize = detectPaperSize(
      parseFloat(widthMm),
      parseFloat(heightMm)
    );

    if (paperSize) {
      return `${paperSize} (${widthMm} × ${heightMm} mm)`;
    } else {
      return `${widthMm} × ${heightMm} mm (${orientation})`;
    }
  } else {
    const minWidthMm = pointsToMm(minWidth);
    const maxWidthMm = pointsToMm(maxWidth);
    const minHeightMm = pointsToMm(minHeight);
    const maxHeightMm = pointsToMm(maxHeight);
    return `various sizes (${minWidthMm}-${maxWidthMm} × ${minHeightMm}-${maxHeightMm} mm)`;
  }
}

async function handleFileSelect() {
  const file = fileInput.files[0];
  if (!file) return;

  fileName = file.name.replace(".pdf", "");
  showStatus("Loading PDF...", "processing");

  try {
    const arrayBuffer = await file.arrayBuffer();
    originalPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    const pageCount = originalPdfDoc.getPageCount();
    const pageSizeInfo = getPageSizeInfo(originalPdfDoc);

    document.getElementById("fileInfo").innerHTML = `
                <div class="file-info">
                    <strong>File:</strong> ${file.name}<br>
                    <strong>Size:</strong> ${(file.size / 1024 / 1024).toFixed(
                      2
                    )} MB<br>
                    <strong>Pages:</strong> ${pageCount}<br>
                    <strong>Page Size:</strong> ${pageSizeInfo}
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
  const enableScaling = isScalingEnabled();

  if (
    !enableRotation &&
    !enablePageNumbers &&
    !enablePassword &&
    !enableMerge &&
    !enableSplit &&
    !enableWatermark &&
    !enableCompression &&
    !enableScaling
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
          enableCompression,
          enableScaling
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
        enableCompression,
        enableScaling
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
  enableCompression,
  enableScaling
) {
  // Check if we should keep page numbers at bottom after rotation
  const keepNumbersAtBottom = document.getElementById(
    "keepNumbersAtBottom"
  ).checked;

  // Apply scaling first (before other operations)
  if (enableScaling) {
    scaleToA4(pdfDoc);
  }

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
