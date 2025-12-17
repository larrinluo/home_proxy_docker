const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './data/database.db';

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
  all(sql, params = []) {
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
  get(sql, params = []) {
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
  run(sql, params = []) {
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

// 初始化数据库连接
db.open().catch((err) => {
  console.error('Failed to open database:', err);
  process.exit(1);
});

module.exports = db;
