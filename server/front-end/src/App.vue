<template>
  <router-view />
</template>

<script setup>
// Vue 3 Composition API
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height: 100%;
  width: 100%;
}

/* 平面设计风格 - 去掉所有阴影 */
.el-card {
  box-shadow: none !important;
  border: 1px solid #e4e7ed !important;
  background-color: #fafbfc !important;
}

.el-card:hover {
  box-shadow: none !important;
  border-color: #c0c4cc !important;
}

/* 按钮也采用平面风格 */
.el-button {
  box-shadow: none !important;
}

.el-button:hover {
  box-shadow: none !important;
}

/* 输入框平面风格 */
.el-input__wrapper {
  box-shadow: none !important;
  border: 1px solid #dcdfe6 !important;
}

.el-input__wrapper:hover {
  box-shadow: none !important;
  border-color: #c0c4cc !important;
}

.el-input__wrapper.is-focus {
  box-shadow: none !important;
  border-color: #409eff !important;
}

/* 表格平面风格 */
.el-table {
  box-shadow: none !important;
}

.el-table th {
  background-color: transparent !important;
  border-bottom: 1px solid #e4e7ed !important;
}

.el-table td {
  background-color: transparent !important;
}

/* 菜单平面风格 */
.el-menu {
  box-shadow: none !important;
}

.el-menu-item.is-active {
  background-color: #ecf5ff !important;
}
</style>


