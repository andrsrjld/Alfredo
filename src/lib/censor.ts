const PHONE_MASK_START = 4
const PHONE_MASK_END = 4
const PHONE_MIN_LENGTH = 8

export function maskPhone(phone: string): string {
  if (phone.length < PHONE_MIN_LENGTH) return phone
  const visible = PHONE_MASK_START + PHONE_MASK_END
  if (phone.length <= visible) return phone
  const start = phone.slice(0, PHONE_MASK_START)
  const end = phone.slice(-PHONE_MASK_END)
  return start + '••••' + end
}

const REDACT_PATTERNS: Array<[RegExp, string]> = [
  [/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT REDACTED]'],
  [/glpat-[a-zA-Z0-9_-]+/g, 'glpat-[REDACTED]'],
  [/sk-[a-zA-Z0-9]{4,}/g, (match: string) => match.slice(0, 6) + '••••••' + match.slice(-3)],
  [/rk-[a-zA-Z0-9]{4,}/g, (match: string) => match.slice(0, 6) + '••••••' + match.slice(-3)],
  [/(?:password|passwd|pass|pwd|secret|token)=(\S+)/gi, '$1=[REDACTED]'],
  [/Bearer\s+(\S+)/gi, 'Bearer [REDACTED]'],
  [/(?:x-api-key|api-key|apikey)[\s:=]+(\S+)/gi, (match: string) => match.replace(/(\S+)$/, '[REDACTED]')],
  [/Authorization:\s*(\S+)/gi, 'Authorization: [REDACTED]'],
  [/BEGIN\s+(RSA|OPENSSH|EC)\s+PRIVATE\s+KEY[\s\S]*?END\s+\1\s+PRIVATE\s+KEY/gi, '[PRIVATE KEY REDACTED]'],
]

export function redactContent(text: string): string {
  let result = text
  for (const [pattern, replacement] of REDACT_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}
