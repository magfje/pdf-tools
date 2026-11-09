// Ordered list of files for the merge tool. The main file is one of the
// entries (flagged isMain), so it can be positioned anywhere.
//
// Each item: { id, file, bytes, password, pageCount, isMain, locked, wrongPassword }

let items = [];
let nextId = 1;
let dragId = null;
let hooks = { inspect: null, onChange: () => {}, onError: () => {} };

export function initMergeList(options) {
  hooks = { ...hooks, ...options };
  const input = document.getElementById("mergeFiles");
  const dropZone = document.getElementById("mergeGroup");

  document.getElementById("mergeAddBtn").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = ""; // allow re-adding the same file
  });

  dropZone.addEventListener("dragover", (e) => {
    if (dragId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", (e) => {
    if (dragId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");
    addFiles(e.dataTransfer.files);
  });

  render();
}

export function getItems() {
  return items;
}

export function hasExtraFiles() {
  return items.some((item) => !item.isMain);
}

/** Set (or replace) the main file entry. */
export function setMainItem(item) {
  const entry = { ...item, id: nextId++, isMain: true };
  const index = items.findIndex((i) => i.isMain);
  if (index >= 0) items[index] = entry;
  else items.unshift(entry);
  changed();
}

export function clearAll() {
  items = [];
  changed();
}

export async function addFiles(files) {
  const pdfs = Array.from(files).filter(isPdf);
  const skipped = files.length - pdfs.length;
  for (const file of pdfs) {
    try {
      const info = await hooks.inspect(file);
      items.push({ id: nextId++, isMain: false, ...info });
    } catch (error) {
      hooks.onError(error.message);
    }
  }
  if (skipped > 0) hooks.onError(`${skipped} file(s) skipped: not a pdf`);
  changed();
  return pdfs.length;
}

export function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function changed() {
  render();
  hooks.onChange();
}

function moveItem(id, toIndex) {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return;
  const [item] = items.splice(from, 1);
  items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, item);
  changed();
}

function removeItem(id) {
  items = items.filter((item) => item.id !== id || item.isMain);
  changed();
}

async function unlockItem(item, password) {
  try {
    const info = await hooks.inspect(item.file, password);
    Object.assign(item, info);
    if (info.locked) hooks.onError(`wrong password for "${item.file.name}"`);
  } catch (error) {
    hooks.onError(error.message);
  }
  changed();
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kb`;
  return `${(bytes / 1024 / 1024).toFixed(1)} mb`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  const list = document.getElementById("mergeList");
  const summary = document.getElementById("mergeSummary");
  if (!list) return;
  list.innerHTML = "";

  items.forEach((item, index) => {
    const li = el("li", "merge-item" + (item.isMain ? " merge-item-main" : "") + (item.locked ? " merge-item-locked" : ""));
    li.draggable = true;

    const name = el("span", "merge-name", item.file.name);
    name.title = item.file.name;
    const meta = item.locked
      ? "locked"
      : `${item.pageCount} p · ${item.isMain ? "main" : formatSize(item.file.size)}`;

    const actions = el("span", "merge-actions");
    actions.append(
      button("↑", "move up", index === 0, () => moveItem(item.id, index - 1)),
      button("↓", "move down", index === items.length - 1, () => moveItem(item.id, index + 1))
    );
    if (!item.isMain) actions.append(button("×", "remove", false, () => removeItem(item.id)));

    li.append(
      el("span", "merge-handle", "⋮⋮"),
      el("span", "merge-pos", `${index + 1}.`),
      name,
      el("span", "merge-meta", meta),
      actions
    );

    if (item.locked && !item.isMain) {
      li.append(unlockForm(item));
    }

    li.addEventListener("dragstart", (e) => {
      if (e.target.closest("input")) return e.preventDefault();
      dragId = item.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(item.id)); // Firefox needs data
    });
    li.addEventListener("dragend", () => {
      dragId = null;
      li.classList.remove("dragging");
      clearDropMarkers(list);
    });
    li.addEventListener("dragover", (e) => {
      if (dragId === null) return;
      e.preventDefault();
      e.stopPropagation();
      clearDropMarkers(list);
      li.classList.add(isAfter(e, li) ? "drop-after" : "drop-before");
    });
    li.addEventListener("drop", (e) => {
      if (dragId === null) return;
      e.preventDefault();
      e.stopPropagation();
      const from = items.findIndex((m) => m.id === dragId);
      let to = index + (isAfter(e, li) ? 1 : 0);
      if (from < to) to -= 1;
      moveItem(dragId, to);
    });

    list.appendChild(li);
  });

  if (summary) {
    const pages = items.reduce((sum, i) => sum + (i.pageCount || 0), 0);
    summary.textContent = hasExtraFiles()
      ? `${items.length} files · ${pages} pages, merged top to bottom`
      : "add one or more pdfs to merge with the main file";
  }
}

function unlockForm(item) {
  const form = el("form", "unlock-form merge-unlock");
  const input = el("input");
  input.type = "password";
  input.placeholder = item.wrongPassword ? "wrong password, try again" : "password";
  input.setAttribute("aria-label", `password for ${item.file.name}`);
  input.autocomplete = "off";
  const submit = el("button", "small-btn", "unlock");
  submit.type = "submit";
  form.append(input, submit);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    unlockItem(item, input.value);
  });
  return form;
}

function button(label, title, disabled, onClick) {
  const btn = el("button", "merge-btn", label);
  btn.type = "button";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.disabled = disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function isAfter(e, node) {
  const rect = node.getBoundingClientRect();
  return e.clientY > rect.top + rect.height / 2;
}

function clearDropMarkers(list) {
  list
    .querySelectorAll(".drop-before, .drop-after")
    .forEach((node) => node.classList.remove("drop-before", "drop-after"));
}
