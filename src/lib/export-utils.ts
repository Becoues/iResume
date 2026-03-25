/**
 * Client-side export helpers: PDF (html2canvas + jsPDF) and Markdown download.
 */

export async function exportAsPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const imgW = canvas.width;
  const imgH = canvas.height;

  // A4 dimensions in pt
  const pdfW = 595.28;
  const pdfH = 841.89;
  const margin = 20;
  const contentW = pdfW - margin * 2;
  const contentH = (imgH * contentW) / imgW;

  const pdf = new jsPDF({
    orientation: contentH > pdfH ? "portrait" : "portrait",
    unit: "pt",
    format: "a4",
  });

  // Handle multi-page if content is taller than one page
  const pageContentH = pdfH - margin * 2;
  if (contentH <= pageContentH) {
    pdf.addImage(imgData, "PNG", margin, margin, contentW, contentH);
  } else {
    let remainingH = contentH;
    let srcY = 0;
    let page = 0;
    while (remainingH > 0) {
      if (page > 0) pdf.addPage();
      const sliceH = Math.min(pageContentH, remainingH);
      // Calculate source slice from the original canvas
      const srcSliceH = (sliceH / contentW) * imgW;
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgW;
      sliceCanvas.height = srcSliceH;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, srcY, imgW, srcSliceH, 0, 0, imgW, srcSliceH);
      const sliceData = sliceCanvas.toDataURL("image/png");
      pdf.addImage(sliceData, "PNG", margin, margin, contentW, sliceH);
      srcY += srcSliceH;
      remainingH -= sliceH;
      page++;
    }
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
