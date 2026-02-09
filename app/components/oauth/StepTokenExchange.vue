<script setup lang="ts">
import type { TokenExchangeResponse } from '~/types/oauth'

const { session, setTokenResponse, setTokenError, saveToStorage } = useOAuthState()
const { exchangeCodeForTokens, resolveEndpoint } = useOAuthFlow()

const isExchanging = ref(false)
const rawResponse = ref<string | null>(null)
const exchangeResult = ref<TokenExchangeResponse | null>(null)

const requestParams = computed(() => {
  const items = [
    { key: 'grant_type', value: 'authorization_code' },
    { key: 'code', value: session.value.authorizationCode || '' },
    { key: 'redirect_uri', value: session.value.config.redirectUri },
    { key: 'client_id', value: session.value.config.clientId }
  ]

  if (session.value.config.flowType === 'authorization_code') {
    items.push({ key: 'client_secret', value: session.value.config.clientSecret ? '••••••••' : '(empty)' })
  }

  if (session.value.config.flowType === 'authorization_code_pkce') {
    items.push({ key: 'code_verifier', value: session.value.pkce?.codeVerifier || '(missing — PKCE state lost!)' })
  }

  return items
})

const tokenEndpointResolved = computed(() =>
  resolveEndpoint(session.value.config.tokenEndpoint, session.value.config.domain)
)

const hasPkceState = computed(() =>
  session.value.config.flowType !== 'authorization_code_pkce' || !!session.value.pkce?.codeVerifier
)

async function handleExchange() {
  isExchanging.value = true
  rawResponse.value = null
  exchangeResult.value = null

  try {
    const result = await exchangeCodeForTokens()
    rawResponse.value = result.rawResponse || null
    exchangeResult.value = result

    if (result.success && result.data) {
      setTokenResponse(result.data)
    } else {
      setTokenError(result.error || 'Token exchange failed')
    }
    saveToStorage()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    setTokenError(message)
    saveToStorage()
  } finally {
    isExchanging.value = false
  }
}

function handleRetry() {
  session.value.tokenError = null
  session.value.tokenResponse = null
  rawResponse.value = null
  exchangeResult.value = null
  saveToStorage()
}
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <!-- Token Endpoint -->
      <div>
        <h4 class="text-sm font-medium mb-1">
          Token Endpoint
        </h4>
        <p class="font-mono text-sm text-muted break-all">
          POST {{ tokenEndpointResolved }}
        </p>
      </div>

      <!-- Request Parameters -->
      <OauthParameterTable
        title="Request Parameters"
        :items="requestParams"
      />

      <!-- PKCE state warning -->
      <UAlert
        v-if="session.config.flowType === 'authorization_code_pkce' && !session.pkce"
        title="PKCE state missing"
        description="The code_verifier was not found in the session. This can happen if the session was lost during the redirect. Try resetting and starting the flow again."
        icon="i-lucide-alert-triangle"
        color="error"
        variant="subtle"
      />

      <UAlert
        title="Server-side proxy"
        description="The token exchange is proxied through this app's server to avoid CORS and protect secrets. Falls back to client-side if unavailable."
        icon="i-lucide-server"
        color="neutral"
        variant="subtle"
      />

      <!-- Exchange Button -->
      <div class="flex gap-2">
        <UButton
          label="Exchange Code for Tokens"
          icon="i-lucide-repeat"
          :loading="isExchanging"
          :disabled="!session.authorizationCode || !!session.tokenResponse || !hasPkceState"
          @click="handleExchange"
        />
        <UButton
          v-if="session.tokenError"
          label="Retry"
          icon="i-lucide-refresh-cw"
          variant="outline"
          color="neutral"
          @click="handleRetry"
        />
      </div>

      <!-- Error -->
      <UAlert
        v-if="session.tokenError"
        :title="`Error${exchangeResult?.statusCode ? ` (HTTP ${exchangeResult.statusCode})` : ''}`"
        :description="session.tokenError"
        icon="i-lucide-x-circle"
        color="error"
        variant="subtle"
      />

      <!-- Debug: Actual request sent (from server proxy) -->
      <div v-if="exchangeResult?.debugRequest && session.tokenError">
        <h4 class="text-sm font-medium mb-2">
          Request Sent to Provider
          <UBadge
            :label="exchangeResult.exchangeMethod === 'server' ? 'via server proxy' : 'direct from browser'"
            size="xs"
            variant="subtle"
            color="neutral"
            class="ml-2"
          />
        </h4>
        <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
          <div
            v-for="(value, key) in exchangeResult.debugRequest"
            :key="String(key)"
            class="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <span class="font-mono text-muted min-w-[140px]">{{ key }}</span>
            <span class="font-mono break-all">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- Raw Response -->
      <div v-if="rawResponse">
        <h4 class="text-sm font-medium mb-2">
          Raw Response
          <UBadge
            v-if="exchangeResult?.statusCode"
            :label="`HTTP ${exchangeResult.statusCode}`"
            size="xs"
            :variant="exchangeResult.success ? 'subtle' : 'solid'"
            :color="exchangeResult.success ? 'success' : 'error'"
            class="ml-2"
          />
        </h4>
        <UTextarea
          :model-value="rawResponse"
          readonly
          :rows="6"
          autoresize
          class="font-mono text-xs"
        />
      </div>

      <!-- Troubleshooting (only shown on error) -->
      <div
        v-if="session.tokenError"
        class="border border-default rounded-lg p-4"
      >
        <h4 class="text-sm font-semibold mb-2">
          Troubleshooting
        </h4>
        <ul class="text-sm text-muted space-y-1 list-disc list-inside">
          <li>Check your provider's logs for detailed error info (Auth0: Dashboard &rarr; Monitoring &rarr; Logs)</li>
          <li v-if="session.config.flowType === 'authorization_code_pkce'">
            For SPA + PKCE: Ensure "Authorization Code" grant type is enabled in your app settings
          </li>
          <li v-if="session.config.flowType === 'authorization_code'">
            For Auth Code flow: Verify the client secret is correct and the app type is "Regular Web Application"
          </li>
          <li>
            Verify the redirect URI <code class="text-xs bg-muted px-1 rounded">{{ session.config.redirectUri }}</code> is registered in your provider's allowed callback URLs
          </li>
          <li>Authorization codes are single-use and expire quickly &mdash; if expired, reset and start the flow again</li>
          <li>Check if any custom rules, actions, or authorization policies are blocking the request</li>
        </ul>
      </div>

      <!-- Success -->
      <UAlert
        v-if="session.tokenResponse"
        title="Token exchange successful"
        icon="i-lucide-check-circle"
        color="success"
        variant="subtle"
      />
    </div>
  </UCard>
</template>
