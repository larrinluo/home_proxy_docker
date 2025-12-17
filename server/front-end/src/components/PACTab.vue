<template>
  <div class="pac-tab">
    <div class="detail-content">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="自动代理配置服务URL">
          <div class="pac-url-container">
            <a 
              v-if="computedPacUrl" 
              :href="getPreviewUrl()" 
              target="_blank"
              class="pac-url-link"
            >
              {{ computedPacUrl }}
            </a>
            <span v-else>-</span>
            <el-icon 
              v-if="computedPacUrl"
              class="copy-icon"
              @click="handleCopyUrl"
              title="复制URL"
            >
              <DocumentCopy />
            </el-icon>
          </div>
        </el-descriptions-item>
        <el-descriptions-item label="自动代理配置服务地址与端口">
          <div class="host-port-row">
            <el-input
              v-model="pacServiceHost"
              size="small"
              @blur="handleBlur('pac_service_host', pacServiceHost)"
              @keyup.enter="handleEnter('pac_service_host', pacServiceHost)"
              style="width: 200px;"
              placeholder="IP地址"
            />
            <span class="separator">:</span>
            <el-input
              v-model="pacServicePort"
              size="small"
              @blur="handleBlur('pac_service_port', pacServicePort)"
              @keyup.enter="handleEnter('pac_service_port', pacServicePort)"
              style="width: 100px;"
              placeholder="端口"
            />
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- 服务介绍说明 -->
    <div class="service-intro">
      <div class="intro-content">
        <div class="intro-section">
          <h4>📖 什么是自动代理配置服务</h4>
          <p>自动代理配置服务（PAC - Proxy Auto-Configuration）是一种智能代理配置方案，通过提供PAC脚本文件，让浏览器根据访问的网站地址自动决定是否使用代理服务器。从而通过代理访问某些无法直接访问的网站，而大部分网站则高速直接访问，无需手动切换。</p>
        </div>
        <div class="intro-section">
          <h4>🎯 本项目的主要用途</h4>
          <ul>
            <li>智能分流：根据域名自动选择是否使用代理，提高访问效率</li>
            <li>统一管理：集中管理所有代理配置，无需在每个设备上单独设置</li>
            <li>灵活配置：支持多个代理配置，不同域名可以使用不同的代理服务器</li>
            <li>自动更新：修改代理配置后，所有客户端自动生效，无需重新配置</li>
          </ul>
        </div>
        <div class="intro-section">
          <h4>🚀 如何使用自动代理配置服务</h4>
          <ol>
            <li>在上方配置服务地址和端口，系统会自动生成PAC脚本URL</li>
            <li>根据您的操作系统，按照下方对应的配置方法进行设置：</li>
          </ol>
          
          <!-- Windows 配置方法 -->
          <div class="os-config-section">
            <div class="os-config-header">
              <el-icon class="os-icon"><Monitor /></el-icon>
              <h5>Windows配置方法</h5>
            </div>
            <div class="os-config-steps">
              <div class="config-step">
                <span class="step-number">1</span>
                <div class="step-content">
                  <p>打开"设置" → "网络和Internet" → "代理"</p>
                  <p class="step-detail">或按 <kbd>Win + I</kbd> 搜索"代理"</p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">2</span>
                <div class="step-content">
                  <p>在"自动代理设置"部分，开启"使用设置脚本"</p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">3</span>
                <div class="step-content">
                  <p>在"脚本地址"中输入：</p>
                  <div class="code-block">
                    <code>{{ computedPacUrl || 'http://192.168.2.4:3000/proxy.pac' }}</code>
                    <el-icon class="copy-code-icon" @click="copyPacUrl" title="复制">
                      <DocumentCopy />
                    </el-icon>
                  </div>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">4</span>
                <div class="step-content">
                  <p>点击"保存"，配置完成</p>
                </div>
              </div>
            </div>
          </div>

          <!-- macOS 配置方法 -->
          <div class="os-config-section">
            <div class="os-config-header">
              <el-icon class="os-icon"><Monitor /></el-icon>
              <h5>macOS配置方法</h5>
            </div>
            <div class="os-config-steps">
              <div class="config-step">
                <span class="step-number">1</span>
                <div class="step-content">
                  <p>打开"系统设置" → "网络"</p>
                  <p class="step-detail">或点击苹果菜单 → "系统设置"</p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">2</span>
                <div class="step-content">
                  <p>选择当前网络连接（Wi-Fi 或以太网）</p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">3</span>
                <div class="step-content">
                  <p>点击"详细信息" → "代理"标签</p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">4</span>
                <div class="step-content">
                  <p>勾选"自动代理配置"，在"URL"中输入：</p>
                  <div class="code-block">
                    <code>{{ computedPacUrl || 'http://192.168.2.4:3000/proxy.pac' }}</code>
                    <el-icon class="copy-code-icon" @click="copyPacUrl" title="复制">
                      <DocumentCopy />
                    </el-icon>
                  </div>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">5</span>
                <div class="step-content">
                  <p>点击"好"保存设置</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Ubuntu/Linux 配置方法 -->
          <div class="os-config-section">
            <div class="os-config-header">
              <el-icon class="os-icon"><Monitor /></el-icon>
              <h5>Ubuntu/Linux配置方法</h5>
            </div>
            <div class="os-config-steps">
              <div class="config-step">
                <span class="step-number">1</span>
                <div class="step-content">
                  <p>打开"设置" → "网络" → "网络代理"</p>
                  <p class="step-detail">或在终端运行：<code>gnome-control-center network</code></p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">2</span>
                <div class="step-content">
                  <p>选择"自动"模式</p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">3</span>
                <div class="step-content">
                  <p>在"配置URL"中输入：</p>
                  <div class="code-block">
                    <code>{{ computedPacUrl || 'http://192.168.2.4:3000/proxy.pac' }}</code>
                    <el-icon class="copy-code-icon" @click="copyPacUrl" title="复制">
                      <DocumentCopy />
                    </el-icon>
                  </div>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">4</span>
                <div class="step-content">
                  <p>点击"应用"保存设置</p>
                </div>
              </div>
              <div class="config-step">
                <span class="step-number">5</span>
                <div class="step-content">
                  <p><strong>命令行方式（可选）：</strong></p>
                  <div class="code-block">
                    <code>gsettings set org.gnome.system.proxy mode 'auto'</code>
                  </div>
                  <div class="code-block">
                    <code>gsettings set org.gnome.system.proxy autoconfig-url '{{ computedPacUrl || 'http://192.168.2.4:3000/proxy.pac' }}'</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ol start="3" style="margin-top: 20px;">
            <li>配置完成后，浏览器会根据PAC脚本自动选择代理服务器</li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { DocumentCopy, Monitor, InfoFilled } from '@element-plus/icons-vue';
import { getSystemConfigs, updateSystemConfig } from '../api/system-configs';

const props = defineProps({
  pacUrl: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['pac-config-updated']);

const pacServiceHost = ref('');
const pacServicePort = ref('');
const originalValues = ref({});

// 计算服务地址
const computedPacUrl = computed(() => {
  if (pacServiceHost.value && pacServicePort.value) {
    return `http://${pacServiceHost.value}:${pacServicePort.value}/proxy.pac`;
  }
  return props.pacUrl || '';
});

// 获取预览URL
function getPreviewUrl() {
  if (!computedPacUrl.value) return '';
  // 将 /proxy.pac 替换为 /api/v1/pac/preview
  const baseUrl = computedPacUrl.value.replace('/proxy.pac', '');
  return `${baseUrl}/api/v1/pac/preview`;
}

// 复制URL到剪贴板
async function handleCopyUrl() {
  if (!computedPacUrl.value) return;
  await copyToClipboard(computedPacUrl.value);
}

// 复制PAC URL（用于配置说明中的复制按钮）
async function copyPacUrl() {
  const url = computedPacUrl.value || 'http://192.168.2.4:3000/proxy.pac';
  await copyToClipboard(url);
}

// 通用复制函数
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('已复制到剪贴板');
  } catch (error) {
    console.error('Copy to clipboard failed:', error);
    // 降级方案：使用传统方法
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      ElMessage.success('已复制到剪贴板');
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError);
      ElMessage.error('复制失败');
    }
  }
}

// 加载系统配置
async function loadConfigs() {
  try {
    const response = await getSystemConfigs();
    if (response.success) {
      const items = response.data.items || [];
      const hostConfig = items.find(c => c.key === 'pac_service_host');
      const portConfig = items.find(c => c.key === 'pac_service_port');
      
      pacServiceHost.value = hostConfig?.value || '';
      pacServicePort.value = portConfig?.value || '';
      
      originalValues.value['pac_service_host'] = pacServiceHost.value;
      originalValues.value['pac_service_port'] = pacServicePort.value;
    }
  } catch (error) {
    console.error('Load system configs error:', error);
  }
}

// 处理失焦事件
function handleBlur(key, value) {
  if (originalValues.value[key] === value) {
    return;
  }
  handleUpdate(key, value);
}

// 处理回车事件
function handleEnter(key, value, event) {
  if (event && event.target) {
    event.target.blur();
  }
}

// 更新配置
async function handleUpdate(key, value) {
  try {
    await updateSystemConfig(key, value);
    originalValues.value[key] = value;
    ElMessage.success('更新成功');
    
    // 通知父组件配置已更新
    emit('pac-config-updated', {
      host: pacServiceHost.value,
      port: pacServicePort.value,
      pacUrl: computedPacUrl.value
    });
  } catch (error) {
    console.error('Update system config error:', error);
    ElMessage.error('更新失败');
    // 恢复原值
    if (key === 'pac_service_host') {
      pacServiceHost.value = originalValues.value[key] || '';
    } else if (key === 'pac_service_port') {
      pacServicePort.value = originalValues.value[key] || '';
    }
  }
}

onMounted(() => {
  loadConfigs();
});
</script>

<style scoped>
.pac-tab {
  height: 100%;
  padding: 20px;
  overflow: auto;
}

/* 服务介绍说明样式 */
.service-intro {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  margin-top: 24px;
}

.intro-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e4e7ed;
}

.intro-icon {
  font-size: 24px;
  color: #409eff;
}

.intro-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: normal;
  color: #303133;
}

.intro-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.intro-section {
  background: #ffffff;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e4e7ed;
}

.intro-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: normal;
  color: #303133;
}

.intro-section p {
  margin: 0 0 12px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.8;
}

.intro-section p:last-child {
  margin-bottom: 0;
}

.intro-section ul,
.intro-section ol {
  margin: 0;
  padding-left: 24px;
  color: #606266;
  font-size: 14px;
  line-height: 1.8;
}

.intro-section li {
  margin-bottom: 8px;
}

.intro-section li:last-child {
  margin-bottom: 0;
}

.intro-section strong {
  color: #303133;
  font-weight: normal;
}

/* 操作系统配置方法样式（在"使用方法"部分内） */
.os-config-section {
  margin: 20px 0;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
}

.os-config-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.os-config-header .os-icon {
  font-size: 20px;
  color: #409eff;
}

.os-config-header h5 {
  margin: 0;
  font-size: 16px;
  font-weight: normal;
  color: #303133;
}

.os-config-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-step {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.config-step .step-number {
  display: inline-block;
  font-weight: normal;
  font-size: 14px;
  color: #303133;
  margin-right: 8px;
  flex-shrink: 0;
  min-width: 20px;
}

.config-step .step-content {
  flex: 1;
}

.config-step .step-content p {
  margin: 0 0 5px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.config-step .step-detail {
  color: #909399 !important;
  font-size: 12px !important;
}

.config-step .step-content kbd {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.config-step .code-block {
  position: relative;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 10px 35px 10px 12px;
  margin-top: 8px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.config-step .code-block code {
  color: #409eff;
  word-break: break-all;
}

.config-step .copy-code-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: #909399;
  cursor: pointer;
  transition: color 0.2s;
}

.config-step .copy-code-icon:hover {
  color: #409eff;
}

.detail-content {
  width: 100%;
}

.pac-url-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pac-url-link {
  color: #409eff;
  text-decoration: none;
  cursor: pointer;
}

.pac-url-link:hover {
  color: #66b1ff;
  text-decoration: underline;
}

.copy-icon {
  font-size: 16px;
  color: #909399;
  cursor: pointer;
  transition: color 0.2s;
}

.copy-icon:hover {
  color: #409eff;
}

.host-port-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.separator {
  color: #909399;
  font-weight: 500;
}

/* 系统配置说明样式 */
.system-guides {
  margin-top: 30px;
}

.guide-title {
  font-size: 18px;
  font-weight: normal;
  color: #303133;
  margin-bottom: 20px;
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.guide-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  background: #f5f7fa;
  transition: box-shadow 0.3s;
}

.guide-card:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.guide-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e4e7ed;
}

.os-icon {
  font-size: 24px;
  color: #409eff;
}

.guide-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: normal;
  color: #303133;
}

.guide-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.guide-steps {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.step {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.step-number {
  display: inline-block;
  font-weight: normal;
  font-size: 14px;
  color: #303133;
  margin-right: 8px;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content p {
  margin: 0 0 5px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}

.step-detail {
  color: #909399 !important;
  font-size: 12px !important;
}

.step-content kbd {
  background: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.code-block {
  position: relative;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 10px 35px 10px 12px;
  margin-top: 8px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.code-block code {
  color: #409eff;
  word-break: break-all;
}

.copy-code-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: #909399;
  cursor: pointer;
  transition: color 0.2s;
}

.copy-code-icon:hover {
  color: #409eff;
}


/* 响应式布局 */
@media (max-width: 1400px) {
  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>

