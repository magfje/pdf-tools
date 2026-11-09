import test from "node:test";
import assert from "node:assert/strict";
import { displayGeometry, displayMarginsToBox } from "../tools/geometry.js";
import { makeDoc } from "./helpers.js";

test("display size swaps for 90/270 rotation", async () => {
  const doc = await makeDoc([[200, 300, 0], [200, 300, 90], [200, 300, 180], [200, 300, 270]]);
  const views = doc.getPages().map(displayGeometry);
  assert.deepEqual(views.map((v) => [v.width, v.height, v.isLandscape]), [
    [200, 300, false],
    [300, 200, true],
    [200, 300, false],
    [300, 200, true],
  ]);
});

test("toPdf maps the displayed bottom-left corner to the right page corner", async () => {
  // Display rotates clockwise: the displayed bottom-left comes from
  //   0°: (0,0)   90°: (w,0)   180°: (w,h)   270°: (0,h)
  const doc = await makeDoc([[200, 300, 0], [200, 300, 90], [200, 300, 180], [200, 300, 270]]);
  const corners = doc.getPages().map((p) => displayGeometry(p).toPdf(0, 0));
  assert.deepEqual(corners, [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 300 },
    { x: 0, y: 300 },
  ]);
});

test("toPdf respects a non-zero crop box origin", async () => {
  const doc = await makeDoc([[200, 300]]);
  const page = doc.getPage(0);
  page.setCropBox(50, 60, 100, 100);
  assert.deepEqual(displayGeometry(page).toPdf(10, 20), { x: 60, y: 80 });
});

test("displayed margins map onto the unrotated box", () => {
  const m = { top: 1, right: 2, bottom: 3, left: 4 };
  assert.deepEqual(displayMarginsToBox(m, 0), m);
  assert.deepEqual(displayMarginsToBox(m, 90), { left: 1, top: 2, right: 3, bottom: 4 });
  assert.deepEqual(displayMarginsToBox(m, 180), { left: 2, top: 3, right: 4, bottom: 1 });
  assert.deepEqual(displayMarginsToBox(m, 270), { right: 1, top: 4, left: 3, bottom: 2 });
});
