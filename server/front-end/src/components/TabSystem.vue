<template>
  <div class="tab-system">
    <!-- 标签页内容区域 -->
    <div class="tabs-content">
      <!-- Host配置标签页内容 -->
      <HostConfigTab
        v-if="activeTab && activeTab.type === 'host-config'"
        :key="`host-config-${activeTab.id}-${activeTab.config?.id || 'new'}`"
        :config="activeTab.config"
        :proxy-service-id="activeTab.proxyServiceId"
        :pac-url="pacUrl"
        @saved="handleHostConfigSaved"
        ref="hostConfigTabRef"
      />

      <!-- PAC配置预览标签页内容 -->
      <PACPreview
        v-if="activeTab && activeTab.type === 'pac-preview'"
        :key="activeTab.id"
        :pac-url="pacUrl"
        :proxy-host="proxyHost"
        @pac-config-updated="handlePACConfigUpdated"
        @service-updated="handleServiceUpdated"
        @start-service="handleStartService"
        @stop-service="handleStopService"
        @config-updated="handleConfigUpdated"
        ref="pacPreviewRef"
      />

      <!-- 代理服务日志标签页内容 -->
      <template v-for="tab in tabs.filter(t => t.type === 'proxy-service-log')" :key="tab.id">
        <ProxyServiceLogTab
          v-show="tab.active"
          :service="tab.service"
          :ref="(el) => setProxyServiceLogTabRef(tab.id, el)"
        />
      </template>

      <!-- PAC配置标签页内容 -->
      <PACTab
        v-if="activeTab && activeTab.type === 'pac-config'"
        :key="activeTab.id"
        :pac-url="pacUrl"
        @pac-config-updated="handlePACConfigUpdated"
      />

      <!-- 代理服务详情标签页内容 -->
      <ProxyServiceDetailTab
        v-if="activeTab && activeTab.type === 'proxy-service-detail'"
        :key="activeTab.id"
        :service="activeTab.service"
        :proxy-host="proxyHost"
        @service-updated="handleServiceUpdated"
        @start-service="handleStartService"
        @stop-service="handleStopService"
        @service-deleted="handleServiceDeleted"
        :ref="(el) => setProxyServiceDetailTabRef(activeTab.id, el)"
      />

      <!-- 跳板服务器信息标签页内容 -->
      <JumpServerTab
        v-if="activeTab && activeTab.type === 'jump-server'"
        :key="activeTab.id"
        :service="activeTab.service"
      />

      <!-- 目标网站列表标签页内容 -->
      <TargetHostsTab
        v-if="activeTab && activeTab.type === 'target-hosts'"
        :key="activeTab.id"
        :config="activeTab.config"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import HostConfigTab from './HostConfigTab.vue';
import PACPreview from './PACPreview.vue';
import ProxyServiceLogTab from './ProxyServiceLogTab.vue';
import PACTab from './PACTab.vue';
import ProxyServiceDetailTab from './ProxyServiceDetailTab.vue';
import JumpServerTab from './JumpServerTab.vue';
import TargetHostsTab from './TargetHostsTab.vue';

const props = defineProps({
  pacUrl: {
    type: String,
    default: 'http://192.168.2.4/proxy.pac'
  },
  proxyHost: {
    type: String,
    default: '127.0.0.1'
  }
});

const emit = defineEmits(['pac-config-updated', 'service-updated', 'start-service', 'stop-service', 'service-deleted', 'config-updated']);

const pacPreviewRef = ref(null);
const hostConfigTabRef = ref(null);
const proxyServiceLogTabRefs = ref({});
const proxyServiceDetailTabRefs = ref({});

// 设置代理服务日志标签页的 ref
function setProxyServiceLogTabRef(tabId, el) {
  if (!proxyServiceLogTabRefs.value) {
    proxyServiceLogTabRefs.value = {};
  }
  if (el) {
    // 组件挂载时设置 ref
    proxyServiceLogTabRefs.value[tabId] = el;
    console.log(`[TabSystem] Set ref for ${tabId}`, el);
  } else {
    // 组件卸载时清理 ref（但保留对象结构）
    if (proxyServiceLogTabRefs.value[tabId]) {
      delete proxyServiceLogTabRefs.value[tabId];
      console.log(`[TabSystem] Removed ref for ${tabId}`);
    }
  }
}

// 设置代理服务详情标签页的 ref
function setProxyServiceDetailTabRef(tabId, el) {
  if (!proxyServiceDetailTabRefs.value) {
    proxyServiceDetailTabRefs.value = {};
  }
  if (el) {
    proxyServiceDetailTabRefs.value[tabId] = el;
  } else {
    if (proxyServiceDetailTabRefs.value[tabId]) {
      delete proxyServiceDetailTabRefs.value[tabId];
    }
  }
}

// 标签页列表
const tabs = ref([
  {
    id: 'pac-preview',
    type: 'pac-preview',
    label: '代理服务部署图',
    closable: false,
    active: true
  }
]);

// 当前活动标签页（始终显示第一个标签页的内容）
const activeTab = computed(() => {
  return tabs.value.find(tab => tab.active) || tabs.value[0];
});

// 打开Host配置标签页
function openHostConfigTab(config, onSaved) {
  const tabId = `host-config-${config.id}`;
  
  console.log('openHostConfigTab called:', { tabId, config });
  
  // 检查是否已存在
  const existingIndex = tabs.value.findIndex(t => t.id === tabId);
  
  if (existingIndex !== -1) {
    // 如果已存在，激活它
    tabs.value.forEach(tab => tab.active = false);
    tabs.value[existingIndex].active = true;
    // 更新配置数据
    tabs.value[existingIndex].config = config;
    tabs.value[existingIndex].onSaved = onSaved;
    console.log('激活已存在的标签页:', tabs.value[existingIndex]);
  } else {
    // 创建新标签页
    tabs.value.forEach(tab => tab.active = false);
    const newTab = {
      id: tabId,
      type: 'host-config',
      label: `Host配置 - ${config.name}`,
      closable: true,
      active: true,
      config: config,
      proxyServiceId: config.proxyServiceId,
      onSaved: onSaved
    };
    tabs.value.push(newTab);
    console.log('创建新标签页:', newTab);
  }
  
  // 确保标签页内容正确显示
  nextTick(() => {
    console.log('nextTick - activeTab:', activeTab.value);
    // 组件会自动响应 activeTab 的变化
  });
}

// Host配置保存后
function handleHostConfigSaved() {
  // 如果有关联的保存回调，调用它
  if (activeTab.value && activeTab.value.onSaved) {
    // 获取当前Host列表
    const hosts = hostConfigTabRef.value?.hosts || activeTab.value.config?.hosts || [];
    activeTab.value.onSaved(hosts);
  }
  
  // 刷新PAC配置
  refreshPACConfig();
}

// 刷新PAC配置
function refreshPACConfig() {
  if (pacPreviewRef.value) {
    pacPreviewRef.value.refresh();
  }
}

// PAC配置更新回调
function handlePACConfigUpdated(config) {
  // 通知父组件PAC配置已更新
  emit('pac-config-updated', config);
  // 刷新PAC预览
  refreshPACConfig();
}

// 服务更新回调
function handleServiceUpdated() {
  // 通知父组件服务已更新，需要刷新数据
  emit('service-updated');
}

// 处理服务删除
function handleServiceDeleted(serviceId) {
  // 关闭相关的标签页
  const tabId = `proxy-service-detail-${serviceId}`;
  const tabIndex = tabs.value.findIndex(t => t.id === tabId);
  if (tabIndex !== -1) {
    tabs.value.splice(tabIndex, 1);
    // 如果删除的是当前活动标签，激活第一个标签
    if (tabs.value.length > 0) {
      tabs.value[0].active = true;
    }
  }
  
  // 关闭相关的日志标签页
  const logTabs = tabs.value.filter(t => t.type === 'proxy-service-log' && t.service?.id === serviceId);
  logTabs.forEach(logTab => {
    const logTabIndex = tabs.value.findIndex(t => t.id === logTab.id);
    if (logTabIndex !== -1) {
      tabs.value.splice(logTabIndex, 1);
    }
  });
  
  // 通知父组件服务已删除，需要刷新数据
  emit('service-deleted', serviceId);
}

// 处理启动服务
function handleStartService(service) {
  emit('start-service', service);
}

// 处理停止服务
function handleStopService(service) {
  console.log('[TabSystem] handleStopService called, service:', service);
  emit('stop-service', service);
}

// 处理配置更新
function handleConfigUpdated(configData) {
  console.log('[TabSystem] handleConfigUpdated called, configData:', configData);
  // 刷新部署图
  refreshPACConfig();
  // 通知父组件配置已更新
  emit('config-updated', configData);
}

// 打开代理服务日志标签页
function openProxyServiceLogTab(service) {
  const tabId = `proxy-service-log-${service.id}`;
  
  // 检查是否已存在
  const existingIndex = tabs.value.findIndex(t => t.id === tabId);
  
  if (existingIndex !== -1) {
    // 如果已存在，激活它
    tabs.value.forEach(tab => tab.active = false);
    tabs.value[existingIndex].active = true;
    // 更新服务数据（确保使用最新的服务信息）
    tabs.value[existingIndex].service = { ...service };
    console.log(`[TabSystem] Activated existing log tab for service ${service.id}`);
  } else {
    // 创建新标签页
    tabs.value.forEach(tab => tab.active = false);
    const newTab = {
      id: tabId,
      type: 'proxy-service-log',
      label: `日志 - ${service.name}代理服务`,
      closable: true,
      active: true,
      service: { ...service }
    };
    tabs.value.push(newTab);
    console.log(`[TabSystem] Created new log tab for service ${service.id}`);
  }
  
  // 确保 refs 对象存在
  if (!proxyServiceLogTabRefs.value) {
    proxyServiceLogTabRefs.value = {};
  }
  
  // 强制触发响应式更新
  nextTick(() => {
    // 确保标签页被激活
    const tab = tabs.value.find(t => t.id === tabId);
    if (tab && !tab.active) {
      tabs.value.forEach(t => t.active = false);
      tab.active = true;
    }
  });
}

// 添加日志到指定的代理服务日志标签页或详情面板
function addLogToServiceLogTab(serviceId, level, message) {
  // 首先尝试向独立的日志标签页添加日志
  const logTabId = `proxy-service-log-${serviceId}`;
  const logTab = tabs.value.find(t => t.id === logTabId);
  
  if (logTab) {
    // 确保标签页是激活的
    if (!logTab.active) {
      tabs.value.forEach(t => t.active = false);
      logTab.active = true;
    }
    
    // 确保 refs 对象存在
    if (!proxyServiceLogTabRefs.value) {
      proxyServiceLogTabRefs.value = {};
    }
    
    // 添加日志，使用递归重试机制
    const tryAddLog = (retries = 10) => {
      nextTick(() => {
        const logTabRef = proxyServiceLogTabRefs.value[logTabId];
        if (logTabRef && typeof logTabRef.addLog === 'function') {
          logTabRef.addLog(level, message);
        } else if (retries > 0) {
          setTimeout(() => {
            tryAddLog(retries - 1);
          }, 150);
        }
      });
    };
    
    tryAddLog();
  }
  
  // 同时尝试向部署图中的详情面板添加日志
  // 查找是否有对应的详情标签页
  const detailTabId = `proxy-service-detail-${serviceId}`;
  const detailTab = tabs.value.find(t => t.id === detailTabId);
  
  if (detailTab) {
    const tryAddLogToDetail = (retries = 10) => {
      nextTick(() => {
        const detailTabRef = proxyServiceDetailTabRefs.value[detailTabId];
        if (detailTabRef && typeof detailTabRef.addLog === 'function') {
          detailTabRef.addLog(level, message);
        } else if (retries > 0) {
          setTimeout(() => {
            tryAddLogToDetail(retries - 1);
          }, 150);
        }
      });
    };
    
    tryAddLogToDetail();
  }
  
  // 如果当前在部署图页面，尝试向 NodeDetailView 中的 ProxyServiceDetailTab 添加日志
  const pacPreviewTab = tabs.value.find(t => t.id === 'pac-preview' && t.active);
  if (pacPreviewTab && pacPreviewRef.value) {
    const tryAddLogToPACPreview = (retries = 10) => {
      nextTick(() => {
        if (pacPreviewRef.value && typeof pacPreviewRef.value.addLogToService === 'function') {
          pacPreviewRef.value.addLogToService(serviceId, level, message);
        } else if (retries > 0) {
          setTimeout(() => {
            tryAddLogToPACPreview(retries - 1);
          }, 150);
        }
      });
    };
    
    tryAddLogToPACPreview();
  }
}

// 向代理服务详情标签页的日志面板添加日志
function addLogToServiceDetailTab(serviceId, level, message) {
  const detailTabId = `proxy-service-detail-${serviceId}`;
  const detailTab = tabs.value.find(t => t.id === detailTabId);
  
  if (detailTab) {
    const tryAddLog = (retries = 10) => {
      nextTick(() => {
        const detailTabRef = proxyServiceDetailTabRefs.value[detailTabId];
        if (detailTabRef && typeof detailTabRef.addLog === 'function') {
          detailTabRef.addLog(level, message);
        } else if (retries > 0) {
          setTimeout(() => {
            tryAddLog(retries - 1);
          }, 150);
        }
      });
    };
    
    tryAddLog();
  }
  
  // 如果当前在部署图页面，也尝试向 NodeDetailView 中的 ProxyServiceDetailTab 添加日志
  const pacPreviewTab = tabs.value.find(t => t.id === 'pac-preview' && t.active);
  if (pacPreviewTab && pacPreviewRef.value) {
    const tryAddLogToPACPreview = (retries = 10) => {
      nextTick(() => {
        if (pacPreviewRef.value && typeof pacPreviewRef.value.addLogToService === 'function') {
          pacPreviewRef.value.addLogToService(serviceId, level, message);
        } else if (retries > 0) {
          setTimeout(() => {
            tryAddLogToPACPreview(retries - 1);
          }, 150);
        }
      });
    };
    
    tryAddLogToPACPreview();
  }
}

// 打开PAC配置标签
function openPACTab() {
  const tabId = 'pac-config';
  const existingIndex = tabs.value.findIndex(t => t.id === tabId);
  
  if (existingIndex !== -1) {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value[existingIndex].active = true;
  } else {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value.push({
      id: tabId,
      type: 'pac-config',
      label: 'PAC配置',
      closable: true,
      active: true
    });
  }
}

// 打开代理服务部署图标签页
function openDeploymentDiagramTab() {
  const tabId = 'pac-preview';
  const existingIndex = tabs.value.findIndex(t => t.id === tabId);
  
  if (existingIndex !== -1) {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value[existingIndex].active = true;
  } else {
    // 如果不存在，创建新标签页（虽然通常应该已经存在）
    tabs.value.forEach(tab => tab.active = false);
    tabs.value.push({
      id: tabId,
      type: 'pac-preview',
      label: '代理服务部署图',
      closable: false,
      active: true
    });
  }
}

// 打开代理服务详情标签
function openProxyServiceDetailTab(service) {
  const tabId = `proxy-service-detail-${service.id}`;
  const existingIndex = tabs.value.findIndex(t => t.id === tabId);
  
  if (existingIndex !== -1) {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value[existingIndex].active = true;
    tabs.value[existingIndex].service = { ...service };
  } else {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value.push({
      id: tabId,
      type: 'proxy-service-detail',
      label: `代理服务 - ${service.name}`,
      closable: true,
      active: true,
      service: { ...service }
    });
  }
}

// 打开跳板服务器信息标签
function openJumpServerTab(service) {
  const tabId = `jump-server-${service.id}`;
  const existingIndex = tabs.value.findIndex(t => t.id === tabId);
  
  if (existingIndex !== -1) {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value[existingIndex].active = true;
    tabs.value[existingIndex].service = { ...service };
  } else {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value.push({
      id: tabId,
      type: 'jump-server',
      label: `跳板服务器 - ${service.jump_host}`,
      closable: true,
      active: true,
      service: { ...service }
    });
  }
}

// 打开目标网站列表标签
function openTargetHostsTab(config) {
  const tabId = `target-hosts-${config.id}`;
  const existingIndex = tabs.value.findIndex(t => t.id === tabId);
  
  if (existingIndex !== -1) {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value[existingIndex].active = true;
    tabs.value[existingIndex].config = { ...config };
  } else {
    tabs.value.forEach(tab => tab.active = false);
    tabs.value.push({
      id: tabId,
      type: 'target-hosts',
      label: `目标网站 - ${config.name}`,
      closable: true,
      active: true,
      config: { ...config }
    });
  }
}

// 选中部署图中的节点
function selectDiagramNode(nodeId) {
  if (pacPreviewRef.value && pacPreviewRef.value.selectNode) {
    pacPreviewRef.value.selectNode(nodeId);
  }
}

// 暴露方法给父组件
defineExpose({
  openHostConfigTab,
  openProxyServiceLogTab,
  addLogToServiceLogTab,
  addLogToServiceDetailTab,
  refreshPACConfig,
  openPACTab,
  openDeploymentDiagramTab,
  openProxyServiceDetailTab,
  openJumpServerTab,
  openTargetHostsTab,
  selectDiagramNode,
  tabs // 暴露tabs以便检查标签页是否存在
});
</script>

<style scoped>
.tab-system {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 标签页内容区域 */
.tabs-content {
  flex: 1;
  overflow: auto;
  background-color: #fafbfc;
  margin: 0;
  padding: 0;
}
</style>

