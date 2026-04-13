<script setup lang="ts">
const { session, setTokenResponse, saveToStorage } = useOAuthState()
const { refreshTokens } = useOAuthFlow()

const isRefreshing = ref(false)
const refreshError = ref<string | null>(null)
const refreshRawResponse = ref<string | null>(null)

const hasRefreshToken = computed(() => !!session.value.tokenResponse?.refresh_token)

async function handleRefresh() {
  isRefreshing.value = true
  refreshError.value = null
  refreshRawResponse.value = null

  try {
    const result = await refreshTokens()
    refreshRawResponse.value = result.rawResponse || null

    if (result.success && result.data) {
      // Preserve the refresh token if the new response doesn't include one
      const newRefreshToken = result.data.refresh_token || session.value.tokenResponse?.refresh_token
      setTokenResponse({ ...result.data, refresh_token: newRefreshToken })
      saveToStorage()
    } else {
      refreshError.value = result.error || 'Refresh failed'
    }
  } catch (e: unknown) {
    refreshError.value = e instanceof Error ? e.message : 'Unexpected error'
  } finally {
    isRefreshing.value = false
  }
}

const tokens = computed(() => {
  const response = session.value.tokenResponse
  // For implicit flow, tokens come from hash params
  const hash = session.value.callbackHash

  const items: Array<{ label: string, value: string, token: string }> = []

  if (response?.access_token) {
    items.push({ label: 'Access Token', value: 'access_token', token: String(response.access_token) })
  } else if (hash?.access_token) {
    items.push({ label: 'Access Token', value: 'access_token', token: hash.access_token })
  }

  if (response?.id_token) {
    items.push({ label: 'ID Token', value: 'id_token', token: String(response.id_token) })
  } else if (hash?.id_token) {
    items.push({ label: 'ID Token', value: 'id_token', token: hash.id_token })
  }

  if (response?.refresh_token) {
    items.push({ label: 'Refresh Token', value: 'refresh_token', token: String(response.refresh_token) })
  }

  return items
})

const metadata = computed(() => {
  const response = session.value.tokenResponse
  const hash = session.value.callbackHash
  const items: Array<{ key: string, value: string }> = []

  const tokenType = response?.token_type || hash?.token_type
  if (tokenType) items.push({ key: 'token_type', value: String(tokenType) })

  const expiresIn = response?.expires_in || hash?.expires_in
  if (expiresIn) {
    items.push({ key: 'expires_in', value: `${expiresIn} seconds` })
    const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
    items.push({ key: 'expires_at (approx)', value: expiresAt })
  }

  const scope = response?.scope || hash?.scope
  if (scope) items.push({ key: 'scope', value: String(scope) })

  return items
})

const hasTokens = computed(() => tokens.value.length > 0)

const { resolveEndpoint } = useOAuthFlow()

const refreshCurlCommand = computed(() => {
  const config = session.value.config
  const endpoint = resolveEndpoint(config.tokenEndpoint, config.domain)
  const refreshToken = session.value.tokenResponse?.refresh_token

  const parts = [
    `grant_type=refresh_token`,
    `refresh_token=${refreshToken || '<REFRESH_TOKEN>'}`,
    `client_id=${config.clientId}`
  ]

  if (config.clientSecret) {
    parts.push(`client_secret=${config.clientSecret}`)
  }

  return `curl -X POST '${endpoint}' \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -d '${parts.join('&')}'`
})

const apiCurlCommand = computed(() => {
  const token = session.value.tokenResponse?.access_token
    || session.value.callbackHash?.access_token

  return `curl -H 'Authorization: Bearer ${token || '<ACCESS_TOKEN>'}' \\
  'https://your-api.example.com/endpoint'`
})
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <UAlert
        v-if="!hasTokens"
        title="No tokens available"
        description="Complete the previous steps to obtain tokens."
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
      />

      <template v-if="hasTokens">
        <UTabs
          :items="tokens"
          class="w-full"
        >
          <template
            v-for="token in tokens"
            :key="token.value"
            #[token.value]
          >
            <div class="mt-3">
              <OauthTokenViewer
                :token="token.token"
                :label="token.label"
              />
            </div>
          </template>
        </UTabs>

        <!-- Metadata -->
        <OauthParameterTable
          v-if="metadata.length > 0"
          title="Token Metadata"
          :items="metadata"
        />

        <!-- Use Token cURL -->
        <OauthCurlCommand :command="apiCurlCommand" />

        <!-- Refresh Token -->
        <div
          v-if="hasRefreshToken"
          class="border border-default rounded-lg p-4 space-y-3"
        >
          <h4 class="text-sm font-semibold">
            Refresh Token
          </h4>
          <p class="text-xs text-muted">
            Use the refresh token to get a new access token without re-authenticating (grant_type=refresh_token).
          </p>

          <!-- Refresh cURL -->
          <OauthCurlCommand :command="refreshCurlCommand" />

          <div class="flex gap-2">
            <UButton
              label="Refresh Tokens"
              icon="i-lucide-refresh-cw"
              variant="outline"
              :loading="isRefreshing"
              @click="handleRefresh"
            />
          </div>

          <UAlert
            v-if="refreshError"
            :title="refreshError"
            icon="i-lucide-x-circle"
            color="error"
            variant="subtle"
          />

          <UAlert
            v-if="!refreshError && refreshRawResponse"
            title="Tokens refreshed successfully"
            description="The access token and metadata above have been updated with the new values."
            icon="i-lucide-check-circle"
            color="success"
            variant="subtle"
          />

          <div v-if="refreshRawResponse">
            <h4 class="text-sm font-medium mb-1">
              Raw Refresh Response
            </h4>
            <UTextarea
              :model-value="refreshRawResponse"
              readonly
              :rows="4"
              autoresize
              class="font-mono text-xs"
            />
          </div>
        </div>

        <!-- Session Info -->
        <div class="text-xs text-dimmed space-y-1">
          <p>Session ID: {{ session.id }}</p>
          <p>Created: {{ session.createdAt }}</p>
          <p>Updated: {{ session.updatedAt }}</p>
        </div>
      </template>
    </div>
  </UCard>
</template>
