<script setup lang="ts">
import type { ResourceServerResponse } from '~/types/oauth'

const { session, setResourceServerResponse, saveToStorage } = useOAuthState()

const secret = ref('')
const issuer = ref('')
const audience = ref('')
const isLoading = ref(false)

const accessToken = computed(() => {
  return session.value.tokenResponse?.access_token
    || session.value.callbackHash?.access_token
    || null
})

const tokenFormat = computed(() => {
  if (!accessToken.value) return null
  const parts = String(accessToken.value).split('.')
  if (parts.length === 5) return 'JWE'
  if (parts.length === 3) return 'JWS'
  return 'opaque'
})

const hasJwksCache = computed(() => !!session.value.jwksCache)

// Auto-populate issuer/audience from cached JWKS or token claims
onMounted(() => {
  if (session.value.jwksCache?.issuer) {
    issuer.value = session.value.jwksCache.issuer
  }

  if (!accessToken.value) return
  const { decodeJwt, isJwt } = useJwtDecode()
  if (!isJwt(String(accessToken.value))) return
  const decoded = decodeJwt(String(accessToken.value))
  if (!decoded) return

  if (!issuer.value && typeof decoded.payload.iss === 'string') {
    issuer.value = decoded.payload.iss
  }

  if (typeof decoded.payload.aud === 'string') {
    audience.value = decoded.payload.aud
  } else if (Array.isArray(decoded.payload.aud) && decoded.payload.aud.length > 0) {
    audience.value = String(decoded.payload.aud[0])
  }
})

const canSubmit = computed(() => {
  if (!accessToken.value) return false
  if (tokenFormat.value === 'JWE') return !!secret.value
  if (tokenFormat.value === 'JWS') return hasJwksCache.value
  return false
})

async function handleCall() {
  if (!accessToken.value) return

  isLoading.value = true

  try {
    const body: Record<string, unknown> = {}
    if (issuer.value) body.issuer = issuer.value
    if (audience.value) body.audience = audience.value

    if (tokenFormat.value === 'JWE') {
      body.secret = secret.value
    } else if (session.value.jwksCache) {
      body.jwks = { keys: session.value.jwksCache.keys }
    }

    const response = await fetch('/api/resource', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.value}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
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
        <!-- Token format info -->
        <UAlert
          v-if="tokenFormat === 'JWE'"
          title="Encrypted Token (JWE)"
          description="Your access token is a JWE (5-part encrypted JWT). A signing secret is required to decrypt and validate it."
          icon="i-lucide-lock"
          color="warning"
          variant="subtle"
        />
        <UAlert
          v-else-if="tokenFormat === 'JWS'"
          title="Resource Server — Offline Validation"
          description="Validates your access token using the locally cached JWKS keys. No network calls are made during verification."
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
          <!-- JWKS cache status (for JWS) -->
          <UAlert
            v-if="tokenFormat === 'JWS' && hasJwksCache"
            :title="`Using cached JWKS (${session.jwksCache!.keys.length} keys)`"
            :description="`Fetched from ${session.jwksCache!.jwksUri} at ${new Date(session.jwksCache!.fetchedAt).toLocaleString()}`"
            icon="i-lucide-key-round"
            color="success"
            variant="subtle"
          />
          <UAlert
            v-else-if="tokenFormat === 'JWS' && !hasJwksCache"
            title="No JWKS cached"
            description="Go to the JWKS step to fetch and cache the provider's public keys before validating."
            icon="i-lucide-alert-triangle"
            color="warning"
            variant="subtle"
          />

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
