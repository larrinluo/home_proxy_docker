const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || '/data/database/database.db';
const SCHEMA_PATH = path.join(__dirname, '../db/schema.sql');

/**
 * 初始化数据库
 */
async function initDatabase() {
  return new Promise((resolve, reject) => {
    // 确保数据库目录存在
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }

    // 打开数据库连接
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log(`Connected to database: ${DB_PATH}`);
    });

    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.error('Error enabling foreign keys:', err);
        reject(err);
        return;
      }
    });

    // 读取schema文件
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

    // 执行schema
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error executing schema:', err);
        db.close();
        reject(err);
        return;
      }
      console.log('Database schema initialized successfully');
      db.close();
      resolve();
    });
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database initialization completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };








