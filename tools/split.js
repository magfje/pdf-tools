export async function splitPDF(pdfDoc, splitOption) {
  const splitType = document.getElementById("splitType").value;
  const splitPages = pdfDoc.getPages();
  const splitResults = [];

  switch (splitType) {
    case "individual":
      // Split into individual pages
      for (let i = 0; i < splitPages.length; i++) {
        const newPdf = await PDFLib.PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        splitResults.push({
          pdf: newPdf,
          name: `page_${i + 1}`,
        });
      }
      break;

    case "ranges":
      // Split by custom ranges
      const ranges = parseSplitRanges(
        document.getElementById("splitRanges").value
      );
      for (const range of ranges) {
        const newPdf = await PDFLib.PDFDocument.create();
        const pageIndices = [];

        for (let i = range.start - 1; i < range.end; i++) {
          if (i < splitPages.length) {
            pageIndices.push(i);
          }
        }

        if (pageIndices.length > 0) {
          const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach((page) => newPdf.addPage(page));
          splitResults.push({
            pdf: newPdf,
            name: `pages_${range.start}_to_${range.end}`,
          });
        }
      }
      break;

    case "evenodd":
      // Split into even and odd pages
      const evenPages = [];
      const oddPages = [];

      for (let i = 0; i < splitPages.length; i++) {
        if ((i + 1) % 2 === 0) {
          evenPages.push(i);
        } else {
          oddPages.push(i);
        }
      }

      if (oddPages.length > 0) {
        const oddPdf = await PDFLib.PDFDocument.create();
        const copiedOddPages = await oddPdf.copyPages(pdfDoc, oddPages);
        copiedOddPages.forEach((page) => oddPdf.addPage(page));
        splitResults.push({
          pdf: oddPdf,
          name: "odd_pages",
        });
      }

      if (evenPages.length > 0) {
        const evenPdf = await PDFLib.PDFDocument.create();
        const copiedEvenPages = await evenPdf.copyPages(pdfDoc, evenPages);
        copiedEvenPages.forEach((page) => evenPdf.addPage(page));
        splitResults.push({
          pdf: evenPdf,
          name: "even_pages",
        });
      }
      break;
  }

  return splitResults;
}

function parseSplitRanges(rangeString) {
  const ranges = [];
  const parts = rangeString.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map((n) => parseInt(n.trim()));
      if (start && end && start <= end) {
        ranges.push({ start, end });
      }
    } else {
      const page = parseInt(trimmed);
      if (page) {
        ranges.push({ start: page, end: page });
      }
    }
  }

  return ranges;
}

export function isSplitEnabled() {
  return document.getElementById("enableSplit").checked;
}
