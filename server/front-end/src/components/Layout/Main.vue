<template>
  <div class="layout-container">
    <Header />
    <div class="layout-content">
      <Sidebar />
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import Header from './Header.vue';
import Sidebar from './Sidebar.vue';
</script>

<style scoped>
.layout-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.layout-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 0;
  margin: 0;
  background-color: #f5f7fa;
}
</style>

