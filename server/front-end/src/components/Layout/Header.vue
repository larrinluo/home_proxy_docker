<template>
  <header class="app-header">
    <div class="header-content">
      <div class="header-left">
        <img src="/favicon.svg" alt="Proxy Icon" class="header-icon" />
        <span class="network-label">家庭网络</span>
      </div>
      <div class="header-right">
        <el-link 
          href="https://github.com/your-username/socks_proxy_docker" 
          target="_blank" 
          class="header-link"
        >
          GitHub
        </el-link>
        <el-link 
          href="#" 
          target="_blank" 
          class="header-link"
        >
          Support
        </el-link>
        <el-link 
          href="#" 
          target="_blank" 
          class="header-link"
        >
          Discord
        </el-link>
      </div>
    </div>
  </header>
</template>

<script setup>
// Header组件，显示左侧网络标签和右侧链接
</script>

<style scoped>
.app-header {
  background-color: #fafbfc;
  border-bottom: 1px solid #e4e7ed;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  box-shadow: none;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  width: 24px;
  height: 24px;
  display: block;
}

.network-label {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-link {
  font-size: 14px;
  color: #606266;
  text-decoration: none;
  transition: color 0.3s;
}

.header-link:hover {
  color: #409eff;
}
</style>

