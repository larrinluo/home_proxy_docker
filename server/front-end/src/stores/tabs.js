import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref([
    {
      id: 'pac-preview',
      name: 'PAC配置预览',
      component: 'PACPreview',
      closable: false,
      active: true
    }
  ]);

  /**
   * 添加标签页
   */
  function addTab(tab) {
    // 检查是否已存在
    const exists = tabs.value.find(t => t.id === tab.id);
    if (!exists) {
      // 取消其他标签页的active状态
      tabs.value.forEach(t => t.active = false);
      tabs.value.push({
        ...tab,
        active: true,
        closable: tab.closable !== false
      });
    } else {
      // 如果已存在，激活它
      setActiveTab(tab.id);
    }
  }

  /**
   * 移除标签页
   */
  function removeTab(tabId) {
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

  /**
   * 设置活动标签页
   */
  function setActiveTab(tabId) {
    tabs.value.forEach(tab => {
      tab.active = tab.id === tabId;
    });
  }

  /**
   * 获取活动标签页
   */
  function getActiveTab() {
    return tabs.value.find(tab => tab.active);
  }

  return {
    tabs,
    addTab,
    removeTab,
    setActiveTab,
    getActiveTab
  };
});






