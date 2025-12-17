<template>
  <div class="pac-preview">
    <!-- 上方：部署图 -->
    <div class="top-panel">
      <ProxyDeploymentDiagram
        :key="`diagram-${pacUrl}`"
        :pac-url="pacUrl"
        :proxy-host="proxyHost"
        @node-click="handleNodeClick"
        ref="diagramRef"
      />
    </div>
    <!-- 下方：选中节点详细信息 -->
    <div class="bottom-panel">
      <NodeDetailView
        :selected-node="selectedNode"
        :pac-url="pacUrl"
        :proxy-host="proxyHost"
        @pac-config-updated="handlePACConfigUpdated"
        @service-updated="handleServiceUpdated"
        @start-service="handleStartService"
        @stop-service="handleStopService"
        @service-deleted="handleServiceDeleted"
        @config-updated="handleConfigUpdated"
        ref="nodeDetailViewRef"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import ProxyDeploymentDiagram from './ProxyDeploymentDiagram.vue';
import NodeDetailView from './NodeDetailView.vue';

const props = defineProps({
  pacUrl: {
    type: String,
    default: ''
  },
  proxyHost: {
    type: String,
    default: '127.0.0.1'
  }
});

const diagramRef = ref(null);
const selectedNode = ref(null);
const nodeDetailViewRef = ref(null);

const emit = defineEmits(['pac-config-updated', 'service-updated', 'start-service', 'stop-service', 'service-deleted', 'config-updated']);

// 处理节点点击事件
function handleNodeClick(nodeData) {
  console.log('[PACPreview] handleNodeClick received:', nodeData);
  // 使用 Object.assign 或展开运算符确保 Vue 能检测到变化
  selectedNode.value = nodeData ? { ...nodeData } : null;
  console.log('[PACPreview] selectedNode updated to:', selectedNode.value);
}

// 处理PAC配置更新
function handlePACConfigUpdated(config) {
  console.log('[PACPreview] PAC config updated:', config);
  emit('pac-config-updated', config);
  // 强制刷新部署图以显示新的PAC地址
  // 使用setTimeout确保props已经更新
  setTimeout(() => {
    if (diagramRef.value && diagramRef.value.refresh) {
      console.log('[PACPreview] Calling diagram refresh');
      diagramRef.value.refresh();
    } else {
      console.warn('[PACPreview] Diagram ref not available');
    }
  }, 100);
}

// 处理服务更新
async function handleServiceUpdated() {
  emit('service-updated');
  // 刷新部署图以显示更新的服务状态
  setTimeout(() => {
    if (diagramRef.value && diagramRef.value.refresh) {
      diagramRef.value.refresh();
    }
  }, 100);
  
  // 如果当前选中的节点是服务节点，更新其服务数据
  if (selectedNode.value && selectedNode.value.service) {
    const serviceId = selectedNode.value.service.id;
    // 重新获取服务数据
    import('../api/proxy-services').then(({ getProxyService }) => {
      getProxyService(serviceId).then(response => {
        if (response && response.success && response.data) {
          // 更新选中节点的服务数据
          selectedNode.value = {
            ...selectedNode.value,
            service: response.data
          };
        }
      }).catch(err => {
        console.error('[PACPreview] Error fetching updated service data:', err);
      });
    });
  }
}

// 处理启动服务
function handleStartService(service) {
  emit('start-service', service);
}

// 处理停止服务
function handleStopService(service) {
  console.log('[PACPreview] handleStopService called, service:', service);
  emit('stop-service', service);
}

// 处理服务删除
async function handleServiceDeleted(serviceId) {
  console.log('[PACPreview] handleServiceDeleted called, serviceId:', serviceId);
  emit('service-deleted', serviceId);
  
  // 如果当前选中的节点是被删除的服务，清空选中状态
  if (selectedNode.value && selectedNode.value.service && selectedNode.value.service.id === serviceId) {
    selectedNode.value = null;
  }
  
  // 刷新部署图以移除已删除的服务
  setTimeout(() => {
    if (diagramRef.value && diagramRef.value.refresh) {
      diagramRef.value.refresh();
    }
  }, 100);
}

// 处理配置更新
async function handleConfigUpdated(configData) {
  console.log('[PACPreview] handleConfigUpdated called, configData:', configData);
  emit('config-updated', configData);
  
  // 刷新部署图以显示更新的域名数量
  setTimeout(() => {
    if (diagramRef.value && diagramRef.value.refresh) {
      diagramRef.value.refresh();
    }
  }, 100);
  
  // 如果当前选中的节点是配置节点，更新其配置数据
  if (selectedNode.value && selectedNode.value.config && selectedNode.value.config.id === configData.id) {
    selectedNode.value = {
      ...selectedNode.value,
      config: {
        ...selectedNode.value.config,
        hosts: configData.hosts
      }
    };
  }
}

// 选中部署图中的节点
function selectNode(nodeId) {
  if (diagramRef.value && diagramRef.value.selectNode) {
    diagramRef.value.selectNode(nodeId);
  }
}

// 暴露方法给父组件
defineExpose({
  refresh: () => {
    if (diagramRef.value && diagramRef.value.refresh) {
      diagramRef.value.refresh();
    }
  },
  selectNode,
  addLogToService: (serviceId, level, message) => {
    if (nodeDetailViewRef.value && typeof nodeDetailViewRef.value.addLogToService === 'function') {
      nodeDetailViewRef.value.addLogToService(serviceId, level, message);
    }
  }
});
</script>

<style scoped>
.pac-preview {
  padding: 0;
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.top-panel {
  width: 100%;
  height: 400px;
  padding: 0;
  margin: 0;
  border-bottom: 1px solid #e4e7ed;
  overflow: hidden;
  flex-shrink: 0;
}

.bottom-panel {
  width: 100%;
  flex: 1;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.preview-content {
  flex: 1;
  background-color: #ffffff;
  border: none;
  border-radius: 0;
  padding: 0;
  margin: 0;
  overflow: auto;
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: #c1c1c1 #ffffff; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.preview-content::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.preview-content::-webkit-scrollbar-track {
  background: #f5f5f5;
}

.preview-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.preview-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.code-block {
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', 'Fira Code', 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  background-color: #ffffff;
  color: #24292e;
  padding: 10px 10px 10px 10px;
  border-radius: 0;
  font-variant-ligatures: none;
  letter-spacing: 0;
}

.code-block :deep(code) {
  white-space: pre-wrap;
  word-wrap: break-word;
  display: block;
  color: inherit;
  background: transparent;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
</style>
