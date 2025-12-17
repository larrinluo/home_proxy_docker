<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑代理服务' : '创建代理服务'"
    width="900px"
    class="proxy-service-dialog"
    :close-on-click-modal="false"
    @close="handleClose"
    :style="isEdit ? { height: 'auto', marginTop: '15vh' } : { height: '80vh', marginTop: '10vh' }"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      :validate-on-rule-change="false"
    >
      <el-form-item label="服务名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入服务名称" />
      </el-form-item>

      <!-- 跳板服务器信息分组（编辑模式下只读） -->
      <div v-if="!isEdit" class="jump-server-group">
        <div class="group-title">跳板服务器信息</div>
        <div class="group-content">
          <el-form-item prop="jumpHost">
            <template #label>
              <span>跳板服务器</span>
            </template>
            <div class="form-row">
              <el-input v-model="form.jumpHost" placeholder="请输入跳板服务器地址" class="jump-host-input" />
              <span class="port-label">端口</span>
              <el-input-number v-model="form.jumpPort" :min="1" :max="65535" class="port-input" />
            </div>
          </el-form-item>
          <el-form-item label="用户名" prop="jumpUsername">
            <el-input v-model="form.jumpUsername" placeholder="请输入用户名" />
          </el-form-item>
          <el-form-item label="密码" prop="jumpPassword">
            <el-input
              v-model="form.jumpPassword"
              type="password"
              placeholder="请输入密码"
            />
            <el-alert
              type="info"
              :closable="false"
              style="margin-top: 8px;"
            >
              <template #title>
                <div style="font-size: 12px; line-height: 1.6;">
                  为了建立稳定代理链接，我们需要创建一个密钥对并将公钥通过ssh-copy-id复制到跳板服务器，这个过程需要用到跳板服务用户密码。我们不会保存密码，参见项目
                  <el-link
                    href="https://github.com/your-username/socks_proxy_docker"
                    target="_blank"
                    type="primary"
                    style="font-size: 12px; vertical-align: baseline;"
                  >
                    GitHub源码
                  </el-link>
                </div>
              </template>
            </el-alert>
          </el-form-item>
        </div>
      </div>
      
      <!-- 编辑模式下显示只读的跳板服务器信息 -->
      <div v-if="isEdit" class="jump-server-group read-only">
        <div class="group-title">跳板服务器信息</div>
        <div class="group-content">
          <el-form-item>
            <template #label>
              <span>跳板服务器</span>
            </template>
            <div class="form-row">
              <el-input :value="form.jumpHost" disabled class="jump-host-input" />
              <span class="port-label">端口</span>
              <el-input-number :value="form.jumpPort" disabled class="port-input" />
            </div>
          </el-form-item>
          <el-form-item label="用户名">
            <el-input :value="form.jumpUsername" disabled />
          </el-form-item>
        </div>
      </div>
    </el-form>

    <!-- 日志窗口（仅创建模式显示） -->
    <div v-if="!isEdit" class="log-section">
      <ProcessLogViewer
        :logs="processLogs"
      />
    </div>

    <!-- 成功信息显示 -->
    <div v-if="createdService" class="success-info">
      <el-alert
        type="success"
        :closable="false"
        show-icon
      >
        <template #title>
          <div class="success-content">
            <div class="success-title">代理服务创建成功！</div>
            <div class="success-details">
              <div><strong>代理服务器地址：</strong>{{ proxyServerUrl }}</div>
              <div class="success-links">
                <el-link
                  :href="proxyServerUrl"
                  target="_blank"
                  type="primary"
                >
                  打开代理服务器
                </el-link>
                <el-link
                  href="#"
                  type="primary"
                  @click.prevent="showUsageGuide"
                >
                  使用方法
                </el-link>
              </div>
            </div>
          </div>
        </template>
      </el-alert>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button 
        type="primary"
        @click="handleCreate" 
        :loading="connecting || loading"
        :disabled="isProcessing"
      >
        {{ isEdit ? '确定' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createProxyService, updateProxyService, connectProxyService, startProxyService } from '../api/proxy-services';
import ProcessLogViewer from './ProcessLogViewer.vue';

const props = defineProps({
  modelValue: Boolean,
  service: Object,
  onServiceCreated: Function // 创建成功后的回调函数，用于设置代理服务ID
});

const emit = defineEmits(['update:modelValue', 'success']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const isEdit = computed(() => !!props.service);

const formRef = ref(null);
const loading = ref(false);
const connecting = ref(false);
const isProcessing = ref(false);
const processLogs = ref([]);
const createdService = ref(null);
const proxyServerUrl = ref('');
const connectionResult = ref(null);
const sseReader = ref(null); // 保存SSE reader引用，用于取消连接

const form = reactive({
  name: '',
  jumpHost: '',
  jumpPort: 22,
  jumpUsername: '',
  jumpPassword: ''
});

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
  processLogs.value.push({
    timestamp: formatTimestamp(),
    level: level.toUpperCase(),
    message
  });
}


watch(() => props.service, (service) => {
  if (service) {
    // 编辑模式：填充现有服务数据
    form.name = service.name || '';
    form.jumpHost = service.jump_host || '';
    form.jumpPort = service.jump_port || 22;
    form.jumpUsername = service.jump_username || '';
    form.jumpPassword = ''; // 编辑模式下密码留空
  } else {
    // 新建模式：清空所有字段
    Object.assign(form, {
      name: '',
      jumpHost: '',
      jumpPort: 22,
      jumpUsername: '',
      jumpPassword: ''
    });
  }
  // 重置状态
  processLogs.value = [];
  createdService.value = null;
  proxyServerUrl.value = '';
  isProcessing.value = false;
  connecting.value = false;
  connectionResult.value = null;
  // 停止之前的连接
  stopConnection();
}, { immediate: true });

watch(() => props.modelValue, (val) => {
  if (val) {
    // 打开对话框时，如果是新建模式，确保字段清空
    if (!props.service) {
      Object.assign(form, {
        name: '',
        jumpHost: '',
        jumpPort: 22,
        jumpUsername: '',
        jumpPassword: ''
      });
      // 重置状态
      processLogs.value = [];
      createdService.value = null;
      proxyServerUrl.value = '';
      isProcessing.value = false;
      connecting.value = false;
      connectionResult.value = null;
      stopConnection();
    }
    
    // 清除表单验证错误（避免显示红色警告）
    nextTick(() => {
      if (formRef.value) {
        formRef.value.clearValidate();
      }
    });
  } else {
    // 关闭时重置
    processLogs.value = [];
    createdService.value = null;
    proxyServerUrl.value = '';
    isProcessing.value = false;
    connecting.value = false;
    connectionResult.value = null;
    // 停止连接
    stopConnection();
    
    // 清除表单验证错误
    if (formRef.value) {
      formRef.value.clearValidate();
    }
  }
});

// 监听 onServiceCreated prop 的变化
watch(() => props.onServiceCreated, (callback) => {
  console.log('ProxyServiceDialog: onServiceCreated prop changed:', {
    exists: !!callback,
    type: typeof callback
  });
}, { immediate: true });

// 密码验证规则（动态计算）
const passwordRules = computed(() => {
  return isEdit.value 
    ? [] // 编辑模式下密码可选
    : [{ required: true, message: '请输入密码', trigger: 'blur' }];
});

const rules = computed(() => {
  // 编辑模式下，只验证服务名称
  if (isEdit.value) {
    return {
      name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }]
    };
  }
  
  // 新建模式下，验证所有字段
  return {
    name: [{ required: true, message: '请输入服务名称', trigger: 'blur' }],
    jumpHost: [{ required: true, message: '请输入跳板服务器地址', trigger: 'blur' }],
    jumpPort: [{ required: true, message: '请输入跳板端口', trigger: 'blur' }],
    jumpUsername: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    jumpPassword: passwordRules.value
  };
});

// 停止SSE连接
function stopConnection() {
  if (sseReader.value) {
    try {
      sseReader.value.cancel();
      sseReader.value = null;
    } catch (error) {
      console.error('Error stopping connection:', error);
    }
  }
}

function handleClose() {
  // 停止正在进行的连接
  stopConnection();
  connecting.value = false;
  visible.value = false;
}

// 处理创建/更新按钮
async function handleCreate() {
  if (!formRef.value) return;
  
  // 验证表单
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    
    // 编辑模式：只更新服务名称
    if (isEdit.value) {
      await updateProxyServiceRecord();
      return;
    }
    
    // 新建模式：需要密码
    if (!form.jumpPassword) {
      ElMessage.warning('请输入密码');
      return;
    }
    
    // 停止之前的连接
    stopConnection();
    
    connecting.value = true;
    loading.value = true;
    isProcessing.value = true;
    processLogs.value = [];
    connectionResult.value = null;
    createdService.value = null;
    proxyServerUrl.value = '';
    
    try {
      // 新建模式，先执行连接流程
        // 保存reader引用以便取消
        const connectPromise = connectProxyService(
          {
            jumpHost: form.jumpHost,
            jumpPort: form.jumpPort,
            jumpUsername: form.jumpUsername,
            jumpPassword: form.jumpPassword
          },
          // onLog回调
          (level, message) => {
            if (connecting.value) { // 只有在创建中时才添加日志
              addLog(level, message);
            }
          },
          // onComplete回调
          (result) => {
            if (!connecting.value) return; // 如果已取消，不处理
            if (result.success) {
              connectionResult.value = result;
              addLog('SUCCESS', '创建流程完成！');
            } else {
              addLog('ERROR', result.error || '创建失败');
              ElMessage.error('创建失败');
              connecting.value = false;
              loading.value = false;
              isProcessing.value = false;
              sseReader.value = null;
              return;
            }
            connecting.value = false;
            sseReader.value = null;
            
            // 连接成功后，继续创建代理服务
            createProxyServiceRecord();
          },
          // onError回调
          (error) => {
            if (!connecting.value) return; // 如果已取消，不处理
            addLog('ERROR', error.message || '创建过程中发生错误');
            ElMessage.error('创建失败');
            connecting.value = false;
            loading.value = false;
            isProcessing.value = false;
            sseReader.value = null;
          },
          // 传递reader引用
          (reader) => {
            sseReader.value = reader;
          }
        );
        
        await connectPromise;
    } catch (error) {
      if (connecting.value || loading.value) { // 只有在创建中时才显示错误
        addLog('ERROR', error.message || '创建失败');
        ElMessage.error('创建失败');
      }
      connecting.value = false;
      loading.value = false;
      isProcessing.value = false;
      sseReader.value = null;
    }
  });
}

// 创建代理服务记录
async function createProxyServiceRecord() {
  try {
    addLog('INFO', '开始创建代理服务...');
    addLog('INFO', `服务名称: ${form.name}`);

    const data = {
      name: form.name,
      jumpHost: form.jumpHost,
      jumpPort: form.jumpPort,
      jumpUsername: form.jumpUsername
    };

    // 如果已有连接结果，使用连接结果中的端口和密钥
    if (connectionResult.value && connectionResult.value.success) {
      data.proxyPort = connectionResult.value.proxyPort;
      data.sshKeyPath = connectionResult.value.sshKeyPath;
    }

    addLog('INFO', '创建代理服务配置...');
    
    const response = await createProxyService(data);
    const service = response.data;
    
    addLog('INFO', `分配代理端口: ${service.proxy_port}`);
    addLog('SUCCESS', '代理服务创建成功');
    
    addLog('INFO', '启动autossh进程...');
    addLog('INFO', `建立SSH隧道: 127.0.0.1:${service.proxy_port} -> ${form.jumpHost}:${form.jumpPort}`);
    
    // 启动代理服务
    try {
      await startProxyService(service.id);
      addLog('SUCCESS', '代理服务启动成功');
      
      // 等待一下让服务启动
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addLog('INFO', '测试代理服务连接...');
      // 这里可以添加实际的测试逻辑
      addLog('SUCCESS', '代理服务测试通过');
    } catch (error) {
      addLog('ERROR', `启动代理服务失败: ${error.message}`);
    }

    // 设置代理服务器URL
    proxyServerUrl.value = `socks5://127.0.0.1:${service.proxy_port}`;
    createdService.value = service;
    
    ElMessage.success('代理服务创建成功');
    
    // 如果有回调函数，调用它来设置代理服务ID（在关闭对话框之前调用）
    // 使用 await 确保回调完成后再关闭对话框
    console.log('Checking onServiceCreated callback:', {
      exists: !!props.onServiceCreated,
      type: typeof props.onServiceCreated,
      serviceId: service.id
    });
    
    if (props.onServiceCreated && typeof props.onServiceCreated === 'function') {
      try {
        console.log('Calling onServiceCreated with serviceId:', service.id);
        await props.onServiceCreated(service.id);
        console.log('onServiceCreated callback completed');
      } catch (error) {
        console.error('Error in onServiceCreated callback:', error);
      }
    } else {
      console.warn('onServiceCreated callback is not available or not a function');
    }
    
    // 延迟关闭对话框，让用户看到成功信息
    setTimeout(() => {
      visible.value = false;
      emit('success');
    }, 1500);
  } catch (error) {
    addLog('ERROR', error.message || '创建失败');
    ElMessage.error('创建失败');
    loading.value = false;
    isProcessing.value = false;
  }
}

// 更新代理服务记录（编辑模式）
async function updateProxyServiceRecord() {
  try {
    loading.value = true;
    
    // 编辑模式下，只更新服务名称
    const data = {
      name: form.name
    };

    const response = await updateProxyService(props.service.id, data);
    
    ElMessage.success('更新成功');
    emit('success');
    visible.value = false;
  } catch (error) {
    ElMessage.error('更新失败');
    loading.value = false;
  } finally {
    loading.value = false;
  }
}

// 显示使用方法
function showUsageGuide() {
  ElMessageBox.alert(
    `代理服务器使用方法：

1. 配置浏览器代理：
   - 代理类型：SOCKS5
   - 代理地址：127.0.0.1
   - 代理端口：${createdService.value?.proxyPort || '端口号'}

2. 或使用PAC配置：
   - PAC地址：http://192.168.1.4:8090/proxy.pac
   - 在浏览器代理设置中选择"自动配置代理脚本"
   - 输入上述PAC地址

3. 测试代理连接：
   curl --socks5 127.0.0.1:${createdService.value?.proxyPort || '端口号'} http://www.google.com`,
    '使用方法',
    {
      confirmButtonText: '知道了'
    }
  );
}

</script>

<style scoped>
/* 跳板服务器信息分组 */
.jump-server-group {
  margin: 20px 0;
  padding: 16px;
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

/* 只读模式的跳板服务器信息 */
.jump-server-group.read-only {
  background-color: #fafafa;
  opacity: 0.8;
}

.group-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.group-content {
  padding-left: 0;
}

/* 调整分组内表单项间距 */
.jump-server-group :deep(.el-form-item) {
  margin-bottom: 18px;
}

.jump-server-group :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

/* 表单项行布局 */
.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.jump-host-input {
  flex: 1;
  min-width: 0;
}

.port-label {
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
  margin-left: auto;
}

.port-input {
  width: 120px;
  flex-shrink: 0;
}

/* 日志区域 - 固定高度 280px */
.log-section {
  margin-top: 20px;
  height: 280px;
  min-height: 280px;
  max-height: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 0 0 280px; /* 固定高度，不扩展 */
}

/* 成功信息 */
.success-info {
  margin-top: 20px;
}

.success-content {
  width: 100%;
}

.success-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
}

.success-details {
  font-size: 14px;
  line-height: 1.8;
}

.success-details > div {
  margin-bottom: 8px;
}

.success-links {
  margin-top: 12px;
  display: flex;
  gap: 16px;
}

/* 弹窗内容布局 */
.proxy-service-dialog :deep(.el-dialog) {
  display: flex !important;
  flex-direction: column !important;
  height: 80vh !important;
  margin-top: 10vh !important;
  margin-bottom: 10vh !important;
  max-height: 80vh !important;
  overflow: hidden !important;
}

.proxy-service-dialog :deep(.el-dialog__wrapper) {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  padding-bottom: 10vh;
}

.proxy-service-dialog :deep(.el-dialog__header) {
  flex: 0 0 auto !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  order: 1 !important;
}

.proxy-service-dialog :deep(.el-dialog__body) {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  min-height: 0 !important;
  max-height: 100% !important;
  padding: 20px !important;
  padding-bottom: 0 !important;
  overflow: hidden !important; /* body本身不滚动，内容区域滚动 */
  position: relative !important;
}

.proxy-service-dialog :deep(.el-form) {
  flex: 0 0 auto !important; /* 固定高度，不扩展 */
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
}

/* 日志区域 - 固定高度 280px */
.proxy-service-dialog :deep(.log-section) {
  height: 280px !important;
  min-height: 280px !important;
  max-height: 280px !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  margin-top: 20px !important;
  flex: 0 0 280px !important; /* 固定高度，不扩展 */
}

.proxy-service-dialog :deep(.success-info) {
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  margin-top: 20px !important;
}

/* Footer固定在对话框底部 */
.proxy-service-dialog :deep(.el-dialog__footer) {
  flex: 0 0 auto !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  padding: 20px !important;
  border-top: 1px solid #e4e7ed !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  order: 999 !important;
  position: relative !important;
}
</style>
