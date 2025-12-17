const db = require('../index');

/**
 * Host配置模型
 */
class HostConfigModel {
  /**
   * 创建Host配置
   */
  static async create(configData) {
    const { name, proxyServiceId, hosts, enabled = 1 } = configData;
    const hostsJson = JSON.stringify(hosts);

    const sql = `
      INSERT INTO host_configs (name, proxy_service_id, hosts, enabled)
      VALUES (?, ?, ?, ?)
    `;
    const result = await db.run(sql, [name, proxyServiceId, hostsJson, enabled ? 1 : 0]);
    return this.findById(result.lastID);
  }

  /**
   * 根据ID查找Host配置
   */
  static async findById(id) {
    const sql = 'SELECT * FROM host_configs WHERE id = ?';
    const row = await db.get(sql, [id]);
    if (row) {
      row.hosts = JSON.parse(row.hosts);
      row.enabled = row.enabled === 1;
    }
    return row;
  }

  /**
   * 获取所有Host配置
   */
  static async findAll(options = {}) {
    const { proxyServiceId, page, pageSize } = options;
    let sql = 'SELECT * FROM host_configs';
    const params = [];

    if (proxyServiceId) {
      sql += ' WHERE proxy_service_id = ?';
      params.push(proxyServiceId);
    }

    sql += ' ORDER BY created_at DESC';

    if (page && pageSize) {
      const offset = (page - 1) * pageSize;
      sql += ' LIMIT ? OFFSET ?';
      params.push(pageSize, offset);
    }

    const rows = await db.all(sql, params);
    return rows.map(row => ({
      ...row,
      hosts: JSON.parse(row.hosts)
    }));
  }

  /**
   * 获取所有Host配置（包含代理服务信息）
   */
  static async findAllWithProxyService(options = {}) {
    const { proxyServiceId, enabled } = options;
    let sql = `
      SELECT 
        hc.*,
        ps.name as proxy_service_name,
        ps.status as proxy_service_status,
        ps.proxy_port as proxy_service_port
      FROM host_configs hc
      LEFT JOIN proxy_services ps ON hc.proxy_service_id = ps.id
    `;
    const params = [];
    const conditions = [];

    if (proxyServiceId) {
      conditions.push('hc.proxy_service_id = ?');
      params.push(proxyServiceId);
    }
    
    if (enabled !== undefined) {
      conditions.push('hc.enabled = ?');
      params.push(enabled ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY hc.created_at DESC';

    const rows = await db.all(sql, params);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      proxyServiceId: row.proxy_service_id,
      hosts: JSON.parse(row.hosts),
      enabled: row.enabled === 1,
      proxyServiceName: row.proxy_service_name,
      proxyServiceStatus: row.proxy_service_status,
      proxyServicePort: row.proxy_service_port,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * 更新Host配置
   */
  static async update(id, configData) {
    const { name, proxyServiceId, hosts, enabled } = configData;
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (proxyServiceId !== undefined) {
      updates.push('proxy_service_id = ?');
      params.push(proxyServiceId);
    }
    if (hosts !== undefined) {
      updates.push('hosts = ?');
      params.push(JSON.stringify(hosts));
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE host_configs SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(sql, params);
    return this.findById(id);
  }

  /**
   * 删除Host配置
   */
  static async delete(id) {
    const sql = 'DELETE FROM host_configs WHERE id = ?';
    await db.run(sql, [id]);
  }

  /**
   * 获取所有Host列表（用于冲突检测）
   */
  static async getAllHosts(excludeId = null) {
    let sql = 'SELECT id, hosts FROM host_configs';
    const params = [];

    if (excludeId) {
      sql += ' WHERE id != ?';
      params.push(excludeId);
    }

    const rows = await db.all(sql, params);
    const allHosts = [];
    rows.forEach(row => {
      const hosts = JSON.parse(row.hosts);
      hosts.forEach(host => {
        allHosts.push({ configId: row.id, host });
      });
    });
    return allHosts;
  }
}

module.exports = HostConfigModel;


