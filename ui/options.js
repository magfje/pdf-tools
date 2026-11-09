// Reads the tool settings from the page into plain objects for runPipeline.
// Throws an Error with a user-facing message when a setting is invalid.

const $ = (id) => document.getElementById(id);
const on = (id) => $(id).checked;

function number(id, { min = -Infinity, max = Infinity, label }) {
  const value = Number($(id).value);
  if ($(id).value === "" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}: enter a number from ${min} to ${max}`);
  }
  return value;
}

export async function readOptions({ merging }) {
  const options = {};

  if (merging) options.merge = true;

  if (on("enableRemovePages")) {
    options.removePages = { ranges: $("removeRanges").value };
  }

  if (on("enableRotation")) {
    options.rotate = {
      angle: Number($("rotationAngle").value),
      which: $("rotationPages").value,
    };
  }

  if (on("enableScaling")) {
    options.scale = { mode: $("scalingMode").value };
  }

  if (on("enableMargins")) {
    const label = "margins";
    if (on("marginSeparate")) {
      options.margins = {
        top: number("marginTop", { min: 0, max: 100, label }),
        right: number("marginRight", { min: 0, max: 100, label }),
        bottom: number("marginBottom", { min: 0, max: 100, label }),
        left: number("marginLeft", { min: 0, max: 100, label }),
      };
    } else {
      const all = number("marginAll", { min: 0, max: 100, label });
      options.margins = { top: all, right: all, bottom: all, left: all };
    }
  }

  if (on("enablePageNumbers")) {
    options.pageNumbers = {
      position: $("pageNumberPosition").value,
      format: $("pageNumberFormat").value,
      fontSize: number("pageNumberSize", { min: 6, max: 48, label: "page number size" }),
      start: number("startPage", { min: 0, max: 99999, label: "first page number" }),
      skipFirst: on("skipFirstPage"),
    };
  }

  if (on("enableWatermark")) {
    const type = $("watermarkType").value;
    const common = {
      type,
      rotation: number("watermarkRotation", { min: -360, max: 360, label: "watermark rotation" }),
      opacity: number("watermarkOpacity", { min: 0.05, max: 1, label: "watermark opacity" }),
      position: $("watermarkPosition").value,
    };
    if (type === "image") {
      const file = $("watermarkImage").files[0];
      if (!file) throw new Error("watermark: choose an image");
      options.watermark = {
        ...common,
        imageBytes: new Uint8Array(await file.arrayBuffer()),
        imageScale: number("watermarkImageScale", { min: 0.05, max: 5, label: "watermark scale" }),
      };
    } else {
      options.watermark = {
        ...common,
        text: $("watermarkText").value,
        fontSize: number("watermarkFontSize", { min: 8, max: 200, label: "watermark font size" }),
        color: $("watermarkColor").value,
      };
    }
  }

  if (on("enableCompression")) {
    options.compress = { level: $("compressionLevel").value };
  }

  if (on("enableSplit")) {
    options.split = {
      type: $("splitType").value,
      ranges: $("splitRanges").value,
      every: $("splitEvery").value,
    };
  }

  if (on("enableMetadata")) {
    options.metadata = {
      title: $("metaTitle").value,
      author: $("metaAuthor").value,
      subject: $("metaSubject").value,
      keywords: $("metaKeywords").value,
      strip: on("metaStrip"),
    };
  }

  if (on("enablePassword")) {
    const password = $("pdfPassword").value;
    if (!password) throw new Error("password: enter a password");
    if (password !== $("confirmPassword").value) throw new Error("password: the passwords don't match");
    options.password = { password };
  }

  return options;
}
