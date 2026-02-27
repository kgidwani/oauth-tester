import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import { createLocalJWKSet, jwtVerify, jwtDecrypt } from 'jose'
import type { JWTVerifyOptions, JWTDecryptOptions } from 'jose'

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

  // Read body
  const body = await readBody(event)
  const jwks = body?.jwks as { keys: Array<Record<string, unknown>> } | undefined
  const secret = typeof body?.secret === 'string' ? body.secret : undefined
  const issuer = typeof body?.issuer === 'string' ? body.issuer : undefined
  const audience = typeof body?.audience === 'string' ? body.audience : undefined

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
    if (!secret) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The access token is a JWE (encrypted JWT with 5 parts). A signing secret is required to decrypt it.'
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

  // JWS — verify with locally cached JWKS (no network call)
  if (!jwks?.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Missing JWKS keys. Fetch and cache the provider\'s JWKS in the JWKS step first.' })
  }

  try {
    const localJWKS = createLocalJWKSet(jwks as { keys: Array<Record<string, unknown>> })

    const verifyOptions: JWTVerifyOptions = {}
    if (issuer) verifyOptions.issuer = issuer
    if (audience) verifyOptions.audience = audience

    const { payload, protectedHeader } = await jwtVerify(token, localJWKS, verifyOptions)

    return {
      status: 'ok',
      message: 'Access token signature verified offline (JWS) — no network call made',
      tokenFormat: 'JWS',
      header: protectedHeader,
      claims: payload
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Token validation failed'
    throw createError({ statusCode: 401, statusMessage: `JWS verification failed: ${message}` })
  }
})
