<script setup lang="ts">
import type { ResourceServerResponse } from '~/types/oauth'

const { session, setResourceServerResponse, saveToStorage } = useOAuthState()
const { decodeJwt, isJwt } = useJwtDecode()

const jwksUri = ref('')
const issuer = ref('')
const audience = ref('')
const isLoading = ref(false)

const accessToken = computed(() => {
  return session.value.tokenResponse?.access_token
    || session.value.callbackHash?.access_token
    || null
})

// Auto-populate fields from decoded access token claims
onMounted(() => {
  if (!accessToken.value || !isJwt(String(accessToken.value))) return
  const decoded = decodeJwt(String(accessToken.value))
  if (!decoded) return

  if (typeof decoded.payload.iss === 'string') {
    issuer.value = decoded.payload.iss
    // Derive JWKS URI from issuer for common providers
    const iss = decoded.payload.iss.replace(/\/$/, '')
    jwksUri.value = `${iss}/.well-known/jwks.json`
  }

  if (typeof decoded.payload.aud === 'string') {
    audience.value = decoded.payload.aud
  } else if (Array.isArray(decoded.payload.aud) && decoded.payload.aud.length > 0) {
    audience.value = String(decoded.payload.aud[0])
  }
})

const resourceEndpoint = computed(() => {
  const params = new URLSearchParams()
  if (jwksUri.value) params.set('jwks_uri', jwksUri.value)
  if (issuer.value) params.set('issuer', issuer.value)
  if (audience.value) params.set('audience', audience.value)
  return `/api/resource?${params.toString()}`
})

async function handleCall() {
  if (!accessToken.value) return

  isLoading.value = true

  try {
    const response = await fetch(resourceEndpoint.value, {
      headers: {
        'Authorization': `Bearer ${accessToken.value}`,
        'Accept': 'application/json'
      }
    })

    const data = await response.json()

    const result: ResourceServerResponse = response.ok
      ? { success: true, statusCode: response.status, data }
      : { success: false, statusCode: response.status, error: data.statusMessage || data.message || 'Validation failed' }

    setResourceServerResponse(result)
    saveToStorage()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Network error'
    setResourceServerResponse({ success: false, statusCode: 0, error: message })
    saveToStorage()
  } finally {
    isLoading.value = false
  }
}

function handleRetry() {
  session.value.resourceServerResponse = null
  saveToStorage()
}
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <UAlert
        v-if="!accessToken"
        title="No access token available"
        description="Complete the previous steps to obtain an access token."
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
      />

      <template v-else>
        <UAlert
          title="Resource Server"
          description="This endpoint validates your access token offline by verifying its JWT signature against the provider's JWKS and checking standard claims (expiration, issuer, audience)."
          icon="i-lucide-shield-check"
          color="neutral"
          variant="subtle"
        />

        <!-- JWKS URI -->
        <UFormField label="JWKS URI" required>
          <UInput
            v-model="jwksUri"
            placeholder="https://your-provider/.well-known/jwks.json"
            class="w-full font-mono"
          />
        </UFormField>

        <!-- Issuer -->
        <UFormField label="Issuer" hint="Optional — validates the iss claim">
          <UInput
            v-model="issuer"
            placeholder="https://your-provider/"
            class="w-full font-mono"
          />
        </UFormField>

        <!-- Audience -->
        <UFormField label="Audience" hint="Optional — validates the aud claim">
          <UInput
            v-model="audience"
            placeholder="https://api.example.com"
            class="w-full font-mono"
          />
        </UFormField>

        <!-- Endpoint Preview -->
        <div>
          <h4 class="text-sm font-medium mb-1">
            Request
          </h4>
          <p class="font-mono text-sm text-muted break-all">
            GET {{ resourceEndpoint }}
          </p>
          <p class="font-mono text-xs text-dimmed mt-1">
            Authorization: Bearer {{ String(accessToken).substring(0, 20) }}...
          </p>
        </div>

        <!-- Call Button -->
        <div class="flex gap-2">
          <UButton
            label="Call Resource Server"
            icon="i-lucide-shield-check"
            :loading="isLoading"
            :disabled="!jwksUri || !!session.resourceServerResponse?.success"
            @click="handleCall"
          />
          <UButton
            v-if="session.resourceServerResponse"
            label="Retry"
            icon="i-lucide-refresh-cw"
            variant="outline"
            color="neutral"
            @click="handleRetry"
          />
        </div>

        <!-- Error -->
        <UAlert
          v-if="session.resourceServerResponse && !session.resourceServerResponse.success"
          :title="`Validation Failed${session.resourceServerResponse.statusCode ? ` (HTTP ${session.resourceServerResponse.statusCode})` : ''}`"
          :description="session.resourceServerResponse.error"
          icon="i-lucide-x-circle"
          color="error"
          variant="subtle"
        />

        <!-- Success -->
        <template v-if="session.resourceServerResponse?.success && session.resourceServerResponse.data">
          <UAlert
            title="Access token is valid"
            :description="session.resourceServerResponse.data.message"
            icon="i-lucide-check-circle"
            color="success"
            variant="subtle"
          />

          <!-- Token Header -->
          <div>
            <h4 class="text-sm font-semibold mb-2">
              Verified Header
            </h4>
            <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
              <div
                v-for="(value, key) in session.resourceServerResponse.data.header"
                :key="String(key)"
                class="flex items-start gap-3 px-3 py-2 text-sm"
              >
                <UBadge
                  :label="String(key)"
                  color="neutral"
                  variant="subtle"
                  class="shrink-0 font-mono"
                />
                <span class="font-mono text-muted break-all">{{ String(value) }}</span>
              </div>
            </div>
          </div>

          <!-- Verified Claims -->
          <div>
            <h4 class="text-sm font-semibold mb-2">
              Verified Claims
            </h4>
            <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
              <div
                v-for="(value, key) in session.resourceServerResponse.data.claims"
                :key="String(key)"
                class="flex items-start gap-3 px-3 py-2 text-sm"
              >
                <UBadge
                  :label="String(key)"
                  color="primary"
                  variant="subtle"
                  class="shrink-0 font-mono"
                />
                <span class="font-mono text-muted break-all whitespace-pre-wrap">{{
                  typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
                }}</span>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </UCard>
</template>
