export function downloadPromptTxt({ positive, negative, filenameBase = 'qwen-prompt' }) {
  const pos = (positive ?? '').trim()
  if (!pos) return false
  const neg = (negative ?? '').trim()
  const body = neg ? `${pos}\n\nNEGATIVE:\n${neg}` : pos
  const safe = String(filenameBase).replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'prompt'
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}.txt`
  a.click()
  URL.revokeObjectURL(url)
  return true
}
