<template>
  <aside class="app-sidebar">
    <div class="sidebar-content">
      <el-menu
        :default-active="activeMenu"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/">
          <el-icon><House /></el-icon>
          <span>Socks5代理配置</span>
        </el-menu-item>
      </el-menu>
      
      <!-- 用户信息区域（底部） -->
      <div class="sidebar-footer">
        <el-dropdown 
          @command="handleCommand" 
          trigger="click" 
          placement="top-start"
          popper-class="user-dropdown-menu"
        >
          <div class="user-info">
            <el-icon class="user-icon"><User /></el-icon>
            <span class="username">{{ user?.username || 'User' }}</span>
            <el-icon class="arrow-icon"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人中心</el-dropdown-item>
              <el-dropdown-item command="system-config">系统配置</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { House, User, ArrowDown } from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeMenu = computed(() => route.path);
const user = computed(() => authStore.user);

function handleCommand(command) {
  if (command === 'profile') {
    router.push('/profile');
  } else if (command === 'system-config') {
    router.push('/system-config');
  } else if (command === 'logout') {
    authStore.logout();
  }
}
</script>

<style scoped>
.app-sidebar {
  width: 200px;
  background-color: #fafbfc;
  border-right: 1px solid #e4e7ed;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-menu {
  border-right: none;
  flex: 1;
  overflow-y: auto;
}

/* 用户信息区域（底部） */
.sidebar-footer {
  flex-shrink: 0;
  padding: 0;
  border-top: 1px solid #e4e7ed;
  background-color: #ffffff;
  width: 100%;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 12px 16px;
  border-radius: 0;
  transition: background-color 0.3s;
  width: 100%;
  user-select: none; /* 防止文本选择 */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  box-sizing: border-box;
  margin: 0;
}

/* 确保下拉菜单也占满宽度 */
.sidebar-footer :deep(.el-dropdown) {
  width: 100%;
  display: block;
}

.sidebar-footer :deep(.el-dropdown__caret-button) {
  width: 100%;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.user-info:active {
  background-color: #e4e7ed;
}

.user-icon {
  font-size: 18px;
  color: #606266;
}

.username {
  flex: 1;
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow-icon {
  font-size: 12px;
  color: #909399;
}
</style>

<style>
/* 全局样式：用户下拉菜单宽度与侧边栏一致 */
.user-dropdown-menu {
  min-width: 200px !important;
  width: 200px !important;
}

.user-dropdown-menu .el-dropdown-menu__item {
  padding: 12px 20px;
}
</style>

