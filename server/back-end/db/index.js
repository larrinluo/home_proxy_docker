const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 本地开发环境使用相对路径，生产环境使用绝对路径
const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'development' 
  ? './data/database/database.db' 
  : '/data/database/database.db');

/**
 * 数据库连接类
 */
class Database {
  constructor() {
    this.db = null;
  }

  /**
   * 打开数据库连接
   */
  open() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        // 启用外键约束
        this.db.run('PRAGMA foreign_keys = ON');
        resolve();
      });
    });
  }

  /**
   * 关闭数据库连接
   */
  close() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      this.db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        this.db = null;
        resolve();
      });
    });
  }

  /**
   * 执行查询（返回多行）
   */
  async all(sql, params = []) {
    // 确保数据库连接已打开
    if (!this.db && this.ensureOpen) {
      await this.ensureOpen();
    }
    if (!this.db) {
      throw new Error('Database connection is not open');
    }
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  /**
   * 执行查询（返回单行）
   */
  async get(sql, params = []) {
    // 确保数据库连接已打开
    if (!this.db && this.ensureOpen) {
      await this.ensureOpen();
    }
    if (!this.db) {
      throw new Error('Database connection is not open');
    }
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * 执行更新（INSERT/UPDATE/DELETE）
   */
  async run(sql, params = []) {
    // 确保数据库连接已打开
    if (!this.db && this.ensureOpen) {
      await this.ensureOpen();
    }
    if (!this.db) {
      throw new Error('Database connection is not open');
    }
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      });
    });
  }

  /**
   * 执行事务
   */
  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }
}

// 创建单例实例
const db = new Database();

// 延迟初始化数据库连接（避免在模块加载时立即打开，等待环境变量设置完成）
// 数据库连接将在server.js的startServer()函数中通过initDatabase()确保打开
// 这里不立即打开，避免在环境变量未设置时失败
let dbOpenAttempted = false;

// 提供一个手动打开数据库的方法
db.ensureOpen = async function() {
  if (!this.db && !dbOpenAttempted) {
    dbOpenAttempted = true;
    try {
      await this.open();
      console.log(`Database connected: ${DB_PATH}`);
    } catch (err) {
      console.error('Failed to open database:', err);
      console.error('DB_PATH:', DB_PATH);
      throw err;
    }
  }
  return this;
};

module.exports = db;
