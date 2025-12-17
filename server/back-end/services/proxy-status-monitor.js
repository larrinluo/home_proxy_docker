const ProxyServiceModel = require('../db/models/proxy-services');
const processManager = require('./proxy-process-manager');

/**
 * 代理服务状态监控器
 */
class ProxyStatusMonitor {
  constructor() {
    this.intervalId = null;
    this.checkInterval = 30000; // 30秒
  }

  /**
   * 启动监控
   */
  start() {
    if (this.intervalId) {
      return; // 已经启动
    }

    this.intervalId = setInterval(async () => {
      await this.checkAllServices();
    }, this.checkInterval);

    console.log('Proxy status monitor started');
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Proxy status monitor stopped');
    }
  }

  /**
   * 检查所有代理服务状态
   */
  async checkAllServices() {
    try {
      const services = await ProxyServiceModel.findAll({ status: 'running' });

      for (const service of services) {
        if (service.process_id) {
          const isRunning = await processManager.isProcessRunning(service.process_id);
          
          if (!isRunning && service.status === 'running') {
            // 进程已退出，更新状态
            await ProxyServiceModel.update(service.id, {
              status: 'error',
              processId: -1  // 进程意外退出时设置为 -1
            });
            console.log(`Service ${service.id} process exited unexpectedly`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking proxy services status:', error);
    }
  }
}

module.exports = new ProxyStatusMonitor();




