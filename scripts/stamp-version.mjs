// Cache busting for GitHub Pages, which serves JS/CSS with a 4-hour cache.
//
// Rewrites every local .js/.css reference in the built site to carry
// `?v=<version>`, so each deploy gets new URLs and a browser can never mix
// files from two deploys. Run on a copy of the site, never on the sources:
//
//   node scripts/stamp-version.mjs <siteDir> <version>

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// "./x.js", "../tools/x.js", "vendor/x.js" inside JS string literals
const JS_REF = /(["'])((?:\.{1,2}\/|vendor\/)[^"'?#\s]+\.js)\1/g;
// src="script.js" / href="styles.css" in HTML (relative URLs only)
const HTML_REF = /\b(src|href)="([^":?#]+\.(?:js|css))"/g;

export function stampJs(source, version) {
  return source.replace(JS_REF, (_, quote, path) => `${quote}${path}?v=${version}${quote}`);
}

export function stampHtml(source, version) {
  return source.replace(HTML_REF, (_, attr, path) => `${attr}="${path}?v=${version}"`);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

async function main([siteDir, version]) {
  if (!siteDir || !version) {
    console.error("usage: node scripts/stamp-version.mjs <siteDir> <version>");
    process.exit(1);
  }
  let count = 0;
  for await (const path of walk(siteDir)) {
    // Minified vendor bundles have no local imports; leave them untouched.
    if (path.includes(`${join("vendor", "")}`) || !/\.(js|html)$/.test(path)) continue;
    const source = await readFile(path, "utf8");
    const stamped = path.endsWith(".html") ? stampHtml(source, version) : stampJs(source, version);
    if (stamped !== source) {
      await writeFile(path, stamped);
      count++;
    }
  }
  console.log(`stamped ${count} files with v=${version}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main(process.argv.slice(2));
}
