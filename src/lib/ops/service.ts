import { createAdminClient } from '@/lib/supabase/admin'
import {
  canUseOpsCommand,
  formatOpsPermissionDenied,
  formatPendingConfirmation,
  parseOpsCommand,
  sanitizeCommandOutput,
  type OpsAction,
  type OpsRole,
  type OpsTargetType,
} from './commands'

export type WhitelistOpsIdentity = {
  phone_number: string
  pm_name?: string | null
  ops_role?: OpsRole | string | null
}

type OpsCommandRow = {
  id: string
  requester_phone: string
  requester_name: string | null
  requester_role: OpsRole
  server_name: string
  target_type: OpsTargetType
  target_name: string | null
  action: OpsAction
  status: string
  tail: number | null
  confirmation_expires_at: string | null
  output: string | null
  error: string | null
  requested_at: string
  confirmed_at: string | null
  started_at: string | null
  finished_at: string | null
}

type AgentCommand = {
  id: string
  action: OpsAction
  target_type: OpsTargetType
  target_name: string | null
  tail: number | null
  timeout_seconds: number
}

type ServicePayload = {
  name?: string
  description?: string
  load_state?: string
  active_state?: string
  sub_state?: string
}

const CONFIRMATION_TTL_MS = 5 * 60 * 1000
const WAIT_FOR_RESULT_MS = 20_000
const WAIT_INTERVAL_MS = 1_000
const COMMAND_TIMEOUT_SECONDS = 30

function noStoreHeaders() {
  return { 'Cache-Control': 'no-store' }
}

export const OPS_NO_STORE_HEADERS = noStoreHeaders()

function toWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function isTerminal(status: string): boolean {
  return ['succeeded', 'failed', 'cancelled', 'expired'].includes(status)
}

function formatResult(row: OpsCommandRow): string {
  const label = `${row.action} ${row.target_type}${row.target_name ? ` ${row.target_name}` : ''} di ${row.server_name}`
  if (row.status === 'succeeded') {
    const output = sanitizeCommandOutput(row.output || 'Command selesai tanpa output.')
    return `Halo! 🤖 ${label} berhasil.\n\n${output}`
  }
  if (row.status === 'failed') {
    const error = sanitizeCommandOutput(row.error || row.output || 'Command gagal tanpa detail error.')
    return `Halo! 🤖 ${label} gagal.\n\n${error}`
  }
  if (row.status === 'cancelled') {
    return `Halo! 🤖 Command ${row.id} sudah dibatalkan.`
  }
  if (row.status === 'expired') {
    return `Halo! 🤖 Konfirmasi command ${row.id} sudah kedaluwarsa. Silakan kirim command baru jika masih diperlukan.`
  }
  return `Halo! 🤖 Command ${row.id} masih diproses oleh agent server ${row.server_name}. Cek dashboard untuk status terbaru.`
}

async function waitForCommandResult(commandId: string): Promise<OpsCommandRow | null> {
  const supabase = createAdminClient()
  const deadline = Date.now() + WAIT_FOR_RESULT_MS
  while (Date.now() < deadline) {
    const { data } = await supabase
      .from('ops_commands')
      .select('*')
      .eq('id', commandId)
      .maybeSingle()
    const row = data as OpsCommandRow | null
    if (row && isTerminal(row.status)) return row
    await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL_MS))
  }
  return null
}

async function ensureServerExists(serverName: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('server_status')
    .select('server_name')
    .eq('server_name', serverName)
    .maybeSingle()
  return !!data
}

async function ensureKnownTarget(serverName: string, targetType: OpsTargetType, targetName: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = createAdminClient()
  if (targetType === 'container') {
    const { data } = await supabase
      .from('container_status')
      .select('container_name')
      .eq('server_name', serverName)
      .eq('container_name', targetName)
      .maybeSingle()
    return data ? { ok: true } : { ok: false, reason: `Container ${targetName} belum tercatat di server ${serverName}.` }
  }

  const { data } = await supabase
    .from('server_services')
    .select('service_name,is_allowed')
    .eq('server_name', serverName)
    .eq('service_name', targetName)
    .maybeSingle()
  if (!data) return { ok: false, reason: `Service ${targetName} belum terdeteksi di server ${serverName}.` }
  if (data.is_allowed !== true) return { ok: false, reason: `Service ${targetName} belum diizinkan untuk ops command dari dashboard.` }
  return { ok: true }
}

async function insertOpsCommand(params: {
  identity: WhitelistOpsIdentity
  serverName: string
  targetType: OpsTargetType
  targetName: string | null
  action: OpsAction
  tail: number | null
  mutating: boolean
}): Promise<OpsCommandRow> {
  const supabase = createAdminClient()
  const expiresAt = params.mutating
    ? new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString()
    : null
  const status = params.mutating ? 'pending_confirmation' : 'queued'
  const { data, error } = await supabase
    .from('ops_commands')
    .insert({
      requester_phone: params.identity.phone_number,
      requester_name: params.identity.pm_name || null,
      requester_role: params.identity.ops_role || 'viewer',
      server_name: params.serverName,
      target_type: params.targetType,
      target_name: params.targetName,
      action: params.action,
      status,
      tail: params.tail,
      confirmation_expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as OpsCommandRow
}

async function queueConfirmedCommand(commandId: string, identity: WhitelistOpsIdentity): Promise<OpsCommandRow | null> {
  const supabase = createAdminClient()
  const { data: existing, error: readError } = await supabase
    .from('ops_commands')
    .select('*')
    .eq('id', commandId)
    .eq('requester_phone', identity.phone_number)
    .maybeSingle()
  if (readError) throw new Error(readError.message)
  const row = existing as OpsCommandRow | null
  if (!row) return null

  if (row.status !== 'pending_confirmation') return row
  if (!row.confirmation_expires_at || new Date(row.confirmation_expires_at).getTime() < Date.now()) {
    const { data } = await supabase
      .from('ops_commands')
      .update({ status: 'expired', finished_at: new Date().toISOString() })
      .eq('id', commandId)
      .select()
      .single()
    return data as OpsCommandRow
  }

  const { data, error } = await supabase
    .from('ops_commands')
    .update({ status: 'queued', confirmed_at: new Date().toISOString() })
    .eq('id', commandId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as OpsCommandRow
}

export async function handleOpsMessage(text: string, identity: WhitelistOpsIdentity): Promise<{ handled: boolean; reply?: string }> {
  if (!text.trim().toLowerCase().startsWith('/ops')) return { handled: false }
  const parsed = parseOpsCommand(text)
  const role = identity.ops_role || 'viewer'

  if (parsed.kind === 'invalid') {
    return { handled: true, reply: `Halo! 🤖 Format command ops belum sesuai (${parsed.reason}). Gunakan /ops <server> containers atau /ops <server> logs container <nama>.` }
  }

  if (parsed.kind === 'cancel') {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('ops_commands')
      .update({ status: 'cancelled', finished_at: new Date().toISOString() })
      .eq('id', parsed.commandId)
      .eq('requester_phone', identity.phone_number)
      .eq('status', 'pending_confirmation')
      .select()
      .maybeSingle()
    return { handled: true, reply: data ? `Halo! 🤖 Command ${parsed.commandId} dibatalkan.` : `Halo! 🤖 Command ${parsed.commandId} tidak ditemukan atau tidak bisa dibatalkan.` }
  }

  if (parsed.kind === 'confirm') {
    const permission = canUseOpsCommand(role, true)
    if (!permission.ok) return { handled: true, reply: formatOpsPermissionDenied(permission.reason) }
    const queued = await queueConfirmedCommand(parsed.commandId, identity)
    if (!queued) return { handled: true, reply: `Halo! 🤖 Command ${parsed.commandId} tidak ditemukan untuk nomor ini.` }
    if (isTerminal(queued.status)) return { handled: true, reply: formatResult(queued) }
    const result = await waitForCommandResult(queued.id)
    return { handled: true, reply: result ? formatResult(result) : formatResult(queued) }
  }

  const permission = canUseOpsCommand(role, parsed.mutating)
  if (!permission.ok) return { handled: true, reply: formatOpsPermissionDenied(permission.reason) }

  const serverExists = await ensureServerExists(parsed.serverName)
  if (!serverExists) {
    return { handled: true, reply: `Halo! 🤖 Server ${parsed.serverName} belum terdaftar di Alfredo.` }
  }

  if (parsed.targetName) {
    const target = await ensureKnownTarget(parsed.serverName, parsed.targetType, parsed.targetName)
    if (!target.ok) return { handled: true, reply: `Halo! 🤖 ${target.reason}` }
  }

  const command = await insertOpsCommand({
    identity,
    serverName: parsed.serverName,
    targetType: parsed.targetType,
    targetName: parsed.targetName,
    action: parsed.action,
    tail: parsed.tail,
    mutating: parsed.mutating,
  })

  if (command.status === 'pending_confirmation') {
    return {
      handled: true,
      reply: formatPendingConfirmation({
        id: command.id,
        action: command.action,
        targetType: command.target_type,
        targetName: command.target_name || '-',
        serverName: command.server_name,
        expiresAtWib: toWIB(command.confirmation_expires_at!),
      }),
    }
  }

  const result = await waitForCommandResult(command.id)
  return { handled: true, reply: result ? formatResult(result) : formatResult(command) }
}

export async function authenticateAgent(secret: string | null): Promise<string | null> {
  if (!secret) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('server_status')
    .select('server_name')
    .eq('ping_secret', secret)
    .maybeSingle()
  return data?.server_name || null
}

export async function claimNextAgentCommand(serverName: string): Promise<AgentCommand | null> {
  const supabase = createAdminClient()
  const { data: rows, error } = await supabase
    .from('ops_commands')
    .select('*')
    .eq('server_name', serverName)
    .eq('status', 'queued')
    .order('requested_at', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  const row = (rows?.[0] || null) as OpsCommandRow | null
  if (!row) return null

  const { data: claimed, error: updateError } = await supabase
    .from('ops_commands')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('status', 'queued')
    .select()
    .maybeSingle()
  if (updateError) throw new Error(updateError.message)
  if (!claimed) return null

  const command = claimed as OpsCommandRow
  return {
    id: command.id,
    action: command.action,
    target_type: command.target_type,
    target_name: command.target_name,
    tail: command.tail,
    timeout_seconds: COMMAND_TIMEOUT_SECONDS,
  }
}

export async function recordAgentResult(params: {
  commandId: string
  serverName: string
  ok: boolean
  output?: string | null
  error?: string | null
}) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('ops_commands')
    .update({
      status: params.ok ? 'succeeded' : 'failed',
      output: sanitizeCommandOutput(params.output),
      error: sanitizeCommandOutput(params.error),
      finished_at: new Date().toISOString(),
    })
    .eq('id', params.commandId)
    .eq('server_name', params.serverName)
  if (error) throw new Error(error.message)
}

export async function recordServiceDiscovery(serverName: string, services: ServicePayload[]) {
  const rows = services
    .filter(service => service.name)
    .map(service => ({
      server_name: serverName,
      service_name: service.name!,
      description: service.description || null,
      load_state: service.load_state || null,
      active_state: service.active_state || null,
      sub_state: service.sub_state || null,
      last_seen: new Date().toISOString(),
    }))
  if (rows.length === 0) return

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('server_services')
    .upsert(rows, { onConflict: 'server_name,service_name' })
  if (error) throw new Error(error.message)
}
