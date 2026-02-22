const jsonStore = require('../json-store');

/**
 * 系统配置模型
 */
class SystemConfigModel {
  /**
   * 创建或更新系统配置（UPSERT）
   */
  static async upsert(configData) {
    const { key, value, description } = configData;

    // 查找是否已存在
    const existing = await this.findByKey(key);

    if (existing) {
      // 更新
      const updateData = {
        value,
        updated_at: new Date().toISOString()
      };

      if (description !== undefined) {
        updateData.description = description;
      }

      return await jsonStore.update('system_configs', existing.id, updateData);
    } else {
      // 插入
      return await jsonStore.insert('system_configs', {
        key,
        value,
        description: description || null
      });
    }
  }

  /**
   * 根据key查找配置
   */
  static async findByKey(key) {
    const configs = await jsonStore.findAll('system_configs', {
      where: { key }
    });
    return configs.length > 0 ? configs[0] : null;
  }

  /**
   * 获取所有系统配置
   */
  static async findAll() {
    return await jsonStore.findAll('system_configs', {
      orderBy: 'key',
      order: 'ASC'
    });
  }

  /**
   * 更新配置值
   */
  static async update(key, value) {
    const config = await this.findByKey(key);

    if (!config) {
      throw new Error(`Config not found: ${key}`);
    }

    const result = await jsonStore.update('system_configs', config.id, {
      value
    });

    return result;
  }

  /**
   * 删除配置
   */
  static async delete(key) {
    const config = await this.findByKey(key);

    if (!config) {
      return;
    }

    return await jsonStore.delete('system_configs', config.id);
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
