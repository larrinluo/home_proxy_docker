const ProxyServiceModel = require('../db/models/proxy-services');
const HostConfigModel = require('../db/models/host-configs');

// 缓存相关变量
let pacConfigCache = null;
let pacFileCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 1000; // 5秒缓存

/**
 * PAC配置生成器
 */
class PACGenerator {
  /**
   * 清除缓存
   */
  clearCache() {
    pacConfigCache = null;
    pacFileCache = null;
    cacheTimestamp = null;
  }

  /**
   * 生成PAC配置JSON
   * @param {string} proxyHost - 代理服务器地址（客户端访问的地址）
   * @param {boolean} useCache - 是否使用缓存
   * @returns {Promise<Object>}
   */
  async generatePACConfig(proxyHost = '127.0.0.1', useCache = true) {
    // 检查缓存
    if (useCache && pacConfigCache && cacheTimestamp) {
      const now = Date.now();
      if (now - cacheTimestamp < CACHE_TTL) {
        return pacConfigCache;
      }
    }
    // 获取所有运行中的代理服务
    const runningServices = await ProxyServiceModel.findAll({ status: 'running' });

    if (runningServices.length === 0) {
      return {
        proxyRules: [],
        direct: true
      };
    }

    // 获取所有启用的Host配置
    const hostConfigs = await HostConfigModel.findAllWithProxyService({ enabled: true });

    // 构建代理规则
    const proxyRules = [];
    const domainMap = new Map(); // host -> proxy_port

    // 遍历Host配置，建立域名到代理端口的映射
    hostConfigs.forEach(config => {
      if (config.enabled && config.proxyServiceStatus === 'running' && config.hosts) {
        const proxy = `SOCKS5 ${proxyHost}:${config.proxyServicePort}`;
        config.hosts.forEach(host => {
          if (!domainMap.has(host)) {
            domainMap.set(host, proxy);
          }
        });
      }
    });

    // 按代理端口分组域名
    const proxyGroups = new Map();
    domainMap.forEach((proxy, host) => {
      if (!proxyGroups.has(proxy)) {
        proxyGroups.set(proxy, []);
      }
      proxyGroups.get(proxy).push(host);
    });

    // 构建规则数组
    proxyGroups.forEach((domains, proxy) => {
      proxyRules.push({
        domains,
        proxy
      });
    });

    const config = {
      proxyRules,
      direct: proxyRules.length === 0
    };

    // 更新缓存
    if (useCache) {
      pacConfigCache = config;
      cacheTimestamp = Date.now();
    }

    return config;
  }

  /**
   * 生成PAC文件内容（JavaScript格式）
   * @param {string} proxyHost - 代理服务器地址
   * @param {boolean} useCache - 是否使用缓存
   * @returns {Promise<string>}
   */
  async generatePACFile(proxyHost = '127.0.0.1', useCache = true) {
    // 检查缓存
    if (useCache && pacFileCache && cacheTimestamp) {
      const now = Date.now();
      if (now - cacheTimestamp < CACHE_TTL) {
        return pacFileCache;
      }
    }

    const config = await this.generatePACConfig(proxyHost, useCache);

    const pacContent = `function FindProxyForURL(url, host) {
  // PAC配置文件自动生成
  var proxyRules = ${JSON.stringify(config.proxyRules, null, 2)};

  for (var i = 0; i < proxyRules.length; i++) {
    var rule = proxyRules[i];
    for (var j = 0; j < rule.domains.length; j++) {
      if (host === rule.domains[j] || host.endsWith('.' + rule.domains[j])) {
        return rule.proxy;
      }
    }
  }

  return "DIRECT";
}`;

    // 更新缓存
    if (useCache) {
      pacFileCache = pacContent;
      cacheTimestamp = Date.now();
    }

    return pacContent;
  }
}

module.exports = new PACGenerator();

