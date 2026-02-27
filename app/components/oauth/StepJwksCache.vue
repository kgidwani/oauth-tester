<script setup lang="ts">
const { session, setJwksCache, clearJwksCache, saveToStorage } = useOAuthState()
const { decodeJwt, isJwt } = useJwtDecode()

const wellKnownUrl = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)

const accessToken = computed(() => {
  return session.value.tokenResponse?.access_token
    || session.value.callbackHash?.access_token
    || null
})

// Auto-derive well-known URL from access token issuer
onMounted(() => {
  if (session.value.jwksCache) {
    wellKnownUrl.value = session.value.jwksCache.wellKnownUrl
    return
  }

  if (!accessToken.value || !isJwt(String(accessToken.value))) return
  const decoded = decodeJwt(String(accessToken.value))
  if (!decoded || typeof decoded.payload.iss !== 'string') return

  const iss = decoded.payload.iss.replace(/\/$/, '')
  wellKnownUrl.value = `${iss}/.well-known/openid-configuration`
})

async function handleFetch() {
  if (!wellKnownUrl.value) return

  isLoading.value = true
  error.value = null

  try {
    const result = await $fetch<{ issuer: string, jwksUri: string, keys: Array<Record<string, unknown>> }>('/api/oauth/discover', {
      method: 'POST',
      body: { wellKnownUrl: wellKnownUrl.value }
    })

    setJwksCache({
      wellKnownUrl: wellKnownUrl.value,
      issuer: result.issuer,
      jwksUri: result.jwksUri,
      keys: result.keys,
      fetchedAt: new Date().toISOString()
    })
    saveToStorage()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch JWKS'
    error.value = message
  } finally {
    isLoading.value = false
  }
}

function handleClear() {
  clearJwksCache()
  error.value = null
  saveToStorage()
}

const keyColumns = ['kid', 'kty', 'alg', 'use']
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <UAlert
        title="JWKS Discovery & Cache"
        description="Fetch the provider's public keys from the OpenID Connect discovery endpoint. These keys are cached locally and used for offline token validation — no network calls during verification."
        icon="i-lucide-key-round"
        color="neutral"
        variant="subtle"
      />

      <!-- Well-Known URL Input -->
      <UFormField label="OpenID Configuration URL" required>
        <UInput
          v-model="wellKnownUrl"
          placeholder="https://your-provider/.well-known/openid-configuration"
          class="w-full font-mono"
          :disabled="!!session.jwksCache"
        />
      </UFormField>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <UButton
          v-if="!session.jwksCache"
          label="Fetch JWKS"
          icon="i-lucide-download"
          :loading="isLoading"
          :disabled="!wellKnownUrl"
          @click="handleFetch"
        />
        <UButton
          v-if="session.jwksCache"
          label="Clear Cache"
          icon="i-lucide-trash-2"
          variant="outline"
          color="error"
          @click="handleClear"
        />
      </div>

      <!-- Error -->
      <UAlert
        v-if="error"
        title="Failed to fetch JWKS"
        :description="error"
        icon="i-lucide-x-circle"
        color="error"
        variant="subtle"
      />

      <!-- Cached JWKS Display -->
      <template v-if="session.jwksCache">
        <UAlert
          title="JWKS cached successfully"
          :description="`${session.jwksCache.keys.length} key(s) fetched at ${new Date(session.jwksCache.fetchedAt).toLocaleString()}`"
          icon="i-lucide-check-circle"
          color="success"
          variant="subtle"
        />

        <!-- Metadata -->
        <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
          <div class="flex items-center gap-3 px-3 py-2 text-sm">
            <span class="font-mono text-muted min-w-[100px]">Issuer</span>
            <span class="font-mono break-all">{{ session.jwksCache.issuer }}</span>
          </div>
          <div class="flex items-center gap-3 px-3 py-2 text-sm">
            <span class="font-mono text-muted min-w-[100px]">JWKS URI</span>
            <span class="font-mono break-all">{{ session.jwksCache.jwksUri }}</span>
          </div>
          <div class="flex items-center gap-3 px-3 py-2 text-sm">
            <span class="font-mono text-muted min-w-[100px]">Fetched At</span>
            <span class="font-mono">{{ new Date(session.jwksCache.fetchedAt).toLocaleString() }}</span>
          </div>
        </div>

        <!-- Keys Table -->
        <div>
          <h4 class="text-sm font-semibold mb-2">
            Public Keys ({{ session.jwksCache.keys.length }})
          </h4>
          <div class="border border-default rounded-lg overflow-hidden">
            <!-- Header -->
            <div class="flex bg-elevated px-3 py-2 text-xs font-semibold text-muted">
              <span
                v-for="col in keyColumns"
                :key="col"
                class="flex-1 font-mono"
              >{{ col }}</span>
            </div>
            <!-- Rows -->
            <div
              v-for="(key, index) in session.jwksCache.keys"
              :key="index"
              class="flex px-3 py-2 text-sm border-t border-default"
            >
              <span
                v-for="col in keyColumns"
                :key="col"
                class="flex-1 font-mono text-muted break-all"
              >{{ key[col] || '—' }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </UCard>
</template>
