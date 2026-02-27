<script setup lang="ts">
const { session, loadFromStorage, enableAutoSave, resetSession } = useOAuthState()

const stepper = useTemplateRef('stepper')

const steps = computed(() => {
  const base = [
    { title: 'Configure', description: 'Provider & flow', icon: 'i-lucide-settings', value: 'configure', slot: 'configure' },
    { title: 'Auth URL', description: 'Build & review', icon: 'i-lucide-link', value: 'build-url', slot: 'build-url' },
    { title: 'Redirect', description: 'Go to provider', icon: 'i-lucide-external-link', value: 'redirect', slot: 'redirect' },
    { title: 'Callback', description: 'Capture response', icon: 'i-lucide-arrow-down-left', value: 'callback', slot: 'callback' }
  ]

  if (session.value.config.flowType !== 'implicit') {
    base.push({
      title: 'Exchange',
      description: 'Code for tokens',
      icon: 'i-lucide-repeat',
      value: 'exchange',
      slot: 'exchange'
    })
  }

  base.push({
    title: 'Results',
    description: 'View tokens',
    icon: 'i-lucide-check-circle',
    value: 'results',
    slot: 'results'
  })

  base.push({
    title: 'Decoded',
    description: 'Inspect claims',
    icon: 'i-lucide-scan-eye',
    value: 'decoded',
    slot: 'decoded'
  })

  base.push({
    title: 'JWKS',
    description: 'Cache keys',
    icon: 'i-lucide-key-round',
    value: 'jwks-cache',
    slot: 'jwks-cache'
  })

  base.push({
    title: 'API Test',
    description: 'Resource server',
    icon: 'i-lucide-shield-check',
    value: 'resource-server',
    slot: 'resource-server'
  })

  return base
})

onMounted(() => {
  loadFromStorage()
  enableAutoSave()
})

function handleReset() {
  resetSession()
}
</script>

<template>
  <UContainer class="py-8">
    <div class="max-w-4xl mx-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold">
          OAuth Redirect URL Tester
        </h1>
        <p class="text-muted mt-2">
          Walk through OAuth 2.0 / OIDC flows step by step. Configure a provider, authorize, and inspect tokens.
        </p>
      </div>

      <UStepper
        ref="stepper"
        v-model="session.currentStep"
        :items="steps"
        orientation="horizontal"
        class="w-full"
      >
        <template #configure>
          <OauthStepConfigure />
        </template>

        <template #build-url>
          <OauthStepBuildUrl />
        </template>

        <template #redirect>
          <OauthStepRedirect />
        </template>

        <template #callback>
          <OauthStepCallback />
        </template>

        <template #exchange>
          <OauthStepTokenExchange />
        </template>

        <template #results>
          <OauthStepTokenDisplay />
        </template>

        <template #decoded>
          <OauthStepDecodedToken />
        </template>

        <template #jwks-cache>
          <OauthStepJwksCache />
        </template>

        <template #resource-server>
          <OauthStepResourceServer />
        </template>
      </UStepper>

      <div class="flex justify-between mt-6">
        <UButton
          v-if="stepper?.hasPrev"
          label="Previous"
          icon="i-lucide-arrow-left"
          variant="outline"
          color="neutral"
          @click="stepper?.prev()"
        />
        <div v-else />
        <div class="flex gap-2">
          <UButton
            label="Reset"
            icon="i-lucide-rotate-ccw"
            variant="ghost"
            color="neutral"
            @click="handleReset"
          />
          <UButton
            v-if="stepper?.hasNext"
            label="Next"
            trailing-icon="i-lucide-arrow-right"
            @click="stepper?.next()"
          />
        </div>
      </div>
    </div>
  </UContainer>
</template>
