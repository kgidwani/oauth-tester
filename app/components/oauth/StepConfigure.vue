<script setup lang="ts">
import type { OAuthFlowType } from '~/types/oauth'
import { OAUTH_PROVIDER_PRESETS, getPresetById } from '~/utils/oauth-providers'

const { session, updateConfig } = useOAuthState()

const providerItems = OAUTH_PROVIDER_PRESETS.map(p => ({
  label: p.name,
  value: p.id,
  icon: p.icon
}))

const flowItems = computed(() => {
  const preset = getPresetById(session.value.config.presetId || 'custom')
  const flows: Array<{ label: string, value: OAuthFlowType, description: string, disabled: boolean }> = [
    {
      label: 'Authorization Code',
      value: 'authorization_code',
      description: 'Standard server-side flow with client secret',
      disabled: !preset?.supportsFlows.includes('authorization_code')
    },
    {
      label: 'Authorization Code + PKCE',
      value: 'authorization_code_pkce',
      description: 'Enhanced security with code challenge (recommended for SPAs)',
      disabled: !preset?.supportsFlows.includes('authorization_code_pkce')
    },
    {
      label: 'Implicit',
      value: 'implicit',
      description: 'Tokens returned directly in URL fragment (legacy)',
      disabled: !preset?.supportsFlows.includes('implicit')
    }
  ]
  return flows
})

const selectedPreset = computed(() => getPresetById(session.value.config.presetId || 'custom'))

const showDomain = computed(() => selectedPreset.value?.domainRequired)
const showTokenEndpoint = computed(() => session.value.config.flowType !== 'implicit')
const showClientSecret = computed(() => session.value.config.flowType === 'authorization_code')

function onPresetChange(presetId: string) {
  const preset = getPresetById(presetId)
  if (!preset) return

  updateConfig({
    presetId,
    authorizationEndpoint: preset.authorizationEndpoint,
    tokenEndpoint: preset.tokenEndpoint,
    scopes: [...preset.scopes],
    extraParams: preset.extraParams ? { ...preset.extraParams } : {},
    domain: ''
  })

  if (!preset.supportsFlows.includes(session.value.config.flowType)) {
    updateConfig({ flowType: preset.supportsFlows[0] })
  }
}

// Initialize endpoints from preset if they're empty (first load)
onMounted(() => {
  if (session.value.config.presetId && !session.value.config.authorizationEndpoint) {
    onPresetChange(session.value.config.presetId)
  }
})

function copyToClipboard(text: string) {
  window.navigator.clipboard.writeText(text)
}

function onFlowChange(flow: OAuthFlowType) {
  updateConfig({ flowType: flow })
  if (flow === 'implicit') {
    updateConfig({ responseType: 'token id_token' })
  } else {
    updateConfig({ responseType: 'code' })
  }
}
</script>

<template>
  <UCard>
    <div class="space-y-6">
      <!-- Security Warning -->
      <UAlert
        title="Testing tool only"
        description="This tool stores credentials in your browser's local storage (unencrypted). Use development/test credentials only — never enter production secrets."
        icon="i-lucide-shield-alert"
        color="warning"
        variant="subtle"
      />

      <!-- Provider Preset -->
      <UFormField label="Provider">
        <USelect
          :model-value="session.config.presetId ?? undefined"
          :items="providerItems"
          value-key="value"
          class="w-full"
          @update:model-value="onPresetChange"
        />
      </UFormField>

      <!-- Domain -->
      <UFormField
        v-if="showDomain"
        label="Domain"
        :description="selectedPreset?.domainPlaceholder ? `e.g. ${selectedPreset.domainPlaceholder}` : ''"
      >
        <UInput
          v-model="session.config.domain"
          :placeholder="selectedPreset?.domainPlaceholder"
          class="w-full"
        />
      </UFormField>

      <!-- Flow Type -->
      <UFormField label="Flow Type">
        <URadioGroup
          :model-value="session.config.flowType"
          :items="flowItems"
          value-key="value"
          @update:model-value="onFlowChange"
        />
      </UFormField>

      <!-- Endpoints -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UFormField label="Authorization Endpoint">
          <UInput
            v-model="session.config.authorizationEndpoint"
            placeholder="https://provider.com/authorize"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="showTokenEndpoint"
          label="Token Endpoint"
        >
          <UInput
            v-model="session.config.tokenEndpoint"
            placeholder="https://provider.com/oauth/token"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- Client Credentials -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UFormField label="Client ID">
          <UInput
            v-model="session.config.clientId"
            placeholder="Your application's client ID"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="showClientSecret"
          label="Client Secret"
        >
          <UInput
            v-model="session.config.clientSecret"
            type="password"
            placeholder="Your application's client secret"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- Redirect URI -->
      <UFormField
        label="Redirect URI"
        description="Register this URL in your provider's configuration"
      >
        <div class="flex gap-2">
          <UInput
            v-model="session.config.redirectUri"
            class="w-full font-mono text-sm"
            readonly
          />
          <UButton
            icon="i-lucide-copy"
            variant="outline"
            color="neutral"
            @click="copyToClipboard(session.config.redirectUri)"
          />
        </div>
      </UFormField>

      <!-- Scopes -->
      <UFormField label="Scopes">
        <UInputTags
          v-model="session.config.scopes"
          placeholder="Add scope..."
          class="w-full"
        />
      </UFormField>

      <!-- Extra Params (e.g. Auth0 audience) -->
      <template v-if="Object.keys(session.config.extraParams).length > 0">
        <UFormField
          v-for="(value, key) in session.config.extraParams"
          :key="String(key)"
          :label="String(key)"
        >
          <UInput
            :model-value="String(value)"
            :placeholder="`Value for ${String(key)}`"
            class="w-full"
            @update:model-value="(v: string) => session.config.extraParams[String(key)] = v"
          />
        </UFormField>
      </template>
    </div>
  </UCard>
</template>
