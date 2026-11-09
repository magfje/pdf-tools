import { displayGeometry } from "./tools/geometry.js";
import { loadPdf, PasswordRequiredError } from "./tools/load.js";
import { readMetadata } from "./tools/metadata.js";
import { runPipeline } from "./tools/pipeline.js";
import { browserImageEncoder } from "./ui/imageEncoder.js";
import {
  addFiles as addMergeFiles,
  clearAll as clearMergeList,
  getItems,
  hasExtraFiles,
  initMergeList,
  isPdf,
  setMainItem,
} from "./ui/mergeList.js";
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
  const pages = mainItem()?.pageCount ?? 0;
  showStatus(
    "digipost preset: a4 with 15 mm margins. digipost also requires max 20 pages and no password" +
      (pages > 20 ? ` (this file has ${pages} pages)` : ""),
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

function mainItem() {
  return getItems().find((item) => item.isMain);
}

async function openFiles(fileList) {
  const files = Array.from(fileList).filter(isPdf);
  if (files.length === 0) {
    showStatus("that doesn't look like a pdf", "error");
    return;
  }

  showStatus("loading…", "processing");
  let main;
  try {
    main = await inspectFile(files[0]);
  } catch (error) {
    showStatus(error.message, "error");
    return;
  }

  clearMergeList();
  setMainItem(main);
  clearResults();
  operationsGrid.hidden = false;
  processBtn.hidden = false;
  renderFileInfo();

  const extras = files.slice(1);
  if (extras.length > 0) {
    await addMergeFiles(extras);
    enableTool("enableMerge");
  }

  if (main.locked) {
    showStatus(`"${main.file.name}" is password-protected. enter its password to open it`, "error");
  } else if (extras.length > 0) {
    showStatus(`${files.length} files loaded and added to merge. set the order below`, "success");
  } else {
    showStatus("pdf loaded. pick the tools you want below", "success");
  }
}

async function unlockMain(password) {
  const main = mainItem();
  const info = await inspectFile(main.file, password);
  setMainItem(info);
  renderFileInfo();
  if (info.locked) {
    showStatus("wrong password, try again", "error");
  } else {
    showStatus("unlocked. the output will have no password unless you add one", "success");
  }
}

function resetAll() {
  clearMergeList();
  clearResults();
  fileInfo.hidden = true;
  fileInfo.innerHTML = "";
  operationsGrid.hidden = true;
  processBtn.hidden = true;
  showStatus("");
}

$("chooseFileBtn").addEventListener("click", () => fileInput.click());
uploadSection.addEventListener("click", (e) => {
  if (e.target === uploadSection) fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) openFiles(fileInput.files);
  fileInput.value = ""; // allow picking the same file again
});

// Dropping anywhere on the page opens the files (instead of the browser
// navigating away to show the PDF). The merge card handles its own drops.
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  dragDepth++;
  uploadSection.classList.add("dragover");
});
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) uploadSection.classList.remove("dragover");
});
window.addEventListener("dragover", (e) => {
  if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
});
window.addEventListener("drop", (e) => {
  dragDepth = 0;
  uploadSection.classList.remove("dragover");
  if (!e.dataTransfer?.files.length) return;
  e.preventDefault();
  openFiles(e.dataTransfer.files);
});

// ------------------------------------------------------------ file info ---

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

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kb`;
  return `${(bytes / 1024 / 1024).toFixed(2)} mb`;
}

function renderFileInfo() {
  const main = mainItem();
  fileInfo.hidden = false;
  fileInfo.innerHTML = "";
  const box = document.createElement("div");
  box.className = "file-info";

  const row = (label, value) => {
    const line = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.append(strong, document.createTextNode(value));
    box.appendChild(line);
  };

  row("file", main.file.name);
  row("size", formatSize(main.file.size));

  if (main.locked) {
    const form = document.createElement("form");
    form.className = "unlock-form";
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = "password";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "password for this pdf");
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "small-btn";
    submit.textContent = "unlock";
    form.append(input, submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      unlockMain(input.value);
    });
    box.appendChild(form);
    setTimeout(() => input.focus(), 0);
  } else {
    row("pages", String(main.pageCount));
    row("page size", describePageSizes(main.doc));
    const title = main.doc.getTitle();
    if (title) row("title", title);
    prefillMetadata(main.doc);
  }

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "small-btn clear-btn";
  clear.textContent = "× clear";
  clear.addEventListener("click", resetAll);
  box.appendChild(clear);

  fileInfo.appendChild(box);
  processBtn.disabled = main.locked;
}

function prefillMetadata(doc) {
  const meta = readMetadata(doc);
  $("metaTitle").value = meta.title;
  $("metaAuthor").value = meta.author;
  $("metaSubject").value = meta.subject;
  $("metaKeywords").value = meta.keywords;
}

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
  const main = mainItem();
  if (!main || processBtn.disabled) return;
  if (main.locked) {
    showStatus("unlock the pdf first", "error");
    return;
  }

  const merging = $("enableMerge").checked && hasExtraFiles();
  const items = merging ? getItems() : [main];
  const locked = items.find((item) => item.locked);
  if (locked) {
    showStatus(`unlock "${locked.file.name}" (in the merge list) or remove it`, "error");
    return;
  }

  let options;
  try {
    options = await readOptions({ merging });
  } catch (error) {
    showStatus(error.message, "error");
    return;
  }
  const enabled = Object.keys(options);
  if (enabled.length === 0) {
    showStatus(
      $("enableMerge").checked ? "add at least one more pdf to merge" : "pick at least one tool",
      "error"
    );
    return;
  }

  clearResults();
  processBtn.disabled = true;
  processBtn.textContent = "processing…";
  showStatus("processing…", "processing");

  try {
    // Load fresh copies every run: the tools modify documents in place.
    const docs = [];
    for (const item of items) {
      docs.push(await loadPdf(item.bytes, { name: item.file.name, password: item.password }));
    }

    const { outputs, report } = await runPipeline(docs, options, {
      imageEncoder: browserImageEncoder,
      onProgress: (step) => showStatus(`${step}…`, "processing"),
    });

    const base = main.file.name.replace(/\.pdf$/i, "");
    const label = enabled.length === 1 ? TOOL_LABELS[enabled[0]] : "processed";
    results = outputs.map((o) => ({
      name: `${base}_${o.suffix || label}.pdf`,
      bytes: o.bytes,
      pageCount: o.pageCount,
    }));

    const inputBytes = items.reduce((sum, item) => sum + item.file.size, 0);
    showResults(inputBytes);
    showStatus(...resultMessage(options, report));
  } catch (error) {
    console.error(error);
    showStatus(error.message || String(error), "error");
  } finally {
    processBtn.disabled = false;
    processBtn.textContent = "process";
  }
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

function showResults(inputBytes) {
  const totalBytes = results.reduce((sum, r) => sum + r.bytes.length, 0);
  const totalPages = results.reduce((sum, r) => sum + r.pageCount, 0);
  const change = Math.round((1 - totalBytes / inputBytes) * 100);
  const sizeNote =
    change > 0 ? `${change}% smaller` : change < 0 ? `${-change}% larger` : "same size";

  $("resultSummary").textContent =
    (results.length > 1 ? `${results.length} files · ` : "") +
    `${totalPages} pages · ${formatSize(totalBytes)} (${sizeNote} than the input)`;

  const downloadBtn = $("downloadBtn");
  const links = $("splitDownloadLinks");
  links.innerHTML = "";

  if (results.length === 1) {
    downloadBtn.textContent = `download ${results[0].name}`;
  } else {
    downloadBtn.textContent = `download all (${results.length} files, .zip)`;
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
    const base = mainItem().file.name.replace(/\.pdf$/i, "");
    saveFile(blob, `${base}_split.zip`, "application/zip");
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

initMergeList({
  inspect: inspectFile,
  onChange: invalidateResults,
  onError: (message) => showStatus(message, "error"),
});
