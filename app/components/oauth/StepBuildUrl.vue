<script setup lang="ts">
const { session } = useOAuthState()
const { buildAuthorizationUrl } = useOAuthFlow()

const isBuilding = ref(false)
const urlParams = computed(() => {
  if (!session.value.authorizationUrl) return []
  try {
    const url = new URL(session.value.authorizationUrl)
    return Array.from(url.searchParams.entries()).map(([key, value]) => ({
      key,
      value
    }))
  } catch {
    return []
  }
})

const baseUrl = computed(() => {
  if (!session.value.authorizationUrl) return ''
  try {
    const url = new URL(session.value.authorizationUrl)
    return `${url.origin}${url.pathname}`
  } catch {
    return ''
  }
})

async function handleBuild() {
  isBuilding.value = true
  try {
    await buildAuthorizationUrl()
  } finally {
    isBuilding.value = false
  }
}

function copyUrl() {
  if (session.value.authorizationUrl) {
    navigator.clipboard.writeText(session.value.authorizationUrl)
  }
}
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <UButton
          label="Build Authorization URL"
          icon="i-lucide-hammer"
          :loading="isBuilding"
          @click="handleBuild"
        />
        <UButton
          v-if="session.authorizationUrl"
          icon="i-lucide-copy"
          label="Copy URL"
          variant="outline"
          color="neutral"
          @click="copyUrl"
        />
      </div>

      <template v-if="session.authorizationUrl">
        <div>
          <h4 class="text-sm font-medium mb-2">
            Full URL
          </h4>
          <UTextarea
            :model-value="session.authorizationUrl"
            readonly
            :rows="3"
            autoresize
            class="font-mono text-xs"
          />
        </div>

        <div>
          <h4 class="text-sm font-medium mb-2">
            Base URL
          </h4>
          <p class="font-mono text-sm text-muted">
            {{ baseUrl }}
          </p>
        </div>

        <OauthParameterTable
          title="Query Parameters"
          :items="urlParams"
        />

        <UAlert
          v-if="session.config.flowType === 'authorization_code_pkce' && session.pkce"
          title="PKCE Enabled"
          description="A code_challenge has been generated and included in the URL. The code_verifier is stored locally and will be sent during token exchange."
          icon="i-lucide-shield-check"
          color="primary"
          variant="subtle"
        />

        <UAlert
          v-if="session.config.flowType === 'implicit'"
          title="Implicit Flow"
          description="Tokens will be returned in the URL fragment (hash). The authorization code exchange step will be skipped."
          icon="i-lucide-info"
          color="warning"
          variant="subtle"
        />
      </template>
    </div>
  </UCard>
</template>
