import { defineEventHandler, readBody, createError } from 'h3'

const MAX_URL_LENGTH = 2048
const FETCH_TIMEOUT_MS = 10_000
const MAX_RESPONSE_SIZE = 512 * 1024

export default defineEventHandler(async (event) => {
  const rateLimited = checkRateLimit(event)
  if (rateLimited) {
    event.node.res.setHeader('Retry-After', String(rateLimited.retryAfterSeconds))
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Retry after ${rateLimited.retryAfterSeconds} seconds.`
    })
  }

  const body = await readBody(event)
  const wellKnownUrl = typeof body?.wellKnownUrl === 'string' ? body.wellKnownUrl.trim() : ''

  if (!wellKnownUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required field: wellKnownUrl' })
  }
  if (wellKnownUrl.length > MAX_URL_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: 'wellKnownUrl exceeds maximum length' })
  }

  // SSRF protection
  const wellKnownCheck = await validateTokenEndpoint(wellKnownUrl)
  if (!wellKnownCheck.valid) {
    throw createError({ statusCode: 400, statusMessage: `Blocked URL: ${wellKnownCheck.reason}` })
  }

  // Fetch OIDC discovery document
  let discoveryDoc: Record<string, unknown>
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(wellKnownUrl, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const text = await response.text()
    if (text.length > MAX_RESPONSE_SIZE) {
      throw new Error('Discovery document too large')
    }

    discoveryDoc = JSON.parse(text)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch discovery document'
    throw createError({ statusCode: 502, statusMessage: `Failed to fetch discovery document: ${message}` })
  }

  const issuer = typeof discoveryDoc.issuer === 'string' ? discoveryDoc.issuer : null
  const jwksUri = typeof discoveryDoc.jwks_uri === 'string' ? discoveryDoc.jwks_uri : null

  if (!jwksUri) {
    throw createError({ statusCode: 502, statusMessage: 'Discovery document does not contain a jwks_uri field' })
  }

  // SSRF protection on JWKS URI
  const jwksCheck = await validateTokenEndpoint(jwksUri)
  if (!jwksCheck.valid) {
    throw createError({ statusCode: 400, statusMessage: `Blocked JWKS URI: ${jwksCheck.reason}` })
  }

  // Fetch JWKS
  let jwks: { keys: Array<Record<string, unknown>> }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(jwksUri, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const text = await response.text()
    if (text.length > MAX_RESPONSE_SIZE) {
      throw new Error('JWKS response too large')
    }

    jwks = JSON.parse(text)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch JWKS'
    throw createError({ statusCode: 502, statusMessage: `Failed to fetch JWKS: ${message}` })
  }

  if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw createError({ statusCode: 502, statusMessage: 'JWKS does not contain any keys' })
  }

  return {
    issuer: issuer || '',
    jwksUri,
    keys: jwks.keys
  }
})
