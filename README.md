# PDF Tools

A web-based PDF toolbox that runs entirely in your browser. Files are never
uploaded: everything happens on your device.

## Tools

Turn on any combination of tools and press **process**. They always run in
this order, so the result is predictable:

**merge → remove pages → rotate → scale to A4 → margins → page numbers → watermark → compress → split → metadata → password**

| Tool | What it does |
| --- | --- |
| **Merge** | Combine any number of PDFs. Drop or pick several files, then drag rows (or use ↑ ↓) to set the order. The main file can go anywhere. |
| **Remove pages** | Drop pages by number, e.g. `1, 4-6, 10-`. |
| **Rotate** | 90°/180°/270°, for all, landscape-only or portrait-only pages. Adds to any rotation the page already has, and judges landscape/portrait by how the page is displayed. |
| **Scale to A4** | Fit each page to A4 in its own orientation, fit to portrait A4, or stretch. Content is centred and links stay aligned. |
| **Margins** | Shrink content to leave a blank margin (mm), on all sides or per side. Includes a **Digipost letter** preset (A4, 15 mm). |
| **Page numbers** | Six positions, formats `1` / `1 / 10` / `page 1 of 10`, custom first number, optional unnumbered cover page. Numbers are upright on rotated pages. |
| **Watermark** | Text or PNG/JPEG image with position, rotation and opacity. |
| **Compress** | Re-encodes large images as JPEG at high/medium/low quality and saves with compact object streams. Text and vector graphics are untouched. |
| **Split** | Single pages, every _n_ pages, custom ranges, or odd/even. Download each part or everything as a `.zip`. |
| **Metadata** | Edit title, author, subject and keywords (pre-filled from the file), or remove all metadata. |
| **Password** | AES-128 encryption that opens in any PDF reader. |

Password-protected PDFs can be opened too. Enter the password and the output
is saved without it (unless you add one).

## Development

No build step. `index.html` loads the ES modules directly, so any static file
server works:

```sh
python3 -m http.server   # then open http://localhost:8000
npm test                 # unit tests (Node 22+, no dependencies to install)
```

```
script.js        app wiring: file loading, results, downloads
ui/              DOM helpers: merge list, reading settings, canvas image encoder
tools/           the PDF tools. Plain functions (pdfDoc, options) with no DOM access
  pipeline.js    runs the enabled tools in order
  geometry.js    "as displayed" page geometry shared by the tools
tests/           node:test unit tests for tools/
vendor/          pdf-lib-with-encrypt and JSZip (see vendor/README.md)
```

## License

This project is open source. Feel free to use, modify, and distribute.
