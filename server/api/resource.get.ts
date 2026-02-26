import { defineEventHandler, getQuery, getHeader, createError } from 'h3'
import { createRemoteJWKSet, jwtVerify, jwtDecrypt } from 'jose'
import type { JWTVerifyOptions, JWTDecryptOptions } from 'jose'

const MAX_URL_LENGTH = 2048
const MAX_TOKEN_LENGTH = 16384
const MAX_SECRET_LENGTH = 512

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
  const secret = query.secret ? String(query.secret) : undefined
  const issuer = query.issuer ? String(query.issuer) : undefined
  const audience = query.audience ? String(query.audience) : undefined

  if (secret && secret.length > MAX_SECRET_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'secret exceeds maximum length' })
  }

  // Determine token format: JWS (3 parts) or JWE (5 parts)
  const parts = token.split('.')
  const isJWE = parts.length === 5
  const isJWS = parts.length === 3

  if (!isJWS && !isJWE) {
    throw createError({
      statusCode: 401,
      statusMessage: `The access token is not a valid JWT. Expected 3 parts (JWS) or 5 parts (JWE), got ${parts.length}. This is likely an opaque token. For Auth0, set the "audience" parameter in the Configure step to receive a JWT access token.`
    })
  }

  if (isJWE) {
    // JWE tokens require a symmetric secret for decryption
    if (!secret) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The access token is a JWE (encrypted JWT with 5 parts). A signing secret is required to decrypt it. Enter your API signing secret in the resource server settings. For Auth0, find this under Applications > APIs > your API > Signing Secret.'
      })
    }

    try {
      const secretKey = new TextEncoder().encode(secret)
      const decryptOptions: JWTDecryptOptions = {}
      if (issuer) decryptOptions.issuer = issuer
      if (audience) decryptOptions.audience = audience

      const { payload, protectedHeader } = await jwtDecrypt(token, secretKey, decryptOptions)

      return {
        status: 'ok',
        message: 'Access token decrypted and validated (JWE)',
        tokenFormat: 'JWE',
        header: protectedHeader,
        claims: payload
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'JWE decryption failed'
      throw createError({ statusCode: 401, statusMessage: `JWE decryption/validation failed: ${message}` })
    }
  }

  // JWS (signed JWT) — verify with JWKS
  if (!jwksUri) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required parameter: jwks_uri (needed for JWS signature verification)' })
  }

  if (jwksUri.length > MAX_URL_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'jwks_uri exceeds maximum length' })
  }

  // SSRF protection on JWKS URI
  const endpointCheck = await validateTokenEndpoint(jwksUri)
  if (!endpointCheck.valid) {
    throw createError({ statusCode: 400, statusMessage: `Blocked JWKS URI: ${endpointCheck.reason}` })
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(jwksUri))

    const verifyOptions: JWTVerifyOptions = {}
    if (issuer) verifyOptions.issuer = issuer
    if (audience) verifyOptions.audience = audience

    const { payload, protectedHeader } = await jwtVerify(token, JWKS, verifyOptions)

    return {
      status: 'ok',
      message: 'Access token signature verified (JWS)',
      tokenFormat: 'JWS',
      header: protectedHeader,
      claims: payload
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Token validation failed'
    throw createError({ statusCode: 401, statusMessage: `JWS verification failed: ${message}` })
  }
})
