import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

// CIDR ranges that should never be reached by the token proxy
const BLOCKED_IP_RANGES = [
  // Loopback (except localhost which is explicitly allowed for dev)
  { prefix: '127.', description: 'loopback' },
  // Private networks (RFC 1918)
  { prefix: '10.', description: 'private (10.x)' },
  { prefix: '192.168.', description: 'private (192.168.x)' },
  // 172.16.0.0 - 172.31.255.255
  { prefix: '172.', description: 'private (172.16-31.x)', check: (ip: string) => {
    const second = parseInt(ip.split('.')[1] ?? '0')
    return second >= 16 && second <= 31
  } },
  // Link-local
  { prefix: '169.254.', description: 'link-local / cloud metadata' },
  // IPv6 mapped/loopback
  { prefix: '::1', description: 'IPv6 loopback' },
  { prefix: '::ffff:127.', description: 'IPv6-mapped loopback' },
  { prefix: 'fc', description: 'IPv6 unique local' },
  { prefix: 'fd', description: 'IPv6 unique local' },
  { prefix: 'fe80:', description: 'IPv6 link-local' },
  // Cloud metadata endpoints
  { prefix: '100.100.100.200', description: 'Alibaba Cloud metadata' }
]

function isBlockedIp(ip: string): string | null {
  const normalized = ip.toLowerCase()
  for (const range of BLOCKED_IP_RANGES) {
    if (normalized.startsWith(range.prefix)) {
      if (range.check && !range.check(normalized)) continue
      return range.description
    }
  }
  // Block 0.0.0.0
  if (ip === '0.0.0.0' || ip === '::') {
    return 'unspecified address'
  }
  return null
}

/**
 * Validates that a token endpoint URL is safe to request.
 * Prevents SSRF by blocking private/reserved IP ranges.
 */
export async function validateTokenEndpoint(url: string): Promise<{ valid: true } | { valid: false, reason: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }

  // Must be HTTPS (except localhost for dev)
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    return { valid: false, reason: 'Token endpoint must use HTTPS' }
  }

  // Block non-standard ports that might target internal services
  // Allow: 443 (default HTTPS), 80 (default HTTP), no port specified, common dev ports
  const allowedPorts = ['', '80', '443', '3000', '8080', '8443']
  if (parsed.port && !allowedPorts.includes(parsed.port)) {
    return { valid: false, reason: `Port ${parsed.port} is not allowed` }
  }

  // Allow localhost for local development without DNS check
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    return { valid: true }
  }

  // If hostname is a raw IP, check it directly
  if (isIP(parsed.hostname)) {
    const blocked = isBlockedIp(parsed.hostname)
    if (blocked) {
      return { valid: false, reason: `Blocked: ${blocked} address` }
    }
    return { valid: true }
  }

  // Resolve hostname and check all returned IPs
  try {
    const results = await lookup(parsed.hostname, { all: true })
    for (const result of results) {
      const blocked = isBlockedIp(result.address)
      if (blocked) {
        return { valid: false, reason: `Hostname resolves to blocked ${blocked} address` }
      }
    }
  } catch {
    return { valid: false, reason: 'Could not resolve hostname' }
  }

  return { valid: true }
}
