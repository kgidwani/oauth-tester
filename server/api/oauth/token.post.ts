import { defineEventHandler, readBody, createError } from 'h3'

// Input length limits
const MAX_URL_LENGTH = 2048
const MAX_CODE_LENGTH = 4096
const MAX_SECRET_LENGTH = 512
const MAX_CLIENT_ID_LENGTH = 512
const MAX_REDIRECT_URI_LENGTH = 2048
const MAX_CODE_VERIFIER_LENGTH = 128

// Response size limit (1 MB)
const MAX_RESPONSE_SIZE = 1024 * 1024

// Request timeout (10 seconds)
const FETCH_TIMEOUT_MS = 10_000

function validateStringLength(value: unknown, name: string, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  if (value.length > maxLength) {
    return `${name} exceeds maximum length of ${maxLength} characters`
  }
  return null
}

function sanitizeErrorMessage(message: string): string {
  // Strip potential HTML/script injection from provider error responses
  return message
    .replace(/<[^>]*>/g, '')
    .substring(0, 500)
}

export default defineEventHandler(async (event) => {
  // --- Rate limiting ---
  const rateLimited = checkRateLimit(event)
  if (rateLimited) {
    event.node.res.setHeader('Retry-After', String(rateLimited.retryAfterSeconds))
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Retry after ${rateLimited.retryAfterSeconds} seconds.`
    })
  }

  const body = await readBody(event)

  const { tokenEndpoint, grantType, code, redirectUri, clientId, clientSecret, codeVerifier } = body

  // --- Required fields ---
  if (!tokenEndpoint || !code || !redirectUri || !clientId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: tokenEndpoint, code, redirectUri, clientId'
    })
  }

  // --- Input length validation ---
  const lengthErrors = [
    validateStringLength(tokenEndpoint, 'tokenEndpoint', MAX_URL_LENGTH),
    validateStringLength(code, 'code', MAX_CODE_LENGTH),
    validateStringLength(redirectUri, 'redirectUri', MAX_REDIRECT_URI_LENGTH),
    validateStringLength(clientId, 'clientId', MAX_CLIENT_ID_LENGTH),
    validateStringLength(clientSecret, 'clientSecret', MAX_SECRET_LENGTH),
    validateStringLength(codeVerifier, 'codeVerifier', MAX_CODE_VERIFIER_LENGTH)
  ].filter(Boolean)

  if (lengthErrors.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: lengthErrors[0]!
    })
  }

  // --- SSRF protection: validate token endpoint ---
  const endpointCheck = await validateTokenEndpoint(tokenEndpoint)
  if (!endpointCheck.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: `Blocked token endpoint: ${endpointCheck.reason}`
    })
  }

  // --- Validate redirect URI format ---
  try {
    const parsedRedirect = new URL(redirectUri)
    if (parsedRedirect.protocol !== 'https:' && parsedRedirect.hostname !== 'localhost' && parsedRedirect.hostname !== '127.0.0.1') {
      throw new Error('Redirect URI must use HTTPS (except localhost)')
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid redirect URI'
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid redirect URI: ${message}`
    })
  }

  const formParams = new URLSearchParams()
  formParams.set('grant_type', grantType || 'authorization_code')
  formParams.set('code', code)
  formParams.set('redirect_uri', redirectUri)
  formParams.set('client_id', clientId)

  if (clientSecret) {
    formParams.set('client_secret', clientSecret)
  }

  if (codeVerifier) {
    formParams.set('code_verifier', codeVerifier)
  }

  // Build debug info (mask sensitive values)
  const debugRequest: Record<string, string> = {}
  for (const [key, value] of formParams.entries()) {
    if (key === 'client_secret') {
      debugRequest[key] = '••••••••'
    } else if (key === 'code') {
      debugRequest[key] = value.length > 20 ? `${value.substring(0, 20)}...` : value
    } else {
      debugRequest[key] = value
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formParams.toString(),
      signal: controller.signal
    })

    clearTimeout(timeout)

    // Check response size before reading body
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return {
        success: false,
        error: 'Token endpoint response too large',
        statusCode: response.status,
        rawResponse: null,
        exchangeMethod: 'server',
        debugRequest
      }
    }

    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()

    // Enforce response size limit on actual body
    if (text.length > MAX_RESPONSE_SIZE) {
      return {
        success: false,
        error: 'Token endpoint response too large',
        statusCode: response.status,
        rawResponse: null,
        exchangeMethod: 'server',
        debugRequest
      }
    }

    let data: Record<string, unknown>

    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { raw: text.substring(0, 1000) }
      }
    } else {
      try {
        data = JSON.parse(text)
      } catch {
        const params = new URLSearchParams(text)
        data = Object.fromEntries(params.entries())
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: sanitizeErrorMessage(
          (data.error_description as string) || (data.error as string) || 'Token exchange failed'
        ),
        statusCode: response.status,
        rawResponse: JSON.stringify(data, null, 2),
        exchangeMethod: 'server',
        debugRequest
      }
    }

    return {
      success: true,
      data,
      statusCode: response.status,
      rawResponse: JSON.stringify(data, null, 2),
      exchangeMethod: 'server',
      debugRequest
    }
  } catch (e: unknown) {
    let message = 'Network error during token exchange'
    if (e instanceof Error) {
      if (e.name === 'AbortError') {
        message = `Token endpoint did not respond within ${FETCH_TIMEOUT_MS / 1000} seconds`
      } else {
        message = sanitizeErrorMessage(e.message)
      }
    }
    return {
      success: false,
      error: message,
      statusCode: 0,
      rawResponse: null,
      exchangeMethod: 'server',
      debugRequest
    }
  }
})
