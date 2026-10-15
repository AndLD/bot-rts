// A cell that starts like a formula would be run by a spreadsheet, so it is made plain text
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text

  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const csvRow = (values: readonly unknown[]): string => values.map(csvCell).join(',')

// A header and rows as CSV text, one line per row
export function toCsv(header: readonly string[], rows: ReadonlyArray<readonly unknown[]>): string {
  return `${[csvRow(header), ...rows.map(csvRow)].join('\n')}\n`
}
