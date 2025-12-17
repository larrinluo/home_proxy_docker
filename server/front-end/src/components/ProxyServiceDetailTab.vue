<template>
  <div class="proxy-service-detail-tab">
    <div class="detail-content">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="服务名称">
          <div class="service-name-wrapper">
            <div class="service-name-left">
              <span>{{ service?.name || '-' }}</span>
              <el-icon class="edit-icon" @click.stop="handleEditName" v-if="service">
                <Edit />
              </el-icon>
            </div>
            <div class="service-name-right">
              <el-tag :type="getStatusType(service?.status)" size="small">
                {{ getStatusText(service?.status) }}
              </el-tag>
              <!-- 启动按钮 -->
              <el-button
                v-if="service && (service.status === 'stopped' || service.status === 'error')"
                size="small"
                text
                :icon="VideoPlay"
                @click="handleStart"
                :loading="loadingState === 'starting'"
                class="action-button"
              />
              <!-- 停止按钮 -->
              <el-button
                v-if="service && service.status === 'running'"
                size="small"
                text
                :icon="VideoPause"
                @click="handleStop"
                :loading="loadingState === 'stopping'"
                class="action-button"
              />
              <!-- 更多操作按钮 -->
              <el-dropdown
                v-if="service"
                @command="handleMoreMenuCommand"
                trigger="click"
              >
                <el-button
                  size="small"
                  text
                  class="action-button"
                >
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="delete">
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="代理地址">
          {{ service ? `${props.proxyHost}:${service.proxy_port}` : '-' }}
          <span v-if="service?.process_id != null" class="pid-info">(pid: {{ service.process_id }})</span>
        </el-descriptions-item>
        <el-descriptions-item label="跳板服务器">
          {{ formatJumpServer(service) }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 日志面板 -->
    <div class="log-panel" v-if="service">
      <ProcessLogViewer :logs="logs" />
    </div>

    <!-- 编辑服务名称对话框 -->
    <el-dialog
      v-model="showEditNameDialog"
      title="编辑服务名称"
      width="400px"
      @close="handleCloseEditNameDialog"
    >
      <el-form :model="editNameForm" label-width="80px">
        <el-form-item label="服务名称">
          <el-input
            v-model="editNameForm.name"
            placeholder="请输入服务名称"
            @keyup.enter="handleSaveName"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditNameDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveName" :loading="savingName">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Edit, VideoPlay, VideoPause, MoreFilled } from '@element-plus/icons-vue';
import { updateProxyService, deleteProxyService, getProxyService } from '../api/proxy-services';
import ProcessLogViewer from './ProcessLogViewer.vue';

const props = defineProps({
  service: {
    type: Object,
    default: null
  },
  proxyHost: {
    type: String,
    default: '127.0.0.1'
  }
});

const emit = defineEmits(['service-updated', 'start-service', 'stop-service', 'service-deleted']);

// 编辑服务名称相关
const showEditNameDialog = ref(false);
const savingName = ref(false);
const editNameForm = ref({
  name: ''
});

// 加载状态管理
const loadingState = ref('');

// 日志相关
const logs = ref([]);

function getStatusType(status) {
  const statusMap = {
    running: 'success',
    stopped: 'info',
    error: 'danger'
  };
  return statusMap[status] || 'info';
}

function getStatusText(status) {
  const textMap = {
    running: '运行中',
    stopped: '已停止',
    error: '启动失败'
  };
  return textMap[status] || '未知';
}

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

// 编辑服务名称
function handleEditName() {
  if (!props.service) return;
  editNameForm.value.name = props.service.name || '';
  showEditNameDialog.value = true;
}

// 关闭编辑名称对话框
function handleCloseEditNameDialog() {
  editNameForm.value.name = '';
}

// 保存服务名称
async function handleSaveName() {
  if (!props.service) return;
  
  const newName = editNameForm.value.name.trim();
  if (!newName) {
    ElMessage.warning('服务名称不能为空');
    return;
  }
  
  if (newName === props.service.name) {
    showEditNameDialog.value = false;
    return;
  }
  
  try {
    savingName.value = true;
    await updateProxyService(props.service.id, {
      name: newName
    });
    ElMessage.success('服务名称更新成功');
    showEditNameDialog.value = false;
    // 通知父组件刷新数据
    emit('service-updated');
  } catch (error) {
    console.error('Update service name error:', error);
    ElMessage.error('更新服务名称失败');
  } finally {
    savingName.value = false;
  }
}

// 启动服务
function handleStart() {
  if (!props.service) return;
  loadingState.value = 'starting';
  
  // 立即在日志面板显示操作日志
  addLog('INFO', '═══════════════════════════════════════');
  addLog('INFO', '开始启动代理服务...');
  addLog('INFO', `服务名称: ${props.service.name}`);
  addLog('INFO', `代理端口: ${props.service.proxy_port}`);
  addLog('INFO', `跳板服务器: ${formatJumpServer(props.service)}`);
  addLog('INFO', '');
  addLog('INFO', '正在执行 autossh 命令...');
  
  emit('start-service', props.service);
  // 监听服务更新，清除loading状态
  setTimeout(() => {
    loadingState.value = '';
  }, 2000);
}

// 停止服务
function handleStop() {
  console.log('[ProxyServiceDetailTab] handleStop called, service:', props.service);
  if (!props.service) {
    console.warn('[ProxyServiceDetailTab] handleStop: service is null');
    return;
  }
  loadingState.value = 'stopping';
  
  // 立即在日志面板显示操作日志
  addLog('INFO', '═══════════════════════════════════════');
  addLog('INFO', '开始停止代理服务...');
  addLog('INFO', `服务名称: ${props.service.name}`);
  if (props.service.process_id && props.service.process_id > 0) {
    addLog('INFO', `进程ID: ${props.service.process_id}`);
  }
  addLog('INFO', `代理端口: ${props.service.proxy_port}`);
  
  console.log('[ProxyServiceDetailTab] Emitting stop-service event for service:', props.service.id);
  emit('stop-service', props.service);
  // 监听服务更新，清除loading状态
  setTimeout(() => {
    loadingState.value = '';
  }, 2000);
}

// 处理更多菜单命令
async function handleMoreMenuCommand(command) {
  if (command === 'delete') {
    await handleDelete();
  }
}

// 删除服务
async function handleDelete() {
  if (!props.service) return;
  
  // 确认删除
  let confirmMessage = `确定要删除代理服务 "${props.service.name}" 吗？此操作不可恢复。`;
  if (props.service.status === 'running') {
    confirmMessage = `代理服务 "${props.service.name}" 正在运行中，删除将自动停止服务。确定要删除吗？此操作不可恢复。`;
  }
  
  try {
    await ElMessageBox.confirm(
      confirmMessage,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
  } catch {
    // 用户取消删除
    return;
  }
  
  // 如果服务正在运行，先停止服务
  if (props.service.status === 'running') {
    try {
      addLog('INFO', '═══════════════════════════════════════');
      addLog('INFO', '服务正在运行，先停止服务...');
      addLog('INFO', `服务名称: ${props.service.name}`);
      
      // 触发停止服务事件
      emit('stop-service', props.service);
      
      // 等待服务停止（给一些时间让服务停止）
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 再次检查服务状态
      const updatedService = await getProxyService(props.service.id);
      if (updatedService && updatedService.success && updatedService.data) {
        if (updatedService.data.status === 'running') {
          ElMessage.warning('服务停止失败，请稍后重试');
          return;
        }
        addLog('INFO', '服务已停止，继续删除...');
      }
    } catch (error) {
      console.error('Stop service before delete error:', error);
      ElMessage.warning('停止服务时出错，但将继续尝试删除');
    }
  }
  
  // 执行删除
  try {
    addLog('INFO', '正在删除代理服务...');
    await deleteProxyService(props.service.id);
    addLog('SUCCESS', '代理服务删除成功');
    ElMessage.success('删除成功');
    // 通知父组件服务已删除
    emit('service-deleted', props.service.id);
  } catch (error) {
    console.error('Delete proxy service error:', error);
    addLog('ERROR', `删除失败: ${error.response?.data?.error?.message || error.message || '未知错误'}`);
    ElMessage.error('删除失败: ' + (error.response?.data?.error?.message || error.message || '未知错误'));
  }
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
  if (!props.service) return;
  
  logs.value = [];
  addLog('INFO', '═══════════════════════════════════════');
  addLog('INFO', `代理服务: ${props.service.name}`);
  addLog('INFO', '═══════════════════════════════════════');
  addLog('INFO', '');
  
  // 显示服务基本信息
  addLog('INFO', '【服务信息】');
  addLog('INFO', `  服务名称: ${props.service.name}`);
  addLog('INFO', `  服务状态: ${getStatusText(props.service.status)}`);
  addLog('INFO', `  代理地址: ${props.service.proxy_port ? `${props.proxyHost}:${props.service.proxy_port}` : '未配置'}`);
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
    addLog('SUCCESS', `  可通过 SOCKS5 代理访问: ${props.proxyHost}:${props.service.proxy_port}`);
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
function handleRefreshLogs() {
  loadServiceLogs();
}

// 清空日志
function handleClearLogs() {
  logs.value = [];
  addLog('INFO', '日志已清空');
}

// 监听服务变化，重新加载日志
watch(() => props.service, (newService) => {
  if (newService) {
    loadServiceLogs();
  }
}, { immediate: true, deep: true });

// 组件挂载时加载日志
onMounted(() => {
  if (props.service) {
    loadServiceLogs();
  }
});

// 暴露方法给父组件
defineExpose({
  addLog,
  loadServiceLogs
});
</script>

<style scoped>
.proxy-service-detail-tab {
  height: 100%;
  padding: 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.detail-content {
  width: 100%;
  flex-shrink: 0;
}

.log-panel {
  margin-top: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

.pid-info {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}

.service-name-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.service-name-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-name-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-icon {
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  transition: color 0.2s;
}

.edit-icon:hover {
  color: #409eff;
}

.action-button {
  padding: 4px;
  color: #606266;
}

.action-button:hover {
  color: #409eff;
}

.action-button.el-button--danger:hover {
  color: #f56c6c;
}
</style>

