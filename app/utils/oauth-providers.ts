import type { OAuthProviderPreset } from '~/types/oauth'

export const OAUTH_PROVIDER_PRESETS: OAuthProviderPreset[] = [
  {
    id: 'auth0',
    name: 'Auth0',
    icon: 'i-simple-icons-auth0',
    authorizationEndpoint: 'https://{domain}/authorize',
    tokenEndpoint: 'https://{domain}/oauth/token',
    scopes: ['openid', 'profile', 'email'],
    supportsFlows: ['authorization_code', 'authorization_code_pkce', 'implicit'],
    domainRequired: true,
    domainPlaceholder: 'your-tenant.us.auth0.com',
    extraParams: { audience: '' },
    extraParamDescriptions: { audience: 'Required for JWT access tokens. Find this under APIs in your Auth0 dashboard.' }
  },
  {
    id: 'okta',
    name: 'Okta',
    icon: 'i-simple-icons-okta',
    authorizationEndpoint: 'https://{domain}/oauth2/default/v1/authorize',
    tokenEndpoint: 'https://{domain}/oauth2/default/v1/token',
    scopes: ['openid', 'profile', 'email'],
    supportsFlows: ['authorization_code', 'authorization_code_pkce', 'implicit'],
    domainRequired: true,
    domainPlaceholder: 'your-org.okta.com'
  },
  {
    id: 'google',
    name: 'Google',
    icon: 'i-simple-icons-google',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'profile', 'email'],
    supportsFlows: ['authorization_code', 'authorization_code_pkce', 'implicit'],
    domainRequired: false
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'i-simple-icons-github',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    scopes: ['read:user', 'user:email'],
    supportsFlows: ['authorization_code'],
    domainRequired: false
  },
  {
    id: 'microsoft',
    name: 'Microsoft Entra ID',
    icon: 'i-simple-icons-microsoftazure',
    authorizationEndpoint: 'https://login.microsoftonline.com/{domain}/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/{domain}/oauth2/v2.0/token',
    scopes: ['openid', 'profile', 'email'],
    supportsFlows: ['authorization_code', 'authorization_code_pkce', 'implicit'],
    domainRequired: true,
    domainPlaceholder: 'your-tenant-id or common'
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    icon: 'i-lucide-settings',
    authorizationEndpoint: '',
    tokenEndpoint: '',
    scopes: [],
    supportsFlows: ['authorization_code', 'authorization_code_pkce', 'implicit'],
    domainRequired: false
  }
]

export function getPresetById(id: string): OAuthProviderPreset | undefined {
  return OAUTH_PROVIDER_PRESETS.find(p => p.id === id)
}
