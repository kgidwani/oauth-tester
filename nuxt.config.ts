// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  // GitHub Pages deployment: set base URL from NUXT_APP_BASE_URL env var
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark'
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    routeRules: {
      '/': { prerender: true },
      '/callback': { ssr: false },
      '/**': {
        headers: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'X-DNS-Prefetch-Control': 'off'
        }
      }
    }
  },

  // Workaround: @nuxt/fonts (via @nuxt/ui) leaves an esbuild process alive
  // after build/generate, causing CI to hang. See https://github.com/nuxt/nuxt/issues/33987
  hooks: {
    close: () => {
      process.exit(0)
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
