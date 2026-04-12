import { createHmac } from 'crypto'

function b64url(data: string): string {
  return Buffer.from(data).toString('base64url')
}

function b64urlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8')
}

export function signUnsubscribeToken(contactId: string, accountId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET is not set')

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ contactId, accountId, iat: Math.floor(Date.now() / 1000) }))
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

export function verifyUnsubscribeToken(token: string): { contactId: string; accountId: string } | null {
  try {
    const secret = process.env.UNSUBSCRIBE_SECRET
    if (!secret) return null

    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, payload, sig] = parts

    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
    if (sig !== expected) return null

    const data = JSON.parse(b64urlDecode(payload))
    if (!data.contactId || !data.accountId) return null
    return { contactId: data.contactId, accountId: data.accountId }
  } catch {
    return null
  }
}
