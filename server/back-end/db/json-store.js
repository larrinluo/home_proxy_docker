const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// 本地开发环境使用相对路径，生产环境使用绝对路径
const DB_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : (process.env.NODE_ENV === 'development'
    ? './data/database'
    : '/data/database');

// 数据表定义
const TABLES = {
  users: 'users.json',
  proxy_services: 'proxy_services.json',
  host_configs: 'host_configs.json',
  system_configs: 'system_configs.json'
};

// 字段映射（数据库字段名 -> JSON 字段名）
const FIELD_MAPPING = {
  // proxy_services - 移除映射以保持前端兼容性
  // jump_host: 'jumpHost',
  // jump_port: 'jumpPort',
  // jump_username: 'jumpUsername',
  // proxy_port: 'proxyPort',
  // ssh_key_path: 'sshKeyPath',
  // process_id: 'processId',
  // created_at: 'createdAt',
  // updated_at: 'updatedAt',

  // host_configs - 移除映射以保持前端兼容性
  // proxy_service_id: 'proxyServiceId',

  // password_hash - 保留映射，后端使用camelCase
  password_hash: 'passwordHash'
};

/**
 * JSON 存储引擎
 */
class JsonStore {
  constructor() {
    this.cache = new Map(); // 内存缓存
    this.locks = new Map(); // 文件锁
  }

  /**
   * 获取表文件路径
   */
  getTablePath(table) {
    const filename = TABLES[table];
    if (!filename) {
      throw new Error(`Unknown table: ${table}`);
    }
    return path.join(DB_DIR, filename);
  }

  /**
   * 转换字段名（数据库格式 -> JSON 格式）
   */
  toCamelCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.toCamelCase(item));

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = FIELD_MAPPING[key] || key;
      // 处理嵌套对象
      result[newKey] = typeof value === 'object' && value !== null && !Array.isArray(value)
        ? this.toCamelCase(value)
        : value;
    }
    return result;
  }

  /**
   * 转换字段名（JSON 格式 -> 数据库格式）
   */
  toSnakeCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.toSnakeCase(item));

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      // 反向查找映射
      const snakeKey = Object.keys(FIELD_MAPPING).find(
        k => FIELD_MAPPING[k] === key
      ) || key;
      result[snakeKey] = value;
    }
    return result;
  }

  /**
   * 读取表数据（带缓存）
   */
  async readTable(table) {
    const filePath = this.getTablePath(table);

    // 检查缓存
    if (this.cache.has(table)) {
      return [...this.cache.get(table)];
    }

    // 读取文件
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const rows = JSON.parse(data);

      // 更新缓存
      this.cache.set(table, rows);

      return rows;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，返回空数组
        return [];
      }
      throw error;
    }
  }

  /**
   * 写入表数据（原子写入 + 清除缓存）
   * 注意：在某些 Docker 环境中，fs.rename() 可能失败
   * 这里使用直接写入 + fsync 来确保数据完整性
   */
  async writeTable(table, rows) {
    const filePath = this.getTablePath(table);
    const backupPath = path.join(DB_DIR, '.backup', path.basename(filePath));

    try {
      // 确保目录存在
      await fs.mkdir(DB_DIR, { recursive: true });
      await fs.mkdir(path.dirname(backupPath), { recursive: true });

      // 备份旧数据
      try {
        await fs.copyFile(filePath, backupPath);
      } catch (err) {
        // 文件不存在，忽略
      }

      // 直接写入文件（不使用临时文件 + rename）
      // 这在某些文件系统上更可靠
      const data = JSON.stringify(rows, null, 2);
      const fd = await fs.open(filePath, 'w', 0o644);
      try {
        await fd.write(data, 0, 'utf8');
        await fd.sync(); // 确保数据写入磁盘
      } finally {
        await fd.close();
      }

      // 清除缓存（确保下次读取时从文件加载最新数据）
      this.cache.delete(table);

      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 生成新 ID
   */
  generateId(rows) {
    if (rows.length === 0) return 1;
    return Math.max(...rows.map(r => r.id)) + 1;
  }

  /**
   * 查找所有记录
   */
  async findAll(table, options = {}) {
    let rows = await this.readTable(table);

    // 条件过滤
    if (options.where) {
      rows = rows.filter(row => {
        for (const [key, value] of Object.entries(options.where)) {
          if (row[key] !== value) return false;
        }
        return true;
      });
    }

    // 排序
    if (options.orderBy) {
      const field = options.orderBy;
      const direction = options.order === 'ASC' ? 1 : -1;
      rows.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
    }

    // 分页
    if (options.limit) {
      const offset = options.offset || 0;
      rows = rows.slice(offset, offset + options.limit);
    }

    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * 查找单条记录
   */
  async findOne(table, options = {}) {
    const rows = await this.findAll(table, options);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 根据 ID 查找
   */
  async findById(table, id) {
    const rows = await this.readTable(table);
    // 将ID转换为数字进行比较（兼容字符串ID，如从URL参数获取的"1"）
    const numericId = parseInt(id, 10);
    const row = rows.find(r => r.id === numericId);
    return row ? this.toCamelCase(row) : null;
  }

  /**
   * 插入记录
   */
  async insert(table, data) {
    const rows = await this.readTable(table);

    // 转换字段名
    const insertData = this.toSnakeCase(data);

    // 生成 ID
    const id = this.generateId(rows);

    // 添加时间戳
    const now = new Date().toISOString();
    const newRow = {
      id,
      ...insertData,
      created_at: now,
      updated_at: now
    };

    rows.push(newRow);
    await this.writeTable(table, rows);

    return this.toCamelCase(newRow);
  }

  /**
   * 更新记录
   */
  async update(table, id, data) {
    const rows = await this.readTable(table);
    // 将ID转换为数字进行比较（兼容字符串ID）
    const numericId = parseInt(id, 10);
    const index = rows.findIndex(r => r.id === numericId);

    if (index === -1) {
      throw new Error(`Record not found: ${table}.id=${id}`);
    }

    // 转换字段名
    const updateData = this.toSnakeCase(data);

    // 更新字段
    const updatedRow = {
      ...rows[index],
      ...updateData,
      id: numericId, // 确保 ID 不被修改
      updated_at: new Date().toISOString()
    };

    rows[index] = updatedRow;
    await this.writeTable(table, rows);

    return this.toCamelCase(updatedRow);
  }

  /**
   * 删除记录
   */
  async delete(table, id) {
    const rows = await this.readTable(table);
    // 将ID转换为数字进行比较（兼容字符串ID）
    const numericId = parseInt(id, 10);
    const index = rows.findIndex(r => r.id === numericId);

    if (index === -1) {
      throw new Error(`Record not found: ${table}.id=${id}`);
    }

    rows.splice(index, 1);
    await this.writeTable(table, rows);

    return true;
  }

  /**
   * 统计记录数
   */
  async count(table, options = {}) {
    const rows = await this.findAll(table, options);
    return rows.length;
  }

  /**
   * 执行事务
   */
  async transaction(callback) {
    // 创建备份
    const backups = new Map();

    try {
      // 备份所有表
      for (const table of Object.keys(TABLES)) {
        const rows = await this.readTable(table);
        backups.set(table, [...rows]);
      }

      // 执行回调
      const result = await callback(this);

      return result;
    } catch (error) {
      // 回滚：恢复所有备份
      for (const [table, rows] of backups.entries()) {
        await this.writeTable(table, rows);
      }

      throw error;
    }
  }

  /**
   * 清空缓存
   */
  clearCache(table = null) {
    if (table) {
      this.cache.delete(table);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 初始化系统配置数据（默认配置）
   */
  async initializeSystemConfigs() {
    const table = 'system_configs';
    const rows = await this.readTable(table);

    // 如果已有数据，跳过初始化
    if (rows.length > 0) {
      console.log(`[JsonStore] System configs already initialized (${rows.length} records)`);
      return;
    }

    console.log(`[JsonStore] Initializing default system configs...`);

    // 默认系统配置
    const defaultConfigs = [
      {
        key: 'register_enabled',
        value: 'true',
        description: '允许注册用户'
      },
      {
        key: 'pac_service_host',
        value: '192.168.1.4',
        description: '代理配置服务地址'
      },
      {
        key: 'pac_service_port',
        value: '8090',
        description: '代理配置服务端口'
      }
    ];

    // 插入默认配置
    for (const config of defaultConfigs) {
      const id = this.generateId(rows);
      const now = new Date().toISOString();
      rows.push({
        id,
        ...config,
        updated_at: now
      });
    }

    await this.writeTable(table, rows);
    console.log(`[JsonStore] ✓ Initialized ${defaultConfigs.length} default system configs`);
  }

  /**
   * 初始化数据库（确保所有表文件存在）
   */
  async initialize() {
    console.log(`[JsonStore] Initializing JSON database at: ${DB_DIR}`);

    for (const [table, filename] of Object.entries(TABLES)) {
      const filePath = path.join(DB_DIR, filename);

      try {
        await fs.access(filePath);
        console.log(`[JsonStore] ✓ Table exists: ${table}`);
      } catch (err) {
        // 文件不存在，创建空表
        await fs.mkdir(DB_DIR, { recursive: true });
        await fs.writeFile(filePath, '[]', 'utf8');
        console.log(`[JsonStore] ✓ Table created: ${table}`);
      }
    }

    // 初始化系统配置数据
    await this.initializeSystemConfigs();

    console.log(`[JsonStore] Initialization complete`);
  }
}

// 创建单例实例
const jsonStore = new JsonStore();

module.exports = jsonStore;
