import type { TokenExchangeResponse } from '~/types/oauth'

export function useOAuthFlow() {
  const { session, setAuthorizationUrl, setPkce } = useOAuthState()
  const { generatePkce } = usePkce()

  function resolveEndpoint(template: string, domain?: string): string {
    if (!domain) return template
    return template.replace(/\{domain\}/g, domain)
  }

  async function buildAuthorizationUrl(): Promise<string> {
    const config = session.value.config
    const authEndpoint = resolveEndpoint(config.authorizationEndpoint, config.domain)

    const params = new URLSearchParams()
    params.set('client_id', config.clientId)
    params.set('redirect_uri', config.redirectUri)
    params.set('scope', config.scopes.join(' '))
    params.set('state', session.value.state)
    params.set('nonce', session.value.nonce)

    if (config.flowType === 'implicit') {
      params.set('response_type', 'token id_token')
    } else {
      params.set('response_type', 'code')
    }

    if (config.flowType === 'authorization_code_pkce') {
      const pkce = await generatePkce()
      setPkce(pkce)
      params.set('code_challenge', pkce.codeChallenge)
      params.set('code_challenge_method', pkce.codeChallengeMethod)
    }

    for (const [key, value] of Object.entries(config.extraParams)) {
      if (value) {
        params.set(key, value)
      }
    }

    const url = `${authEndpoint}?${params.toString()}`
    setAuthorizationUrl(url)
    return url
  }

  // Try server-side proxy first (works in local dev), fall back to client-side fetch
  async function exchangeCodeForTokens(): Promise<TokenExchangeResponse> {
    try {
      return await exchangeViaServer()
    } catch {
      // Server route not available (static deployment) — try client-side
      return await exchangeClientSide()
    }
  }

  async function exchangeViaServer(): Promise<TokenExchangeResponse> {
    const config = session.value.config
    const tokenEndpoint = resolveEndpoint(config.tokenEndpoint, config.domain)

    const body: Record<string, string> = {
      tokenEndpoint,
      grantType: 'authorization_code',
      code: session.value.authorizationCode!,
      redirectUri: config.redirectUri,
      clientId: config.clientId,
      clientSecret: config.clientSecret
    }

    if (config.flowType === 'authorization_code_pkce' && session.value.pkce) {
      body.codeVerifier = session.value.pkce.codeVerifier
    }

    return await $fetch<TokenExchangeResponse>('/api/oauth/token', {
      method: 'POST',
      body
    })
  }

  async function exchangeClientSide(): Promise<TokenExchangeResponse> {
    const config = session.value.config
    const tokenEndpoint = resolveEndpoint(config.tokenEndpoint, config.domain)

    const formParams = new URLSearchParams()
    formParams.set('grant_type', 'authorization_code')
    formParams.set('code', session.value.authorizationCode!)
    formParams.set('redirect_uri', config.redirectUri)
    formParams.set('client_id', config.clientId)

    if (config.clientSecret) {
      formParams.set('client_secret', config.clientSecret)
    }

    if (config.flowType === 'authorization_code_pkce' && session.value.pkce) {
      formParams.set('code_verifier', session.value.pkce.codeVerifier)
    }

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formParams.toString()
      })

      const contentType = response.headers.get('content-type') || ''
      let data: Record<string, unknown>

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
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
          error: (data.error_description as string) || (data.error as string) || 'Token exchange failed',
          statusCode: response.status,
          rawResponse: JSON.stringify(data, null, 2),
          exchangeMethod: 'client' as const
        }
      }

      return {
        success: true,
        data,
        statusCode: response.status,
        rawResponse: JSON.stringify(data, null, 2),
        exchangeMethod: 'client' as const
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Network error'
      return {
        success: false,
        error: `Client-side token exchange failed: ${message}. This may be due to CORS restrictions. Try running the app locally with "npm run dev" for server-side proxying.`,
        statusCode: 0,
        rawResponse: null,
        exchangeMethod: 'client' as const
      }
    }
  }

  return {
    buildAuthorizationUrl,
    exchangeCodeForTokens,
    resolveEndpoint
  }
}
