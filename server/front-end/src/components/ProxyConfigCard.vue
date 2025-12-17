<template>
  <div class="proxy-config-card">
    <!-- 卡片头部 -->
    <div class="card-header">
      <div class="config-name-wrapper">
        <span class="config-name">{{ config.name }}</span>
        <el-icon class="edit-icon" @click.stop="handleEditName">
          <Edit />
        </el-icon>
      </div>
      <div class="header-actions">
        <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
        <el-dropdown @command="handleDropdownCommand" trigger="click">
          <el-icon class="action-icon more-icon">
            <MoreFilled />
          </el-icon>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item 
                command="delete-config" 
              >
                删除代理配置
              </el-dropdown-item>
              <el-dropdown-item 
                v-if="config.enabled"
                command="disable-config"
              >
                停用配置
              </el-dropdown-item>
              <el-dropdown-item 
                v-if="!config.enabled"
                command="enable-config"
              >
                启用配置
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 卡片内容 -->
    <div class="card-content">
      <!-- 代理服务选择 -->
      <div class="info-row">
        <span class="label">代理服务：</span>
        <el-select
          v-model="selectedProxyServiceId"
          placeholder="新建或选择代理服务"
          size="small"
          style="flex: 1;"
          @change="handleProxyServiceChange"
        >
          <el-option
            v-for="service in proxyServices"
            :key="service.id"
            :label="`${service.name} - ${proxyHost}:${service.proxy_port}`"
            :value="service.id"
          />
          <el-option
            label="+ 新建代理服务"
            value="__create_new__"
            style="color: #409eff;"
          />
        </el-select>
      </div>

      <!-- Host配置（可点击） -->
      <div class="info-row host-config-row" @click="handleClickHostConfig">
        <span class="label">Host配置：</span>
        <span class="value host-value">
          {{ hostDisplayText }}
        </span>
        <el-icon class="arrow-icon">
          <ArrowRight />
        </el-icon>
      </div>
    </div>

    <!-- 卡片底部操作（仅临时配置显示） -->
    <div v-if="isTempConfig" class="card-footer">
      <el-button
        type="primary"
        size="small"
        :disabled="!canSave"
        @click="handleSave"
      >
        保存配置
      </el-button>
    </div>

    <!-- 编辑配置名称对话框 -->
    <el-dialog
      v-model="showEditNameDialog"
      title="编辑配置名称"
      width="400px"
      @close="handleCloseEditNameDialog"
    >
      <el-form :model="editNameForm" label-width="80px">
        <el-form-item label="配置名称">
          <el-input
            v-model="editNameForm.name"
            placeholder="请输入配置名称"
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
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowRight, MoreFilled, Edit } from '@element-plus/icons-vue';
import { updateHostConfig, deleteHostConfig, enableHostConfig, disableHostConfig } from '../api/host-configs';

const props = defineProps({
  config: {
    type: Object,
    required: true
  },
  proxyService: {
    type: Object,
    default: null
  },
  proxyServices: {
    type: Array,
    default: () => []
  },
  proxyHost: {
    type: String,
    default: '127.0.0.1' // 默认值，如果未传递则使用127.0.0.1
  }
});

const emit = defineEmits(['refresh', 'click-host-config', 'delete-config', 'save-config', 'update-config']);

// 选中的代理服务ID
const selectedProxyServiceId = ref(null);

// 编辑配置名称相关
const showEditNameDialog = ref(false);
const savingName = ref(false);
const editNameForm = ref({
  name: ''
});

// 初始化选中的代理服务ID
if (props.config.proxyServiceId) {
  selectedProxyServiceId.value = props.config.proxyServiceId;
}

// 监听config变化，更新选中的代理服务ID
watch(() => props.config.proxyServiceId, (newId) => {
  selectedProxyServiceId.value = newId;
}, { immediate: true });

// 代理服务列表（用于下拉菜单判断）
const proxyServices = computed(() => {
  return props.proxyServices || [];
});

// 状态类型
const statusType = computed(() => {
  if (!props.proxyService) return 'info';
  const statusMap = {
    running: 'success',
    stopped: 'info',
    error: 'danger'
  };
  return statusMap[props.proxyService.status] || 'info';
});

// 状态文本
const statusText = computed(() => {
  if (!props.proxyService) return '未配置';
  const textMap = {
    running: '运行中',
    stopped: '已停止',
    error: '启动失败'
  };
  return textMap[props.proxyService.status] || '未知';
});

// 代理服务变更处理
function handleProxyServiceChange(value) {
  if (value === '__create_new__') {
    // 重置选择
    selectedProxyServiceId.value = props.config.proxyServiceId;
    // 触发新建代理服务
    emit('update-config', {
      ...props.config,
      proxyServiceId: null
    });
    emit('new-service', props.config);
  } else {
    // 如果是临时配置，只更新内存中的配置，不调用API
    if (isTempConfig.value) {
      // 临时配置，只更新内存
      emit('update-config', {
        ...props.config,
        proxyServiceId: value
      });
    } else {
      // 已存在的配置，更新到数据库
      updateConfigProxyService(value);
    }
  }
}

// 更新配置的代理服务
async function updateConfigProxyService(serviceId) {
  try {
    await updateHostConfig(props.config.id, {
      proxyServiceId: serviceId
    });
    ElMessage.success('代理服务已更新');
    emit('refresh');
  } catch (error) {
    console.error('Update proxy service error:', error);
    ElMessage.error('更新代理服务失败');
    // 恢复原选择
    selectedProxyServiceId.value = props.config.proxyServiceId;
  }
}

// 是否为临时配置
const isTempConfig = computed(() => {
  return props.config.isTemp || props.config.id?.toString().startsWith('temp-');
});

// 是否可以保存（临时配置需要选择代理服务）
const canSave = computed(() => {
  if (!isTempConfig.value) {
    return false; // 非临时配置不显示保存按钮
  }
  return selectedProxyServiceId.value !== null;
});

// Host显示文本
const hostDisplayText = computed(() => {
  const hosts = props.config.hosts || [];
  if (hosts.length === 0) {
    return '未配置';
  }
  if (hosts.length <= 3) {
    return hosts.join(', ');
  }
  return `${hosts.slice(0, 3).join(', ')}...`;
});

// 点击Host配置区域
function handleClickHostConfig() {
  emit('click-host-config', props.config);
}

// 下拉菜单命令处理
function handleDropdownCommand(command) {
  if (command === 'delete-config') {
    handleDeleteConfig();
  } else if (command === 'enable-config') {
    handleEnableConfig();
  } else if (command === 'disable-config') {
    handleDisableConfig();
  }
}

// 启动
async function handleStart() {
  if (!props.proxyService) return;
  try {
    await startProxyService(props.proxyService.id);
    ElMessage.success('启动成功');
    emit('refresh');
  } catch (error) {
    ElMessage.error('启动失败');
  }
}

// 停止
async function handleStop() {
  if (!props.proxyService) return;
  try {
    await stopProxyService(props.proxyService.id);
    ElMessage.success('停止成功');
    emit('refresh');
  } catch (error) {
    ElMessage.error('停止失败');
  }
}

// 删除代理配置
async function handleDeleteConfig() {
  try {
    // 如果是临时配置，直接删除，不需要确认
    if (props.config.isTemp || props.config.id?.toString().startsWith('temp-')) {
      emit('delete-config', props.config.id);
      return;
    }
    
    await ElMessageBox.confirm(`确定要删除配置"${props.config.name}"吗？`, '提示', {
      type: 'warning'
    });
    await deleteHostConfig(props.config.id);
    ElMessage.success('删除成功');
    emit('refresh');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
}

// 启用配置
async function handleEnableConfig() {
  // 如果是临时配置，直接更新内存中的状态
  if (props.config.isTemp || props.config.id?.toString().startsWith('temp-')) {
    emit('save-config', {
      ...props.config,
      enabled: true
    });
    return;
  }
  
  try {
    await enableHostConfig(props.config.id);
    ElMessage.success('配置已启用');
    emit('refresh');
  } catch (error) {
    ElMessage.error('启用失败');
  }
}

// 停用配置
async function handleDisableConfig() {
  // 如果是临时配置，直接更新内存中的状态
  if (props.config.isTemp || props.config.id?.toString().startsWith('temp-')) {
    emit('save-config', {
      ...props.config,
      enabled: false
    });
    return;
  }
  
  try {
    await disableHostConfig(props.config.id);
    ElMessage.success('配置已停用');
    emit('refresh');
  } catch (error) {
    ElMessage.error('停用失败');
  }
}

// 保存临时配置
async function handleSave() {
  if (!canSave.value) {
    ElMessage.warning('请选择代理服务');
    return;
  }

  // 触发保存事件，让父组件处理
  emit('save-config', {
    ...props.config,
    proxyServiceId: selectedProxyServiceId.value,
    hosts: props.config.hosts || []
  });
}

// 编辑配置名称
function handleEditName() {
  editNameForm.value.name = props.config.name;
  showEditNameDialog.value = true;
}

// 关闭编辑名称对话框
function handleCloseEditNameDialog() {
  editNameForm.value.name = '';
}

// 保存配置名称
async function handleSaveName() {
  if (!editNameForm.value.name || editNameForm.value.name.trim() === '') {
    ElMessage.warning('配置名称不能为空');
    return;
  }

  if (editNameForm.value.name.trim() === props.config.name) {
    showEditNameDialog.value = false;
    return;
  }

  // 如果是临时配置，直接更新内存中的状态
  if (props.config.isTemp || props.config.id?.toString().startsWith('temp-')) {
    emit('save-config', {
      ...props.config,
      name: editNameForm.value.name.trim()
    });
    showEditNameDialog.value = false;
    return;
  }

  savingName.value = true;
  try {
    await updateHostConfig(props.config.id, {
      name: editNameForm.value.name.trim()
    });
    ElMessage.success('配置名称更新成功');
    showEditNameDialog.value = false;
    emit('refresh');
  } catch (error) {
    console.error('Update config name error:', error);
    ElMessage.error('更新配置名称失败');
  } finally {
    savingName.value = false;
  }
}
</script>

<style scoped>
.proxy-config-card {
  background-color: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 10px;
  padding: 12px;
  cursor: default;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-name-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.config-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
}

/* 卡片内容 */
.card-content {
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  width: 100%;
  min-width: 0; /* 允许flex收缩 */
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #606266;
  min-width: 80px;
  margin-right: 20px;
  flex-shrink: 0; /* 防止标签被压缩 */
}

.value {
  color: #303133;
  flex: 1;
  min-width: 0; /* 允许flex收缩 */
  overflow: hidden; /* 防止内容溢出 */
}

.host-config-row {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.host-config-row:hover {
  background-color: #f5f7fa;
}

.host-value {
  color: #409eff;
}

.arrow-icon {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}

/* 卡片底部 */
.card-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.action-btn {
  padding: 4px 8px;
}
</style>
