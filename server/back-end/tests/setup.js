// 测试环境全局设置
const { initDatabase } = require('../scripts/init-db');
const db = require('../db/index');
const proxyStatusMonitor = require('../services/proxy-status-monitor');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DB_PATH = './data/test-database.db';

beforeAll(async () => {
  // 初始化测试数据库
  await initDatabase();
});

afterAll(async () => {
  // 停止监控器
  proxyStatusMonitor.stop();
  
  // 关闭数据库连接
  await db.close();
  
  // 等待异步操作完成
  await new Promise(resolve => setTimeout(resolve, 100));
});

beforeEach(async () => {
  // 每个测试前清理数据
  await db.run('DELETE FROM host_configs');
  await db.run('DELETE FROM proxy_services');
  await db.run('DELETE FROM users');
  await db.run("DELETE FROM system_configs WHERE key != 'register_enabled'");
});

