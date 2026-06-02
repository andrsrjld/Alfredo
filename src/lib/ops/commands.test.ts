import { describe, expect, it } from 'vitest'
import {
  canUseOpsCommand,
  formatPendingConfirmation,
  parseOpsCommand,
  sanitizeCommandOutput,
} from './commands'

describe('parseOpsCommand', () => {
  it('parses container list command', () => {
    expect(parseOpsCommand('/ops prod containers')).toEqual({
      kind: 'run',
      serverName: 'prod',
      action: 'list',
      targetType: 'container',
      targetName: null,
      tail: null,
      mutating: false,
    })
  })

  it('parses bounded container log tail command', () => {
    expect(parseOpsCommand('/ops prod logs container nginx tail=999')).toEqual({
      kind: 'run',
      serverName: 'prod',
      action: 'logs',
      targetType: 'container',
      targetName: 'nginx',
      tail: 500,
      mutating: false,
    })
  })

  it('parses mutating service restart command', () => {
    expect(parseOpsCommand('/ops prod restart service nginx.service')).toEqual({
      kind: 'run',
      serverName: 'prod',
      action: 'restart',
      targetType: 'service',
      targetName: 'nginx.service',
      tail: null,
      mutating: true,
    })
  })

  it('parses confirmation commands', () => {
    expect(parseOpsCommand('/ops confirm 123e4567-e89b-12d3-a456-426614174000')).toEqual({
      kind: 'confirm',
      commandId: '123e4567-e89b-12d3-a456-426614174000',
    })
  })
})

describe('canUseOpsCommand', () => {
  it('denies viewers from ops commands', () => {
    expect(canUseOpsCommand('viewer', false)).toEqual({
      ok: false,
      reason: 'ops_not_allowed',
    })
  })

  it('allows operators to run read-only commands only', () => {
    expect(canUseOpsCommand('operator', false)).toEqual({ ok: true })
    expect(canUseOpsCommand('operator', true)).toEqual({
      ok: false,
      reason: 'mutating_requires_admin',
    })
  })

  it('allows admins to run mutating commands', () => {
    expect(canUseOpsCommand('admin', true)).toEqual({ ok: true })
  })
})

describe('formatPendingConfirmation', () => {
  it('includes exact command target and confirm instruction', () => {
    expect(formatPendingConfirmation({
      id: 'cmd-1',
      action: 'restart',
      targetType: 'container',
      targetName: 'nginx',
      serverName: 'prod',
      expiresAtWib: '2 Jun 2026 10.10 WIB',
    })).toContain('/ops confirm cmd-1')
  })
})

describe('sanitizeCommandOutput', () => {
  it('truncates command output to 8KB', () => {
    const output = 'x'.repeat(9000)
    expect(sanitizeCommandOutput(output).length).toBeLessThanOrEqual(8192)
  })
})
