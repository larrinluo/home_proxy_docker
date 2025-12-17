<template>
  <div class="default-config-card">
    <!-- 卡片头部 -->
    <div class="card-header">
      <span class="config-name">默认配置</span>
      <el-tag type="info" size="small">未配置</el-tag>
    </div>

    <!-- 卡片内容 -->
    <div class="card-content">
      <!-- 代理服务选择 -->
      <div class="info-row">
        <span class="label">代理服务：</span>
        <el-select
          v-model="selectedProxyServiceId"
          :key="`select-${proxyServices.length}-${selectedProxyServiceId}`"
          placeholder="新建或选择代理服务"
          size="small"
          style="flex: 1; min-width: 0;"
          @change="handleProxyServiceChange"
          @visible-change="handleSelectVisibleChange"
        >
          <el-option
            v-for="service in proxyServices"
            :key="service.id"
            :label="`${service.name} (${service.proxy_port})`"
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

    <!-- 卡片底部操作 -->
    <div class="card-footer">
      <el-button
        type="primary"
        size="small"
        :disabled="!canSave"
        @click="handleSave"
      >
        保存配置
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowRight } from '@element-plus/icons-vue';
import { createHostConfig } from '../api/host-configs';

const props = defineProps({
  proxyServices: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['save', 'create-service', 'open-host-config']);

const selectedProxyServiceId = ref(null);
const hosts = ref([]);

// 监听 proxyServices 变化，确保选中的服务仍然存在
watch(() => props.proxyServices, (newServices) => {
  if (selectedProxyServiceId.value) {
    const serviceExists = newServices.some(s => s.id === selectedProxyServiceId.value);
    if (!serviceExists) {
      console.warn('Selected service no longer exists, clearing selection');
      selectedProxyServiceId.value = null;
    } else {
      console.log('Selected service still exists:', selectedProxyServiceId.value);
    }
  }
}, { deep: true });

// Host显示文本
const hostDisplayText = computed(() => {
  if (hosts.value.length === 0) {
    return '点击添加Host';
  }
  if (hosts.value.length <= 3) {
    return hosts.value.join(', ');
  }
  return `${hosts.value.slice(0, 3).join(', ')}...`;
});

// 是否可以保存（只要选择了代理服务就可以保存）
const canSave = computed(() => {
  return selectedProxyServiceId.value !== null;
});

// 代理服务变更
function handleProxyServiceChange(value) {
  if (value === '__create_new__') {
    // 重置选择
    selectedProxyServiceId.value = null;
    // 触发创建代理服务
    emit('create-service');
  }
  // 可以在这里处理代理服务变更逻辑
}

// 下拉框显示/隐藏变化
function handleSelectVisibleChange(visible) {
  // 可以在这里处理下拉框显示/隐藏逻辑
}

// 点击Host配置区域
function handleClickHostConfig() {
  if (!selectedProxyServiceId.value) {
    ElMessage.warning('请先选择代理服务');
    return;
  }
  emit('open-host-config', {
    proxyServiceId: selectedProxyServiceId.value,
    hosts: hosts.value,
    isDefault: true
  });
}

// 保存配置
async function handleSave() {
  if (!canSave.value) {
    ElMessage.warning('请选择代理服务');
    return;
  }

  try {
    await createHostConfig({
      name: '默认配置',
      proxyServiceId: selectedProxyServiceId.value,
      hosts: hosts.value || [] // 如果没有Host配置，使用空数组
    });
    ElMessage.success('配置保存成功');
    emit('save');
  } catch (error) {
    ElMessage.error('保存配置失败');
  }
}

// 设置代理服务ID（从外部调用）
async function setProxyServiceId(serviceId) {
  console.log('DefaultConfigCard.setProxyServiceId called with:', serviceId);
  console.log('Available proxy services:', props.proxyServices.map(s => ({ id: s.id, name: s.name })));
  
  // 检查服务是否在列表中
  const serviceExists = props.proxyServices.some(s => s.id === serviceId);
  if (!serviceExists) {
    console.warn('Service not found in proxyServices list:', serviceId, 'Will retry after a delay');
    // 如果服务不在列表中，等待一下再重试
    setTimeout(() => {
      const retryExists = props.proxyServices.some(s => s.id === serviceId);
      if (retryExists) {
        console.log('Service now exists, setting selectedProxyServiceId');
        selectedProxyServiceId.value = serviceId;
        console.log('selectedProxyServiceId set to:', selectedProxyServiceId.value);
      } else {
        console.error('Service still not found after retry:', serviceId);
      }
    }, 500);
    return;
  }
  
  // 服务在列表中，直接设置
  selectedProxyServiceId.value = serviceId;
  console.log('selectedProxyServiceId set to:', selectedProxyServiceId.value);
  
  // 强制触发更新（确保 el-select 显示选中值）
  await nextTick();
  console.log('After nextTick, selectedProxyServiceId:', selectedProxyServiceId.value);
  
  // 再次等待，确保 Element Plus 组件更新
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('After delay, selectedProxyServiceId:', selectedProxyServiceId.value);
  
  // 验证选中值是否正确
  if (selectedProxyServiceId.value === serviceId) {
    console.log('✅ selectedProxyServiceId successfully set to', serviceId);
  } else {
    console.error('❌ selectedProxyServiceId mismatch! Expected:', serviceId, 'Got:', selectedProxyServiceId.value);
  }
}

// 暴露方法
defineExpose({
  setHosts,
  setProxyServiceId
});

// 设置Host列表（从外部调用）
function setHosts(newHosts) {
  hosts.value = [...newHosts];
}

</script>

<style scoped>
.default-config-card {
  background-color: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  margin-bottom: 10px;
  padding: 12px;
  cursor: default;
  width: 100%;
  box-sizing: border-box; /* 确保padding包含在宽度内 */
  overflow: hidden; /* 防止内容溢出 */
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.config-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
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
</style>

