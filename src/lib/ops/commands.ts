export type OpsRole = 'viewer' | 'operator' | 'admin'
export type OpsAction = 'list' | 'logs' | 'status' | 'start' | 'stop' | 'restart'
export type OpsTargetType = 'container' | 'service'

export type ParsedOpsCommand =
  | {
      kind: 'run'
      serverName: string
      action: OpsAction
      targetType: OpsTargetType
      targetName: string | null
      tail: number | null
      mutating: boolean
    }
  | { kind: 'confirm'; commandId: string }
  | { kind: 'cancel'; commandId: string }
  | { kind: 'invalid'; reason: string }

export type OpsPermission =
  | { ok: true }
  | { ok: false; reason: 'ops_not_allowed' | 'mutating_requires_admin' }

const MUTATING_ACTIONS = new Set<OpsAction>(['start', 'stop', 'restart'])
const READ_ACTIONS = new Set<OpsAction>(['list', 'logs', 'status'])
const MAX_TAIL = 500
const DEFAULT_TAIL = 200
const MAX_OUTPUT_BYTES = 8192

function cleanToken(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('/')) return null
  return trimmed
}

function parseTail(tokens: string[]): number | null {
  const tailToken = tokens.find(token => /^tail=\d+$/i.test(token))
  if (!tailToken) return null
  const value = Number(tailToken.split('=')[1])
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TAIL
  return Math.min(MAX_TAIL, Math.floor(value))
}

export function parseOpsCommand(input: string): ParsedOpsCommand {
  const tokens = input.trim().split(/\s+/)
  if (tokens[0]?.toLowerCase() !== '/ops') {
    return { kind: 'invalid', reason: 'not_ops_command' }
  }

  const subcommand = tokens[1]?.toLowerCase()
  if (subcommand === 'confirm') {
    const commandId = cleanToken(tokens[2])
    return commandId ? { kind: 'confirm', commandId } : { kind: 'invalid', reason: 'missing_command_id' }
  }
  if (subcommand === 'cancel') {
    const commandId = cleanToken(tokens[2])
    return commandId ? { kind: 'cancel', commandId } : { kind: 'invalid', reason: 'missing_command_id' }
  }

  const serverName = cleanToken(tokens[1])
  if (!serverName) return { kind: 'invalid', reason: 'missing_server' }

  const verb = tokens[2]?.toLowerCase()
  if (verb === 'containers') {
    return {
      kind: 'run',
      serverName,
      action: 'list',
      targetType: 'container',
      targetName: null,
      tail: null,
      mutating: false,
    }
  }
  if (verb === 'services') {
    return {
      kind: 'run',
      serverName,
      action: 'list',
      targetType: 'service',
      targetName: null,
      tail: null,
      mutating: false,
    }
  }

  if (!['logs', 'status', 'start', 'stop', 'restart'].includes(verb || '')) {
    return { kind: 'invalid', reason: 'unsupported_action' }
  }

  const action = verb as OpsAction
  const targetType = tokens[3]?.toLowerCase() as OpsTargetType | undefined
  if (targetType !== 'container' && targetType !== 'service') {
    return { kind: 'invalid', reason: 'unsupported_target_type' }
  }

  if (action === 'logs' && targetType !== 'container') {
    return { kind: 'invalid', reason: 'logs_only_support_container' }
  }

  const targetName = cleanToken(tokens[4])
  if (!targetName) return { kind: 'invalid', reason: 'missing_target_name' }

  const knownAction = action === 'logs' || READ_ACTIONS.has(action) || MUTATING_ACTIONS.has(action)
  if (!knownAction) return { kind: 'invalid', reason: 'unsupported_action' }

  return {
    kind: 'run',
    serverName,
    action,
    targetType,
    targetName,
    tail: action === 'logs' ? parseTail(tokens.slice(5)) || DEFAULT_TAIL : null,
    mutating: MUTATING_ACTIONS.has(action),
  }
}

export function canUseOpsCommand(role: OpsRole | string | null | undefined, mutating: boolean): OpsPermission {
  if (role !== 'operator' && role !== 'admin') {
    return { ok: false, reason: 'ops_not_allowed' }
  }
  if (mutating && role !== 'admin') {
    return { ok: false, reason: 'mutating_requires_admin' }
  }
  return { ok: true }
}

export function formatPendingConfirmation(command: {
  id: string
  action: OpsAction
  targetType: OpsTargetType
  targetName: string
  serverName: string
  expiresAtWib: string
}): string {
  return [
    `Halo! 🤖 Konfirmasi diperlukan sebelum menjalankan ${command.action} ${command.targetType} ${command.targetName} di server ${command.serverName}.`,
    `Kirim /ops confirm ${command.id} sebelum ${command.expiresAtWib}.`,
    `Untuk membatalkan, kirim /ops cancel ${command.id}.`,
  ].join('\n')
}

export function sanitizeCommandOutput(output: string | null | undefined): string {
  const text = output || ''
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.length <= MAX_OUTPUT_BYTES) return text
  return `${bytes.subarray(0, MAX_OUTPUT_BYTES - 40).toString('utf8')}\n...[output truncated]`
}

export function formatOpsPermissionDenied(reason: OpsPermission extends infer T ? T extends { ok: false; reason: infer R } ? R : never : never): string {
  if (reason === 'mutating_requires_admin') {
    return 'Halo! 🤖 Perintah ini membutuhkan role admin karena dapat mengubah kondisi server.'
  }
  return 'Halo! 🤖 Nomor ini belum memiliki akses ops command. Hubungi admin Alfredo untuk menaikkan role whitelist.'
}
