<template>
  <div class="system-config">
    <h1>系统配置</h1>
    <el-card v-loading="loading">
      <el-table :data="configs" style="width: 100%">
        <el-table-column prop="key" label="配置键" width="200" />
        <el-table-column prop="description" label="说明" />
        <el-table-column label="值" width="400">
          <template #default="{ row }">
            <el-switch
              v-if="typeof row.value === 'boolean'"
              v-model="row.value"
              @change="handleUpdate(row.key, row.value)"
            />
            <div v-else-if="isEditableText(row.key)" class="input-with-button">
              <el-input
                v-model="row.value"
                size="small"
                @blur="handleBlur(row.key, row.value, $event)"
                @keyup.enter="handleEnter(row.key, row.value, $event)"
                style="width: 200px;"
              />
              <el-button
                v-if="row.key === 'pac_service_port'"
                size="small"
                type="primary"
                :loading="testingPort"
                @click="handleTestPort(row)"
                style="margin-left: 8px;"
              >
                测试
              </el-button>
            </div>
            <span v-else>{{ row.value }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getSystemConfigs, updateSystemConfig } from '../api/system-configs';

const loading = ref(false);
const configs = ref([]);
const originalValues = ref({}); // 存储原始值，用于比较是否真正改变
const testingPort = ref(false);

// 判断配置项是否为可编辑文本类型
function isEditableText(key) {
  return key === 'pac_service_host' || key === 'pac_service_port';
}

async function loadConfigs() {
  loading.value = true;
  try {
    const response = await getSystemConfigs();
    if (response.success) {
      configs.value = response.data.items || [];
      // 保存原始值
      configs.value.forEach(config => {
        if (isEditableText(config.key)) {
          originalValues.value[config.key] = config.value;
        }
      });
    }
  } catch (error) {
    ElMessage.error('加载系统配置失败');
  } finally {
    loading.value = false;
  }
}

async function handleUpdate(key, value) {
  // 如果值没有改变，不执行更新
  if (originalValues.value[key] === value) {
    return;
  }
  
  try {
    await updateSystemConfig(key, value);
    // 更新原始值
    originalValues.value[key] = value;
    ElMessage.success('更新成功');
  } catch (error) {
    ElMessage.error('更新失败');
    // 重新加载以恢复原值
    loadConfigs();
  }
}

// 处理失焦事件
function handleBlur(key, value, event) {
  // 确保是真正的失焦事件，而不是其他原因
  if (event && event.target) {
    handleUpdate(key, value);
  }
}

// 处理回车事件
function handleEnter(key, value, event) {
  if (event && event.target) {
    event.target.blur(); // 失焦，触发blur事件
  }
}

// 测试端口
async function handleTestPort(row) {
  testingPort.value = true;
  try {
    // 获取host和port配置
    const hostConfig = configs.value.find(c => c.key === 'pac_service_host');
    const portConfig = configs.value.find(c => c.key === 'pac_service_port');
    
    const host = hostConfig?.value || '127.0.0.1';
    const port = portConfig?.value || row.value;
    
    // 构建PAC URL
    const pacUrl = `http://${host}:${port}/proxy.pac`;
    
    // 测试PAC服务是否可访问
    const response = await fetch(pacUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (response.ok) {
      ElMessage.success(`PAC服务测试成功: ${pacUrl}`);
    } else {
      ElMessage.error(`PAC服务测试失败: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Test PAC service error:', error);
    ElMessage.error(`PAC服务测试失败: ${error.message || '无法连接到PAC服务'}`);
  } finally {
    testingPort.value = false;
  }
}

onMounted(() => {
  loadConfigs();
});
</script>

<style scoped>
.system-config {
  padding: 20px;
}

.system-config :deep(.el-table th) {
  background-color: transparent !important;
}

.system-config :deep(.el-table td) {
  background-color: transparent !important;
}

.input-with-button {
  display: flex;
  align-items: center;
}
</style>

