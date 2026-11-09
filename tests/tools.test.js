import test from "node:test";
import assert from "node:assert/strict";
import { PDFName, PDFRawStream, decodePDFRawStream } from "../tools/pdflib.js";
import { A4, displayGeometry, getRotation } from "../tools/geometry.js";
import { rotatePages } from "../tools/rotation.js";
import { scaleToA4 } from "../tools/scale.js";
import { addMargins } from "../tools/margins.js";
import { removePages } from "../tools/removePages.js";
import { splitPDF } from "../tools/split.js";
import { applyMetadata, readMetadata } from "../tools/metadata.js";
import { encryptPDF } from "../tools/password.js";
import { loadPdf, PasswordRequiredError } from "../tools/load.js";
import { recompressImages } from "../tools/compress.js";
import { addPageNumbers, formatPageNumber } from "../tools/pageNumbers.js";
import { addWatermark } from "../tools/watermark.js";
import { runPipeline } from "../tools/pipeline.js";
import { approx, makeDoc, roundTrip } from "./helpers.js";

const size = (page) => {
  const v = displayGeometry(page);
  return [Math.round(v.width), Math.round(v.height)];
};

// --- rotation (issue #4) -------------------------------------------------

test("rotation adds to the page's existing rotation", async () => {
  const doc = await makeDoc([[200, 300, 90]]);
  rotatePages(doc, { angle: 90 });
  assert.equal(getRotation(doc.getPage(0)), 180);
});

test("'only landscape' uses the displayed orientation", async () => {
  // A portrait box shown sideways (/Rotate 90) *is* landscape to the reader.
  const doc = await makeDoc([[200, 300, 90], [200, 300, 0], [300, 200, 0]]);
  const count = rotatePages(doc, { angle: 90, which: "landscape" });
  assert.equal(count, 2);
  assert.deepEqual(doc.getPages().map(getRotation), [180, 0, 90]);
});

// --- scaling ---------------------------------------------------------------

test("smart scaling keeps orientation, fit makes portrait A4", async () => {
  const doc = await makeDoc([[300, 200], [200, 300]]);
  scaleToA4(doc, { mode: "smart" });
  assert.deepEqual(doc.getPages().map(size), [[842, 595], [595, 842]]);

  const doc2 = await makeDoc([[300, 200]]);
  scaleToA4(doc2, { mode: "fit" });
  assert.deepEqual(size(doc2.getPage(0)), [595, 842]);
});

test("smart scaling of a rotated page keeps its rotation and displayed orientation", async () => {
  const doc = await makeDoc([[200, 300, 90]]); // displayed landscape
  scaleToA4(doc, { mode: "smart" });
  const page = doc.getPage(0);
  assert.equal(getRotation(page), 90);
  assert.deepEqual(size(page), [842, 595]);
  const box = page.getMediaBox();
  assert.ok(approx(box.width, A4.width) && approx(box.height, A4.height));
});

test("fit scaling centres the content (via the page box)", async () => {
  const doc = await makeDoc([[100, 100]]);
  scaleToA4(doc, { mode: "fit" });
  const box = doc.getPage(0).getMediaBox();
  // content scaled by 5.95 -> 595x595, centred vertically in 842
  assert.ok(approx(box.x, 0, 0.1));
  assert.ok(approx(box.y, -(A4.height - A4.width) / 2, 0.1));
});

// --- issue #2 + #4: rotate runs before scale --------------------------------

test("pipeline: rotate 'only landscape' + scale still rotates landscape pages", async () => {
  const doc = await makeDoc([[842, 595], [595, 842]]);
  const { outputs } = await runPipeline([doc], {
    rotate: { angle: 90, which: "landscape" },
    scale: { mode: "fit" },
  });
  const out = await loadPdf(outputs[0].bytes);
  assert.deepEqual(out.getPages().map(getRotation), [90, 0]);
  // both are now displayed as portrait A4
  assert.deepEqual(out.getPages().map(size), [[595, 842], [595, 842]]);
});

// --- margins ---------------------------------------------------------------

test("margins keep the page size and shrink content", async () => {
  const doc = await makeDoc([[A4.width, A4.height]]);
  addMargins(doc, { top: 15, right: 15, bottom: 15, left: 15 });
  const box = doc.getPage(0).getMediaBox();
  assert.ok(approx(box.width, A4.width) && approx(box.height, A4.height));
  assert.ok(box.x < 0 && box.y < 0, "box moved so scaled content sits inside the margin");
});

test("margins larger than the page are rejected", async () => {
  const doc = await makeDoc([[100, 100]]);
  assert.throws(() => addMargins(doc, { top: 20, right: 20, bottom: 20, left: 20 }), /larger than the page/);
});

// --- remove / split --------------------------------------------------------

test("remove pages", async () => {
  const doc = await makeDoc([[100, 100], [200, 200], [300, 300], [400, 400]]);
  assert.equal(removePages(doc, "1, 3"), 2);
  assert.deepEqual(doc.getPages().map((p) => p.getWidth()), [200, 400]);
  assert.throws(() => removePages(doc, "1-2"), /every page/);
});

test("split variants and names", async () => {
  const doc = await makeDoc([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  const names = async (opts) => (await splitPDF(doc, opts)).map((p) => `${p.name}:${p.pdf.getPageCount()}`);
  assert.deepEqual(await names({ type: "ranges", ranges: "1-2, 4-" }), ["pages_1-2:2", "pages_4-5:2"]);
  assert.deepEqual(await names({ type: "every", every: 2 }), ["pages_1-2:2", "pages_3-4:2", "page_5:1"]);
  assert.deepEqual(await names({ type: "evenodd" }), ["odd_pages:3", "even_pages:2"]);
  assert.equal((await splitPDF(doc, { type: "individual" })).length, 5);
  await assert.rejects(splitPDF(doc, { type: "ranges", ranges: "9" }), /past the last page/);
});

// --- metadata (issue #3) ------------------------------------------------------

test("metadata: set, clear and strip", async () => {
  const doc = await makeDoc([[1, 1]], { title: "old" });
  doc.setAuthor("someone");
  applyMetadata(doc, { title: "New title", author: "", subject: "s", keywords: "a, b" });
  let meta = readMetadata(await roundTrip(doc));
  assert.deepEqual(meta, { title: "New title", author: "", subject: "s", keywords: "a, b" });

  doc.setProducer("pdf-lib");
  applyMetadata(doc, { strip: true });
  const out = await roundTrip(doc);
  assert.deepEqual(readMetadata(out), { title: "", author: "", subject: "", keywords: "" });
  assert.equal(out.getProducer(), undefined);
});

// --- password ----------------------------------------------------------------

test("password: encrypt, then open with right / wrong / no password", async () => {
  const doc = await makeDoc([[100, 100], [100, 100]]);
  await encryptPDF(doc, "s3cret");
  const bytes = await doc.save();

  await assert.rejects(loadPdf(bytes, { name: "x.pdf" }), (e) => e instanceof PasswordRequiredError && !e.wrongPassword);
  await assert.rejects(loadPdf(bytes, { name: "x.pdf", password: "nope" }), (e) => e instanceof PasswordRequiredError && e.wrongPassword);
  const opened = await loadPdf(bytes, { password: "s3cret" });
  assert.equal(opened.getPageCount(), 2);
});

test("files with only an owner password open without asking", async () => {
  const doc = await makeDoc([[100, 100]]);
  await doc.encrypt({ ownerPassword: "owner", pdfVersion: "1.7" });
  const opened = await loadPdf(await doc.save());
  assert.equal(opened.getPageCount(), 1);
});

test("unreadable input gives a clear error", async () => {
  await assert.rejects(loadPdf(new Uint8Array([1, 2, 3]), { name: "junk.pdf" }), /could not read "junk.pdf"/);
});

// --- stamps --------------------------------------------------------------------

test("page number formats", () => {
  assert.equal(formatPageNumber("n", 3, 9), "3");
  assert.equal(formatPageNumber("n-of-total", 3, 9), "3 / 9");
  assert.equal(formatPageNumber("page-n-of-total", 3, 9), "page 3 of 9");
});

test("page numbers and watermarks work on rotated pages", async () => {
  const doc = await makeDoc([[200, 300, 0], [200, 300, 90], [200, 300, 270]]);
  await addPageNumbers(doc, { position: "bottom-right", fontSize: 10, start: 1, skipFirst: true });
  await addWatermark(doc, { type: "text", text: "draft", fontSize: 30, color: "#ff0000", rotation: 45, opacity: 0.3, position: "center" });
  assert.equal((await roundTrip(doc)).getPageCount(), 3);
});

test("watermark rejects text the standard font can't draw", async () => {
  const doc = await makeDoc([[200, 300]]);
  await assert.rejects(
    addWatermark(doc, { type: "text", text: "hi 🙂", fontSize: 20, color: "#000000", rotation: 0, opacity: 1, position: "center" }),
    /can't draw/
  );
});

// --- compression -----------------------------------------------------------------

test("compression replaces large images with the encoder's smaller output", async () => {
  const doc = await makeDoc([[100, 100]]);
  const w = 120, h = 120;
  const pixels = new Uint8Array(w * h * 3);
  crypto.getRandomValues(pixels); // noise compresses poorly, so the stream is large
  const ref = doc.context.register(
    doc.context.flateStream(pixels, { Type: "XObject", Subtype: "Image", Width: w, Height: h, BitsPerComponent: 8, ColorSpace: "DeviceRGB" })
  );
  const loaded = await roundTrip(doc);
  const seen = [];
  const encoder = async (input) => {
    seen.push(input.kind);
    assert.equal(input.pixels.length, w * h * 3);
    return { bytes: new Uint8Array(1000), width: 60, height: 60 };
  };
  const { images, savedBytes } = await recompressImages(loaded, "medium", encoder);
  assert.equal(images, 1);
  assert.ok(savedBytes > 0);
  assert.deepEqual(seen, ["raw"]);
  const img = loaded.context.lookup(ref);
  assert.ok(img instanceof PDFRawStream);
  assert.equal(img.dict.get(PDFName.of("Filter")), PDFName.of("DCTDecode"));
  assert.equal(img.dict.get(PDFName.of("Width")).asNumber(), 60);
});

// --- pipeline ----------------------------------------------------------------------

test("pipeline merges in the given order and splits with suffixes", async () => {
  const a = await makeDoc([[100, 100]], { title: "A" });
  const b = await makeDoc([[200, 200], [300, 300]]);
  const { outputs, report } = await runPipeline([b, a], { merge: true, split: { type: "every", every: 2 } });
  assert.equal(report.merged, 2);
  assert.deepEqual(outputs.map((o) => [o.suffix, o.pageCount]), [["pages_1-2", 2], ["page_3", 1]]);
  const first = await loadPdf(outputs[0].bytes);
  assert.deepEqual(first.getPages().map((p) => p.getWidth()), [200, 300]);
});

test("pipeline with password encrypts every split part", async () => {
  const doc = await makeDoc([[100, 100], [100, 100]]);
  const { outputs } = await runPipeline([doc], { split: { type: "individual" }, password: { password: "pw" } });
  for (const o of outputs) {
    await assert.rejects(loadPdf(o.bytes), PasswordRequiredError);
    assert.equal((await loadPdf(o.bytes, { password: "pw" })).getPageCount(), 1);
  }
});

test("stamps drawn after scaling are not scaled with the content", async () => {
  // Regression: pdf-lib's scaleContent() also scaled later drawing, so page
  // numbers ended up off the page.
  const src = await makeDoc([[300, 300]]);
  src.getPage(0).drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
  const doc = await roundTrip(src);
  scaleToA4(doc, { mode: "fit" });
  await addPageNumbers(doc, { position: "bottom-center", fontSize: 12, start: 1 });
  const out = await roundTrip(doc);
  const contents = out.getPage(0).node.Contents();
  const streams = contents.asArray().map((ref) => out.context.lookup(ref));
  const decoded = streams.map((s) => new TextDecoder().decode(decodePDFRawStream(s).decode()));
  const qIndex = decoded.findLastIndex((t) => t.trim() === "Q");
  const textIndex = decoded.findIndex((t) => t.includes("Tj"));
  assert.ok(qIndex >= 0 && textIndex > qIndex, "page number is drawn after the scaled content is closed");
});
