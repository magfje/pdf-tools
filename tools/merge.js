// Ordered list of files to merge. The main uploaded file is included as an
// entry flagged `isMain`, so the user can position it anywhere in the order.
let mergeItems = [];
let nextId = 1;
let dragId = null;

export async function mergePDFs(pdfFiles) {
  if (!pdfFiles || pdfFiles.length < 2) {
    throw new Error("At least 2 PDF files are required for merging");
  }

  const mergedPdf = await PDFLib.PDFDocument.create();

  for (const file of pdfFiles) {
    const arrayBuffer = await file.arrayBuffer();
    let pdf;
    try {
      pdf = await PDFLib.PDFDocument.load(arrayBuffer);
    } catch (error) {
      throw new Error(`could not read "${file.name}": ${error.message}`);
    }
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return mergedPdf;
}

export function isMergeEnabled() {
  return document.getElementById("enableMerge").checked;
}

// Returns all files (including the main file) in the user's chosen order.
export function getMergeFiles() {
  return mergeItems.map((item) => item.file);
}

export function hasExtraMergeFiles() {
  return mergeItems.some((item) => !item.isMain);
}

// Called whenever a new main file is loaded.
export function setMainMergeFile(file) {
  const existing = mergeItems.findIndex((item) => item.isMain);
  const entry = { id: nextId++, file, isMain: true };
  if (existing >= 0) {
    mergeItems[existing] = entry;
  } else {
    mergeItems.unshift(entry);
  }
  renderMergeList();
}

export function addMergeFiles(files) {
  const pdfs = Array.from(files).filter(isPdf);
  pdfs.forEach((file) => mergeItems.push({ id: nextId++, file, isMain: false }));
  renderMergeList();
  return pdfs.length;
}

export function isPdf(file) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function moveItem(id, toIndex) {
  const from = mergeItems.findIndex((item) => item.id === id);
  if (from < 0) return;
  const [item] = mergeItems.splice(from, 1);
  const clamped = Math.max(0, Math.min(toIndex, mergeItems.length));
  mergeItems.splice(clamped, 0, item);
  renderMergeList();
}

function removeItem(id) {
  mergeItems = mergeItems.filter((item) => item.id !== id || item.isMain);
  renderMergeList();
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kb`;
  return `${(bytes / 1024 / 1024).toFixed(1)} mb`;
}

function renderMergeList() {
  const list = document.getElementById("mergeList");
  const summary = document.getElementById("mergeSummary");
  if (!list) return;

  list.innerHTML = "";

  mergeItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "merge-item" + (item.isMain ? " merge-item-main" : "");
    li.draggable = true;
    li.dataset.id = item.id;

    const handle = document.createElement("span");
    handle.className = "merge-handle";
    handle.textContent = "⋮⋮";
    handle.title = "drag to reorder";

    const pos = document.createElement("span");
    pos.className = "merge-pos";
    pos.textContent = `${index + 1}.`;

    const name = document.createElement("span");
    name.className = "merge-name";
    name.textContent = item.file.name;
    name.title = item.file.name;

    const meta = document.createElement("span");
    meta.className = "merge-meta";
    meta.textContent = item.isMain ? "main" : formatSize(item.file.size);

    const actions = document.createElement("span");
    actions.className = "merge-actions";

    const up = makeButton("↑", "move up", index === 0, () =>
      moveItem(item.id, index - 1)
    );
    const down = makeButton("↓", "move down", index === mergeItems.length - 1, () =>
      moveItem(item.id, index + 1)
    );
    actions.append(up, down);

    if (!item.isMain) {
      actions.append(makeButton("×", "remove", false, () => removeItem(item.id)));
    }

    li.append(handle, pos, name, meta, actions);

    li.addEventListener("dragstart", (e) => {
      dragId = item.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      // Required for Firefox to start a drag
      e.dataTransfer.setData("text/plain", String(item.id));
    });
    li.addEventListener("dragend", () => {
      dragId = null;
      li.classList.remove("dragging");
      clearDropMarkers(list);
    });
    li.addEventListener("dragover", (e) => {
      if (dragId === null) return; // external file drag, handled by the drop zone
      e.preventDefault();
      e.stopPropagation();
      const after = isAfter(e, li);
      clearDropMarkers(list);
      li.classList.add(after ? "drop-after" : "drop-before");
    });
    li.addEventListener("drop", (e) => {
      if (dragId === null) return;
      e.preventDefault();
      e.stopPropagation();
      const after = isAfter(e, li);
      const from = mergeItems.findIndex((m) => m.id === dragId);
      let to = index + (after ? 1 : 0);
      if (from < to) to -= 1;
      moveItem(dragId, to);
    });

    list.appendChild(li);
  });

  if (summary) {
    const extra = mergeItems.filter((item) => !item.isMain).length;
    summary.textContent =
      extra === 0
        ? "add one or more pdfs to merge with the main file"
        : `${mergeItems.length} files will be merged top to bottom`;
  }
}

function makeButton(label, title, disabled, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "merge-btn";
  btn.textContent = label;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.disabled = disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function isAfter(e, el) {
  const rect = el.getBoundingClientRect();
  return e.clientY > rect.top + rect.height / 2;
}

function clearDropMarkers(list) {
  list
    .querySelectorAll(".drop-before, .drop-after")
    .forEach((el) => el.classList.remove("drop-before", "drop-after"));
}

export function initMergeUI() {
  const input = document.getElementById("mergeFiles");
  const addBtn = document.getElementById("mergeAddBtn");
  const dropZone = document.getElementById("mergeGroup");

  addBtn.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    addMergeFiles(input.files);
    input.value = ""; // allow re-adding the same file
  });

  dropZone.addEventListener("dragover", (e) => {
    if (dragId !== null) return;
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", (e) => {
    if (dragId !== null) return;
    e.preventDefault();
    dropZone.classList.remove("dragover");
    addMergeFiles(e.dataTransfer.files);
  });

  renderMergeList();
}
