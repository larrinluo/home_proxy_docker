<template>
  <div class="process-log-viewer">
    <div ref="logContentRef" class="log-content">
      <div
        v-for="(log, index) in logs"
        :key="index"
        :class="['log-line', `log-${log.level.toLowerCase()}`, { 'log-command': isCommand(log.message), 'log-countdown': isCountdown(log.message) }]"
      >
        <span class="log-timestamp">{{ log.timestamp }}</span>
        <span class="log-level">[{{ log.level }}]</span>
        <span class="log-message" v-html="formatMessage(log.message)"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed } from 'vue';

const props = defineProps({
  logs: {
    type: Array,
    default: () => []
  }
});

const logContentRef = ref(null);

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

const currentTimestamp = computed(() => formatTimestamp());

// 判断是否是命令
function isCommand(message) {
  return message.includes('执行命令:') || message.includes('执行操作:') || message.includes('连接命令:') || message.includes('autossh命令');
}

// 判断是否是倒计时
function isCountdown(message) {
  return message.includes('⏱️') || message.includes('剩余') || message.includes('进行中');
}

// 格式化消息，高亮显示命令和倒计时
function formatMessage(message) {
  let formatted = message;
  
  // 高亮命令
  formatted = formatted.replace(/执行命令:\s*(.+)/g, '<span class="command-text">执行命令: <code>$1</code></span>');
  formatted = formatted.replace(/执行操作:\s*(.+)/g, '<span class="command-text">执行操作: <code>$1</code></span>');
  formatted = formatted.replace(/连接命令:\s*(.+)/g, '<span class="command-text">连接命令: <code>$1</code></span>');
  
  // 高亮倒计时
  formatted = formatted.replace(/(⏱️.*?剩余\s+\d+\s+秒)/g, '<span class="countdown-text">$1</span>');
  
  // 高亮步骤标题
  formatted = formatted.replace(/【步骤\s+(\d+\/\d+)】(.+)/g, '<strong class="step-title">【步骤 $1】$2</strong>');
  
  // 高亮分隔线
  formatted = formatted.replace(/═+/g, '<span class="separator">$&</span>');
  
  return formatted;
}

// 自动滚动到底部
watch(() => props.logs.length, () => {
  nextTick(() => {
    if (logContentRef.value) {
      logContentRef.value.scrollTop = logContentRef.value.scrollHeight;
    }
  });
}, { immediate: true });


</script>

<style scoped>
.process-log-viewer {
  display: flex;
  flex-direction: column;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #ffffff;
  height: 100%;
  min-height: 0; /* 允许flex item缩小 */
}

.log-content {
  flex: 1 1 0%;
  min-height: 0; /* 允许flex item缩小，关键！ */
  padding: 12px 16px;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.8;
  background-color: #ffffff;
}

/* 浅色主题滚动条样式 */
.log-content::-webkit-scrollbar {
  width: 8px;
}

.log-content::-webkit-scrollbar-track {
  background: #f5f5f5;
}

.log-content::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: #a8abb2;
}

.log-line {
  margin-bottom: 4px;
  word-break: break-all;
}

.log-timestamp {
  color: #909399;
  margin-right: 8px;
}

.log-level {
  font-weight: 500;
  margin-right: 8px;
}

.log-info .log-level {
  color: #409eff;
}

.log-success .log-level {
  color: #67c23a;
}

.log-warning .log-level {
  color: #e6a23c;
}

.log-error .log-level {
  color: #f56c6c;
}

.log-message {
  color: #303133;
}

.log-info .log-message {
  color: #303133;
}

.log-success .log-message {
  color: #67c23a;
}

.log-warning .log-message {
  color: #e6a23c;
}

.log-error .log-message {
  color: #f56c6c;
}

/* 命令样式 */
.log-command .log-message {
  font-weight: 500;
}

.command-text {
  color: #303133;
}

.command-text code {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #409eff;
  font-weight: 600;
  border: 1px solid #e4e7ed;
}

/* 倒计时样式 */
.log-countdown .log-message {
  font-weight: 600;
}

.countdown-text {
  color: #e6a23c;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* 步骤标题样式 */
.step-title {
  color: #409eff;
  font-size: 13px;
}

/* 分隔线样式 */
.separator {
  color: #c0c4cc;
  font-weight: normal;
}

</style>

