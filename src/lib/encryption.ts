import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function getKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY env var is not set')
  }
  return Buffer.from(encryptionKey, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  const result = {
    iv: iv.toString('hex'),
    data: encrypted,
    tag: authTag.toString('hex'),
  }
  return Buffer.from(JSON.stringify(result)).toString('base64')
}

export function decrypt(encryptedBase64: string): string {
  const key = getKey()
  const json = JSON.parse(Buffer.from(encryptedBase64, 'base64').toString('utf8'))
  const iv = Buffer.from(json.iv, 'hex')
  const authTag = Buffer.from(json.tag, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(json.data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••'
  return key.slice(0, 4) + '••••' + key.slice(-4)
}