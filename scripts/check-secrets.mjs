#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SECRET_KEY_RE = /(?:^|_)(?:SECRET|TOKEN|API_?KEY|SERVICE_?ROLE(?:_?KEY)?|PASSWORD|PASSWD|PRIVATE_?KEY|ACCESS_?KEY|PAT|ENCRYPTION_?KEY)(?:_|$)/i
const ASSIGNMENT_RE = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*[:=]\s*(.+?)\s*$/

const TOKEN_PATTERNS = [
  ['Private key block', /-----BEGIN (?:RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/],
  ['GitLab token', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['JWT-like token', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/],
]

const SAFE_VALUE_RE = /^(?:$|['"]?$|your[-_a-z0-9]*|change[-_a-z0-9]*|random[-_a-z0-9]*|example[-_a-z0-9]*|dummy[-_a-z0-9]*|test[-_a-z0-9]*|localhost|https?:\/\/(?:your-|example\.|localhost)|<[^>]+>|\{\{[^}]+\}\}|\$\{.+\}|process\.env\.[A-Z0-9_]+|undefined|null|true|false|0|1|eyJ\.\.\.|sk-\.\.\.|glpat-xxxx|alfredo_webhook_verify_token)/i
const SAFE_FILES = new Set([
  '.env.example',
  'docker.env.example',
])

function isBinary(buf) {
  return buf.includes(0)
}

function isSafeAssignment(file, key, rawValue) {
  const value = rawValue.trim().replace(/^['"]|['"]$/g, '')
  if (SAFE_FILES.has(file) && SAFE_VALUE_RE.test(value)) return true
  if (SAFE_VALUE_RE.test(value)) return true
  if (!SECRET_KEY_RE.test(key.replace(/-/g, '_'))) return true
  return false
}

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => !file.startsWith('docs/screenshots/'))
}

const findings = []

for (const file of trackedFiles()) {
  const buf = readFileSync(file)
  if (isBinary(buf)) continue
  const text = buf.toString('utf8')

  for (const [name, regex] of TOKEN_PATTERNS) {
    if (regex.test(text)) {
      findings.push({ file, line: 1, rule: name })
    }
  }

  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    const match = line.match(ASSIGNMENT_RE)
    if (!match) return
    const [, key, value] = match
    if (!isSafeAssignment(file, key, value)) {
      findings.push({ file, line: index + 1, rule: `Non-placeholder secret assignment: ${key}` })
    }
  })
}

if (findings.length > 0) {
  console.error('Potential secrets found in tracked files:')
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.rule}`)
  }
  process.exit(1)
}

console.log('No secret patterns found in tracked files.')
