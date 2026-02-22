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
 * 获取数据库版本（JSON 存储版本）
 */
async function getDatabaseVersion(jsonStoreInstance) {
  // JSON 存储版本固定为 2.0
  return '2.0';
}

/**
 * 获取完整版本信息（包括数据库版本）
 */
async function getFullVersionInfo(jsonStoreInstance) {
  const versionInfo = getVersionInfo();
  let databaseVersion = null;

  try {
    databaseVersion = await getDatabaseVersion(jsonStoreInstance);
  } catch (error) {
    console.warn('Failed to get database version:', error.message);
  }

  return {
    ...versionInfo,
    databaseVersion,
    storageType: 'JSON'
  };
}

module.exports = {
  getVersionInfo,
  getDatabaseVersion,
  getFullVersionInfo
};

