/**
 * Client-side export helpers: PDF and Markdown download.
 * PDF: Markdown → HTML → hidden div → html2canvas → jsPDF (no DOM dependency)
 */

import { moduleToMarkdown } from "./export-markdown";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type A = Record<string, any>;

// ---------------------------------------------------------------------------
// Markdown → simple HTML (for PDF rendering)
// ---------------------------------------------------------------------------

function mdToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;margin:12px 0 6px;color:#1e293b">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:16px 0 8px;color:#0f172a">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:800;margin:20px 0 10px;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:6px">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;padding-left:4px">$1</li>')
    // Line breaks for remaining lines
    .replace(/^(?!<[hl]|<li|<t|\|)(.*\S.*)$/gm, '<p style="margin:3px 0;line-height:1.6">$1</p>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul style="margin:4px 0 8px 16px;padding:0;list-style:disc">$1</ul>');

  // Tables: convert markdown tables to HTML
  const tableRegex = /(\|.+\|\n\|[-| :]+\|\n(?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (table) => {
    const rows = table.trim().split("\n");
    const headers = rows[0].split("|").filter(c => c.trim());
    const dataRows = rows.slice(2);
    let t = '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:13px">';
    t += '<thead><tr>';
    for (const h of headers) {
      t += `<th style="border:1px solid #e2e8f0;padding:6px 8px;background:#f8fafc;text-align:left;font-weight:600">${h.trim()}</th>`;
    }
    t += '</tr></thead><tbody>';
    for (const row of dataRows) {
      const cells = row.split("|").filter(c => c.trim());
      t += '<tr>';
      for (const cell of cells) {
        t += `<td style="border:1px solid #e2e8f0;padding:5px 8px">${cell.trim()}</td>`;
      }
      t += '</tr>';
    }
    t += '</tbody></table>';
    return t;
  });

  return html;
}

// ---------------------------------------------------------------------------
// Render HTML in hidden div → html2canvas → jsPDF pages
// ---------------------------------------------------------------------------

async function htmlToPdfPages(
  htmlContent: string,
  html2canvas: typeof import("html2canvas").default,
): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0; width: 800px;
    background: white; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px; color: #1e293b; line-height: 1.6;
  `;
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  // Wait for rendering
  await new Promise(r => setTimeout(r, 100));

  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  document.body.removeChild(container);
  return canvas;
}

function canvasToPdf(
  canvas: HTMLCanvasElement,
  jsPDF: typeof import("jspdf").default,
  filename: string,
) {
  const imgW = canvas.width;
  const imgH = canvas.height;

  const pdfW = 595.28;
  const pdfH = 841.89;
  const margin = 24;
  const contentW = pdfW - margin * 2;
  const contentH = (imgH * contentW) / imgW;
  const pageContentH = pdfH - margin * 2;

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  if (contentH <= pageContentH) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, contentW, contentH);
  } else {
    let remainingH = contentH;
    let srcY = 0;
    let page = 0;
    while (remainingH > 0) {
      if (page > 0) pdf.addPage();
      const sliceH = Math.min(pageContentH, remainingH);
      const srcSliceH = (sliceH / contentW) * imgW;
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = imgW;
      sliceCanvas.height = srcSliceH;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, srcY, imgW, srcSliceH, 0, 0, imgW, srcSliceH);
      pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, margin, contentW, sliceH);
      srcY += srcSliceH;
      remainingH -= sliceH;
      page++;
    }
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export selected modules as a single PDF.
 * Renders from data (not DOM) so all content is included regardless of collapse/tab state.
 */
export async function exportModulesAsPdf(
  moduleKeys: string[],
  analysis: A,
  candidateName: string,
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // Generate combined HTML from all selected modules
  const allHtml = moduleKeys
    .map(key => {
      const md = moduleToMarkdown(key, analysis, undefined);
      return mdToHtml(md);
    })
    .join('<hr style="border:none;border-top:2px solid #e2e8f0;margin:24px 0">');

  const fullHtml = `<div style="margin-bottom:8px">
    <h1 style="font-size:22px;font-weight:800;color:#7c3aed;margin:0 0 4px">${candidateName} — 简历分析报告</h1>
    <p style="font-size:12px;color:#94a3b8;margin:0">导出时间: ${new Date().toLocaleString("zh-CN")}</p>
  </div>
  <hr style="border:none;border-top:2px solid #7c3aed;margin:12px 0 20px">
  ${allHtml}`;

  const canvas = await htmlToPdfPages(fullHtml, html2canvas);
  canvasToPdf(canvas, jsPDF, `${candidateName}_分析报告.pdf`);
}

/**
 * Export selected modules as a single Markdown file.
 */
export function exportModulesAsMarkdown(
  moduleKeys: string[],
  analysis: A,
  candidateName: string,
): void {
  const header = `# ${candidateName} — 简历分析报告\n\n> 导出时间: ${new Date().toLocaleString("zh-CN")}\n\n---\n\n`;
  const body = moduleKeys
    .map(key => moduleToMarkdown(key, analysis, undefined))
    .join("\n\n---\n\n");

  const content = header + body;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${candidateName}_分析报告.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
