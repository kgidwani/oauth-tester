import type { PkceState } from '~/types/oauth'

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]!)
  }
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateRandomString(byteLength: number): string {
  const array = new Uint8Array(byteLength)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

async function sha256(plain: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hash)
}

export function usePkce() {
  async function generatePkce(): Promise<PkceState> {
    const codeVerifier = generateRandomString(32)
    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64UrlEncode(hashed)
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    }
  }

  return { generatePkce }
}
