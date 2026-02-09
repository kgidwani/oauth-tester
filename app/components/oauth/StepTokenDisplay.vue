<script setup lang="ts">
const { session } = useOAuthState()

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
