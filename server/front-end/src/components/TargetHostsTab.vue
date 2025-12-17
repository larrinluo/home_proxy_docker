<template>
  <div class="target-hosts-tab">
    <div class="hosts-content">
      <div class="hosts-header">
        <div class="header-left">
          <h3>{{ config?.name || '默认代理配置' }}<span class="host-count">({{ hostCount }}个域名)</span></h3>
        </div>
        <div class="header-right">
          <el-input
            v-model="newHost"
            placeholder="请输入域名、IP（输入关键字可快速筛选）"
            @keyup.enter="handleAddHost"
            @input="handleInputChange"
            clearable
            style="width: 300px; margin-right: 8px;"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
            <template #append>
              <el-button @click="handleAddHost" :loading="isAddingHost" class="add-btn">添加</el-button>
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
          <el-dropdown @command="handleMoreMenuCommand" trigger="click">
            <el-button class="more-btn">
              <el-icon><MoreFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="clear">清空</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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

      <!-- Host列表 -->
      <div v-if="filteredHosts.length > 0" class="hosts-list">
        <el-tag
          v-for="(host, index) in filteredHosts"
          :key="index"
          class="host-tag"
          effect="plain"
        >
          {{ host }}
          <el-dropdown @command="(cmd) => handleHostMenuCommand(cmd, getOriginalIndex(host))" trigger="click">
            <el-icon class="host-action-icon">
              <MoreFilled />
            </el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="test">测试</el-dropdown-item>
                <el-dropdown-item command="delete">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-tag>
      </div>
      <div v-else-if="hosts.length > 0 && isFiltering" class="empty-filter-result" style="text-align: center; padding: 20px; color: #909399;">
        没有匹配的域名
      </div>
      <div v-else-if="hosts.length === 0" class="empty-hosts" style="text-align: center; padding: 20px; color: #909399;">
        暂无域名配置
      </div>

      <!-- 日志面板 -->
      <div class="log-panel">
        <ProcessLogViewer :logs="testLogs" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MoreFilled, Search } from '@element-plus/icons-vue';
import { updateHostConfig, checkHostConflict, testHost } from '../api/host-configs';
import ProcessLogViewer from './ProcessLogViewer.vue';

// 默认Host列表缓存
let defaultHostsCache = null;

// 加载默认Host列表
async function loadDefaultHosts() {
  if (defaultHostsCache) {
    return defaultHostsCache;
  }
  
  try {
    const response = await fetch('/data/default-hosts.json');
    if (response.ok) {
      defaultHostsCache = await response.json();
      return defaultHostsCache;
    }
  } catch (error) {
    console.error('Load default hosts error:', error);
  }
  
  return [];
}

const props = defineProps({
  config: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['config-updated']);

const newHost = ref('');
const isAddingHost = ref(false);
const conflictWarning = ref('');
const hostsList = ref([]);
const testLogs = ref([{
  level: 'INFO',
  message: '选择域名进行curl代理测试...',
  timestamp: new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-')
}]);

// 使用一个标志来跟踪是否已经初始化过 hostsList
const hostsListInitialized = ref(false);

// 初始化hosts列表
const hosts = computed({
  get: () => {
    // 如果 hostsList 已经初始化过，始终使用它（即使为空）
    if (hostsListInitialized.value) {
      return hostsList.value;
    }
    // 否则从 props.config 初始化
    if (!props.config || !props.config.hosts) return [];
    if (Array.isArray(props.config.hosts)) {
      return props.config.hosts;
    }
    try {
      return JSON.parse(props.config.hosts || '[]');
    } catch (e) {
      return [];
    }
  },
  set: (value) => {
    hostsList.value = value;
    hostsListInitialized.value = true; // 标记为已初始化
  }
});

// 监听config变化，更新hosts列表
watch(() => props.config, (newConfig, oldConfig) => {
  console.log('[TargetHostsTab] Config changed:', { 
    old: oldConfig?.id, 
    new: newConfig?.id,
    newHosts: newConfig?.hosts 
  });
  if (newConfig) {
    // 如果配置ID变化，或者配置对象变化，都重新初始化
    const configId = newConfig.id;
    const oldConfigId = oldConfig?.id;
    
    if (configId !== oldConfigId || !hostsListInitialized.value) {
      console.log('[TargetHostsTab] Reinitializing hosts list for config:', configId);
      if (Array.isArray(newConfig.hosts)) {
        hostsList.value = [...newConfig.hosts];
      } else {
        try {
          hostsList.value = JSON.parse(newConfig.hosts || '[]');
        } catch (e) {
          hostsList.value = [];
        }
      }
      hostsListInitialized.value = true;
      console.log('[TargetHostsTab] Hosts list initialized:', hostsList.value.length, 'hosts');
    }
    
    // 清空搜索关键字
    newHost.value = '';
    
    // 清空测试日志
    testLogs.value = [{
      level: 'INFO',
      message: '选择域名进行curl代理测试...',
      timestamp: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-')
    }];
  } else {
    hostsList.value = [];
    hostsListInitialized.value = false;
  }
}, { immediate: true, deep: true });

const hostCount = computed(() => {
  return hosts.value.length;
});

// 判断是否正在筛选（输入框有内容且不是有效的域名格式，则认为是筛选模式）
const isFiltering = computed(() => {
  if (!newHost.value || !newHost.value.trim()) {
    return false;
  }
  const trimmed = newHost.value.trim();
  // 如果输入的内容看起来像域名/IP，则不是筛选模式
  // 简单判断：包含点号或看起来像IP地址
  if (trimmed.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) {
    return false;
  }
  // 否则认为是筛选关键字
  return true;
});

// 过滤后的域名列表
const filteredHosts = computed(() => {
  // 如果正在筛选模式，使用 newHost 作为关键字
  if (isFiltering.value) {
    const keyword = newHost.value.trim().toLowerCase();
    return hosts.value.filter(host => 
      host.toLowerCase().includes(keyword)
    );
  }
  // 否则显示所有域名
  return hosts.value;
});

// 根据过滤后的host获取原始索引
function getOriginalIndex(filteredHost) {
  return hosts.value.findIndex(host => host === filteredHost);
}

// 处理输入变化（用于实时筛选）
function handleInputChange() {
  // computed 属性会自动更新，这里不需要额外操作
}

// 验证域名格式
function isValidDomain(domain) {
  // 支持域名和IP地址
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return domainRegex.test(domain) || ipRegex.test(domain);
}

// 添加Host
async function handleAddHost() {
  if (isAddingHost.value) {
    return;
  }
  
  const host = newHost.value.trim();
  if (!host) {
    return;
  }

  // 验证域名格式
  if (!isValidDomain(host)) {
    ElMessage.warning('请输入有效的域名或IP地址格式');
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
        excludeConfigId: props.config?.id
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
    ElMessage.success('添加成功');
  } finally {
    isAddingHost.value = false;
  }
}

// 处理域名菜单命令
async function handleHostMenuCommand(command, index) {
  if (command === 'test') {
    await handleTestHost(index);
  } else if (command === 'delete') {
    await handleRemoveHost(index);
  }
}

// 添加日志
function addLog(level, message) {
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');
  
  testLogs.value.push({
    level,
    message,
    timestamp
  });
}

// 清空日志
function handleClearLogs() {
  testLogs.value = [];
}

// 测试域名
async function handleTestHost(index) {
  const host = hosts.value[index];
  if (!host) {
    return;
  }
  
  if (!props.config || !props.config.id) {
    ElMessage.warning('配置信息不完整，无法测试');
    return;
  }
  
  try {
    // 在域名前加 www
    const testHostName = host.startsWith('www.') ? host : `www.${host}`;
    
    addLog('INFO', '═══════════════════════════════════════');
    addLog('INFO', `开始测试域名: ${host}`);
    addLog('INFO', `测试URL: http://${testHostName}`);
    
    const response = await testHost({
      configId: props.config.id,
      host: testHostName
    });
    
    if (response.success && response.data) {
      const { command, output, proxyPort, testUrl, error, tunnelCheck } = response.data;
      
      // 显示SSH隧道连接状态检查
      if (tunnelCheck && tunnelCheck.tunnelDetails && tunnelCheck.tunnelDetails.length > 0) {
        addLog('INFO', '【SSH隧道连接状态检查】');
        tunnelCheck.tunnelDetails.forEach(detail => {
          if (detail.includes('未运行') || detail.includes('失败') || detail.includes('未监听') || detail.includes('未建立')) {
            addLog('WARNING', `  ${detail}`);
          } else {
            addLog('INFO', `  ${detail}`);
          }
        });
        addLog('INFO', '───────────────────────────────────────');
      }
      
      // 显示测试命令
      addLog('INFO', `执行命令: ${command}`);
      addLog('INFO', `代理端口: ${proxyPort}`);
      addLog('INFO', `测试URL: ${testUrl}`);
      addLog('INFO', '───────────────────────────────────────');
      
      // 显示命令输出
      if (output) {
        const lines = output.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          if (error) {
            addLog('ERROR', line);
          } else {
            addLog('INFO', line);
          }
        });
      }
      
      addLog('INFO', '───────────────────────────────────────');
      if (error) {
        addLog('ERROR', `测试失败: 无法通过代理访问 ${testHostName}`);
        // 如果隧道检查显示问题，给出提示
        if (tunnelCheck && (!tunnelCheck.autosshRunning || !tunnelCheck.portListening)) {
          addLog('WARNING', '提示: SSH隧道可能未正常建立，请检查：');
          addLog('WARNING', '  1. autossh进程是否在运行');
          addLog('WARNING', '  2. SSH连接是否正常');
          addLog('WARNING', '  3. 跳板服务器上的SOCKS5服务(127.0.0.1:1080)是否在运行');
        }
      } else {
        addLog('SUCCESS', `测试成功: 可以通过代理访问 ${testHostName}`);
      }
    } else {
      addLog('ERROR', '测试失败: ' + (response.error?.message || '未知错误'));
    }
  } catch (error) {
    console.error('Test host error:', error);
    addLog('ERROR', '测试失败: ' + (error.message || '未知错误'));
    ElMessage.error('测试失败: ' + (error.message || '未知错误'));
  }
}

// 删除Host
async function handleRemoveHost(index) {
  const hostToDelete = hosts.value[index];
  
  // 确认删除
  try {
    await ElMessageBox.confirm(
      `确定要删除域名 "${hostToDelete}" 吗？`,
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
  
  // 执行删除
  const originalHosts = [...hosts.value]; // 保存原始列表以便恢复
  const newHosts = [...hosts.value];
  newHosts.splice(index, 1);
  
  // 直接更新 hostsList，然后通过 computed 的 setter 更新
  hostsList.value = newHosts;
  hosts.value = newHosts; // 触发 computed setter
  conflictWarning.value = '';
  
  console.log('[TargetHostsTab] After delete, hostsList:', hostsList.value, 'hosts:', hosts.value);
  
  // 立即保存
  try {
    await saveHosts();
    
    // 保存成功后，更新 props.config 的 hosts（如果可能）
    // 或者触发父组件刷新配置数据
    console.log('[TargetHostsTab] Delete successful, current hosts:', hosts.value);
    
    ElMessage.success('删除成功');
  } catch (error) {
    console.error('Delete host error:', error);
    // 如果保存失败，恢复hosts列表
    hostsList.value = originalHosts;
    hosts.value = originalHosts;
    ElMessage.error('删除失败: ' + (error.message || '未知错误'));
    throw error; // 重新抛出错误以便上层处理
  }
}

// 保存Host配置
async function saveHosts() {
  if (!props.config || !props.config.id) {
    const error = new Error('配置信息不完整，无法保存');
    ElMessage.warning(error.message);
    throw error;
  }

  try {
    // 检查冲突（只有当hosts不为空时才检查）
    if (hosts.value.length > 0) {
      try {
        const conflictResult = await checkHostConflict({
          hosts: hosts.value,
          excludeConfigId: props.config.id
        });

        if (conflictResult.data.hasConflict) {
          const error = new Error(conflictResult.data.message || 'Host配置冲突，请检查');
          ElMessage.error(error.message);
          throw error;
        }
      } catch (error) {
        console.error('Check conflict error:', error);
        if (error.message && error.message.includes('冲突')) {
          throw error; // 如果是冲突错误，重新抛出
        }
      }
    }

    const data = {
      name: props.config.name,
      proxyServiceId: props.config.proxyServiceId,
      hosts: hosts.value
    };

    console.log('[TargetHostsTab] Saving hosts:', { configId: props.config.id, hosts: hosts.value });
    const response = await updateHostConfig(props.config.id, data);
    console.log('[TargetHostsTab] Save response:', response);
    
    if (!response || !response.success) {
      const error = new Error(response?.error?.message || '保存失败');
      throw error;
    }
    
    // 通知父组件配置已更新
    emit('config-updated', {
      id: props.config.id,
      hosts: hosts.value,
      hostCount: hosts.value.length
    });
  } catch (error) {
    console.error('Save hosts error:', error);
    ElMessage.error('保存失败: ' + (error.message || '未知错误'));
    throw error; // 重新抛出错误以便上层处理
  }
}

// 导入默认配置
async function handleImport(command) {
  if (command === 'default') {
    try {
      isAddingHost.value = true;
      
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
      isAddingHost.value = false;
    }
  }
}

// 处理更多菜单命令
async function handleMoreMenuCommand(command) {
  if (command === 'clear') {
    // 确认清空
    try {
      await ElMessageBox.confirm(
        `确定要清空所有域名吗？此操作不可恢复。`,
        '确认清空',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
    } catch {
      // 用户取消清空
      return;
    }

    // 执行清空
    const originalHosts = [...hosts.value]; // 保存原始列表以便恢复

    try {
      hosts.value = [];
      hostsList.value = []; // 同时更新 hostsList
      conflictWarning.value = '';
      
      // 清空搜索关键字
      newHost.value = '';
      
      // 立即保存
      await saveHosts();
      
      ElMessage.success('清空成功');
    } catch (error) {
      console.error('Clear hosts error:', error);
      ElMessage.error('清空失败: ' + (error.message || '未知错误'));
      // 恢复 hosts 列表
      hosts.value = originalHosts;
      hostsList.value = [...originalHosts];
    }
  }
}
</script>

<style scoped>
.target-hosts-tab {
  height: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hosts-content {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hosts-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-left {
  flex: 1;
}

.hosts-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
  font-weight: 600;
}

.host-count {
  font-weight: 400;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.more-btn {
  padding: 8px 12px;
}

.hosts-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.host-tag {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.host-action-icon {
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  transition: color 0.2s;
  margin-left: 4px;
}

.host-action-icon:hover {
  color: #409eff;
}

.log-panel {
  margin-top: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.log-panel :deep(.process-log-viewer) {
  flex: 1;
  overflow: auto;
  height: 100%;
}
</style>

