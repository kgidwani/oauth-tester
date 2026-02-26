<script setup lang="ts">
import type { ResourceServerResponse } from '~/types/oauth'

const { session, setResourceServerResponse, saveToStorage } = useOAuthState()
const { decodeJwt, isJwt } = useJwtDecode()

const jwksUri = ref('')
const secret = ref('')
const issuer = ref('')
const audience = ref('')
const isLoading = ref(false)

const accessToken = computed(() => {
  return session.value.tokenResponse?.access_token
    || session.value.callbackHash?.access_token
    || null
})

// Detect token format: JWS (3 parts), JWE (5 parts), or opaque
const tokenFormat = computed(() => {
  if (!accessToken.value) return null
  const parts = String(accessToken.value).split('.')
  if (parts.length === 5) return 'JWE'
  if (parts.length === 3) return 'JWS'
  return 'opaque'
})

// Auto-populate fields from decoded access token claims (only works for JWS)
onMounted(() => {
  if (!accessToken.value || !isJwt(String(accessToken.value))) return
  const decoded = decodeJwt(String(accessToken.value))
  if (!decoded) return

  if (typeof decoded.payload.iss === 'string') {
    issuer.value = decoded.payload.iss
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
  if (secret.value) params.set('secret', secret.value)
  if (issuer.value) params.set('issuer', issuer.value)
  if (audience.value) params.set('audience', audience.value)
  return `/api/resource?${params.toString()}`
})

const canSubmit = computed(() => {
  if (!accessToken.value) return false
  if (tokenFormat.value === 'JWE') return !!secret.value
  return !!jwksUri.value
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
        <!-- Token format detection -->
        <UAlert
          v-if="tokenFormat === 'JWE'"
          title="Encrypted Token (JWE)"
          description="Your access token is a JWE (5-part encrypted JWT). This is common with Auth0 when the API uses HS256 signing. A signing secret is required to decrypt and validate it."
          icon="i-lucide-lock"
          color="warning"
          variant="subtle"
        />
        <UAlert
          v-else-if="tokenFormat === 'JWS'"
          title="Resource Server"
          description="This endpoint validates your access token offline by verifying its JWT signature against the provider's JWKS and checking standard claims (expiration, issuer, audience)."
          icon="i-lucide-shield-check"
          color="neutral"
          variant="subtle"
        />
        <UAlert
          v-else
          title="Opaque Token"
          description="The access token is not in JWT format. Offline validation is not possible with opaque tokens."
          icon="i-lucide-alert-triangle"
          color="error"
          variant="subtle"
        />

        <template v-if="tokenFormat !== 'opaque'">
          <!-- Signing Secret (for JWE) -->
          <UFormField
            v-if="tokenFormat === 'JWE'"
            label="API Signing Secret"
            required
            hint="Found in Auth0: Applications > APIs > your API > Signing Secret"
          >
            <UInput
              v-model="secret"
              type="password"
              placeholder="Your API signing secret"
              class="w-full font-mono"
            />
          </UFormField>

          <!-- JWKS URI (for JWS) -->
          <UFormField
            v-if="tokenFormat === 'JWS'"
            label="JWKS URI"
            required
          >
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

          <!-- Call Button -->
          <div class="flex gap-2">
            <UButton
              label="Call Resource Server"
              icon="i-lucide-shield-check"
              :loading="isLoading"
              :disabled="!canSubmit || !!session.resourceServerResponse?.success"
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
      </template>
    </div>
  </UCard>
</template>
