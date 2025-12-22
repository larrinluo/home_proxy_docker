<template>
  <div class="deployment-diagram">
    <div class="diagram-title">家庭网络自动代理服务配置图</div>
    <div class="diagram-container" ref="diagramContainer"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { getProxyServices } from '../api/proxy-services';
import { getHostConfigs } from '../api/host-configs';
import { getServiceAddress, getSystemConfigs } from '../api/system-configs';
// 静态导入vis-network CSS（确保样式加载）
import 'vis-network/styles/vis-network.min.css';

const props = defineProps({
  serviceId: {
    type: Number,
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

const diagramContainer = ref(null);
let diagramInstance = null;
const currentPacUrl = ref(props.pacUrl || '');
const currentProxyHost = ref(props.proxyHost || '127.0.0.1');
const servicesData = ref([]); // 保存服务数据
const configsData = ref([]); // 保存配置数据
const currentSelectedNodeId = ref(null); // 保存当前选中的节点ID

const emit = defineEmits(['node-click']);

// 加载配置信息（仅在props未提供时使用）
async function loadConfig() {
  // 如果props已提供值，直接使用
  if (props.pacUrl) {
    currentPacUrl.value = props.pacUrl;
  }
  if (props.proxyHost && props.proxyHost !== '127.0.0.1') {
    currentProxyHost.value = props.proxyHost;
  }
  
  // 如果props未提供，才从系统配置获取
  if (!props.pacUrl || !props.proxyHost || props.proxyHost === '127.0.0.1') {
    try {
      // 获取系统配置中的代理服务器IP
      const configsResponse = await getSystemConfigs();
      if (configsResponse.success) {
        const pacHostConfig = configsResponse.data.items.find(c => c.key === 'pac_service_host');
        if (pacHostConfig && pacHostConfig.value && pacHostConfig.value !== '192.168.1.4') {
          if (!props.proxyHost || props.proxyHost === '127.0.0.1') {
            currentProxyHost.value = pacHostConfig.value;
          }
        } else {
          // 如果未设置，动态获取
          const addressResponse = await getServiceAddress();
          if (addressResponse.success) {
            if (!props.proxyHost || props.proxyHost === '127.0.0.1') {
              currentProxyHost.value = addressResponse.data.host;
            }
            if (!props.pacUrl) {
              currentPacUrl.value = addressResponse.data.pacURL;
            }
          }
        }
        
        // 获取PAC URL
        if (!props.pacUrl) {
          const pacPortConfig = configsResponse.data.items.find(c => c.key === 'pac_service_port');
          const pacHostConfig = configsResponse.data.items.find(c => c.key === 'pac_service_host');
          if (pacHostConfig && pacPortConfig && pacHostConfig.value && pacPortConfig.value) {
            currentPacUrl.value = `http://${pacHostConfig.value}:${pacPortConfig.value}/proxy.pac`;
          }
        }
      }
    } catch (error) {
      console.error('Load config error:', error);
    }
  }
}

// 使用 vis-network 来绘制图表
async function renderDiagram() {
  if (!diagramContainer.value) {
    // 如果容器还没有准备好，等待一下再试
    setTimeout(() => {
      if (diagramContainer.value) {
        renderDiagram();
      }
    }, 100);
    return;
  }

  try {
    // 确保容器已准备好
    if (!diagramContainer.value) {
      console.warn('[ProxyDeploymentDiagram] Container not ready in renderDiagram, waiting...');
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!diagramContainer.value) {
        console.error('[ProxyDeploymentDiagram] Container still not ready after wait');
        return;
      }
    }
    
    // 显示加载状态
    diagramContainer.value.innerHTML = '<div class="loading-state">正在加载部署图...</div>';
    
    // 优先使用props提供的值
    if (props.pacUrl) {
      currentPacUrl.value = props.pacUrl;
    }
    if (props.proxyHost && props.proxyHost !== '127.0.0.1') {
      currentProxyHost.value = props.proxyHost;
    }
    
    // 如果props未提供，才从系统配置加载
    if (!props.pacUrl || !props.proxyHost || props.proxyHost === '127.0.0.1') {
      await loadConfig();
    }
    
    // 获取数据
    const servicesResponse = await getProxyServices();
    const configsResponse = await getHostConfigs();
    
    if (!servicesResponse) {
      throw new Error('获取代理服务列表失败：响应为空');
    }
    
    if (!configsResponse) {
      throw new Error('获取Host配置列表失败：响应为空');
    }
    
    // request工具返回格式：{ success: true, data: { items: [...], total, page, pageSize } }
    // 或者：{ success: true, data: [...] }
    let services = [];
    if (servicesResponse && servicesResponse.success) {
      if (Array.isArray(servicesResponse.data)) {
        services = servicesResponse.data;
      } else if (servicesResponse.data && Array.isArray(servicesResponse.data.items)) {
        services = servicesResponse.data.items;
      } else {
        console.warn('Unexpected services response format:', servicesResponse);
      }
    }
    
    let configs = [];
    if (configsResponse && configsResponse.success) {
      if (Array.isArray(configsResponse.data)) {
        configs = configsResponse.data;
      } else if (configsResponse.data && Array.isArray(configsResponse.data.items)) {
        configs = configsResponse.data.items;
      } else {
        console.warn('Unexpected configs response format:', configsResponse);
      }
    }
    
    // 确保是数组
    if (!Array.isArray(services)) {
      console.error('Services is not an array:', services, 'Response:', servicesResponse);
      services = [];
    }
    if (!Array.isArray(configs)) {
      console.error('Configs is not an array:', configs, 'Response:', configsResponse);
      configs = [];
    }
    
    // 过滤特定服务（如果指定）
    const filteredServices = props.serviceId 
      ? services.filter(s => s.id === props.serviceId)
      : services;
    
    // 即使没有代理服务，也显示配置图框架（至少显示 PAC 服务节点和配置节点）
    // 保存数据以便在点击事件中使用
    servicesData.value = filteredServices;
    configsData.value = configs;
    
    // 构建节点和边的数据（即使没有服务，也会显示 PAC 和配置节点）
    const { nodes, edges } = buildDiagramData(filteredServices, configs);
    
    // 如果没有节点（既没有服务也没有配置），显示提示信息
    if (nodes.length === 0) {
      if (diagramContainer.value) {
        diagramContainer.value.innerHTML = '<div class="empty-state">暂无配置信息</div>';
      }
      return;
    }
    
    // 使用 vis-network 渲染
    await renderWithVisNetwork(nodes, edges);
    
  } catch (error) {
    console.error('Render diagram error:', error);
    if (diagramContainer.value) {
      let errorMessage = '未知错误';
      if (error.response) {
        // HTTP 错误响应
        const status = error.response.status;
        if (status === 401) {
          errorMessage = '未授权：请重新登录';
        } else if (status === 403) {
          errorMessage = '没有权限访问';
        } else if (status === 404) {
          errorMessage = '资源不存在';
        } else if (status >= 500) {
          errorMessage = '服务器错误，请稍后重试';
        } else {
          errorMessage = error.response.data?.error?.message || `请求失败 (${status})`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      diagramContainer.value.innerHTML = `<div class="error-state">加载失败: ${errorMessage}</div>`;
    }
  }
}

function buildDiagramData(services, configs) {
  const nodes = [];
  const edges = [];
  
  // 统一颜色配置 - 科技感配色
  const unifiedColor = { background: '#e3f2fd', border: '#2196f3' };
  const edgeColor = { color: '#64b5f6' };
  
  // 第一列：创建PAC服务节点（只创建一个，因为PAC服务是共享的）
  const pacUrl = currentPacUrl.value || 'http://192.168.2.4:8090/proxy.pac';
  const pacNodeId = 'pac-service';
  nodes.push({
    id: pacNodeId,
    label: `<b>🐳 自动代码配置服务</b>\n${pacUrl}`,
    group: 'pac',
    shape: 'box',
    color: unifiedColor,
    level: 0 // 第一列
  });
  
  // 第二列：创建所有配置节点
  configs.forEach((config) => {
    const hosts = Array.isArray(config.hosts) ? config.hosts : JSON.parse(config.hosts || '[]');
    const hostCount = hosts.length;
    const sampleHosts = getSampleHosts(config);
    const configName = config.name || '默认代理配置';
    const configNodeId = `target-${config.id}`;
    
    // 构建节点标签
    let label = `<b>📋 ${configName}</b>`;
    if (hostCount > 0) {
      label += `\n${hostCount} 个域名\n${sampleHosts}`;
    } else {
      label += `\n0 个域名\n未配置域名`;
    }
    
    console.log(`[ProxyDeploymentDiagram] Creating config node ${config.id} (${configName}) with ${hostCount} hosts`);
    
    nodes.push({
      id: configNodeId,
      label: label,
      group: 'target',
      shape: 'box',
      color: hostCount > 0 ? unifiedColor : { background: '#f5f5f5', border: '#9e9e9e' },
      level: 1 // 第二列：所有配置节点都在这一列
    });
    
    // 边：PAC服务 -> 配置（无箭头、无标签）
    edges.push({
      from: pacNodeId,
      to: configNodeId,
      arrows: { to: { enabled: false } }, // 明确禁用箭头
      color: hostCount > 0 ? edgeColor : { color: '#9e9e9e' }
    });
  });
  
  // 第三列：创建所有代理服务节点（如果没有服务，不创建节点，但配置图仍然显示）
  if (services.length > 0) {
    services.forEach((service) => {
      const proxyAddress = `${currentProxyHost.value}:${service.proxy_port}`;
      const jumpServer = `${service.jump_username}@${service.jump_host}:${service.jump_port || 22}`;
      const serviceNodeId = `local-${service.id}`;
      
      nodes.push({
        id: serviceNodeId,
        label: `<b>🖥️ 本地代理服务器 ${getStatusBadge(service.status)}</b>\n${service.name}\n${proxyAddress}\n跳板: ${jumpServer}`,
        group: 'local',
        shape: 'box',
        color: unifiedColor,
        level: 2 // 第三列：所有代理服务都在这一列
      });
      
      // 找到该服务关联的所有配置，创建边：配置 -> 代理服务
      const serviceConfigs = configs.filter(c => c.proxyServiceId === service.id);
      console.log(`[ProxyDeploymentDiagram] Service ${service.id} (${service.name}) has ${serviceConfigs.length} config(s)`);
      
      serviceConfigs.forEach((config) => {
        const configNodeId = `target-${config.id}`;
        const hosts = Array.isArray(config.hosts) ? config.hosts : JSON.parse(config.hosts || '[]');
        const hostCount = hosts.length;
        
        // 边：配置 -> 代理服务
        edges.push({
          from: configNodeId,
          to: serviceNodeId,
          label: `SSH隧道\n(autossh)\nSOCKS5`,
          arrows: 'to',
          color: hostCount > 0 ? edgeColor : { color: '#9e9e9e' }
        });
      });
    });
  } else {
    // 如果没有代理服务，在配置节点上显示提示信息
    console.log('[ProxyDeploymentDiagram] No proxy services, showing config nodes only');
  }
  
  return { nodes, edges };
}

function getStatusBadge(status) {
  const badges = {
    running: '🟢',
    stopped: '⚪',
    error: '🔴'
  };
  return badges[status] || '';
}

function getStatusColor(status) {
  const colors = {
    running: { background: '#e8f5e9', border: '#4caf50' },
    stopped: { background: '#fafafa', border: '#9e9e9e' },
    error: { background: '#ffebee', border: '#f44336' }
  };
  return colors[status] || colors.stopped;
}

function getSampleHosts(config) {
  if (!config || !config.hosts) return '';
  const hosts = Array.isArray(config.hosts) ? config.hosts : JSON.parse(config.hosts || '[]');
  const samples = hosts.slice(0, 3).join(', ');
  return hosts.length > 3 ? `${samples}...` : samples;
}

async function renderWithVisNetwork(nodes, edges) {
  try {
    // 动态导入 vis-network（CSS已在顶部静态导入）
    const { Network } = await import('vis-network');
    
    // 如果容器未准备好，等待并重试
    if (!diagramContainer.value) {
      console.warn('[ProxyDeploymentDiagram] Container not ready, waiting...');
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!diagramContainer.value) {
        throw new Error('图表容器未准备好');
      }
    }
    
    // 根据容器宽度计算水平间距，使每列约占1/3宽度
    const containerWidth = diagramContainer.value.clientWidth || 1200; // 默认宽度
    // 计算水平间距：容器宽度 / 3，减去节点宽度的一半（左右各一半）
    const nodeWidth = 250; // 节点平均宽度
    const levelSeparation = Math.max(350, Math.floor((containerWidth - nodeWidth) / 3));
    
    console.log(`[ProxyDeploymentDiagram] Container width: ${containerWidth}, calculated levelSeparation: ${levelSeparation}`);
    
    const data = { nodes, edges };
    const options = {
      nodes: {
        font: { 
          size: 12,
          multi: 'html', // 支持HTML格式，包括加粗
          align: 'center',
          face: 'Arial, sans-serif'
        },
        margin: 10, // 增加节点边距，避免节点内容重叠
        widthConstraint: { 
          minimum: 200,
          maximum: 300 
        },
        heightConstraint: {
          minimum: 80, // 增加最小高度，确保节点有足够空间显示内容
          maximum: 150 // 设置最大高度，避免节点过大
        },
        shapeProperties: {
          borderRadius: 8
        },
        borderWidth: 1,
        chosen: {
          node: function(values, id, selected, hovering) {
            if (selected) {
              // 选中状态：边线加粗，背景色高亮
              values.borderWidth = 3;
              values.borderColor = '#2196f3';
              // 保持高亮背景色
              if (values.color && typeof values.color === 'object') {
                values.color.background = '#bbdefb'; // 更亮的蓝色背景
                values.color.border = '#2196f3';
              }
            } else if (hovering) {
              // 悬停状态：边线稍微加粗
              values.borderWidth = 2;
              values.borderColor = '#64b5f6';
            } else {
              // 默认状态
              values.borderWidth = 1;
            }
          }
        }
      },
      edges: {
        font: { 
          size: 11, 
          align: 'middle',
          multi: true // 支持多行标签
        },
        arrows: { to: { enabled: true, scaleFactor: 1.2 } },
        smooth: false, // 使用直线连接
        width: 1,
        labelHighlightBold: false
      },
      layout: {
        hierarchical: {
          enabled: true,
          direction: 'LR', // 从左到右
          sortMethod: 'directed',
          levelSeparation: levelSeparation, // 根据容器宽度动态计算，使每列约占1/3宽度
          nodeSpacing: 120, // 垂直间距，适中的间距使节点清晰但不拥挤
          treeSpacing: 80, // 树间距，适中的间距避免节点重叠
          blockShifting: true, // 启用块移动，优化布局
          edgeMinimization: true, // 最小化边长度
          parentCentralization: true, // 启用父节点居中，使每列内容居中
          shakeTowards: 'leaves' // 将节点向叶子节点方向移动，避免重叠
        }
      },
      physics: {
        enabled: false // 使用层次布局时禁用物理引擎
      },
      interaction: {
        zoomView: false, // 禁用鼠标滚动缩放
        dragView: false, // 禁用拖动移动
        hover: true,
        tooltipDelay: 100,
        dragNodes: false, // 禁用节点拖动
        zoomSpeed: 1 // 缩放速度（即使禁用缩放也设置）
      }
    };
    
    if (diagramInstance) {
      diagramInstance.destroy();
      diagramInstance = null;
    }
    
    diagramInstance = new Network(diagramContainer.value, data, options);
    
    // 添加节点点击事件
    diagramInstance.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        // 保存当前选中的节点ID
        currentSelectedNodeId.value = nodeId;
        // 设置选中状态
        diagramInstance.setSelection({ nodes: [nodeId] });
        handleNodeClick(nodeId);
      } else {
        // 点击空白处：恢复之前选中的节点，保持当前选择
        if (currentSelectedNodeId.value) {
          diagramInstance.setSelection({ nodes: [currentSelectedNodeId.value] });
        }
      }
    });
    
    // 监听选中状态变化，确保选中状态保持
    diagramInstance.on('select', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        currentSelectedNodeId.value = nodeId;
      } else {
        // 如果选中状态被清空（点击空白处），立即恢复之前选中的节点
        if (currentSelectedNodeId.value) {
          // 使用 setTimeout 确保在 vis-network 处理完点击事件后再恢复选中
          setTimeout(() => {
            diagramInstance.setSelection({ nodes: [currentSelectedNodeId.value] });
          }, 0);
        }
      }
    });
    
    // 如果有保存的选中节点，恢复选中；否则默认选中PAC服务节点
    const nodeToSelect = currentSelectedNodeId.value || 'pac-service';
    if (nodeToSelect) {
      // 等待网络渲染完成后再选中
      setTimeout(() => {
        diagramInstance.setSelection({ nodes: [nodeToSelect] });
        handleNodeClick(nodeToSelect);
        // 如果是默认选中的PAC节点，保存它
        if (!currentSelectedNodeId.value) {
          currentSelectedNodeId.value = nodeToSelect;
        }
      }, 200);
    }
  } catch (error) {
    console.error('Render vis-network error:', error);
    throw error;
  }
}

// 处理节点点击
function handleNodeClick(nodeId) {
  let service = null;
  let config = null;
  
  // 根据节点ID类型处理
  if (nodeId === 'pac-service') {
    // PAC服务节点，不需要关联服务或配置
    emit('node-click', {
      nodeId,
      service: null,
      config: null
    });
    return;
  } else if (nodeId.startsWith('local-')) {
    // 本地代理服务器节点
    const serviceId = parseInt(nodeId.replace('local-', ''));
    service = servicesData.value.find(s => s.id === serviceId);
  } else if (nodeId.startsWith('target-')) {
    // 目标配置节点
    if (nodeId.startsWith('target-empty-')) {
      // 空配置节点
      const serviceId = parseInt(nodeId.replace('target-empty-', ''));
      service = servicesData.value.find(s => s.id === serviceId);
    } else {
      // 有配置的节点
      const configIdStr = nodeId.replace('target-', '');
      const configId = parseInt(configIdStr, 10);
      console.log(`[ProxyDeploymentDiagram] handleNodeClick - target node:`, {
        nodeId,
        configIdStr,
        configId,
        configsDataLength: configsData.value.length,
        allConfigs: configsData.value.map(c => ({ id: c.id, idType: typeof c.id, name: c.name }))
      });
      
      // 尝试多种方式查找配置（处理ID类型不匹配的情况）
      config = configsData.value.find(c => c.id === configId || String(c.id) === configIdStr || c.id === configIdStr);
      
      if (!config) {
        console.error(`[ProxyDeploymentDiagram] Config not found for ID: ${configId} (from nodeId: ${nodeId})`);
      } else {
        console.log(`[ProxyDeploymentDiagram] Found config:`, config);
      }
      
      if (config && config.proxyServiceId) {
        service = servicesData.value.find(s => s.id === config.proxyServiceId || String(s.id) === String(config.proxyServiceId));
      }
    }
  }
  
  // 发送节点点击事件
  const nodeData = {
    nodeId,
    service,
    config
  };
  console.log(`[ProxyDeploymentDiagram] Emitting node-click event:`, nodeData);
  emit('node-click', nodeData);
}

onMounted(() => {
  // 使用多重延迟确保 DOM 完全准备好
  nextTick(() => {
    setTimeout(() => {
      if (diagramContainer.value) {
        renderDiagram();
      } else {
        console.warn('[ProxyDeploymentDiagram] Container not ready, retrying...');
        // 如果容器还没准备好，再等一段时间
        setTimeout(() => {
          if (diagramContainer.value) {
            renderDiagram();
          } else {
            console.error('[ProxyDeploymentDiagram] Container still not ready after retry');
          }
        }, 200);
      }
    }, 100);
  });
});

// 分别监听每个prop的变化，确保能正确触发
watch(() => props.pacUrl, (newPacUrl, oldPacUrl) => {
  console.log('[ProxyDeploymentDiagram] PAC URL watch triggered:', { 
    old: oldPacUrl, 
    new: newPacUrl,
    current: currentPacUrl.value,
    props: props.pacUrl
  });
  if (newPacUrl) {
    currentPacUrl.value = newPacUrl;
    // 立即重新渲染
    nextTick(() => {
      console.log('[ProxyDeploymentDiagram] Re-rendering diagram with new PAC URL:', currentPacUrl.value);
      renderDiagram();
    });
  }
}, { immediate: false });

watch(() => props.proxyHost, (newProxyHost, oldProxyHost) => {
  console.log('[ProxyDeploymentDiagram] Proxy Host watch triggered:', { 
    old: oldProxyHost, 
    new: newProxyHost,
    current: currentProxyHost.value
  });
  if (newProxyHost && newProxyHost !== '127.0.0.1') {
    currentProxyHost.value = newProxyHost;
    nextTick(() => {
      console.log('[ProxyDeploymentDiagram] Re-rendering diagram with new proxy host:', currentProxyHost.value);
      renderDiagram();
    });
  }
}, { immediate: false });

watch(() => props.serviceId, () => {
  nextTick(() => {
    renderDiagram();
  });
}, { immediate: false });

// 选中指定节点
function selectNode(nodeId) {
  if (!diagramInstance) {
    console.warn('[ProxyDeploymentDiagram] Diagram instance not ready, cannot select node:', nodeId);
    return;
  }
  console.log('[ProxyDeploymentDiagram] Selecting node:', nodeId);
  // 保存当前选中的节点ID
  currentSelectedNodeId.value = nodeId;
  diagramInstance.setSelection({ nodes: [nodeId] });
  handleNodeClick(nodeId);
}

defineExpose({
  refresh: () => {
    console.log('[ProxyDeploymentDiagram] Refresh called, current props:', {
      pacUrl: props.pacUrl,
      proxyHost: props.proxyHost,
      currentPacUrl: currentPacUrl.value,
      currentProxyHost: currentProxyHost.value
    });
    // 更新当前值以使用最新的props
    if (props.pacUrl) {
      currentPacUrl.value = props.pacUrl;
    }
    if (props.proxyHost && props.proxyHost !== '127.0.0.1') {
      currentProxyHost.value = props.proxyHost;
    }
    console.log('[ProxyDeploymentDiagram] After update:', {
      currentPacUrl: currentPacUrl.value,
      currentProxyHost: currentProxyHost.value
    });
    // 确保容器准备好后再渲染
    if (diagramContainer.value) {
      renderDiagram();
    } else {
      console.warn('[ProxyDeploymentDiagram] Container not ready for refresh, waiting...');
      nextTick(() => {
        setTimeout(() => {
          if (diagramContainer.value) {
            renderDiagram();
          } else {
            console.error('[ProxyDeploymentDiagram] Container still not ready after wait in refresh');
          }
        }, 100);
      });
    }
  },
  selectNode
});
</script>

<style scoped>
.deployment-diagram {
  width: 100%;
  height: 100%;
  padding: 0;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
}

.diagram-title {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  color: #000000;
  padding: 10px 0;
  flex-shrink: 0;
  background-color: #fafafa;
}

.diagram-container {
  width: 100%;
  flex: 1;
  min-height: 0;
  border: none;
  background-color: #fafafa;
  cursor: default;
}

/* 设置节点鼠标悬停时显示手型指针 */
.diagram-container :deep(.vis-network) {
  cursor: default;
}

.diagram-container :deep(.vis-network .vis-node) {
  cursor: pointer;
}

.diagram-container :deep(.vis-network .vis-node:hover) {
  cursor: pointer;
}

.empty-state,
.error-state,
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}

.error-state {
  color: #f56c6c;
}
</style>

