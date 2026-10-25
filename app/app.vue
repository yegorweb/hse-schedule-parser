<script setup lang="ts">
useHead({
  titleTemplate: (titleChunk) => titleChunk || 'Расписание ВШЭ в календаре',
  link: [
    {
      rel: "icon",
      type: "image/svg+xml",
      href: `${useRuntimeConfig().app.baseURL}logo.svg`,
    },
  ],
})

useSeoMeta({
  description: 'Бесплатный конвертер расписания НИУ ВШЭ из Excel в календарь ICS. Выберите файл .xlsx и учебную группу — обработка происходит прямо в браузере.',
  ogSiteName: 'Расписание ВШЭ в календаре',
  ogUrl: 'https://yegorweb.github.io/hse-schedule-parser/',
  ogLocale: 'ru_RU',
  twitterCard: 'summary',
  applicationName: 'Расписание ВШЭ в календаре',
})
</script>

<template>
  <v-app>
    <NuxtLayout />
  </v-app>
</template>
