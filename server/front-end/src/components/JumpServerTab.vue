<template>
  <div class="jump-server-tab">
    <div class="server-content">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="跳板服务器地址">
          {{ service?.jump_host || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="SSH端口">
          {{ service?.jump_port || 22 }}
        </el-descriptions-item>
        <el-descriptions-item label="用户名">
          {{ service?.jump_username || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="SSH密钥路径">
          {{ service?.ssh_key_path || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="连接信息">
          {{ formatJumpServer(service) }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  service: {
    type: Object,
    default: null
  }
});

function formatJumpServer(service) {
  if (!service) return '-';
  const username = service.jump_username || 'user';
  const host = service.jump_host || '';
  const port = service.jump_port || 22;
  
  if (port === 22) {
    return `${username}@${host}`;
  }
  return `${username}@${host}:${port}`;
}
</script>

<style scoped>
.jump-server-tab {
  height: 100%;
  padding: 20px;
  overflow: auto;
}

.server-content {
  max-width: 800px;
}
</style>


