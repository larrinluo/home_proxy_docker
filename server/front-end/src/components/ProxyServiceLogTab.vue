<template>
  <div class="proxy-service-log-tab">
    <div class="log-header">
      <div class="service-info">
        <span class="service-name">{{ service.name }}</span>
        <el-tag :type="getStatusType(service.status)" size="small" style="margin-left: 8px;">
          {{ getStatusText(service.status) }}
        </el-tag>
      </div>
      <div class="log-actions">
        <el-button size="small" @click="handleRefresh">刷新</el-button>
        <el-button size="small" @click="handleClear">清空</el-button>
      </div>
    </div>
    <ProcessLogViewer :logs="logs" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import ProcessLogViewer from './ProcessLogViewer.vue';
import { connectProxyService } from '../api/proxy-services';

const props = defineProps({
  service: {
    type: Object,
    required: true
  }
});

const logs = ref([]);
let logReader = null;
const logTabRef = ref(null);

// 获取状态类型
function getStatusType(status) {
  const statusMap = {
    running: 'success',
    stopped: 'info',
    error: 'danger'
  };
  return statusMap[status] || 'info';
}

// 获取状态文本
function getStatusText(status) {
  const textMap = {
    running: '运行中',
    stopped: '已停止',
    error: '启动失败'
  };
  return textMap[status] || '未知';
}

// 格式化时间戳
function formatTimestamp() {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');
}

// 添加日志
function addLog(level, message) {
  logs.value.push({
    timestamp: formatTimestamp(),
    level: level.toUpperCase(),
    message: message
  });
}

// 加载服务日志信息
async function loadServiceLogs() {
  addLog('INFO', '═══════════════════════════════════════');
  addLog('INFO', `代理服务: ${props.service.name}`);
  addLog('INFO', '═══════════════════════════════════════');
  addLog('INFO', '');
  
  // 显示服务基本信息
  addLog('INFO', '【服务信息】');
  addLog('INFO', `  服务名称: ${props.service.name}`);
  addLog('INFO', `  服务状态: ${getStatusText(props.service.status)}`);
  addLog('INFO', `  代理地址: ${props.service.proxy_port ? `0.0.0.0:${props.service.proxy_port}` : '未配置'}`);
  if (props.service.process_id && props.service.process_id > 0) {
    addLog('INFO', `  进程ID: ${props.service.process_id}`);
  }
  addLog('INFO', `  跳板服务器: ${props.service.jump_username}@${props.service.jump_host}:${props.service.jump_port || 22}`);
  addLog('INFO', '');
  
  // 根据状态显示不同信息
  if (props.service.status === 'running') {
    addLog('SUCCESS', '【运行状态】');
    addLog('SUCCESS', '  代理服务正在运行中');
    addLog('SUCCESS', `  本地端口 ${props.service.proxy_port} 已监听`);
    addLog('SUCCESS', `  可通过 SOCKS5 代理访问: 0.0.0.0:${props.service.proxy_port}`);
    addLog('INFO', '');
    addLog('INFO', '提示: 代理服务日志会实时显示进程状态和连接信息');
  } else if (props.service.status === 'stopped') {
    addLog('INFO', '【运行状态】');
    addLog('INFO', '  代理服务已停止');
    addLog('INFO', '  点击启动按钮启动服务后，可查看实时日志');
  } else if (props.service.status === 'error') {
    addLog('ERROR', '【运行状态】');
    addLog('ERROR', '  代理服务启动失败');
    addLog('ERROR', '  请检查配置信息或查看错误详情');
  }
  
  addLog('INFO', '');
  addLog('INFO', '═══════════════════════════════════════');
}

// 刷新日志
function handleRefresh() {
  logs.value = [];
  loadServiceLogs();
}

// 清空日志
function handleClear() {
  logs.value = [];
  addLog('INFO', '日志已清空');
}

// 组件挂载时加载日志
onMounted(() => {
  loadServiceLogs();
});

// 组件卸载时断开连接
onUnmounted(() => {
  if (logReader && logReader.cancel) {
    logReader.cancel();
  }
});

// 暴露方法给父组件
defineExpose({
  addLog,
  loadServiceLogs
});
</script>

<style scoped>
.proxy-service-log-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.service-info {
  display: flex;
  align-items: center;
}

.service-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.log-actions {
  display: flex;
  gap: 8px;
}
</style>

