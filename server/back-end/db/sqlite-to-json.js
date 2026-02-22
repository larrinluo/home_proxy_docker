#!/usr/bin/env node

/**
 * SQLite 到 JSON 数据迁移脚本
 * 用法: node sqlite-to-json.js
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

// 数据库路径
const DB_PATH = process.env.DB_PATH || '/data/database/database.db';
const DB_DIR = path.dirname(DB_PATH);

// 表定义
const TABLES = {
  users: 'users.json',
  proxy_services: 'proxy_services.json',
  host_configs: 'host_configs.json',
  system_configs: 'system_configs.json'
};

/**
 * 打开数据库连接
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log(`✓ Database opened: ${DB_PATH}`);
      resolve(db);
    });
  });
}

/**
 * 查询表所有数据
 */
function queryTable(db, tableName) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM ${tableName}`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

/**
 * 写入 JSON 文件
 */
async function writeJsonFile(filename, data) {
  const filePath = path.join(DB_DIR, filename);
  const tmpPath = filePath + '.tmp';

  // 确保目录存在
  await fs.mkdir(DB_DIR, { recursive: true });

  // 写入临时文件
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');

  // 原子重命名
  await fs.rename(tmpPath, filePath);

  console.log(`  ✓ Written ${data.length} records to ${filename}`);
}

/**
 * 迁移单个表
 */
async function migrateTable(db, tableName, filename) {
  try {
    console.log(`\nMigrating table: ${tableName}`);

    // 查询数据
    const rows = await queryTable(db, tableName);
    console.log(`  - Found ${rows.length} records`);

    // 写入 JSON 文件
    await writeJsonFile(filename, rows);

    return { table: tableName, count: rows.length, success: true };
  } catch (error) {
    console.error(`  ✗ Error migrating ${tableName}:`, error.message);
    return { table: tableName, count: 0, success: false, error: error.message };
  }
}

/**
 * 主迁移函数
 */
async function migrate() {
  console.log('='.repeat(60));
  console.log('SQLite → JSON Migration');
  console.log('='.repeat(60));
  console.log(`Database: ${DB_PATH}`);
  console.log(`Output Directory: ${DB_DIR}`);

  let db;
  try {
    // 打开数据库
    db = await openDatabase();

    // 迁移所有表
    const results = [];
    for (const [tableName, filename] of Object.entries(TABLES)) {
      const result = await migrateTable(db, tableName, filename);
      results.push(result);
    }

    // 关闭数据库
    await new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // 显示结果
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + (r.success ? r.count : 0), 0);

    results.forEach(result => {
      const status = result.success ? '✓' : '✗';
      const count = result.success ? `${result.count} records` : 'FAILED';
      console.log(`  ${status} ${result.table}: ${count}`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });

    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${successCount}/${Object.keys(TABLES).length} tables migrated`);
    console.log(`Total Records: ${totalRecords}`);
    console.log(`Failed: ${failCount}`);

    if (failCount === 0) {
      console.log('\n✓ Migration completed successfully!');
      console.log('\nNext steps:');
      console.log('  1. Verify the JSON files in:', DB_DIR);
      console.log('  2. Update your code to use json-store.js');
      console.log('  3. Restart the application');
    } else {
      console.log('\n✗ Migration completed with errors!');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    if (db) {
      db.close();
    }
    process.exit(1);
  }
}

// 执行迁移
migrate();
