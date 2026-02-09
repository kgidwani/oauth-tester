import type { OAuthSession, OAuthProviderConfig, PkceState, TokenResponse } from '~/types/oauth'

const STORAGE_KEY = 'oauth-test-session'

function createDefaultConfig(): OAuthProviderConfig {
  return {
    presetId: 'auth0',
    domain: '',
    authorizationEndpoint: '',
    tokenEndpoint: '',
    clientId: '',
    clientSecret: '',
    redirectUri: import.meta.client
      ? `${window.location.origin}${useRuntimeConfig().app.baseURL}callback`
      : 'http://localhost:3000/callback',
    scopes: ['openid', 'profile', 'email'],
    responseType: 'code',
    flowType: 'authorization_code',
    extraParams: {}
  }
}

function createSession(): OAuthSession {
  return {
    id: import.meta.client ? crypto.randomUUID() : 'ssr-placeholder',
    config: createDefaultConfig(),
    pkce: null,
    state: import.meta.client ? crypto.randomUUID() : '',
    nonce: import.meta.client ? crypto.randomUUID() : '',
    currentStep: 'configure',
    authorizationUrl: null,
    callbackParams: null,
    callbackHash: null,
    callbackError: null,
    authorizationCode: null,
    tokenResponse: null,
    tokenError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export function useOAuthState() {
  const session = useState<OAuthSession>('oauth-session', () => createSession())

  function loadFromStorage(): boolean {
    if (!import.meta.client) return false
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        session.value = JSON.parse(stored)
        return true
      } catch {
        return false
      }
    }
    return false
  }

  function saveToStorage(): void {
    if (!import.meta.client) return
    session.value.updatedAt = new Date().toISOString()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session.value))
  }

  function enableAutoSave(): void {
    watch(session, () => {
      saveToStorage()
    }, { deep: true })
  }

  function resetSession(): void {
    session.value = createSession()
    saveToStorage()
  }

  function updateConfig(partial: Partial<OAuthProviderConfig>): void {
    Object.assign(session.value.config, partial)
  }

  function setStep(step: string): void {
    session.value.currentStep = step
  }

  function setPkce(pkce: PkceState): void {
    session.value.pkce = pkce
  }

  function setAuthorizationUrl(url: string): void {
    session.value.authorizationUrl = url
  }

  function setCallbackResult(params: {
    queryParams?: Record<string, string>
    hashParams?: Record<string, string>
    error?: string
    code?: string
  }): void {
    session.value.callbackParams = params.queryParams ?? null
    session.value.callbackHash = params.hashParams ?? null
    session.value.callbackError = params.error ?? null
    session.value.authorizationCode = params.code ?? null
  }

  function setTokenResponse(response: TokenResponse): void {
    session.value.tokenResponse = response
    session.value.tokenError = null
  }

  function setTokenError(error: string): void {
    session.value.tokenError = error
    session.value.tokenResponse = null
  }

  return {
    session,
    loadFromStorage,
    saveToStorage,
    enableAutoSave,
    resetSession,
    updateConfig,
    setStep,
    setPkce,
    setAuthorizationUrl,
    setCallbackResult,
    setTokenResponse,
    setTokenError
  }
}
