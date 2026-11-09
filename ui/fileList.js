// The list of uploaded files, shown in the file panel. Its order is the merge
// order; without merge, every tool runs on each file separately.
//
// Each item: { id, file, bytes, password, doc, pageCount, locked, wrongPassword }

let items = [];
let nextId = 1;
let dragId = null;
let hooks = { inspect: null, onChange: () => {}, onError: () => {} };

export function initFileList(options) {
  hooks = { ...hooks, ...options };
  render();
}

export function getItems() {
  return items;
}

export function clearAll() {
  items = [];
  changed();
}

/** Inspect and append files. Returns the number of PDFs added. */
export async function addFiles(fileList) {
  const files = Array.from(fileList);
  const pdfs = files.filter(isPdf);
  for (const file of pdfs) {
    try {
      items.push({ id: nextId++, ...(await hooks.inspect(file)) });
    } catch (error) {
      hooks.onError(error.message);
    }
  }
  const skipped = files.length - pdfs.length;
  if (skipped > 0) hooks.onError(`${skipped} file(s) skipped: not a pdf`);
  changed();
  return pdfs.length;
}

export function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function changed() {
  render();
  hooks.onChange(items);
}

function moveItem(id, toIndex) {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return;
  const [item] = items.splice(from, 1);
  items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, item);
  changed();
}

function removeItem(id) {
  items = items.filter((item) => item.id !== id);
  changed();
}

async function unlockItem(item, password) {
  try {
    Object.assign(item, await hooks.inspect(item.file, password));
    if (item.locked) hooks.onError(`wrong password for "${item.file.name}"`);
  } catch (error) {
    hooks.onError(error.message);
  }
  changed();
}

export function formatSize(bytes) {
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
  const list = document.getElementById("fileList");
  if (!list) return;
  list.innerHTML = "";
  const single = items.length === 1;

  items.forEach((item, index) => {
    const li = el("li", "file-item" + (item.locked ? " file-item-locked" : ""));
    li.draggable = !single;

    const name = el("span", "file-name", item.file.name);
    name.title = item.file.name;
    const meta = item.locked
      ? "locked"
      : `${item.pageCount} p · ${formatSize(item.file.size)}`;

    const actions = el("span", "file-actions");
    if (!single) {
      actions.append(
        button("↑", "move up", index === 0, () => moveItem(item.id, index - 1)),
        button("↓", "move down", index === items.length - 1, () => moveItem(item.id, index + 1))
      );
    }
    actions.append(button("×", `remove ${item.file.name}`, false, () => removeItem(item.id)));

    if (!single) li.append(el("span", "file-handle", "⋮⋮"), el("span", "file-pos", `${index + 1}.`));
    li.append(name, el("span", "file-meta", meta), actions);
    if (item.locked) li.append(unlockForm(item));

    if (!single) {
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
        if (dragId === null) return; // a file drag: handled by the page
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
    }

    list.appendChild(li);
  });
}

/** True while a row of the list (not a file from outside) is being dragged. */
export function isReordering() {
  return dragId !== null;
}

function unlockForm(item) {
  const form = el("form", "unlock-form file-unlock");
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
  const btn = el("button", "file-btn", label);
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
