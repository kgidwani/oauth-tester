<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'OAuth Tester'
const description = 'Test OAuth 2.0 and OpenID Connect flows interactively. Configure any provider, walk through the authorization flow, and inspect tokens.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})

const { resetSession } = useOAuthState()
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-shield-check"
            class="text-primary size-6"
          />
          <span class="font-semibold text-lg">OAuth Tester</span>
        </NuxtLink>
      </template>

      <template #right>
        <UButton
          label="Reset"
          icon="i-lucide-rotate-ccw"
          variant="ghost"
          color="neutral"
          @click="resetSession()"
        />
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          OAuth Redirect URL Tester
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
