<script setup lang="ts">
const props = defineProps<{
  token: string
  label: string
}>()

const { decodeJwt, isJwt, formatTimestamp, isTimestampClaim } = useJwtDecode()

const decoded = computed(() => {
  if (!props.token || !isJwt(props.token)) return null
  return decodeJwt(props.token)
})

const tabs = computed(() => {
  const items = [{ label: 'Raw', value: 'raw' }]
  if (decoded.value) {
    items.push({ label: 'Decoded', value: 'decoded' })
  }
  return items
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

function copyToken() {
  navigator.clipboard.writeText(props.token)
}
</script>

<template>
  <div class="space-y-4">
    <UTabs
      :items="tabs"
      class="w-full"
    >
      <template #content="{ item }">
        <!-- Raw tab -->
        <div
          v-if="item.value === 'raw'"
          class="relative mt-3"
        >
          <UButton
            icon="i-lucide-copy"
            size="xs"
            variant="ghost"
            color="neutral"
            class="absolute top-2 right-2 z-10"
            @click="copyToken"
          />
          <UTextarea
            :model-value="token"
            readonly
            :rows="4"
            autoresize
            class="font-mono text-xs"
          />
        </div>

        <!-- Decoded tab -->
        <div
          v-else-if="item.value === 'decoded' && decoded"
          class="mt-3 space-y-4"
        >
          <div>
            <h4 class="text-sm font-semibold mb-2">
              Header
            </h4>
            <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
              <div
                v-for="(value, key) in decoded.header"
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

          <div>
            <h4 class="text-sm font-semibold mb-2">
              Payload
            </h4>
            <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
              <div
                v-for="(value, key) in decoded.payload"
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

          <div>
            <h4 class="text-sm font-semibold mb-2">
              Signature
            </h4>
            <p class="text-xs text-muted font-mono break-all">
              {{ decoded.signature }}
            </p>
            <p class="text-xs text-dimmed mt-1">
              Signature is not verified (no public key available)
            </p>
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>
