const os = require('os');

/**
 * 获取代理配置服务地址（仅host部分，不包含端口）
 * 优先级：
 * 1. 从nginx请求头获取（X-Forwarded-Host 或 Host）
 * 2. 使用本机IP地址
 * 
 * @param {Object} req - Express请求对象
 * @returns {string} 服务地址（仅host，如：192.168.1.4）
 */
function getServiceHost(req) {
  // 1. 尝试从nginx请求头获取Host
  // nginx通常会设置 X-Forwarded-Host 或 Host 头
  const forwardedHost = req.get('X-Forwarded-Host') || req.get('Host');
  
  if (forwardedHost) {
    // 提取host部分（去掉端口）
    const host = forwardedHost.split(':')[0];
    return host;
  }
  
  // 2. 如果没有通过nginx，使用本机IP地址
  return getLocalIP();
}

/**
 * 获取本机IP地址（排除回环地址）
 * @returns {string} IP地址
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // 优先查找非回环的IPv4地址
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部（回环）地址和非IPv4地址
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  // 如果找不到，返回localhost
  return '127.0.0.1';
}

/**
 * 获取完整的服务URL（包含协议）
 * @param {Object} req - Express请求对象
 * @returns {string} 完整的服务URL（如：http://192.168.1.4:8090）
 */
function getServiceURL(req) {
  const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'http';
  const host = getServiceHost(req);
  
  // 如果host已经包含端口，直接拼接协议
  if (host.includes(':')) {
    return `${protocol}://${host}`;
  }
  
  // 否则需要添加端口
  const port = req.get('X-Forwarded-Port') || (req.socket && req.socket.localPort) || (protocol === 'https' ? 443 : 80);
  if ((protocol === 'http' && port === 80) || (protocol === 'https' && port === 443)) {
    return `${protocol}://${host}`;
  }
  return `${protocol}://${host}:${port}`;
}

module.exports = {
  getServiceHost,
  getLocalIP,
  getServiceURL
};

