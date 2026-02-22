const jsonStore = require('../json-store');

/**
 * Host配置模型
 */
class HostConfigModel {
  /**
   * 创建Host配置
   */
  static async create(configData) {
    const { name, proxyServiceId, hosts, enabled = 1 } = configData;

    const result = await jsonStore.insert('host_configs', {
      name,
      proxy_service_id: proxyServiceId,
      hosts: JSON.stringify(hosts),
      enabled: enabled ? 1 : 0
    });

    // 解析 hosts 字段
    result.hosts = JSON.parse(result.hosts);
    result.enabled = result.enabled === 1;

    return result;
  }

  /**
   * 根据ID查找Host配置
   */
  static async findById(id) {
    const result = await jsonStore.findById('host_configs', id);

    if (result) {
      // 解析 JSON 字段
      if (typeof result.hosts === 'string') {
        result.hosts = JSON.parse(result.hosts);
      }
      result.enabled = result.enabled === 1;
    }

    return result;
  }

  /**
   * 获取所有Host配置
   */
  static async findAll(options = {}) {
    const { proxyServiceId, page, pageSize } = options;

    const where = proxyServiceId !== undefined ? { proxy_service_id: proxyServiceId } : undefined;

    const limit = pageSize;
    const offset = page && pageSize ? (page - 1) * pageSize : undefined;

    const result = await jsonStore.findAll('host_configs', {
      where,
      orderBy: 'created_at',
      order: 'DESC',
      limit,
      offset
    });

    // 解析 hosts 字段
    return result.map(row => ({
      ...row,
      hosts: typeof row.hosts === 'string' ? JSON.parse(row.hosts) : row.hosts,
      enabled: row.enabled === 1
    }));
  }

  /**
   * 获取所有Host配置（包含代理服务信息）- 手动实现 JOIN
   */
  static async findAllWithProxyService(options = {}) {
    const { proxyServiceId, enabled } = options;

    // 构建查询条件
    const where = {};
    if (proxyServiceId !== undefined) {
      where.proxy_service_id = proxyServiceId;
    }
    if (enabled !== undefined) {
      where.enabled = enabled ? 1 : 0;
    }

    // 查询所有 host_configs
    const hostConfigs = await jsonStore.findAll('host_configs', {
      where,
      orderBy: 'created_at',
      order: 'DESC'
    });

    // 查询所有 proxy_services（用于 JOIN）
    const proxyServices = await jsonStore.findAll('proxy_services', {});

    // 创建 proxy_service 映射
    const serviceMap = new Map();
    proxyServices.forEach(ps => {
      serviceMap.set(ps.id, ps);
    });

    // 手动 JOIN
    const result = hostConfigs.map(hc => {
      const proxyService = serviceMap.get(hc.proxy_service_id);
      return {
        id: hc.id,
        name: hc.name,
        proxyServiceId: hc.proxy_service_id,
        hosts: typeof hc.hosts === 'string' ? JSON.parse(hc.hosts) : hc.hosts,
        enabled: hc.enabled === 1,
        proxyServiceName: proxyService?.name || null,
        proxyServiceStatus: proxyService?.status || null,
        proxyServicePort: proxyService?.proxy_port || null,
        createdAt: hc.created_at,
        updatedAt: hc.updated_at
      };
    });

    return result;
  }

  /**
   * 更新Host配置
   */
  static async update(id, configData) {
    const { name, proxyServiceId, hosts, enabled } = configData;
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }
    if (proxyServiceId !== undefined) {
      updateData.proxy_service_id = proxyServiceId;
    }
    if (hosts !== undefined) {
      updateData.hosts = JSON.stringify(hosts);
    }
    if (enabled !== undefined) {
      updateData.enabled = enabled ? 1 : 0;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    const result = await jsonStore.update('host_configs', id, updateData);

    // 解析 hosts 字段
    if (typeof result.hosts === 'string') {
      result.hosts = JSON.parse(result.hosts);
    }
    result.enabled = result.enabled === 1;

    return result;
  }

  /**
   * 删除Host配置
   */
  static async delete(id) {
    return await jsonStore.delete('host_configs', id);
  }

  /**
   * 获取所有Host列表（用于冲突检测）
   */
  static async getAllHosts(excludeId = null) {
    const where = excludeId !== null ? { id: { $ne: excludeId } } : undefined;

    // json-store 不支持 $ne 操作符，需要手动过滤
    let hostConfigs = await jsonStore.findAll('host_configs', {});
    if (excludeId !== null) {
      hostConfigs = hostConfigs.filter(hc => hc.id !== excludeId);
    }

    const allHosts = [];
    hostConfigs.forEach(row => {
      const hosts = typeof row.hosts === 'string' ? JSON.parse(row.hosts) : row.hosts;
      hosts.forEach(host => {
        allHosts.push({ configId: row.id, host });
      });
    });

    return allHosts;
  }
}

module.exports = HostConfigModel;
