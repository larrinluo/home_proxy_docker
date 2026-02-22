const jsonStore = require('../json-store');

/**
 * 代理服务模型
 */
class ProxyServiceModel {
  /**
   * 创建代理服务
   */
  static async create(serviceData) {
    const {
      name,
      jumpHost,
      jumpPort,
      jumpUsername,
      proxyPort,
      sshKeyPath,
      status = 'stopped'
    } = serviceData;

    const result = await jsonStore.insert('proxy_services', {
      name,
      jump_host: jumpHost,
      jump_port: jumpPort || 22,
      jump_username: jumpUsername,
      proxy_port: proxyPort,
      ssh_key_path: sshKeyPath,
      status
    });

    return result;
  }

  /**
   * 根据ID查找代理服务
   */
  static async findById(id) {
    return await jsonStore.findById('proxy_services', id);
  }

  /**
   * 获取所有代理服务
   */
  static async findAll(options = {}) {
    const { status, page, pageSize, sortBy = 'created_at', sortOrder = 'DESC' } = options;

    const where = status !== undefined ? { status } : undefined;

    const limit = pageSize;
    const offset = page && pageSize ? (page - 1) * pageSize : undefined;

    const result = await jsonStore.findAll('proxy_services', {
      where,
      orderBy: sortBy,
      order: sortOrder,
      limit,
      offset
    });

    return result;
  }

  /**
   * 统计代理服务数量
   */
  static async count(options = {}) {
    const { status } = options;
    const where = status !== undefined ? { status } : undefined;
    return await jsonStore.count('proxy_services', { where });
  }

  /**
   * 根据代理端口查找
   */
  static async findByProxyPort(proxyPort) {
    const services = await jsonStore.findAll('proxy_services', {
      where: { proxy_port: proxyPort }
    });
    return services.length > 0 ? services[0] : null;
  }

  /**
   * 更新代理服务
   */
  static async update(id, serviceData) {
    const {
      name,
      jumpHost,
      jumpPort,
      jumpUsername,
      proxyPort,
      sshKeyPath,
      status,
      processId
    } = serviceData;

    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }
    if (jumpHost !== undefined) {
      updateData.jump_host = jumpHost;
    }
    if (jumpPort !== undefined) {
      updateData.jump_port = jumpPort;
    }
    if (jumpUsername !== undefined) {
      updateData.jump_username = jumpUsername;
    }
    if (proxyPort !== undefined) {
      updateData.proxy_port = proxyPort;
    }
    if (sshKeyPath !== undefined) {
      updateData.ssh_key_path = sshKeyPath;
    }
    if (status !== undefined) {
      updateData.status = status;
    }
    if (processId !== undefined) {
      updateData.process_id = processId;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    return await jsonStore.update('proxy_services', id, updateData);
  }

  /**
   * 删除代理服务
   */
  static async delete(id) {
    return await jsonStore.delete('proxy_services', id);
  }
}

module.exports = ProxyServiceModel;
