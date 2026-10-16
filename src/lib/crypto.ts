/**
 * AES-256-GCM for third-party tokens at rest.
 *
 * Strava access and refresh tokens are credentials for someone's account.
 * They are encrypted before they touch the database and decrypted only inside
 * the Strava client — never returned by an API route, never sent to a browser.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const VERSION = 'v1'

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes.')
  return buf
}

/** → "v1:<iv>:<authTag>:<ciphertext>", all base64. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':')
}

export function decrypt(payload: string): string {
  const [version, iv, authTag, ciphertext] = payload.split(':')
  if (version !== VERSION || !iv || !authTag || !ciphertext) {
    throw new Error('Malformed encrypted payload.')
  }
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')
}
