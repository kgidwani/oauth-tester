<script setup lang="ts">
const { session } = useOAuthState()
const { decodeJwt, isJwt, formatTimestamp, isTimestampClaim } = useJwtDecode()

const tokens = computed(() => {
  const response = session.value.tokenResponse
  const hash = session.value.callbackHash

  const items: Array<{ label: string, value: string, token: string }> = []

  const accessToken = response?.access_token || hash?.access_token
  if (accessToken) {
    items.push({ label: 'Access Token', value: 'access_token', token: String(accessToken) })
  }

  const idToken = response?.id_token || hash?.id_token
  if (idToken) {
    items.push({ label: 'ID Token', value: 'id_token', token: String(idToken) })
  }

  if (response?.refresh_token) {
    items.push({ label: 'Refresh Token', value: 'refresh_token', token: String(response.refresh_token) })
  }

  return items
})

const decodedTokens = computed(() => {
  return tokens.value
    .filter(t => isJwt(t.token))
    .map(t => ({
      ...t,
      decoded: decodeJwt(t.token)
    }))
})

const nonJwtTokens = computed(() => {
  return tokens.value.filter(t => !isJwt(t.token))
})

function formatClaimValue(key: string, value: unknown): string {
  if (isTimestampClaim(key) && typeof value === 'number') {
    const formatted = formatTimestamp(value)
    return formatted ? `${value} (${formatted})` : String(value)
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

function copyJson(obj: unknown) {
  navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
}
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <UAlert
        v-if="tokens.length === 0"
        title="No tokens available"
        description="Complete the previous steps to obtain tokens."
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
      />

      <UAlert
        v-else-if="decodedTokens.length === 0"
        title="No JWT tokens found"
        description="The tokens received are not in JWT format and cannot be decoded."
        icon="i-lucide-alert-triangle"
        color="warning"
        variant="subtle"
      />

      <template v-if="decodedTokens.length > 0">
        <UTabs
          :items="decodedTokens.map(t => ({ label: t.label, value: t.value }))"
          class="w-full"
        >
          <template #content="{ item }">
            <div
              v-for="dt in decodedTokens.filter(d => d.value === item.value)"
              :key="dt.value"
              class="mt-3 space-y-4"
            >
              <!-- Header -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-semibold">
                    Header
                  </h4>
                  <UButton
                    v-if="dt.decoded"
                    icon="i-lucide-copy"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    label="Copy"
                    @click="copyJson(dt.decoded.header)"
                  />
                </div>
                <div
                  v-if="dt.decoded"
                  class="border border-default rounded-lg overflow-hidden divide-y divide-default"
                >
                  <div
                    v-for="(value, key) in dt.decoded.header"
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

              <!-- Payload -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-semibold">
                    Payload ({{ dt.decoded ? Object.keys(dt.decoded.payload).length : 0 }} claims)
                  </h4>
                  <UButton
                    v-if="dt.decoded"
                    icon="i-lucide-copy"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    label="Copy"
                    @click="copyJson(dt.decoded.payload)"
                  />
                </div>
                <div
                  v-if="dt.decoded"
                  class="border border-default rounded-lg overflow-hidden divide-y divide-default"
                >
                  <div
                    v-for="(value, key) in dt.decoded.payload"
                    :key="String(key)"
                    class="flex items-start gap-3 px-3 py-2 text-sm"
                  >
                    <UBadge
                      :label="String(key)"
                      :color="isTimestampClaim(String(key)) ? 'primary' : 'neutral'"
                      variant="subtle"
                      class="shrink-0 font-mono"
                    />
                    <span class="font-mono text-muted break-all whitespace-pre-wrap">{{ formatClaimValue(String(key), value) }}</span>
                  </div>
                </div>
              </div>

              <!-- Signature -->
              <div>
                <h4 class="text-sm font-semibold mb-2">
                  Signature
                </h4>
                <p
                  v-if="dt.decoded"
                  class="text-xs text-muted font-mono break-all"
                >
                  {{ dt.decoded.signature }}
                </p>
                <p class="text-xs text-dimmed mt-1">
                  Signature is not verified (no public key available)
                </p>
              </div>
            </div>
          </template>
        </UTabs>
      </template>

      <!-- Non-JWT tokens shown as opaque -->
      <div
        v-for="t in nonJwtTokens"
        :key="t.value"
        class="space-y-2"
      >
        <h4 class="text-sm font-semibold">
          {{ t.label }}
        </h4>
        <p class="text-xs text-dimmed">
          Not a JWT — displayed as opaque token
        </p>
        <div class="relative">
          <UButton
            icon="i-lucide-copy"
            size="xs"
            variant="ghost"
            color="neutral"
            class="absolute top-2 right-2 z-10"
            @click="copyJson(t.token)"
          />
          <UTextarea
            :model-value="t.token"
            readonly
            :rows="2"
            autoresize
            class="font-mono text-xs"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
