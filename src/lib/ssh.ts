import { Client, type ConnectConfig } from 'ssh2'

export type SshCredentials = {
  host: string
  port: number
  username: string
  privateKey?: string | null
  passphrase?: string | null
  password?: string | null
}

export type SshExecResult = {
  code: number
  stdout: string
  stderr: string
}

const SSH_TIMEOUT_MS = 20_000
const SSH_OUTPUT_LIMIT = 12_000

function truncate(value: string): string {
  if (value.length <= SSH_OUTPUT_LIMIT) return value
  return `${value.slice(0, SSH_OUTPUT_LIMIT - 40)}\n...[output truncated]`
}

function getConnectConfig(credentials: SshCredentials): ConnectConfig {
  return {
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
    privateKey: credentials.privateKey || undefined,
    passphrase: credentials.passphrase || undefined,
    password: credentials.password || undefined,
    readyTimeout: SSH_TIMEOUT_MS,
  }
}

export function execSsh(credentials: SshCredentials, command: string): Promise<SshExecResult> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      client.end()
      reject(new Error('SSH command timed out'))
    }, SSH_TIMEOUT_MS)

    client
      .on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout)
            client.end()
            reject(err)
            return
          }
          let stdout = ''
          let stderr = ''
          stream
            .on('close', (code: number) => {
              if (settled) return
              settled = true
              clearTimeout(timeout)
              client.end()
              resolve({ code, stdout: truncate(stdout), stderr: truncate(stderr) })
            })
            .on('data', (chunk: Buffer) => {
              stdout += chunk.toString('utf8')
            })
          stream.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8')
          })
        })
      })
      .on('error', err => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        reject(err)
      })
      .connect(getConnectConfig(credentials))
  })
}
