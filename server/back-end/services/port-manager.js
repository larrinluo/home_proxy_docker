const net = require('net');
const ProxyServiceModel = require('../db/models/proxy-services');
require('dotenv').config();

const PROXY_PORT_START = parseInt(process.env.PROXY_PORT_START) || 11081;
const PROXY_PORT_END = parseInt(process.env.PROXY_PORT_END) || 11083;

/**
 * 端口管理器
 */
class PortManager {
  /**
   * 检查端口是否可用
   * @param {number} port - 端口号
   * @returns {Promise<boolean>}
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      server.on('error', () => resolve(false));
    });
  }

  /**
   * 检查端口是否被占用（系统级别）
   * @param {number} port - 端口号
   * @returns {Promise<boolean>}
   */
  async isPortInUse(port) {
    return !(await this.isPortAvailable(port));
  }

  /**
   * 分配一个可用的代理端口
   * @returns {Promise<number>}
   */
  async allocatePort() {
    // 获取所有已使用的端口
    const services = await ProxyServiceModel.findAll();
    const usedPorts = new Set(services.map(s => s.proxy_port));

    // 在端口范围内查找可用端口
    for (let port = PROXY_PORT_START; port <= PROXY_PORT_END; port++) {
      // 检查数据库中是否已使用
      if (usedPorts.has(port)) {
        continue;
      }

      // 检查系统级别是否可用
      const isAvailable = await this.isPortAvailable(port);
      if (isAvailable) {
        return port;
      }
    }

    throw new Error('No available proxy port in range');
  }

  /**
   * 检查端口是否在允许的范围内
   * @param {number} port - 端口号
   * @returns {boolean}
   */
  isPortInRange(port) {
    return port >= PROXY_PORT_START && port <= PROXY_PORT_END;
  }

  /**
   * 释放端口（实际上是从数据库中删除记录）
   * 注意：这个方法主要用于标记端口可用，实际释放由删除代理服务时完成
   */
  async releasePort(port) {
    // 端口释放实际上是通过删除代理服务记录完成的
    // 这里可以添加额外的清理逻辑（如果需要）
    return true;
  }
}

module.exports = new PortManager();








