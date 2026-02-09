<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { session, loadFromStorage, setCallbackResult, setStep, saveToStorage } = useOAuthState()

const status = ref<'loading' | 'success' | 'error' | 'state_mismatch'>('loading')
const errorMessage = ref('')

onMounted(() => {
  const restored = loadFromStorage()
  if (!restored) {
    status.value = 'error'
    errorMessage.value = 'No active OAuth session found. Please start from the configuration page.'
    return
  }

  // Capture query parameters (auth code flow)
  const queryParams: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string') {
      queryParams[key] = value
    }
  }

  // Capture hash fragment (implicit flow)
  const hashParams: Record<string, string> = {}
  if (window.location.hash) {
    const hashString = window.location.hash.substring(1)
    const params = new URLSearchParams(hashString)
    for (const [key, value] of params.entries()) {
      hashParams[key] = value
    }
  }

  // Validate state parameter
  const returnedState = queryParams.state || hashParams.state
  if (returnedState && returnedState !== session.value.state) {
    status.value = 'state_mismatch'
    setCallbackResult({ queryParams, hashParams: Object.keys(hashParams).length > 0 ? hashParams : undefined })
    saveToStorage()
    return
  }

  // Check for errors
  if (queryParams.error) {
    setCallbackResult({
      queryParams,
      error: queryParams.error_description || queryParams.error
    })
    setStep('callback')
    saveToStorage()
    status.value = 'error'
    errorMessage.value = queryParams.error_description || queryParams.error
    return
  }

  // Store results
  setCallbackResult({
    queryParams,
    hashParams: Object.keys(hashParams).length > 0 ? hashParams : undefined,
    code: queryParams.code || undefined
  })

  setStep('callback')
  saveToStorage()
  status.value = 'success'
})

function goToMain() {
  router.push('/')
}
</script>

<template>
  <UContainer class="py-12">
    <div class="max-w-2xl mx-auto space-y-6">
      <h1 class="text-2xl font-bold">
        OAuth Callback
      </h1>

      <!-- Loading -->
      <div
        v-if="status === 'loading'"
        class="flex items-center gap-3"
      >
        <UIcon
          name="i-lucide-loader-2"
          class="animate-spin size-5"
        />
        <span>Processing callback...</span>
      </div>

      <!-- Success -->
      <template v-if="status === 'success'">
        <UAlert
          :title="session.authorizationCode ? 'Authorization code received' : 'Tokens received'"
          description="The OAuth provider has redirected back successfully."
          icon="i-lucide-check-circle"
          color="success"
          variant="subtle"
        />

        <div v-if="session.authorizationCode">
          <h4 class="text-sm font-medium mb-2">
            Authorization Code
          </h4>
          <code class="block text-sm font-mono bg-muted p-3 rounded-lg break-all">
            {{ session.authorizationCode }}
          </code>
        </div>

        <OauthParameterTable
          v-if="session.callbackParams && Object.keys(session.callbackParams).length > 0"
          title="Query Parameters"
          :items="Object.entries(session.callbackParams).map(([key, value]) => ({ key, value }))"
        />

        <OauthParameterTable
          v-if="session.callbackHash && Object.keys(session.callbackHash).length > 0"
          title="Fragment Parameters"
          :items="Object.entries(session.callbackHash).map(([key, value]) => ({ key, value }))"
        />

        <UButton
          label="Continue to next step"
          icon="i-lucide-arrow-right"
          size="lg"
          @click="goToMain"
        />
      </template>

      <!-- State Mismatch -->
      <template v-if="status === 'state_mismatch'">
        <UAlert
          title="State parameter mismatch"
          description="The state parameter returned by the provider does not match the one sent in the authorization request. This could indicate a CSRF attack or session tampering."
          icon="i-lucide-shield-alert"
          color="error"
          variant="subtle"
        />
        <UButton
          label="Return to configuration"
          icon="i-lucide-arrow-left"
          variant="outline"
          @click="goToMain"
        />
      </template>

      <!-- Error -->
      <template v-if="status === 'error'">
        <UAlert
          title="Callback Error"
          :description="errorMessage"
          icon="i-lucide-x-circle"
          color="error"
          variant="subtle"
        />
        <UButton
          label="Return to configuration"
          icon="i-lucide-arrow-left"
          variant="outline"
          @click="goToMain"
        />
      </template>
    </div>
  </UContainer>
</template>
