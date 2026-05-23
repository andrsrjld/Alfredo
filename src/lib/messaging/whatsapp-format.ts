export function markdownToWhatsApp(text: string): string {
  // Prevent tampering with code blocks — save and restore
  const codeBlocks: string[] = []
  const inlineCodes: string[] = []

  const placeholder = (arr: string[], prefix: string) => (match: string) => {
    arr.push(match)
    return prefix + (arr.length - 1) + prefix
  }

  let out = text

  // Preserve fenced code blocks ```...```
  out = out.replace(/```[\s\S]*?```/g, placeholder(codeBlocks, '\x00CBLOCK'))
  // Preserve inline code `...`
  out = out.replace(/`[^`]+`/g, placeholder(inlineCodes, '\x00INLINE'))

  // Strikethrough ~~...~~
  out = out.replace(/~~(.+?)~~/g, '~$1~')

  // Bold **...**
  out = out.replace(/\*\*(.+?)\*\*/g, '*$1*')

  // Italic *...* (single asterisk, avoid conflicts with bullets)
  // We only convert when surrounded by non-space on both sides or not at line start
  out = out.replace(/(?<!\*)\*(?!\s)([^\n*]+?)(?<!\s)\*(?!\*)/g, '_$1_')

  // Links [text](url) → text: url
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2')

  // Headers # ... → *...*
  out = out.replace(/^#{1,6}\s+(.+)$/gm, '*$1*')

  // Blockquotes > ... → italic _..._
  out = out.replace(/^>\s*(.+)$/gm, '_$1_')

  // Horizontal rules ---- / ==== / **** / ____ → strip (just a newline)
  out = out.replace(/^[\-=\*_]{3,}\s*$/gm, '')

  // Tables
  // Simple approach: replace table rows with bullet points, bold first cell
  // Detect table lines: starts/ends with |
  const lines = out.split('\n')
  const resultLines: string[] = []
  let inTable = false
  let tableRows: string[] = []

  const flushTable = () => {
    if (tableRows.length === 0) return
    // Heuristic: first row may be header, second may be separator, rest data
    const start = tableRows[0].trim().startsWith('|') ? 1 : 0
    const sepIdx = tableRows.findIndex(l => /^\|[\s\-:|]+\|\s*$/.test(l))
    const headerRow = sepIdx >= 0 ? tableRows[sepIdx - 1] : tableRows[0]
    const dataRows = sepIdx >= 0 ? tableRows.slice(sepIdx + 1) : tableRows.slice(start + 1)

    const headerCells = headerRow.split('|').map(c => c.trim()).filter(Boolean)
    for (const row of dataRows) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length === 0) continue
      // Pair header with cell if possible
      const parts: string[] = []
      for (let i = 0; i < cells.length; i++) {
        const h = headerCells[i] || `Col${i + 1}`
        parts.push(`*${h}:* ${cells[i]}`)
      }
      resultLines.push('• ' + parts.join(' | '))
    }
    tableRows = []
    inTable = false
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true
      tableRows.push(line)
    } else {
      if (inTable) flushTable()
      resultLines.push(line)
    }
  }
  if (inTable) flushTable()
  out = resultLines.join('\n')

  // Restore code blocks / inline
  out = out.replace(/\x00CBLOCK(\d+)\x00CBLOCK/g, (_, i) => codeBlocks[Number(i)])
  out = out.replace(/\x00INLINE(\d+)\x00INLINE/g, (_, i) => inlineCodes[Number(i)])

  return out.trim()
}
