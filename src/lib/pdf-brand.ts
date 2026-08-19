import fs from 'fs';
import path from 'path';
import type { jsPDF } from 'jspdf';

/** Paleta de constancias PDF (misma que el certificado de lectura individual). */
export const PDF_BRAND = {
  primary: [19, 159, 167] as [number, number, number],
  primaryDark: [14, 110, 115] as [number, number, number],
  border: [165, 178, 182] as [number, number, number],
  bgSoft: [232, 240, 242] as [number, number, number],
  textMain: [17, 24, 39] as [number, number, number],
  textMuted: [72, 82, 90] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  successBg: [220, 252, 231] as [number, number, number],
  warnBg: [254, 243, 199] as [number, number, number],
  warnText: [146, 64, 14] as [number, number, number],
  ok: [4, 120, 87] as [number, number, number],
};

export const PDF_MM = {
  margin: 14,
  contentWidth: 182,
  contentBottom: 268,
  continueTop: 30,
  tableBottom: 22,
};

export const PDF_TABLE_HEAD = {
  fillColor: PDF_BRAND.primary,
  textColor: [255, 255, 255] as [number, number, number],
  fontStyle: 'bold' as const,
};

export const PDF_TABLE_MARGIN = {
  top: PDF_MM.continueTop,
  left: PDF_MM.margin,
  right: PDF_MM.margin,
  bottom: PDF_MM.tableBottom,
};

let logoJpegCache: string | null | undefined;

export function loadNotificasLogoJpeg(): string | null {
  if (logoJpegCache !== undefined) return logoJpegCache;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'notificasLogo.jpg');
    logoJpegCache = fs.existsSync(logoPath)
      ? fs.readFileSync(logoPath, { encoding: 'base64' })
      : null;
  } catch {
    logoJpegCache = null;
  }
  return logoJpegCache;
}

export function drawPdfRuleMm(doc: jsPDF, y: number) {
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.23);
  doc.line(PDF_MM.margin, y, w - PDF_MM.margin, y);
}

function drawCenteredLogo(doc: jsPDF, y: number, size: number) {
  const logo = loadNotificasLogoJpeg();
  if (!logo) return;
  const w = doc.internal.pageSize.getWidth();
  doc.addImage(logo, 'JPEG', w / 2 - size / 2, y, size, size);
}

/** Membrete alineado al certificado de lectura: logo, marca, subtítulo, título del documento. */
export function drawPdfLetterheadMm(
  doc: jsPDF,
  opts: {
    mode: 'first' | 'continue';
    documentTitle: string;
    lines?: string[];
  }
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cx = pageWidth / 2;

  if (opts.mode === 'continue') {
    const logo = loadNotificasLogoJpeg();
    if (logo) {
      doc.addImage(logo, 'JPEG', PDF_MM.margin, 8, 8, 8);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.primaryDark);
    doc.text('Notificas.com', logo ? PDF_MM.margin + 10 : PDF_MM.margin, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_BRAND.textMuted);
    const shortTitle = doc.splitTextToSize(opts.documentTitle, 110);
    doc.text(shortTitle[0], pageWidth - PDF_MM.margin, 13, { align: 'right' });
    drawPdfRuleMm(doc, 18);
    return PDF_MM.continueTop;
  }

  let y = 10;
  drawCenteredLogo(doc, y, 12.7);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...PDF_BRAND.primaryDark);
  doc.text('Notificas.com', cx, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text('Constancia técnica de notificación digital', cx, y, { align: 'center' });
  y += 4;
  drawPdfRuleMm(doc, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PDF_BRAND.textMain);
  const titleLines = doc.splitTextToSize(opts.documentTitle, PDF_MM.contentWidth);
  doc.text(titleLines, cx, y, { align: 'center' });
  y += titleLines.length * 5.2 + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMuted);
  for (const line of opts.lines || []) {
    const wrapped = doc.splitTextToSize(line, PDF_MM.contentWidth);
    doc.text(wrapped, cx, y, { align: 'center' });
    y += wrapped.length * 3.6 + 1;
  }
  y += 2;
  drawPdfRuleMm(doc, y);
  doc.setTextColor(...PDF_BRAND.textMain);
  return y + 8;
}

export function drawPdfFooterMm(
  doc: jsPDF,
  page: number,
  pageCount: number,
  line1: string,
  line2?: string
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const yRule = pageHeight - 20;
  drawPdfRuleMm(doc, yRule);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF_BRAND.textMuted);
  const maxW = PDF_MM.contentWidth;
  const l1 = doc.splitTextToSize(line1, maxW);
  doc.text(l1, pageWidth / 2, yRule + 4.2, { align: 'center' });
  const second = line2 || `Página ${page} de ${pageCount}`;
  const l2 = doc.splitTextToSize(second, maxW);
  doc.text(l2, pageWidth / 2, yRule + 4.2 + l1.length * 3.4, { align: 'center' });
}

export function stampPdfChromeMm(
  doc: jsPDF,
  opts: {
    pagesWithFirstHeader: number[];
    continueTitle: (page: number) => string;
    footerLine1: (page: number, pageCount: number) => string;
    footerLine2?: (page: number, pageCount: number) => string | undefined;
  }
) {
  const pageCount = doc.getNumberOfPages();
  const first = new Set(opts.pagesWithFirstHeader);
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    if (!first.has(page)) {
      drawPdfLetterheadMm(doc, {
        mode: 'continue',
        documentTitle: opts.continueTitle(page),
      });
    }
    drawPdfFooterMm(
      doc,
      page,
      pageCount,
      opts.footerLine1(page, pageCount),
      opts.footerLine2?.(page, pageCount)
    );
  }
}

export function drawSoftPanelMm(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...PDF_BRAND.bgSoft);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'FD');
}

export function drawWarnPanelMm(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...PDF_BRAND.warnBg);
  doc.rect(x, y, w, h, 'F');
}
