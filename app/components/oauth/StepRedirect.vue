<script setup lang="ts">
import { getPresetById } from '~/utils/oauth-providers'

const { session, saveToStorage } = useOAuthState()

const providerName = computed(() => {
  const preset = getPresetById(session.value.config.presetId || 'custom')
  return preset?.name || 'Provider'
})

const summaryItems = computed(() => [
  { key: 'Provider', value: providerName.value },
  { key: 'Flow', value: flowLabel.value },
  { key: 'Scopes', value: session.value.config.scopes.join(', ') },
  { key: 'Redirect URI', value: session.value.config.redirectUri }
])

const flowLabel = computed(() => {
  switch (session.value.config.flowType) {
    case 'authorization_code': return 'Authorization Code'
    case 'authorization_code_pkce': return 'Authorization Code + PKCE'
    case 'implicit': return 'Implicit'
    default: return session.value.config.flowType
  }
})

function handleRedirect() {
  saveToStorage()
  if (session.value.authorizationUrl) {
    window.location.href = session.value.authorizationUrl
  }
}
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <UAlert
        title="Ready to redirect"
        description="You are about to be redirected to the authorization server. Make sure you have registered the redirect URI in your provider's configuration."
        icon="i-lucide-alert-triangle"
        color="warning"
        variant="subtle"
      />

      <OauthParameterTable
        title="Session Summary"
        :items="summaryItems"
      />

      <div class="flex justify-center pt-2">
        <UButton
          :label="`Authorize with ${providerName}`"
          icon="i-lucide-external-link"
          size="xl"
          :disabled="!session.authorizationUrl"
          @click="handleRedirect"
        />
      </div>
    </div>
  </UCard>
</template>
