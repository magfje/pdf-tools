# Vendored libraries

Bundled locally so the site works without a CDN and the PDF library is ready
before the app's modules run.

| File | Source | Version | License |
| --- | --- | --- | --- |
| `pdf-lib-with-encrypt.esm.min.js` | [pdf-lib-with-encrypt](https://www.npmjs.com/package/pdf-lib-with-encrypt) (`dist/pdf-lib.esm.min.js`), fork of [pdf-lib](https://pdf-lib.js.org) | 1.2.1 | MIT |
| `jszip.min.js` | [jszip](https://www.npmjs.com/package/jszip) (`dist/jszip.min.js`), loaded on demand for "download all" | 3.10.1 | MIT or GPL-3.0 |

Source-map comments were stripped. To update, replace the file with the same
`dist` file from a newer npm release.
