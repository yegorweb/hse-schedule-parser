// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  app: {
    baseURL: import.meta.env.NODE_ENV === 'production' ? '/hse-schedule-parser/' : '/',
    head: {
      htmlAttrs: {
        lang: 'ru'
      },
    }
  },
  site: {
    url: 'https://yegorweb.github.io',
    name: 'Расписание ВШЭ в календаре',
  },
  sitemap: {
    excludeAppSources: true,
    urls: ['https://yegorweb.github.io/hse-schedule-parser/'],
  },
  devtools: { enabled: true },
  modules: ['@nuxtjs/robots', '@nuxtjs/sitemap', 'vuetify-nuxt-module', 'nuxt-svgo'],

  css: ['~/assets/styles/main.scss'],

  runtimeConfig: {
    public: {
      apiBase: '', // can be overridden by NUXT_PUBLIC_API_BASE environment variable
      siteUrl: '', // can be overridden by NUXT_PUBLIC_SITE_URL environment variable
    },
  },

  robots: {
    robotsTxt: false,
  },

  features: {
    inlineStyles: false
  },

  vuetify: {
    vuetifyOptions: './vuetify.config.ts',
    moduleOptions: {
      prefixComposables: true,
    },
  },

  svgo: {
    defaultImport: 'skipsvgo',
  },

  devServer: {
    port: Number(import.meta.env.NUXT_DEV_PORT || 3000)
  },

  vite: {
    optimizeDeps: {
      include: [
        '@mdi/js',
        '@unhead/schema-org/vue',
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'vee-validate',
      ]
    },
  },

  imports: {
    imports: [
      {
        from: 'ofetch',
        name: 'FetchError',
        declarationType: 'class',
        type: true
      },
      {
        from: 'ofetch',
        name: 'FetchError',
        declarationType: 'class',
      },
    ],
    presets: [
      {
        from: 'vee-validate',
        imports: ['useForm', 'useField'],
      },
    ],
  }
})
