<template>
  <div class="dashboard">
    <!-- 主内容区：左右分栏布局 -->
    <div class="dashboard-content">
      <!-- 左侧：标签页区域 -->
      <div class="tabs-area">
        <TabSystem
          ref="tabSystemRef"
          :pac-url="pacAddress"
          :proxy-host="proxyHost"
          @pac-config-updated="handlePACConfigUpdated"
          @service-updated="handleServiceUpdated"
          @start-service="handleProxyServiceStart"
          @stop-service="handleProxyServiceStop"
          @service-deleted="handleServiceDeleted"
          @config-updated="handleConfigUpdated"
        />
      </div>

      <!-- 右侧：代理配置卡片区域 -->
      <div class="config-cards-area">
        <div v-loading="loading" class="config-cards-list">
          <!-- 配置卡片区域（上方） -->
          <div class="config-cards-section">
            <!-- 默认配置卡片（当配置列表为空时显示） -->
            <DefaultConfigCard
              v-if="!loading && hostConfigs.length === 0"
              :proxy-services="proxyServices"
              ref="defaultConfigCardRef"
              @save="handleDefaultConfigSaved"
              @create-service="handleNewServiceForDefaultConfig"
              @open-host-config="handleOpenDefaultHostConfig"
            />

          <!-- 已有配置列表 -->
          <ProxyConfigCard
            v-for="config in hostConfigs"
            :key="config.id"
            :config="config"
            :proxy-service="getProxyServiceById(config.proxyServiceId)"
            :proxy-services="proxyServices"
            :proxy-host="proxyHost"
            @click-host-config="handleOpenHostConfigTab"
            @refresh="loadData"
            @edit="handleEdit"
            @select-service="handleSelectService"
            @new-service="handleNewService"
            @update-config="handleUpdateTempConfig"
            @save-config="handleSaveTempConfig"
          />

            <!-- 添加新配置按钮 -->
            <div v-if="hostConfigs.length > 0 && !hasTempConfig" class="add-config-btn-wrapper">
              <el-button
                class="add-config-btn"
                @click="handleAddNewConfig"
              >
                + 添加新配置
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 代理服务创建/编辑弹窗 -->
    <ProxyServiceDialog
      v-model="showCreateDialog"
      :service="editingService"
      :on-service-created="creatingForConfig ? handleServiceCreatedForConfig : undefined"
      @success="handleDialogSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { getProxyServices, getProxyService, startProxyService, stopProxyService } from '../api/proxy-services';
import { getHostConfigs, updateHostConfig, createHostConfig } from '../api/host-configs';
import { getServiceAddress, getSystemConfigs } from '../api/system-configs';
import ProxyConfigCard from '../components/ProxyConfigCard.vue';
import DefaultConfigCard from '../components/DefaultConfigCard.vue';
import ProxyServiceDialog from '../components/ProxyServiceDialog.vue';
import TabSystem from '../components/TabSystem.vue';

const loading = ref(false);
const proxyServices = ref([]);
const hostConfigs = ref([]);
const showCreateDialog = ref(false);
const editingService = ref(null);
const pacAddress = ref('');
const proxyHost = ref('127.0.0.1'); // 代理服务地址（从pac_service_host获取）
const tabSystemRef = ref(null);
const defaultConfigCardRef = ref(null);
const creatingForConfig = ref(false); // 标记是否为代理配置创建代理服务
const creatingForConfigItem = ref(null); // 保存为哪个配置创建代理服务（config对象或null表示默认配置）
const lastCreatedServiceId = ref(null); // 保存最后创建的代理服务ID
const tempConfigCounter = ref(0); // 临时配置计数器

// 是否有临时配置
const hasTempConfig = computed(() => {
  return hostConfigs.value.some(config => 
    config.isTemp || config.id?.toString().startsWith('temp-')
  );
});

// 根据ID获取代理服务
function getProxyServiceById(id) {
  return proxyServices.value.find(s => s.id === id);
}

// 加载数据
async function loadData() {
  loading.value = true;
  try {
    console.log('[Dashboard] Starting to load data...');
    
    // 加载代理服务列表
    const servicesResponse = await getProxyServices();
    console.log('[Dashboard] Proxy services response:', servicesResponse);
    if (servicesResponse.success) {
      proxyServices.value = servicesResponse.data.items || [];
      console.log('[Dashboard] Loaded proxy services:', proxyServices.value.length);
    } else {
      console.error('[Dashboard] Failed to load proxy services:', servicesResponse);
    }

    // 加载Host配置列表
    const configsResponse = await getHostConfigs();
    console.log('[Dashboard] Host configs response:', configsResponse);
    if (configsResponse.success) {
      hostConfigs.value = configsResponse.data.items || [];
      console.log('[Dashboard] Loaded host configs:', hostConfigs.value.length);
    } else {
      console.error('[Dashboard] Failed to load host configs:', configsResponse);
    }
    
    // 加载服务地址（动态获取）
    await loadServiceAddress();
    console.log('[Dashboard] Data loading completed');
  } catch (error) {
    console.error('[Dashboard] Load data error:', error);
    console.error('[Dashboard] Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code
    });
    // 如果是401错误，说明未登录，路由守卫会处理跳转，不需要显示错误消息
    // 如果是网络错误或其他错误，且不是401，才显示错误消息
    if (error.response?.status !== 401 && error.code !== 'ECONNABORTED') {
      ElMessage.error('加载数据失败');
    }
  } finally {
    loading.value = false;
  }
}

// 更新单个服务状态（不触发整体加载）
async function updateServiceStatus(serviceId) {
  try {
    const response = await getProxyService(serviceId);
    if (response && response.success && response.data) {
      // 更新服务列表中的对应服务
      const index = proxyServices.value.findIndex(s => s.id === serviceId);
      if (index !== -1) {
        proxyServices.value[index] = response.data;
      } else {
        // 如果服务不在列表中，添加到列表
        proxyServices.value.push(response.data);
      }
      return response.data;
    }
  } catch (error) {
    console.error('[Dashboard] Update service status error:', error);
  }
  return null;
}

// 加载服务地址
async function loadServiceAddress() {
  try {
    // 优先从系统配置获取（如果用户已手动设置）
    const configsResponse = await getSystemConfigs();
    if (configsResponse.success) {
      const pacHostConfig = configsResponse.data.items.find(c => c.key === 'pac_service_host');
      const pacPortConfig = configsResponse.data.items.find(c => c.key === 'pac_service_port');
      
      // 设置代理服务地址（用于显示代理服务地址）
      if (pacHostConfig && pacHostConfig.value && pacHostConfig.value !== '192.168.1.4') {
        proxyHost.value = pacHostConfig.value;
      } else {
        // 如果未设置或为默认值，动态获取
        const addressResponse = await getServiceAddress();
        if (addressResponse.success) {
          proxyHost.value = addressResponse.data.host;
        }
      }
      
      if (pacHostConfig && pacPortConfig && pacHostConfig.value && pacPortConfig.value) {
        // 如果用户已设置，使用用户设置的值
        pacAddress.value = `http://${pacHostConfig.value}:${pacPortConfig.value}/proxy.pac`;
        return;
      }
    }
    
    // 如果用户未设置，动态获取
    const addressResponse = await getServiceAddress();
    if (addressResponse.success) {
      proxyHost.value = addressResponse.data.host;
      pacAddress.value = addressResponse.data.pacURL;
    } else {
      // 如果获取失败，使用默认值
      proxyHost.value = '127.0.0.1';
      pacAddress.value = 'http://192.168.1.4:8090/proxy.pac';
    }
  } catch (error) {
    console.error('Load service address error:', error);
    // 如果获取失败，使用默认值
    proxyHost.value = '127.0.0.1';
    pacAddress.value = 'http://192.168.1.4:8090/proxy.pac';
  }
}

// 打开Host配置标签页（改为选中部署图中的代理配置Block）
function handleOpenHostConfigTab(config) {
  if (!config) {
    ElMessage.warning('配置信息不完整，无法定位到部署图节点');
    return;
  }
  
  // 在部署图中选中对应的target节点
  // 节点ID格式：target-${config.id}（因为一个服务可能有多个配置）
  const targetNodeId = config.id ? `target-${config.id}` : null;
  
  if (!targetNodeId) {
    ElMessage.warning('配置ID不存在，无法定位到部署图节点');
    return;
  }
  
  if (tabSystemRef.value && tabSystemRef.value.selectDiagramNode) {
    // 确保部署图标签页是打开的（不是PAC配置标签页）
    if (tabSystemRef.value.openDeploymentDiagramTab) {
      tabSystemRef.value.openDeploymentDiagramTab();
    }
    // 等待一下让部署图渲染完成
    nextTick(() => {
      setTimeout(() => {
        if (tabSystemRef.value && tabSystemRef.value.selectDiagramNode) {
          tabSystemRef.value.selectDiagramNode(targetNodeId);
        }
      }, 300);
    });
  }
}

// 删除临时配置
function handleDeleteTempConfig(tempId) {
  const index = hostConfigs.value.findIndex(c => c.id === tempId);
  if (index !== -1) {
    hostConfigs.value.splice(index, 1);
  }
}

// 更新临时配置（只更新内存，不保存到数据库）
function handleUpdateTempConfig(updatedConfig) {
  const index = hostConfigs.value.findIndex(c => c.id === updatedConfig.id);
  if (index !== -1) {
    hostConfigs.value[index] = { ...hostConfigs.value[index], ...updatedConfig };
  }
}

// 保存临时配置
async function handleSaveTempConfig(tempConfig) {
  // 如果只是更新临时配置的属性（如名称、enabled、proxyServiceId），更新内存中的配置，不保存到数据库
  if (tempConfig.id && tempConfig.id.toString().startsWith('temp-')) {
    const index = hostConfigs.value.findIndex(c => c.id === tempConfig.id);
    if (index !== -1) {
      // 更新临时配置的属性
      hostConfigs.value[index] = { ...hostConfigs.value[index], ...tempConfig };
      
      // 如果用户点击了"保存配置"按钮，无论配置是否完整都保存到数据库
      // 否则，如果配置已经完整（有名称、代理服务和hosts），自动保存到数据库
      const updatedConfig = hostConfigs.value[index];
      if (updatedConfig.name && updatedConfig.proxyServiceId) {
        // 继续执行下面的保存逻辑
        tempConfig = updatedConfig;
      } else {
        // 配置不完整，只更新内存，不保存到数据库
        return;
      }
    } else {
      // 找不到配置，直接返回
      return;
    }
  }
  
  // 如果临时配置已经满足保存条件（有名称和代理服务），保存到数据库
  try {
    // 验证必填字段
    if (!tempConfig.name || !tempConfig.name.trim()) {
      ElMessage.warning('配置名称不能为空');
      return;
    }
    
    if (!tempConfig.proxyServiceId) {
      ElMessage.warning('请选择代理服务');
      return;
    }
    
    // 创建配置
    const response = await createHostConfig({
      name: tempConfig.name.trim(),
      proxyServiceId: tempConfig.proxyServiceId,
      hosts: tempConfig.hosts || [],
      enabled: tempConfig.enabled !== false
    });
    
    if (response.success) {
      ElMessage.success('配置创建成功');
      // 移除临时配置
      const index = hostConfigs.value.findIndex(c => c.id === tempConfig.id);
      if (index !== -1) {
        hostConfigs.value.splice(index, 1);
      }
      // 重新加载数据
      await loadData();
      // 刷新PAC配置
      if (tabSystemRef.value) {
        tabSystemRef.value.refreshPACConfig();
      }
    } else {
      ElMessage.error(response.error?.message || '创建配置失败');
    }
  } catch (error) {
    console.error('Save temp config error:', error);
    ElMessage.error('保存配置失败');
  }
}

// 编辑代理服务
function handleEdit(service) {
  editingService.value = service;
  showCreateDialog.value = true;
}

// 选择代理服务
function handleSelectService(config) {
  // TODO: 实现选择代理服务的逻辑
  ElMessage.info('选择代理服务功能待实现');
}

// 新建代理服务
function handleNewService(config) {
  editingService.value = null;
  creatingForConfig.value = !!config; // 如果有config参数，说明是为代理配置创建
  creatingForConfigItem.value = config || null; // 保存配置对象
  showCreateDialog.value = true;
}

// 为默认配置新建代理服务
function handleNewServiceForDefaultConfig() {
  console.log('handleNewServiceForDefaultConfig called');
  editingService.value = null;
  creatingForConfig.value = true; // 标记是为默认配置创建代理服务
  console.log('creatingForConfig set to:', creatingForConfig.value);
  showCreateDialog.value = true;
}

// 为代理配置创建代理服务成功后的回调
async function handleServiceCreatedForConfig(serviceId) {
  console.log('handleServiceCreatedForConfig called with serviceId:', serviceId);
  console.log('creatingForConfigItem:', creatingForConfigItem.value);
  
  // 先刷新数据，确保新创建的代理服务在列表中
  await loadData();
  
  // 等待多个 nextTick，确保所有数据都已更新
  await nextTick();
  await nextTick();
  
  // 检查代理服务是否已经在列表中
  const serviceExists = proxyServices.value.some(s => s.id === serviceId);
  console.log('Service exists in list:', serviceExists, 'Service ID:', serviceId, 'Available services:', proxyServices.value.map(s => s.id));
  
  // 根据创建类型处理
  if (creatingForConfigItem.value === null) {
    // 为默认配置创建代理服务
    if (defaultConfigCardRef.value) {
      console.log('Setting proxy service ID to default config card');
      console.log('Current proxyServices:', proxyServices.value.map(s => ({ id: s.id, name: s.name })));
      
      // 确保服务在列表中
      if (proxyServices.value.some(s => s.id === serviceId)) {
        await defaultConfigCardRef.value.setProxyServiceId(serviceId);
        
        // 等待多个 nextTick，确保 UI 更新
        await nextTick();
        await nextTick();
        console.log('Proxy service ID set, waiting for UI update...');
        
        // 再次验证设置是否成功
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('Final check: selectedProxyServiceId should be:', serviceId);
      } else {
        console.error('Service not found in proxyServices list:', serviceId);
      }
    } else {
      console.warn('defaultConfigCardRef is null');
    }
  } else {
    // 为已有配置创建代理服务，直接更新配置的代理服务ID
    try {
      const configId = creatingForConfigItem.value.id;
      console.log('Updating config proxy service ID:', configId, 'to:', serviceId);
      
      await updateHostConfig(configId, {
        proxyServiceId: serviceId
      });
      
      console.log('Config proxy service ID updated successfully');
      // 刷新数据以更新UI
      await loadData();
    } catch (error) {
      console.error('Update config proxy service error:', error);
      ElMessage.error('更新配置的代理服务失败');
    }
  }
  
  // 保存服务ID，用于在 handleDialogSuccess 中重新设置
  lastCreatedServiceId.value = serviceId;
  
  // 注意：不要在这里重置 creatingForConfig，让 handleDialogSuccess 处理
}

// 添加新配置（创建临时配置块）
function handleAddNewConfig() {
  tempConfigCounter.value++;
  const tempConfig = {
    id: `temp-new-${tempConfigCounter.value}`,
    name: `新配置 ${tempConfigCounter.value}`,
    proxyServiceId: null,
    hosts: [],
    enabled: true,
    isTemp: true // 标记为临时配置
  };
  hostConfigs.value.push(tempConfig);
}

// 默认配置保存成功
function handleDefaultConfigSaved() {
  loadData();
  // 刷新PAC配置
  if (tabSystemRef.value) {
    tabSystemRef.value.refreshPACConfig();
  }
}

// 显示代理服务日志
function handleShowLogs(service) {
  if (tabSystemRef.value) {
    tabSystemRef.value.openProxyServiceLogTab(service);
  }
}

// 处理代理服务启动
async function handleProxyServiceStart(service) {
  // 向详情页的日志面板添加日志（不打开独立的日志标签页）
  if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '开始启动代理服务...');
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', `服务名称: ${service.name}`);
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', `代理端口: ${service.proxy_port}`);
  }
  
  try {
    const response = await startProxyService(service.id);
    if (response.success) {
      // 向详情页的日志面板添加日志
      if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
        // 显示执行的autossh命令
        if (response.data.command) {
          tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '【执行的命令】');
          tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', response.data.command);
          tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '');
        }
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'SUCCESS', '代理服务启动成功');
        if (response.data.processId) {
          tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', `进程ID: ${response.data.processId}`);
        }
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'SUCCESS', `本地端口 ${service.proxy_port} 已监听`);
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'SUCCESS', `可通过 SOCKS5 代理访问: ${proxyHost.value}:${service.proxy_port}`);
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
      }
      ElMessage.success(response.message || '启动成功');
      // 只更新单个服务状态，不触发整体加载
      const updatedService = await updateServiceStatus(service.id);
      // 刷新部署图以显示更新的服务状态
      if (tabSystemRef.value && tabSystemRef.value.refreshPACConfig) {
        tabSystemRef.value.refreshPACConfig();
      }
      // 触发服务更新事件，让服务详情面板更新
      if (tabSystemRef.value) {
        // 通过 emit 事件通知更新
        handleServiceUpdated();
      }
    } else {
      if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'ERROR', `启动失败: ${response.error?.message || '未知错误'}`);
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
      }
      ElMessage.error(response.error?.message || '启动失败');
    }
  } catch (error) {
    console.error('Start service error:', error);
    // 提取详细的错误信息
    let errorMessage = '启动失败';
    if (error.response) {
      // 有HTTP响应，尝试从响应中提取错误信息
      errorMessage = error.response.data?.error?.message || error.response.data?.message || `HTTP ${error.response.status} 错误`;
    } else if (error.request) {
      // 请求已发送但没有收到响应（网络错误）
      errorMessage = '网络错误：无法连接到服务器，请检查网络连接';
    } else {
      // 请求配置错误或其他错误
      errorMessage = error.message || '启动失败';
    }
    
    // 记录详细的错误信息到控制台
    console.error('Start service error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
      tabSystemRef.value.addLogToServiceDetailTab(service.id, 'ERROR', `启动失败: ${errorMessage}`);
      // 如果有更详细的错误信息，也记录下来
      if (error.response?.data?.error?.code) {
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'ERROR', `错误代码: ${error.response.data.error.code}`);
      }
      tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
    }
    ElMessage.error(errorMessage);
  }
}

// 处理代理服务停止
async function handleProxyServiceStop(service) {
  console.log('[Dashboard] handleProxyServiceStop called, service:', service);
  // 向详情页的日志面板添加日志（不打开独立的日志标签页）
  if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '开始停止代理服务...');
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', `服务名称: ${service.name}`);
    if (service.process_id && service.process_id > 0) {
      tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', `进程ID: ${service.process_id}`);
    }
    tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', `代理端口: ${service.proxy_port}`);
  }
  
  try {
    console.log(`[Dashboard] Calling stopProxyService for service ${service.id}...`);
    const response = await stopProxyService(service.id);
    console.log(`[Dashboard] stopProxyService response:`, response);
    if (response.success) {
      // 向详情页的日志面板添加日志
      if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
        await nextTick();
        await new Promise(resolve => setTimeout(resolve, 100));
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'SUCCESS', '代理服务停止成功');
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', `本地端口 ${service.proxy_port} 已释放`);
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
      }
      ElMessage.success('停止成功');
      // 只更新单个服务状态，不触发整体加载
      const updatedService = await updateServiceStatus(service.id);
      // 刷新部署图以显示更新的服务状态
      if (tabSystemRef.value && tabSystemRef.value.refreshPACConfig) {
        tabSystemRef.value.refreshPACConfig();
      }
      // 触发服务更新事件，让服务详情面板更新
      if (tabSystemRef.value) {
        // 通过 emit 事件通知更新
        handleServiceUpdated();
      }
    } else {
      if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
        await nextTick();
        await new Promise(resolve => setTimeout(resolve, 100));
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'ERROR', `停止失败: ${response.error?.message || '未知错误'}`);
        tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
      }
      ElMessage.error(response.error?.message || '停止失败');
    }
  } catch (error) {
    console.error('[Dashboard] Stop service error:', error);
    console.error('[Dashboard] Stop service error details:', {
      message: error.message,
      response: error.response,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack
    });
    
    // 检查是否是认证错误
    if (error.response?.status === 401) {
      console.error('[Dashboard] Authentication error - user may need to re-login');
      ElMessage.error('认证失败，请重新登录');
      // 不继续处理，让路由守卫处理跳转
      return;
    }
    
    const errorMessage = error.response?.data?.error?.message || error.message || '停止失败';
    if (tabSystemRef.value && tabSystemRef.value.addLogToServiceDetailTab) {
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));
      tabSystemRef.value.addLogToServiceDetailTab(service.id, 'ERROR', `停止失败: ${errorMessage}`);
      tabSystemRef.value.addLogToServiceDetailTab(service.id, 'INFO', '═══════════════════════════════════════');
    }
    ElMessage.error(errorMessage);
  }
}

// 测试代理服务
function handleTestService(service) {
  ElMessage.info(`测试功能开发中: ${service.name}`);
  // TODO: 实现测试功能
}

// 打开默认配置的Host配置标签页（改为选中部署图中的代理配置Block）
function handleOpenDefaultHostConfig(configData) {
  // 检查是否有proxyServiceId
  if (!configData || !configData.proxyServiceId) {
    ElMessage.warning('请先选择代理服务');
    return;
  }
  
  // 在部署图中选中对应的target节点
  // 节点ID格式：target-${config.id}（因为一个服务可能有多个配置）
  // 对于默认配置，需要先找到对应的已保存配置
  let targetNodeId = null;
  
  if (configData.id && !configData.id.toString().startsWith('temp-')) {
    // 如果配置已经有ID（已保存），直接使用
    targetNodeId = `target-${configData.id}`;
  } else {
    // 如果配置还没有保存，尝试在已保存的配置中查找对应的默认配置
    const savedConfig = hostConfigs.value.find(c => 
      c.proxyServiceId === configData.proxyServiceId && 
      (c.name === '默认配置' || c.name === '默认代理配置')
    );
    if (savedConfig && savedConfig.id) {
      targetNodeId = `target-${savedConfig.id}`;
    } else {
      // 如果找不到，使用服务ID（可能显示多个配置，但至少能定位到服务）
      // 这种情况下，可能需要用户手动选择具体的配置节点
      ElMessage.warning('配置尚未保存，请先保存配置');
      return;
    }
  }
  
  if (targetNodeId && tabSystemRef.value && tabSystemRef.value.selectDiagramNode) {
    // 确保部署图标签页是打开的（不是PAC配置标签页）
    if (tabSystemRef.value.openDeploymentDiagramTab) {
      tabSystemRef.value.openDeploymentDiagramTab();
    }
    // 等待一下让部署图渲染完成
    nextTick(() => {
      setTimeout(() => {
        if (tabSystemRef.value && tabSystemRef.value.selectDiagramNode) {
          tabSystemRef.value.selectDiagramNode(targetNodeId);
        }
      }, 300);
    });
  }
}

// 弹窗成功回调
async function handleDialogSuccess() {
  editingService.value = null;
  
  // 如果正在为配置创建服务，需要重新设置选中值
  if (creatingForConfig.value && lastCreatedServiceId.value) {
    const serviceId = lastCreatedServiceId.value;
    console.log('handleDialogSuccess: Re-setting proxy service ID:', serviceId);
    
    // 延迟刷新数据，确保 UI 已经更新
    setTimeout(async () => {
      await loadData();
      await nextTick();
      
      // 重新设置选中值
      if (defaultConfigCardRef.value && proxyServices.value.some(s => s.id === serviceId)) {
        console.log('Re-setting proxy service ID after loadData:', serviceId);
        await defaultConfigCardRef.value.setProxyServiceId(serviceId);
        await nextTick();
        console.log('Proxy service ID re-set after dialog success');
      }
    }, 500);
  } else {
    // 如果不是为配置创建服务，立即刷新
    await loadData();
  }
  
  // 重置标志
  creatingForConfig.value = false;
  creatingForConfigItem.value = null;
  lastCreatedServiceId.value = null;
  
  // 刷新PAC配置
  if (tabSystemRef.value) {
    tabSystemRef.value.refreshPACConfig();
  }
}


// PAC配置更新回调
function handlePACConfigUpdated(config) {
  if (config && config.pacUrl) {
    // 更新PAC地址
    pacAddress.value = config.pacUrl;
    // 如果host也更新了，更新proxyHost
    if (config.host) {
      proxyHost.value = config.host;
    }
    // 注意：不调用loadServiceAddress()，因为我们已经从配置更新中获得了最新的值
    // loadServiceAddress()会从服务器获取，可能会覆盖我们刚更新的值
  }
}

// 服务更新回调
async function handleServiceUpdated() {
  // 只刷新部署图以显示更新的服务状态，不触发整体数据加载
  if (tabSystemRef.value && tabSystemRef.value.refreshPACConfig) {
    tabSystemRef.value.refreshPACConfig();
  }
}

// 服务删除回调
async function handleServiceDeleted(serviceId) {
  console.log('[Dashboard] handleServiceDeleted called, serviceId:', serviceId);
  // 重新加载数据以更新服务列表和配置列表
  await loadData();
  // 刷新部署图以移除已删除的服务
  if (tabSystemRef.value && tabSystemRef.value.refreshPACConfig) {
    tabSystemRef.value.refreshPACConfig();
  }
}

// 配置更新回调
async function handleConfigUpdated(configData) {
  console.log('[Dashboard] handleConfigUpdated called, configData:', configData);
  // 重新加载配置数据以更新域名数量
  try {
    const configsResponse = await getHostConfigs();
    if (configsResponse.success) {
      hostConfigs.value = configsResponse.data.items || [];
    }
  } catch (error) {
    console.error('[Dashboard] Load host configs error:', error);
  }
  // 刷新部署图以显示更新的域名数量
  if (tabSystemRef.value && tabSystemRef.value.refreshPACConfig) {
    tabSystemRef.value.refreshPACConfig();
  }
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}


/* 主内容区：左右分栏布局 */
.dashboard-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 右侧：代理配置卡片区域 */
.config-cards-area {
  width: 330px;
  border-left: 1px solid #e4e7ed;
  overflow-y: auto;
  background-color: #fafbfc;
}

.config-cards-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.config-cards-section {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* 空状态引导 */
.empty-guide {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: 20px;
}

.guide-content {
  text-align: center;
}

.guide-title {
  font-size: 14px;
  color: #303133;
  margin-bottom: 8px;
}

.guide-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 16px;
}

/* 添加新配置按钮 */
.add-config-btn-wrapper {
  padding: 10px;
  text-align: center;
}

.add-config-btn {
  width: 100%;
  color: #cccccc;
  border-color: #e4e7ed;
}

.add-config-btn:hover {
  color: #409eff;
  border-color: #409eff;
}

/* 右侧：标签页区域 */
.tabs-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #fafbfc;
}
</style>
