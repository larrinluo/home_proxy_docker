<template>
  <div class="node-detail-view">
    <!-- 没有选中节点时显示提示 -->
    <div v-if="!selectedNode" class="empty-state">
      <p>点击部署图中的节点查看详细信息</p>
    </div>

    <!-- PAC服务节点详情 -->
    <PACTab
      v-else-if="selectedNode.nodeId && selectedNode.nodeId.startsWith('pac-')"
      :pac-url="pacUrl"
      @pac-config-updated="handlePACConfigUpdated"
    />

    <!-- 本地代理服务器节点详情 -->
    <ProxyServiceDetailTab
      v-else-if="selectedNode.nodeId && selectedNode.nodeId.startsWith('local-')"
      :service="selectedNode.service"
      :proxy-host="proxyHost"
      @service-updated="handleServiceUpdated"
      @start-service="handleStartService"
      @stop-service="handleStopService"
      @service-deleted="handleServiceDeleted"
      ref="proxyServiceDetailTabRef"
    />

    <!-- 跳板服务器节点详情 -->
    <JumpServerTab
      v-else-if="selectedNode.nodeId && selectedNode.nodeId.startsWith('jump-')"
      :service="selectedNode.service"
    />

    <!-- 目标网站节点详情 -->
    <TargetHostsTab
      v-else-if="selectedNode.nodeId && selectedNode.nodeId.startsWith('target-')"
      :config="selectedNode.config"
      @config-updated="handleConfigUpdated"
    />

    <!-- 客户端节点详情 -->
    <div v-else-if="selectedNode.nodeId && selectedNode.nodeId.startsWith('client-')" class="client-detail">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="节点类型">客户端 (浏览器)</el-descriptions-item>
        <el-descriptions-item label="说明">用户使用的浏览器客户端，通过PAC配置获取代理设置</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import PACTab from './PACTab.vue';
import ProxyServiceDetailTab from './ProxyServiceDetailTab.vue';
import JumpServerTab from './JumpServerTab.vue';
import TargetHostsTab from './TargetHostsTab.vue';

const proxyServiceDetailTabRef = ref(null);

const props = defineProps({
  selectedNode: {
    type: Object,
    default: null
  },
  pacUrl: {
    type: String,
    default: ''
  },
  proxyHost: {
    type: String,
    default: '127.0.0.1'
  }
});

const emit = defineEmits(['pac-config-updated', 'service-updated', 'start-service', 'stop-service', 'service-deleted', 'config-updated']);

// 处理PAC配置更新
function handlePACConfigUpdated(config) {
  emit('pac-config-updated', config);
}

// 处理服务更新
function handleServiceUpdated() {
  emit('service-updated');
}

// 处理启动服务
function handleStartService(service) {
  emit('start-service', service);
}

// 处理停止服务
function handleStopService(service) {
  console.log('[NodeDetailView] handleStopService called, service:', service);
  emit('stop-service', service);
}

// 处理服务删除
function handleServiceDeleted(serviceId) {
  emit('service-deleted', serviceId);
}

// 处理配置更新
function handleConfigUpdated(configData) {
  emit('config-updated', configData);
}

// 暴露方法给父组件
defineExpose({
  addLogToService: (serviceId, level, message) => {
    if (proxyServiceDetailTabRef.value && 
        props.selectedNode && 
        props.selectedNode.service && 
        props.selectedNode.service.id === serviceId) {
      if (typeof proxyServiceDetailTabRef.value.addLog === 'function') {
        proxyServiceDetailTabRef.value.addLog(level, message);
      }
    }
  }
});
</script>

<style scoped>
.node-detail-view {
  height: 100%;
  overflow: auto;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}

.empty-state p {
  margin: 0;
}

.client-detail {
  padding: 20px;
}
</style>

