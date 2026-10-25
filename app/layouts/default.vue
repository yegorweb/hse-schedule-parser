<script setup lang="ts">
import Logo from '~/assets/images/logo.svg'
</script>

<template>
  <div class="site-layout">
    <header class="site-header">
      <v-container class="header-content">
        <NuxtLink class="brand" to="/">
          <Logo class="brand-logo" />
          <span>Конвертер расписания ВШЭ</span>
        </NuxtLink>
      </v-container>
    </header>

    <NuxtPage />
  </div>
</template>

<style lang="scss" scoped>
.site-layout {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

.site-header {
  height: 60px;
}

.header-content {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  text-decoration: none;
}

.brand-logo {
  width: 35px;
  height: 35px;
}
</style>
