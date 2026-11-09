import { displayGeometry } from "./tools/geometry.js";
import { loadPdf, PasswordRequiredError } from "./tools/load.js";
import { readMetadata } from "./tools/metadata.js";
import { runPipeline } from "./tools/pipeline.js";
import { browserImageEncoder } from "./ui/imageEncoder.js";
import {
  addFiles,
  clearAll as clearFileList,
  formatSize,
  getItems,
  initFileList,
  isReordering,
} from "./ui/fileList.js";
import { readOptions } from "./ui/options.js";

const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const uploadSection = $("uploadSection");
const fileInfo = $("fileInfo");
const operationsGrid = $("operationsGrid");
const processBtn = $("processBtn");
const downloadSection = $("downloadSection");

let results = []; // [{ name, bytes, pageCount }]

// ---------------------------------------------------------------- theme ---

const themes = [
  "theme-cyberpunk",
  "theme-powershell",
  "theme-ocean",
  "theme-sunset",
  "theme-forest",
  "theme-midnight",
  "theme-aurora",
];

function loadThemeIndex() {
  try {
    const saved = Number.parseInt(localStorage.getItem("selectedThemeIndex"), 10);
    if (saved >= 0 && saved < themes.length) return saved;
  } catch {
    // storage blocked: fall through to the default
  }
  return 1; // powershell
}

let themeIndex = loadThemeIndex();
document.body.classList.add(themes[themeIndex]);

$("themeSwitcher").addEventListener("click", (e) => {
  document.body.classList.remove(themes[themeIndex]);
  let next;
  do next = Math.floor(Math.random() * themes.length);
  while (next === themeIndex);
  themeIndex = next;
  document.body.classList.add(themes[themeIndex]);
  try {
    localStorage.setItem("selectedThemeIndex", String(themeIndex));
  } catch {
    // ignore
  }
  const btn = e.currentTarget;
  btn.style.transform = "scale(0.95)";
  setTimeout(() => (btn.style.transform = ""), 100);
});

// --------------------------------------------------------------- status ---

function showStatus(message, type = "info") {
  const status = $("status");
  status.innerHTML = "";
  if (!message) return;
  const div = document.createElement("div");
  div.className = `status ${type}`;
  div.textContent = message;
  status.appendChild(div);
}

// ----------------------------------------------------------- tool cards ---

for (const card of document.querySelectorAll(".operation-card")) {
  const checkbox = card.querySelector(".operation-checkbox");
  const body = card.querySelector(".operation-body");
  const sync = () => {
    body.hidden = !checkbox.checked;
    card.classList.toggle("active", checkbox.checked);
  };
  checkbox.addEventListener("change", sync);
  sync();
}

function enableTool(id, enabled = true) {
  const checkbox = $(id);
  if (checkbox.checked !== enabled) {
    checkbox.checked = enabled;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

$("watermarkType").addEventListener("change", (e) => {
  $("textWatermarkGroup").hidden = e.target.value !== "text";
  $("imageWatermarkGroup").hidden = e.target.value !== "image";
});

$("splitType").addEventListener("change", (e) => {
  $("splitRangesGroup").hidden = e.target.value !== "ranges";
  $("splitEveryGroup").hidden = e.target.value !== "every";
});

$("marginSeparate").addEventListener("change", (e) => {
  $("marginSides").hidden = !e.target.checked;
  $("marginAll").disabled = e.target.checked;
  if (e.target.checked) {
    for (const side of ["Top", "Right", "Bottom", "Left"]) $(`margin${side}`).value = $("marginAll").value;
  }
});

$("showPassword").addEventListener("change", (e) => {
  const type = e.target.checked ? "text" : "password";
  $("pdfPassword").type = type;
  $("confirmPassword").type = type;
});

function updatePasswordHint() {
  const a = $("pdfPassword").value;
  const b = $("confirmPassword").value;
  $("passwordHint").textContent =
    b && a !== b ? "passwords don't match" : "aes-128 encryption, opens in any pdf reader";
}
$("pdfPassword").addEventListener("input", updatePasswordHint);
$("confirmPassword").addEventListener("input", updatePasswordHint);

$("digipostPreset").addEventListener("click", () => {
  enableTool("enableScaling");
  $("scalingMode").value = "smart";
  enableTool("enableMargins");
  $("marginSeparate").checked = false;
  $("marginSeparate").dispatchEvent(new Event("change"));
  $("marginAll").value = 15;
  enableTool("enablePassword", false);
  const items = getItems();
  const pages = isMerging()
    ? items.reduce((sum, item) => sum + item.pageCount, 0)
    : Math.max(0, ...items.map((item) => item.pageCount));
  showStatus(
    "digipost preset: a4 with 15 mm margins. digipost also requires max 20 pages and no password" +
      (pages > 20 ? ` (this has ${pages} pages)` : ""),
    pages > 20 ? "error" : "info"
  );
});

// Enter in a settings field runs the tools.
operationsGrid.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("input:not([type=checkbox]):not([type=file])") && !e.target.closest("form")) {
    e.preventDefault();
    processPDF();
  }
});

// Changing anything after processing makes the result stale.
operationsGrid.addEventListener("input", invalidateResults);
operationsGrid.addEventListener("change", invalidateResults);

// --------------------------------------------------------------- files ---

/** Read a file and work out whether it needs a password. Never throws for locked files. */
async function inspectFile(file, password) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const doc = await loadPdf(bytes, { name: file.name, password });
    return { file, bytes, password, doc, pageCount: doc.getPageCount(), locked: false, wrongPassword: false };
  } catch (error) {
    if (error instanceof PasswordRequiredError) {
      return { file, bytes, password: undefined, doc: null, pageCount: 0, locked: true, wrongPassword: error.wrongPassword };
    }
    throw error;
  }
}

/** Merge is on and there is something to merge. */
function isMerging() {
  return $("enableMerge").checked && getItems().length > 1;
}

/** Several files, each processed on its own. */
function isBatch() {
  return getItems().length > 1 && !$("enableMerge").checked;
}

async function openFiles(fileList) {
  const before = getItems().length;
  showStatus("loading…", "processing");
  const added = await addFiles(fileList);
  if (added === 0) {
    if (before === 0) showStatus("that doesn't look like a pdf", "error");
    return;
  }

  const items = getItems();
  const locked = items.filter((item) => item.locked);
  if (locked.length > 0) {
    showStatus(`"${locked[0].file.name}" is password-protected. enter its password in the file list`, "error");
  } else if (items.length === 1) {
    showStatus("pdf loaded. pick the tools you want below", "success");
  } else if ($("enableMerge").checked) {
    showStatus(`${items.length} files. they will be merged in the order shown`, "success");
  } else {
    showStatus(`${items.length} files. tools run on each file, or turn on merge to combine them`, "success");
  }
}

$("chooseFileBtn").addEventListener("click", () => fileInput.click());
$("addFilesBtn").addEventListener("click", () => fileInput.click());
$("clearBtn").addEventListener("click", () => {
  clearFileList();
  showStatus("");
});
uploadSection.addEventListener("click", (e) => {
  if (e.target === uploadSection) fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) openFiles(fileInput.files);
  fileInput.value = ""; // allow picking the same file again
});

// Dropping anywhere on the page adds the files (instead of the browser
// navigating away to show the PDF).
let dragDepth = 0;
const isFileDrag = (e) => e.dataTransfer?.types.includes("Files") && !isReordering();
window.addEventListener("dragenter", (e) => {
  if (!isFileDrag(e)) return;
  dragDepth++;
  uploadSection.classList.add("dragover");
});
window.addEventListener("dragleave", (e) => {
  if (!isFileDrag(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) uploadSection.classList.remove("dragover");
});
window.addEventListener("dragover", (e) => {
  if (isFileDrag(e)) e.preventDefault();
});
window.addEventListener("drop", (e) => {
  dragDepth = 0;
  uploadSection.classList.remove("dragover");
  if (isReordering() || !e.dataTransfer?.files.length) return;
  e.preventDefault();
  openFiles(e.dataTransfer.files);
});

// ----------------------------------------------------------- file panel ---

const PAPER_SIZES = [
  ["A3", 297, 420],
  ["A4", 210, 297],
  ["A5", 148, 210],
  ["Letter", 215.9, 279.4],
  ["Legal", 215.9, 355.6],
];

function describePageSizes(doc) {
  const pages = doc.getPages();
  if (pages.length === 0) return "no pages";
  const toMm = (pt) => (pt * 25.4) / 72;
  const sizes = pages.map((p) => {
    const v = displayGeometry(p);
    return [toMm(v.width), toMm(v.height)];
  });
  const [w, h] = sizes[0];
  const same = sizes.every(([a, b]) => Math.abs(a - w) < 1 && Math.abs(b - h) < 1);
  if (!same) return "mixed sizes";

  const short = Math.min(w, h);
  const long = Math.max(w, h);
  const paper = PAPER_SIZES.find(([, a, b]) => Math.abs(short - a) <= 2 && Math.abs(long - b) <= 2);
  const orientation = w > h ? "landscape" : "portrait";
  const dims = `${w.toFixed(0)} × ${h.toFixed(0)} mm`;
  return paper ? `${paper[0]} ${orientation} (${dims})` : `${dims} (${orientation})`;
}

function renderFilePanel() {
  const items = getItems();
  const hasFiles = items.length > 0;
  fileInfo.hidden = !hasFiles;
  operationsGrid.hidden = !hasFiles;
  processBtn.hidden = !hasFiles;
  if (!hasFiles) {
    clearResults();
    return;
  }

  const pages = items.reduce((sum, item) => sum + item.pageCount, 0);
  $("fileCount").textContent =
    items.length === 1 ? "1 file" : `${items.length} files · ${pages} pages`;

  const details = $("fileDetails");
  details.innerHTML = "";
  const only = items.length === 1 ? items[0] : null;
  if (only && !only.locked) {
    const row = (label, value) => {
      const line = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      line.append(strong, document.createTextNode(value));
      details.appendChild(line);
    };
    row("page size", describePageSizes(only.doc));
    const title = only.doc.getTitle();
    if (title) row("title", title);
  }

  $("fileHint").textContent =
    items.length === 1
      ? "add more pdfs to merge them or run the tools on all of them"
      : $("enableMerge").checked
        ? "merging: one pdf, in this order. drag rows or use ↑ ↓ to reorder"
        : "each file is processed on its own. turn on merge to combine them";

  $("mergeHint").textContent =
    items.length === 1
      ? "add more pdfs (+ add pdfs, or drop them on the page) to merge them"
      : "combines all files into one pdf, in the order of the file list";

  syncMetadataFields();
}

// Metadata fields: pre-filled from the file when there is one output, empty
// (= keep each file's own values) when several files are processed separately.
let prefilled = { id: null, values: null };
const META_FIELDS = { title: "metaTitle", author: "metaAuthor", subject: "metaSubject", keywords: "metaKeywords" };

function metadataFieldValues() {
  return Object.fromEntries(Object.entries(META_FIELDS).map(([k, id]) => [k, $(id).value]));
}

function syncMetadataFields() {
  const current = metadataFieldValues();
  const untouched =
    Object.values(current).every((v) => v === "") ||
    (prefilled.values && Object.keys(META_FIELDS).every((k) => current[k] === prefilled.values[k]));
  const first = getItems().find((item) => !item.locked);

  if (isBatch() || !first) {
    if (untouched) {
      for (const id of Object.values(META_FIELDS)) $(id).value = "";
      prefilled = { id: null, values: null };
    }
    $("metaHint").textContent = isBatch() ? "empty fields keep each file's own value" : "";
    return;
  }

  $("metaHint").textContent = "";
  if (untouched && prefilled.id !== first.id) {
    const meta = readMetadata(first.doc);
    for (const [k, id] of Object.entries(META_FIELDS)) $(id).value = meta[k];
    prefilled = { id: first.id, values: meta };
  }
}

$("enableMerge").addEventListener("change", renderFilePanel);

// ---------------------------------------------------------- processing ---

const TOOL_LABELS = {
  merge: "merged",
  removePages: "trimmed",
  rotate: "rotated",
  scale: "a4",
  margins: "margins",
  pageNumbers: "numbered",
  watermark: "watermarked",
  compress: "compressed",
  metadata: "edited",
  password: "protected",
};

async function processPDF() {
  const items = getItems();
  if (items.length === 0 || processBtn.disabled) return;

  const locked = items.find((item) => item.locked);
  if (locked) {
    showStatus(`unlock "${locked.file.name}" (in the file list) or remove it`, "error");
    return;
  }

  const merging = isMerging();
  let options;
  try {
    options = await readOptions({ merging });
  } catch (error) {
    showStatus(error.message, "error");
    return;
  }
  if (options.metadata) options.metadata.keepEmpty = isBatch();

  const enabled = Object.keys(options);
  if (enabled.length === 0) {
    showStatus(
      $("enableMerge").checked ? "add at least one more pdf to merge" : "pick at least one tool",
      "error"
    );
    return;
  }
  const label = enabled.length === 1 ? TOOL_LABELS[enabled[0]] : "processed";

  clearResults();
  processBtn.disabled = true;
  processBtn.textContent = "processing…";
  showStatus("processing…", "processing");

  const reports = [];
  try {
    // Each job is one pipeline run: all files merged, or one file at a time.
    const jobs = merging ? [items] : items.map((item) => [item]);
    const collected = [];
    for (const [index, job] of jobs.entries()) {
      const prefix = jobs.length > 1 ? `file ${index + 1} of ${jobs.length}: ` : "";
      try {
        // Load fresh copies every run: the tools modify documents in place.
        const docs = [];
        for (const item of job) {
          docs.push(await loadPdf(item.bytes, { name: item.file.name, password: item.password }));
        }
        showStatus(`${prefix}processing…`, "processing");
        const { outputs, report } = await runPipeline(docs, options, {
          imageEncoder: browserImageEncoder,
          onProgress: (step) => showStatus(`${prefix}${step}…`, "processing"),
        });
        reports.push(report);
        const base = job[0].file.name.replace(/\.pdf$/i, "");
        for (const o of outputs) {
          collected.push({ name: `${base}_${o.suffix || label}.pdf`, bytes: o.bytes, pageCount: o.pageCount });
        }
      } catch (error) {
        throw new Error(jobs.length > 1 ? `${job[0].file.name}: ${error.message}` : error.message);
      }
    }

    results = uniqueNames(collected);
    const inputBytes = items.reduce((sum, item) => sum + item.file.size, 0);
    showResults(inputBytes, label);
    showStatus(...resultMessage(options, combineReports(reports)));
  } catch (error) {
    console.error(error);
    showStatus(error.message || String(error), "error");
  } finally {
    processBtn.disabled = false;
    processBtn.textContent = "process";
  }
}

/** Add " (2)", " (3)" to repeated file names so downloads don't collide. */
function uniqueNames(list) {
  const seen = new Map();
  return list.map((r) => {
    const count = (seen.get(r.name) || 0) + 1;
    seen.set(r.name, count);
    return count === 1 ? r : { ...r, name: r.name.replace(/\.pdf$/i, ` (${count}).pdf`) };
  });
}

function combineReports(reports) {
  const combined = { rotatedPages: 0 };
  for (const r of reports) {
    combined.rotatedPages += r.rotatedPages || 0;
    if (r.compression) {
      combined.compression ??= { images: 0, savedBytes: 0 };
      combined.compression.images += r.compression.images;
      combined.compression.savedBytes += r.compression.savedBytes;
    }
  }
  return combined;
}

function resultMessage(options, report) {
  const notes = [];
  if (options.rotate && report.rotatedPages === 0) {
    notes.push(`no pages matched "${options.rotate.which}", nothing was rotated`);
  }
  if (options.compress && report.compression) {
    const { images, savedBytes } = report.compression;
    notes.push(
      images > 0
        ? `${images} image(s) re-encoded, saved ${formatSize(savedBytes)}`
        : "no images could be made smaller"
    );
  }
  if (notes.length) return [`done. ${notes.join(". ")}`, notes[0].startsWith("no pages") ? "error" : "success"];
  return ["done", "success"];
}

processBtn.addEventListener("click", processPDF);

// ------------------------------------------------------------- results ---

function showResults(inputBytes, label) {
  const totalBytes = results.reduce((sum, r) => sum + r.bytes.length, 0);
  const totalPages = results.reduce((sum, r) => sum + r.pageCount, 0);
  const change = Math.round((1 - totalBytes / inputBytes) * 100);
  const sizeNote =
    change > 0
      ? `${change}% smaller than the input`
      : change < 0
        ? `${-change}% larger than the input`
        : "same size as the input";

  $("resultSummary").textContent =
    (results.length > 1 ? `${results.length} files · ` : "") +
    `${totalPages} pages · ${formatSize(totalBytes)} (${sizeNote})`;

  const downloadBtn = $("downloadBtn");
  const links = $("splitDownloadLinks");
  links.innerHTML = "";

  if (results.length === 1) {
    downloadBtn.textContent = `download ${results[0].name}`;
  } else {
    downloadBtn.textContent = `download all (${results.length} files, .zip)`;
    downloadBtn.dataset.zipName = `pdftools_${label}_${results.length}_files.zip`;
    for (const result of results) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "small-btn";
      btn.textContent = `${result.name} · ${result.pageCount} p`;
      btn.addEventListener("click", () => saveFile(result.bytes, result.name, "application/pdf"));
      links.appendChild(btn);
    }
  }
  downloadSection.hidden = false;
}

function clearResults() {
  results = [];
  downloadSection.hidden = true;
  $("splitDownloadLinks").innerHTML = "";
}

function invalidateResults() {
  if (results.length === 0) return;
  clearResults();
  showStatus("settings changed. press process to update the result", "info");
}

$("downloadBtn").addEventListener("click", async () => {
  if (results.length === 1) {
    saveFile(results[0].bytes, results[0].name, "application/pdf");
    return;
  }
  try {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    for (const result of results) zip.file(result.name, result.bytes);
    const blob = await zip.generateAsync({ type: "uint8array" });
    saveFile(blob, $("downloadBtn").dataset.zipName, "application/zip");
  } catch (error) {
    showStatus(`could not create zip: ${error.message}`, "error");
  }
});

function saveFile(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

let jszipPromise;
function loadJSZip() {
  jszipPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "vendor/jszip.min.js";
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => {
      jszipPromise = undefined;
      reject(new Error("failed to load zip library"));
    };
    document.head.appendChild(script);
  });
  return jszipPromise;
}

// ---------------------------------------------------------------- merge ---

initFileList({
  inspect: inspectFile,
  onChange: () => {
    renderFilePanel();
    invalidateResults();
  },
  onError: (message) => showStatus(message, "error"),
});
