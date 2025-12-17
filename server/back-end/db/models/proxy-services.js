const db = require('../index');

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

    const sql = `
      INSERT INTO proxy_services 
      (name, jump_host, jump_port, jump_username, proxy_port, ssh_key_path, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [
      name,
      jumpHost,
      jumpPort || 22,
      jumpUsername,
      proxyPort,
      sshKeyPath,
      status
    ]);
    return this.findById(result.lastID);
  }

  /**
   * 根据ID查找代理服务
   */
  static async findById(id) {
    const sql = 'SELECT * FROM proxy_services WHERE id = ?';
    return await db.get(sql, [id]);
  }

  /**
   * 获取所有代理服务
   */
  static async findAll(options = {}) {
    const { status, page, pageSize, sortBy = 'created_at', sortOrder = 'DESC' } = options;
    let sql = 'SELECT * FROM proxy_services';
    const params = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ` ORDER BY ${sortBy} ${sortOrder}`;

    if (page && pageSize) {
      const offset = (page - 1) * pageSize;
      sql += ' LIMIT ? OFFSET ?';
      params.push(pageSize, offset);
    }

    return await db.all(sql, params);
  }

  /**
   * 统计代理服务数量
   */
  static async count(options = {}) {
    const { status } = options;
    let sql = 'SELECT COUNT(*) as count FROM proxy_services';
    const params = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    const result = await db.get(sql, params);
    return result.count;
  }

  /**
   * 根据代理端口查找
   */
  static async findByProxyPort(proxyPort) {
    const sql = 'SELECT * FROM proxy_services WHERE proxy_port = ?';
    return await db.get(sql, [proxyPort]);
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

    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (jumpHost !== undefined) {
      updates.push('jump_host = ?');
      params.push(jumpHost);
    }
    if (jumpPort !== undefined) {
      updates.push('jump_port = ?');
      params.push(jumpPort);
    }
    if (jumpUsername !== undefined) {
      updates.push('jump_username = ?');
      params.push(jumpUsername);
    }
    if (proxyPort !== undefined) {
      updates.push('proxy_port = ?');
      params.push(proxyPort);
    }
    if (sshKeyPath !== undefined) {
      updates.push('ssh_key_path = ?');
      params.push(sshKeyPath);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (processId !== undefined) {
      updates.push('process_id = ?');
      params.push(processId);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE proxy_services SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(sql, params);
    return this.findById(id);
  }

  /**
   * 删除代理服务
   */
  static async delete(id) {
    const sql = 'DELETE FROM proxy_services WHERE id = ?';
    await db.run(sql, [id]);
  }
}

module.exports = ProxyServiceModel;







