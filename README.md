# PDF Tools

A web-based PDF toolbox that runs entirely in your browser. Files are never
uploaded: everything happens on your device.

## Tools

Add one or more PDFs, turn on any combination of tools and press **process**.
With several files, the tools run on **each file separately** (download them
one by one or as a `.zip`), unless **merge** is on, which combines them into one
PDF in the order of the file list. Tools always run in this order:

**merge → remove pages → rotate → scale to A4 → margins → page numbers → watermark → compress → split → metadata → password**

| Tool | What it does |
| --- | --- |
| **Merge** | Combine all uploaded PDFs into one, in the order of the file list (drag rows or use ↑ ↓). |
| **Remove pages** | Drop pages by number, e.g. `1, 4-6, 10-`. |
| **Rotate** | 90°/180°/270°, for all, landscape-only or portrait-only pages. Adds to any rotation the page already has, and judges landscape/portrait by how the page is displayed. |
| **Scale to A4** | Fit each page to A4 in its own orientation, fit to portrait A4, or stretch. Content is centred and links stay aligned. |
| **Margins** | Shrink content to leave a blank margin (mm), on all sides or per side. Includes a **Digipost letter** preset (A4, 15 mm). |
| **Page numbers** | Six positions, formats `1` / `1 / 10` / `page 1 of 10`, custom first number, optional unnumbered cover page. Numbers are upright on rotated pages. |
| **Watermark** | Text or PNG/JPEG image with position, rotation and opacity. |
| **Compress** | Re-encodes large images as JPEG at high/medium/low quality and saves with compact object streams. Text and vector graphics are untouched. |
| **Split** | Single pages, every _n_ pages, custom ranges, or odd/even. Download each part or everything as a `.zip`. |
| **Metadata** | Edit title, author, subject and keywords (pre-filled from the file), or remove all metadata. When several files are processed separately, empty fields keep each file's own value. |
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
ui/              DOM helpers: file list, reading settings, canvas image encoder
tools/           the PDF tools. Plain functions (pdfDoc, options) with no DOM access
  pipeline.js    runs the enabled tools in order
  geometry.js    "as displayed" page geometry shared by the tools
tests/           node:test unit tests
scripts/         stamp-version.mjs (cache busting, used by the deploy)
vendor/          pdf-lib-with-encrypt and JSZip (see vendor/README.md)
```

### Deploying

Pushing to `main` runs `.github/workflows/pages.yml`: it runs the tests,
copies the site, adds `?v=<commit>` to every local JS/CSS URL and deploys to
GitHub Pages. Pages caches JS/CSS for 4 hours, so without the version a
browser could mix files from two deploys. The repository's Pages source must
be set to **GitHub Actions**.

## License

This project is open source. Feel free to use, modify, and distribute.
