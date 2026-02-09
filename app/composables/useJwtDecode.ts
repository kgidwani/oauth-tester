import type { DecodedJwt } from '~/types/oauth'

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad) {
    base64 += '='.repeat(4 - pad)
  }
  return atob(base64)
}

const TIMESTAMP_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at'])

export function useJwtDecode() {
  function decodeJwt(token: string): DecodedJwt | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null

      const header = JSON.parse(base64UrlDecode(parts[0]!))
      const payload = JSON.parse(base64UrlDecode(parts[1]!))
      const signature = parts[2]!

      return { header, payload, signature, raw: token }
    } catch {
      return null
    }
  }

  function isJwt(token: string): boolean {
    if (!token) return false
    const parts = token.split('.')
    if (parts.length !== 3) return false
    try {
      JSON.parse(base64UrlDecode(parts[0]!))
      JSON.parse(base64UrlDecode(parts[1]!))
      return true
    } catch {
      return false
    }
  }

  function formatTimestamp(value: unknown): string | null {
    if (typeof value !== 'number') return null
    try {
      return new Date(value * 1000).toISOString()
    } catch {
      return null
    }
  }

  function isTimestampClaim(key: string): boolean {
    return TIMESTAMP_CLAIMS.has(key)
  }

  return { decodeJwt, isJwt, formatTimestamp, isTimestampClaim }
}
