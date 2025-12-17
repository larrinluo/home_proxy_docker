<template>
  <div class="host-config-tab">
    <div class="host-list-section">
      <!-- 第一行：输入框和导入按钮 -->
      <div class="section-header">
        <el-input
          v-model="newHost"
          placeholder="请输入域名、IP (如：google.com)"
          @keyup.enter="handleAddHost"
          style="flex: 1; margin-right: 12px;"
        >
          <template #append>
            <el-button @click="handleAddHost" class="add-btn">添加</el-button>
          </template>
        </el-input>
        <el-dropdown @command="handleImport" trigger="click">
          <el-button class="import-btn">导入</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="default">默认配置(google等)</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button 
          class="clear-btn" 
          @click="handleClearHosts"
          :disabled="hosts.length === 0"
        >
          清空
        </el-button>
      </div>

      <!-- Host列表 -->
      <div v-if="hosts.length > 0" class="host-list">
        <div
          v-for="(host, index) in hosts"
          :key="index"
          class="host-item"
        >
          {{ host }}
          <el-icon class="close-icon" @click="handleRemoveHost(index)">
            <Close />
          </el-icon>
        </div>
      </div>

      <!-- Host冲突提示 -->
      <el-alert
        v-if="conflictWarning"
        :title="conflictWarning"
        type="warning"
        :closable="false"
        style="margin-top: 12px;"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Close } from '@element-plus/icons-vue';
import { createHostConfig, updateHostConfig, checkHostConflict } from '../api/host-configs';

// 默认Host列表（从 /data/default-hosts.json 加载）
let defaultHostsCache = null;
async function loadDefaultHosts() {
  if (defaultHostsCache) {
    return defaultHostsCache;
  }
  try {
    const response = await fetch('/data/default-hosts.json');
    if (response.ok) {
      defaultHostsCache = await response.json();
      return defaultHostsCache;
    } else {
      console.error('Failed to load default-hosts.json:', response.statusText);
      return [];
    }
  } catch (error) {
    console.error('Error loading default-hosts.json:', error);
    return [];
  }
}

const props = defineProps({
  proxyServiceId: {
    type: Number,
    required: true
  },
  config: {
    type: Object,
    default: null
  },
  pacUrl: {
    type: String,
    default: 'http://192.168.2.4/proxy.pac'
  }
});

const emit = defineEmits(['saved', 'cancel']);

const loading = ref(false);
const hosts = ref([]);
const newHost = ref('');
const conflictWarning = ref('');
const isAddingHost = ref(false); // 防止重复添加

// 暴露hosts给父组件
defineExpose({
  hosts
});

// 监听config变化，初始化数据
watch(() => props.config, (config) => {
  if (config) {
    hosts.value = [...(config.hosts || [])];
  } else {
    hosts.value = [];
  }
  conflictWarning.value = '';
}, { immediate: true });

// 添加Host
async function handleAddHost() {
  // 防止重复调用
  if (isAddingHost.value) {
    return;
  }
  
  const host = newHost.value.trim();
  if (!host) {
    return;
  }

  // 验证域名格式
  if (!isValidDomain(host)) {
    ElMessage.warning('请输入有效的域名格式');
    return;
  }

  // 检查是否已存在
  if (hosts.value.includes(host)) {
    ElMessage.warning('该Host已存在');
    newHost.value = '';
    return;
  }

  isAddingHost.value = true;
  
  try {
    // 检查冲突
    try {
      const conflictResult = await checkHostConflict({
        hosts: [...hosts.value, host],
        excludeConfigId: props.config?.id === 'temp-default' ? undefined : props.config?.id
      });

      if (conflictResult.data.hasConflict) {
        conflictWarning.value = conflictResult.data.message || '该Host已被其他配置使用';
        return;
      } else {
        conflictWarning.value = '';
      }
    } catch (error) {
      console.error('Check conflict error:', error);
    }

    hosts.value.push(host);
    newHost.value = '';
    
    // 立即保存
    await saveHosts();
  } finally {
    isAddingHost.value = false;
  }
}

// 删除Host
async function handleRemoveHost(index) {
  hosts.value.splice(index, 1);
  conflictWarning.value = '';
  
  // 立即保存
  await saveHosts();
}

// 验证域名格式
function isValidDomain(domain) {
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

// 保存Host配置（内部函数，供添加/删除时调用）
async function saveHosts() {
  // 检查冲突（只有当hosts不为空时才检查）
  if (hosts.value.length > 0) {
    try {
      const conflictResult = await checkHostConflict({
        hosts: hosts.value,
        excludeConfigId: props.config?.id === 'temp-default' ? undefined : props.config?.id
      });

      if (conflictResult.data.hasConflict) {
        ElMessage.error(conflictResult.data.message || 'Host配置冲突，请检查');
        return;
      }
    } catch (error) {
      console.error('Check conflict error:', error);
      // 不阻止保存，继续执行
    }
  }

  loading.value = true;
  try {
    const data = {
      name: props.config?.name || '默认配置',
      proxyServiceId: props.proxyServiceId,
      hosts: hosts.value
    };

    // 如果是临时配置（包括temp-default和其他temp-开头的），触发saved事件，让父组件处理
    if (props.config && (props.config.id === 'temp-default' || props.config.id?.toString().startsWith('temp-'))) {
      // 临时配置，触发saved事件，传递hosts数据
      emit('saved', hosts.value);
      return;
    } else if (props.config && props.config.id) {
      // 更新现有配置
      await updateHostConfig(props.config.id, data);
    } else {
      // 创建新配置
      await createHostConfig(data);
    }

    emit('saved');
  } catch (error) {
    console.error('Save hosts error:', error);
    ElMessage.error('保存失败');
  } finally {
    loading.value = false;
  }
}

// 保存（保留用于兼容性）
async function handleSave() {
  if (hosts.value.length === 0) {
    ElMessage.warning('请至少添加一个Host');
    return;
  }

  await saveHosts();
  ElMessage.success('保存成功');
}

// 取消
function handleCancel() {
  // 恢复原始数据
  if (props.config) {
    hosts.value = [...(props.config.hosts || [])];
  } else {
    hosts.value = [];
  }
  conflictWarning.value = '';
  emit('cancel');
}

// 导入默认配置
async function handleImport(command) {
  if (command === 'default') {
    try {
      loading.value = true;
      
      // 从 /data/default-hosts.json 加载数据
      const extractedHosts = await loadDefaultHosts();
      
      if (!extractedHosts || extractedHosts.length === 0) {
        ElMessage.warning('默认host列表为空，请检查数据文件');
        return;
      }
      
      // 合并到现有hosts，去重
      const existingHosts = new Set(hosts.value);
      const newHosts = extractedHosts.filter(host => !existingHosts.has(host));
      
      if (newHosts.length === 0) {
        ElMessage.info('没有新的host可以导入');
        return;
      }
      
      // 添加到hosts列表
      hosts.value.push(...newHosts);
      
      // 立即保存
      await saveHosts();
      
      ElMessage.success(`已导入 ${newHosts.length} 个host`);
    } catch (error) {
      console.error('Import hosts error:', error);
      ElMessage.error('导入失败: ' + (error.response?.data?.error?.message || error.message));
    } finally {
      loading.value = false;
    }
  }
}

// 清空所有Host
async function handleClearHosts() {
  if (hosts.value.length === 0) {
    return;
  }
  
  try {
    // 使用Element Plus的确认对话框
    await ElMessageBox.confirm(
      `确定要清空所有 ${hosts.value.length} 个Host吗？此操作不可恢复。`,
      '确认清空',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    // 清空hosts列表
    hosts.value = [];
    conflictWarning.value = '';
    
    // 立即保存
    await saveHosts();
    
    ElMessage.success('已清空所有Host');
  } catch (error) {
    // 用户取消操作，不显示错误
    if (error !== 'cancel') {
      console.error('Clear hosts error:', error);
      ElMessage.error('清空失败: ' + (error.response?.data?.error?.message || error.message));
    }
  }
}
</script>

<style scoped>
.host-config-tab {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.host-list-section {
  flex: 1;
  overflow-y: auto;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.section-header .add-btn,
.section-header .import-btn,
.section-header .clear-btn {
  height: 32px;
  line-height: 30px;
  padding: 0 15px;
  font-size: 14px;
  box-sizing: border-box;
  margin-left: 8px;
}

.section-header .add-btn {
  margin-left: 0;
}

.host-list {
  margin-bottom: 16px;
  min-height: 40px;
}

.host-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  color: #303133;
  cursor: default;
  transition: background-color 0.2s ease;
}

.host-item:hover {
  background-color: #e4e7ed;
}

.host-item:last-child {
  margin-bottom: 0;
}

.close-icon {
  cursor: pointer;
  color: #909399;
  font-size: 14px;
}

.close-icon:hover {
  color: #f56c6c;
}
</style>
