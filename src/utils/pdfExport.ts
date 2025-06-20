import jsPDF from 'jspdf'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – missing types
import autoTable from 'jspdf-autotable'

/**
 * Export tabular data to PDF.
 * @param title Document title
 * @param headers Column headers
 * @param rows    2-dimensional array of cell values
 * @param opts    Options for customizing the PDF
 */
export function exportToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  opts: {
    subtitle?: string
    printedAt?: string
    logoBase64?: string
    footer?: string
  } = {}
) {
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })

  const margin = 40
  let currentY = margin

  // logo
  if (opts.logoBase64) {
    const logoW = 60
    const pageW = doc.internal.pageSize.getWidth()
    const x = pageW - margin - logoW      // posisi kanan
    doc.addImage(opts.logoBase64, 'PNG', x, currentY - 10, logoW, 60)
    // currentY tidak berubah karena judul di kiri
  }

  doc.setFontSize(16)
  doc.text(title, margin, currentY)
  currentY += 18

  if (opts.subtitle) {
    doc.setFontSize(12)
    doc.text(opts.subtitle, margin, currentY)
    currentY += 14
  }

  if (opts.printedAt) {
    doc.setFontSize(10)
    doc.text(opts.printedAt, margin, currentY)
    currentY += 14
  }

  // generate table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: currentY + 6,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [99, 102, 241] },
  })

  if (opts.footer) {
    const pageHeight = doc.internal.pageSize.height || (doc as any).internal.pageSize.getHeight()
    doc.setFontSize(10)
    doc.text(opts.footer, margin, pageHeight - 20)
  }

  const fileName = `${title.replace(/\s+/g, '_').toLowerCase()}_${new Date()
    .toISOString()
    .split('T')[0]}.pdf`
  doc.save(fileName)
}
