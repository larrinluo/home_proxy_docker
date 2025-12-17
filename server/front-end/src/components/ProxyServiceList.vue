<template>
  <div class="proxy-service-list">
    <div class="list-header">
      <h3 class="list-title">代理服务列表</h3>
    </div>
    
    <div v-if="proxyServices.length === 0" class="empty-state">
      <p>暂无代理服务</p>
    </div>
    
    <div v-else class="service-items">
      <div
        v-for="service in proxyServices"
        :key="service.id"
        class="service-item"
      >
        <div class="service-header">
          <span class="service-name">{{ service.name }}</span>
          <div class="header-right">
            <el-tag :type="getStatusType(service.status)" size="small">
              {{ getStatusText(service.status) }}
            </el-tag>
            <!-- 启动按钮 -->
            <el-button
              v-if="service.status === 'stopped' || service.status === 'error'"
              size="small"
              text
              :icon="VideoPlay"
              @click="handleStart(service)"
              :loading="loadingStates[service.id] === 'starting'"
            />
            <!-- 停止按钮 -->
            <el-button
              v-if="service.status === 'running'"
              size="small"
              text
              :icon="VideoPause"
              @click="handleStop(service)"
              :loading="loadingStates[service.id] === 'stopping'"
            />
            <!-- 更多操作菜单 -->
            <el-dropdown @command="(cmd) => handleDropdownCommand(cmd, service)" trigger="click">
              <el-icon class="action-icon more-icon">
                <MoreFilled />
              </el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logs">
                    日志
                  </el-dropdown-item>
                  <el-dropdown-item command="test">
                    测试
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <div class="service-info">
          <div class="info-row">
            <span class="label">代理地址：</span>
            <span class="value">
              {{ proxyHost }}:{{ service.proxy_port }}
              <span v-if="service.process_id != null" class="pid-info">(pid: {{ service.process_id }})</span>
            </span>
          </div>
          <div class="info-row">
            <span class="label">跳板服务器：</span>
            <span class="value">{{ formatJumpServer(service) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { VideoPlay, VideoPause, MoreFilled } from '@element-plus/icons-vue';
import { startProxyService, stopProxyService } from '../api/proxy-services';

const props = defineProps({
  proxyServices: {
    type: Array,
    default: () => []
  },
  proxyHost: {
    type: String,
    default: '127.0.0.1'
  }
});

const emit = defineEmits(['create-service', 'edit-service', 'refresh', 'show-logs', 'test-service', 'start-service', 'stop-service']);

// 加载状态管理
const loadingStates = ref({});

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

// 格式化跳板服务器显示
function formatJumpServer(service) {
  const username = service.jump_username || 'user';
  const host = service.jump_host || '';
  const port = service.jump_port || 22;
  
  if (port === 22) {
    return `${username}@${host}`;
  }
  return `${username}@${host}:${port}`;
}

// 启动服务
async function handleStart(service) {
  loadingStates.value[service.id] = 'starting';
  emit('start-service', service);
}

// 停止服务
async function handleStop(service) {
  loadingStates.value[service.id] = 'stopping';
  emit('stop-service', service);
}

// 下拉菜单命令处理
function handleDropdownCommand(command, service) {
  if (command === 'logs') {
    handleShowLogs(service);
  } else if (command === 'test') {
    handleTestService(service);
  }
}

// 显示日志
function handleShowLogs(service) {
  emit('show-logs', service);
}

// 测试服务
function handleTestService(service) {
  emit('test-service', service);
}

</script>

<style scoped>
.proxy-service-list {
  padding: 10px;
  margin-top: 20px;
  flex-shrink: 0;
  max-height: 50%;
  overflow-y: auto;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.list-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
}

.empty-state p {
  margin: 0 0 16px 0;
  font-size: 14px;
}

.service-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.service-item {
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  transition: all 0.2s;
}

.service-item:hover {
  border-color: #c0c4cc;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.service-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-right .el-button.is-text {
  padding: 4px;
  color: #606266;
}

.header-right .el-button.is-text:hover {
  color: #409eff;
}

.header-right .el-button.is-text.el-button--danger:hover {
  color: #f56c6c;
}

.action-icon {
  font-size: 16px;
  color: #606266;
  cursor: pointer;
  padding: 4px;
}

.action-icon:hover {
  color: #409eff;
}

.more-icon {
  font-size: 14px;
  margin-left: 4px;
}

.service-info {
  margin-bottom: 0;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  font-size: 12px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-row .label {
  color: #606266;
  min-width: 80px;
}

.info-row .value {
  color: #303133;
  flex: 1;
}

.pid-info {
  color: #909399;
  font-size: 11px;
  margin-left: 4px;
}

.action-btn {
  padding: 4px 8px;
}
</style>

