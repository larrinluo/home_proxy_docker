const fs = require('fs');
const path = require('path');

/**
 * 获取应用版本信息
 */
function getVersionInfo() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  let version = '1.0.0';
  let name = 'socks-proxy-backend';

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    version = packageJson.version || version;
    name = packageJson.name || name;
  } catch (error) {
    console.warn('Failed to read package.json:', error.message);
  }

  // 从环境变量获取构建信息
  const buildDate = process.env.BUILD_DATE || 'unknown';
  const gitCommit = process.env.GIT_COMMIT || 'unknown';
  const appVersion = process.env.APP_VERSION || version;

  return {
    name,
    version: appVersion,
    buildDate,
    gitCommit,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'production'
  };
}

/**
 * 获取数据库版本
 */
async function getDatabaseVersion(dbInstance) {
  try {
    const row = await dbInstance.get(
      'SELECT MAX(version) as version FROM schema_migrations'
    );
    return row?.version || null;
  } catch (error) {
    // 如果表不存在，返回null
    if (error.message && error.message.includes('no such table')) {
      return null;
    }
    throw error;
  }
}

/**
 * 获取完整版本信息（包括数据库版本）
 */
async function getFullVersionInfo(db) {
  const versionInfo = getVersionInfo();
  let databaseVersion = null;

  try {
    databaseVersion = await getDatabaseVersion(db);
  } catch (error) {
    console.warn('Failed to get database version:', error.message);
  }

  return {
    ...versionInfo,
    databaseVersion
  };
}

module.exports = {
  getVersionInfo,
  getDatabaseVersion,
  getFullVersionInfo
};

