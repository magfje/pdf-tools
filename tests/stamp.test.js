import test from "node:test";
import assert from "node:assert/strict";
import { stampHtml, stampJs } from "../scripts/stamp-version.mjs";

test("stamps local module imports and script URLs", () => {
  const src = [
    'import { a } from "./tools/a.js";',
    "import b from '../b.js';",
    'export * from "../vendor/lib.esm.min.js";',
    'script.src = "vendor/jszip.min.js";',
    'const url = "https://example.com/x.js";',
    'const name = "file.js is fine";',
  ].join("\n");
  assert.equal(
    stampJs(src, "abc"),
    [
      'import { a } from "./tools/a.js?v=abc";',
      "import b from '../b.js?v=abc';",
      'export * from "../vendor/lib.esm.min.js?v=abc";',
      'script.src = "vendor/jszip.min.js?v=abc";',
      'const url = "https://example.com/x.js";',
      'const name = "file.js is fine";',
    ].join("\n")
  );
});

test("stamps local css/js in html but not external URLs or favicon", () => {
  const html =
    '<link rel="icon" href="favicon.ico" /><link rel="stylesheet" href="styles.css" />' +
    '<script type="module" src="script.js"></script><script src="https://cdn.example/x.js"></script>';
  assert.equal(
    stampHtml(html, "abc"),
    '<link rel="icon" href="favicon.ico" /><link rel="stylesheet" href="styles.css?v=abc" />' +
      '<script type="module" src="script.js?v=abc"></script><script src="https://cdn.example/x.js"></script>'
  );
});
