import { defineEventHandler, getQuery, getHeader, createError } from 'h3'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { JWTVerifyOptions } from 'jose'

const MAX_URL_LENGTH = 2048
const MAX_TOKEN_LENGTH = 8192

export default defineEventHandler(async (event) => {
  // Rate limiting
  const rateLimited = checkRateLimit(event)
  if (rateLimited) {
    event.node.res.setHeader('Retry-After', String(rateLimited.retryAfterSeconds))
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Retry after ${rateLimited.retryAfterSeconds} seconds.`
    })
  }

  // Extract Bearer token
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Missing or invalid Authorization header. Expected: Bearer <token>' })
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Bearer token is empty' })
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    throw createError({ statusCode: 401, statusMessage: 'Token exceeds maximum length' })
  }

  // Read query params
  const query = getQuery(event)
  const jwksUri = String(query.jwks_uri || '')
  const issuer = query.issuer ? String(query.issuer) : undefined
  const audience = query.audience ? String(query.audience) : undefined

  if (!jwksUri) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required query parameter: jwks_uri' })
  }

  if (jwksUri.length > MAX_URL_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'jwks_uri exceeds maximum length' })
  }

  // SSRF protection on JWKS URI
  const endpointCheck = await validateTokenEndpoint(jwksUri)
  if (!endpointCheck.valid) {
    throw createError({ statusCode: 400, statusMessage: `Blocked JWKS URI: ${endpointCheck.reason}` })
  }

  // Check that the token looks like a JWT (3 non-empty base64url-encoded parts separated by dots)
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw createError({
      statusCode: 401,
      statusMessage: `The access token is not a JWT (expected 3 dot-separated parts, got ${parts.length}). This is likely an opaque token. For Auth0, set the "audience" parameter in the Configure step to receive a JWT access token.`
    })
  }
  const emptyParts = parts.map((p, i) => p.length === 0 ? i : -1).filter(i => i >= 0)
  if (emptyParts.length > 0) {
    const labels = ['header', 'payload', 'signature']
    const emptyLabels = emptyParts.map(i => labels[i]).join(', ')
    throw createError({
      statusCode: 401,
      statusMessage: `Malformed JWT: empty segment(s) at position(s) ${emptyParts.join(', ')} (${emptyLabels}). Part lengths: [${parts.map(p => p.length).join(', ')}]. Token starts with: "${token.substring(0, 40)}"`
    })
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(jwksUri))

    const verifyOptions: JWTVerifyOptions = {}
    if (issuer) verifyOptions.issuer = issuer
    if (audience) verifyOptions.audience = audience

    const { payload, protectedHeader } = await jwtVerify(token, JWKS, verifyOptions)

    return {
      status: 'ok',
      message: 'Access token is valid',
      header: protectedHeader,
      claims: payload
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Token validation failed'
    const code = e && typeof e === 'object' && 'code' in e ? String((e as Record<string, unknown>).code) : undefined

    // Surface diagnostic info for debugging
    const tokenPreview = `${token.substring(0, 30)}...${token.substring(token.length - 10)}`
    const detail = [
      message,
      code ? `(code: ${code})` : '',
      `| token length: ${token.length}`,
      `| token preview: ${tokenPreview}`,
      `| jwks_uri: ${jwksUri}`
    ].filter(Boolean).join(' ')

    throw createError({ statusCode: 401, statusMessage: detail })
  }
})
