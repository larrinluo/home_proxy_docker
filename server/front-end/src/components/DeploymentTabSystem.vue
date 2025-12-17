<template>
  <div class="deployment-tab-system">
    <!-- 标签页头部 -->
    <div class="tabs-header">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-item', { active: tab.active, closable: tab.closable }]"
        @click="handleTabClick(tab.id)"
      >
        <span class="tab-label">{{ tab.label }}</span>
        <el-icon
          v-if="tab.closable"
          class="close-icon"
          @click.stop="handleCloseTab(tab.id)"
        >
          <Close />
        </el-icon>
      </div>
    </div>

    <!-- 标签页内容区域 -->
    <div class="tabs-content">
      <!-- 没有标签页时显示提示 -->
      <div v-if="tabs.length === 0" class="empty-tabs">
        <p>点击部署图中的节点查看详细信息</p>
      </div>

      <!-- PAC配置标签页内容 -->
      <PACTab
        v-else-if="activeTab && activeTab.type === 'pac-config'"
        :key="activeTab.id"
        :pac-url="pacUrl"
        @pac-config-updated="handlePACConfigUpdated"
      />

      <!-- 代理服务详情标签页内容 -->
      <ProxyServiceDetailTab
        v-else-if="activeTab && activeTab.type === 'proxy-service-detail'"
        :key="activeTab.id"
        :service="activeTab.service"
        :proxy-host="proxyHost"
      />

      <!-- 跳板服务器信息标签页内容 -->
      <JumpServerTab
        v-else-if="activeTab && activeTab.type === 'jump-server'"
        :key="activeTab.id"
        :service="activeTab.service"
      />

      <!-- 目标网站列表标签页内容 -->
      <TargetHostsTab
        v-else-if="activeTab && activeTab.type === 'target-hosts'"
        :key="activeTab.id"
        :config="activeTab.config"
      />

      <!-- 没有活动标签页时显示提示 -->
      <div v-else-if="!activeTab" class="empty-tabs">
        <p>请选择一个标签页</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Close } from '@element-plus/icons-vue';
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

// 标签页列表
const tabs = ref([
  {
    id: 'pac-config',
    type: 'pac-config',
    label: 'PAC代理配置',
    closable: false,
    active: true
  }
]);

// 当前活动标签页
const activeTab = computed(() => {
  return tabs.value.find(tab => tab.active);
});

// 点击标签页
function handleTabClick(tabId) {
  tabs.value.forEach(tab => {
    tab.active = tab.id === tabId;
  });
}

// 关闭标签页
function handleCloseTab(tabId) {
  const index = tabs.value.findIndex(t => t.id === tabId);
  if (index !== -1 && tabs.value[index].closable) {
    const wasActive = tabs.value[index].active;
    tabs.value.splice(index, 1);
    
    // 如果删除的是活动标签，激活最后一个
    if (wasActive && tabs.value.length > 0) {
      tabs.value[tabs.value.length - 1].active = true;
    }
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
      label: 'PAC代理配置',
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

// 处理PAC配置更新
function handlePACConfigUpdated(config) {
  // 可以在这里处理PAC配置更新后的逻辑
  // 如果需要更新父组件的pacUrl，可以通过emit事件
}

// 暴露方法给父组件
defineExpose({
  openPACTab,
  openProxyServiceDetailTab,
  openJumpServerTab,
  openTargetHostsTab
});
</script>

<style scoped>
.deployment-tab-system {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 标签页头部 */
.tabs-header {
  display: flex;
  align-items: flex-end;
  padding: 10px 10px 0 10px;
  margin: 0;
  background-color: #fafbfc;
  border-bottom: 1px solid #e4e7ed;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  line-height: 0;
}

.tabs-header::-webkit-scrollbar {
  display: none;
}

.tab-item {
  display: flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  background-color: #f5f5f5;
  border: 1px solid #e4e7ed;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  font-size: 13px;
  color: #333333;
  margin: 0;
  user-select: none;
}

.tab-item:hover {
  background-color: #e8e8e8;
}

.tab-item.active {
  background-color: #fafbfc;
  border-color: #e4e7ed;
  border-bottom-color: #fafbfc;
  color: #3399ff;
  font-weight: 600;
  position: relative;
  top: 0;
  margin-bottom: -1px;
}

.tab-label {
  margin-right: 8px;
}

.close-icon {
  font-size: 12px;
  color: #b3b3b3;
  cursor: pointer;
  padding: 2px;
}

.close-icon:hover {
  color: #333333;
}

.tab-item:not(.closable) .close-icon {
  display: none;
}

/* 标签页内容区域 */
.tabs-content {
  flex: 1;
  overflow: auto;
  background-color: #fafbfc;
  margin: 0;
  padding: 0;
}

.empty-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}

.empty-tabs p {
  margin: 0;
}
</style>

