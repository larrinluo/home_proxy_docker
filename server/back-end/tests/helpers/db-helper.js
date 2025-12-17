const db = require('../../db/index');

/**
 * 初始化测试数据库
 */
async function initTestDB() {
  // 数据库已在setup.js中初始化
  return true;
}

/**
 * 清理测试数据库
 */
async function cleanupTestDB() {
  // 清理所有表数据
  await db.run('DELETE FROM host_configs');
  await db.run('DELETE FROM proxy_services');
  await db.run('DELETE FROM users');
  await db.run('DELETE FROM system_configs WHERE key != "register_enabled"');
}

/**
 * 重置测试数据库
 */
async function resetTestDB() {
  await cleanupTestDB();
  // 重新初始化系统配置
  await db.run(`
    INSERT OR IGNORE INTO system_configs (key, value, description) 
    VALUES ('register_enabled', 'true', '允许注册用户')
  `);
}

module.exports = {
  initTestDB,
  cleanupTestDB,
  resetTestDB
};

