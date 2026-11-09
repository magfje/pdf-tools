// Browser implementation of the image encoder used by tools/compress.js:
// decode with the browser, downscale, re-encode as JPEG via a canvas.

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToJpeg(canvas, quality) {
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/jpeg", quality })
    : await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return new Uint8Array(await blob.arrayBuffer());
}

function rawToCanvas({ pixels, width, height, components }) {
  const canvas = makeCanvas(width, height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += components) {
    const r = pixels[j];
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = components === 3 ? pixels[j + 1] : r;
    rgba[i * 4 + 2] = components === 3 ? pixels[j + 2] : r;
    rgba[i * 4 + 3] = 255;
  }
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas;
}

export async function browserImageEncoder(input, { quality, maxSide }) {
  let source;
  if (input.kind === "jpeg") {
    source = await createImageBitmap(new Blob([input.bytes], { type: "image/jpeg" }));
  } else {
    source = rawToCanvas(input);
  }

  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  source.close?.();

  return { bytes: await canvasToJpeg(canvas, quality), width, height };
}
