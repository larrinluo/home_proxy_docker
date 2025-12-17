const db = require('../index');

/**
 * 系统配置模型
 */
class SystemConfigModel {
  /**
   * 创建或更新系统配置
   */
  static async upsert(configData) {
    const { key, value, description } = configData;
    const sql = `
      INSERT INTO system_configs (key, value, description)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `;
    await db.run(sql, [key, value, description || null]);
    return this.findByKey(key);
  }

  /**
   * 根据key查找配置
   */
  static async findByKey(key) {
    const sql = 'SELECT * FROM system_configs WHERE key = ?';
    return await db.get(sql, [key]);
  }

  /**
   * 获取所有系统配置
   */
  static async findAll() {
    const sql = 'SELECT * FROM system_configs ORDER BY key';
    return await db.all(sql);
  }

  /**
   * 更新配置值
   */
  static async update(key, value) {
    const sql = `
      UPDATE system_configs 
      SET value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE key = ?
    `;
    await db.run(sql, [value, key]);
    return this.findByKey(key);
  }

  /**
   * 删除配置
   */
  static async delete(key) {
    const sql = 'DELETE FROM system_configs WHERE key = ?';
    await db.run(sql, [key]);
  }

  /**
   * 获取布尔值配置
   */
  static async getBoolean(key, defaultValue = false) {
    const config = await this.findByKey(key);
    if (!config) {
      return defaultValue;
    }
    return config.value === 'true' || config.value === '1';
  }

  /**
   * 设置布尔值配置
   */
  static async setBoolean(key, value) {
    return await this.update(key, value ? 'true' : 'false');
  }
}

module.exports = SystemConfigModel;







