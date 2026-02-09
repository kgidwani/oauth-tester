<script setup lang="ts">
const { session } = useOAuthState()

function copyToClipboard(text: string) {
  window.navigator.clipboard.writeText(text)
}

const queryItems = computed(() => {
  if (!session.value.callbackParams) return []
  return Object.entries(session.value.callbackParams).map(([key, value]) => ({
    key,
    value
  }))
})

const hashItems = computed(() => {
  if (!session.value.callbackHash) return []
  return Object.entries(session.value.callbackHash).map(([key, value]) => ({
    key,
    value
  }))
})

const stateVerified = computed(() => {
  const returnedState = session.value.callbackParams?.state || session.value.callbackHash?.state
  if (!returnedState) return null
  return returnedState === session.value.state
})
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <!-- Error -->
      <UAlert
        v-if="session.callbackError"
        :title="session.callbackError"
        description="The authorization server returned an error."
        icon="i-lucide-x-circle"
        color="error"
        variant="subtle"
      />

      <!-- No callback yet -->
      <UAlert
        v-else-if="!session.callbackParams && !session.callbackHash"
        title="Waiting for callback"
        description="Complete the authorization step first. After authenticating with the provider, you will be redirected back here."
        icon="i-lucide-clock"
        color="neutral"
        variant="subtle"
      />

      <!-- Success -->
      <template v-else>
        <!-- Authorization Code -->
        <div v-if="session.authorizationCode">
          <h4 class="text-sm font-medium mb-2">
            Authorization Code
          </h4>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-sm font-mono bg-muted p-3 rounded-lg break-all">
              {{ session.authorizationCode }}
            </code>
            <UButton
              icon="i-lucide-copy"
              variant="ghost"
              color="neutral"
              @click="() => { if (session.authorizationCode) copyToClipboard(session.authorizationCode) }"
            />
          </div>
        </div>

        <!-- State Verification -->
        <UAlert
          v-if="stateVerified === true"
          title="State parameter verified"
          icon="i-lucide-check-circle"
          color="success"
          variant="subtle"
        />
        <UAlert
          v-else-if="stateVerified === false"
          title="State parameter mismatch"
          description="The state parameter returned by the provider does not match the one sent. This could indicate a CSRF attack."
          icon="i-lucide-alert-triangle"
          color="error"
          variant="subtle"
        />

        <!-- Query Parameters -->
        <OauthParameterTable
          v-if="queryItems.length > 0"
          title="Query Parameters"
          :items="queryItems"
        />

        <!-- Hash Fragment Parameters (Implicit flow) -->
        <OauthParameterTable
          v-if="hashItems.length > 0"
          title="Fragment Parameters"
          :items="hashItems"
        />
      </template>
    </div>
  </UCard>
</template>
