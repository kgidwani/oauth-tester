export type OAuthFlowType = 'authorization_code' | 'authorization_code_pkce' | 'implicit'

export interface OAuthProviderPreset {
  id: string
  name: string
  icon?: string
  authorizationEndpoint: string
  tokenEndpoint: string
  scopes: string[]
  supportsFlows: OAuthFlowType[]
  extraParams?: Record<string, string>
  domainRequired?: boolean
  domainPlaceholder?: string
}

export interface OAuthProviderConfig {
  presetId: string | null
  domain?: string
  authorizationEndpoint: string
  tokenEndpoint: string
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  responseType: string
  flowType: OAuthFlowType
  extraParams: Record<string, string>
}

export interface PkceState {
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

export interface OAuthSession {
  id: string
  config: OAuthProviderConfig
  pkce: PkceState | null
  state: string
  nonce: string
  currentStep: string
  authorizationUrl: string | null
  callbackParams: Record<string, string> | null
  callbackHash: Record<string, string> | null
  callbackError: string | null
  authorizationCode: string | null
  tokenResponse: TokenResponse | null
  tokenError: string | null
  createdAt: string
  updatedAt: string
}

export interface TokenResponse {
  access_token?: string
  id_token?: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  scope?: string
  [key: string]: unknown
}

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  raw: string
}

export interface TokenExchangeRequest {
  tokenEndpoint: string
  grantType: 'authorization_code'
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
  codeVerifier?: string
}

export interface TokenExchangeResponse {
  success: boolean
  data?: TokenResponse
  error?: string
  statusCode?: number
  rawResponse?: string | null
  exchangeMethod?: 'server' | 'client'
  debugRequest?: Record<string, string>
}
