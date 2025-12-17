const pacGenerator = require('../services/pac-generator');
const SystemConfigModel = require('../db/models/system-configs');
const { getServiceHost } = require('../utils/get-service-host');
const https = require('https');
const http = require('http');

/**
 * 获取代理服务地址（从系统配置或动态获取）
 */
async function getProxyHost(req) {
  try {
    // 1. 优先从系统配置获取
    const pacHostConfig = await SystemConfigModel.findByKey('pac_service_host');
    if (pacHostConfig && pacHostConfig.value && pacHostConfig.value !== '192.168.1.4') {
      return pacHostConfig.value;
    }
    
    // 2. 如果未配置或为默认值，动态获取
    return getServiceHost(req);
  } catch (error) {
    console.error('Get proxy host error:', error);
    // 3. 如果出错，使用环境变量或默认值
    return process.env.PROXY_HOST || '127.0.0.1';
  }
}

/**
 * 获取PAC配置JSON
 */
async function getConfig(req, res) {
  try {
    const proxyHost = await getProxyHost(req);
    const config = await pacGenerator.generatePACConfig(proxyHost);
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Get PAC config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取PAC配置失败'
      }
    });
  }
}

/**
 * 获取PAC文件
 */
async function getPACFile(req, res) {
  try {
    const proxyHost = await getProxyHost(req);
    const pacContent = await pacGenerator.generatePACFile(proxyHost);
    // 正常PAC文件请求，使用标准MIME类型
    res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
    res.send(pacContent);
  } catch (error) {
    console.error('Get PAC file error:', error);
    res.status(500).send('Error generating PAC file');
  }
}

/**
 * 预览PAC文件内容（在浏览器中直接显示）
 */
async function previewPACFile(req, res) {
  try {
    const proxyHost = await getProxyHost(req);
    const pacContent = await pacGenerator.generatePACFile(proxyHost);
    
    // 直接返回纯文本，让浏览器以最简单的方式显示
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.send(pacContent);
  } catch (error) {
    console.error('Preview PAC file error:', error);
    res.status(500).send('Error generating PAC file preview');
  }
}

/**
 * 从PAC文件中提取host列表
 */
async function extractHostsFromPAC(req, res) {
  try {
    const { pacUrl } = req.query;
    
    if (!pacUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'pacUrl参数是必填项'
        }
      });
    }

    // 获取PAC文件内容
    const pacContent = await fetchPACFile(pacUrl);
    
    // 解析PAC文件，提取host列表
    const hosts = parseHostsFromPAC(pacContent);
    
    res.json({
      success: true,
      data: {
        hosts
      }
    });
  } catch (error) {
    console.error('Extract hosts from PAC error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '解析PAC文件失败: ' + error.message
      }
    });
  }
}

/**
 * 获取PAC文件内容
 */
function fetchPACFile(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? require('https') : require('http');
    
    client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 从PAC文件内容中解析host列表
 */
function parseHostsFromPAC(pacContent) {
  const hosts = [];
  
  // 查找 proxyDomains 数组
  const arrayMatch = pacContent.match(/var\s+proxyDomains\s*=\s*\[([\s\S]*?)\];/);
  
  if (arrayMatch) {
    // 提取数组内容
    const arrayContent = arrayMatch[1];
    
    // 匹配所有字符串字面量（支持单引号和双引号）
    const stringMatches = arrayContent.matchAll(/"([^"]+)"|'([^']+)'/g);
    
    for (const match of stringMatches) {
      const host = match[1] || match[2]; // 匹配单引号或双引号的内容
      if (host && host.trim()) {
        hosts.push(host.trim());
      }
    }
  }
  
  return hosts;
}

module.exports = {
  getConfig,
  getPACFile,
  previewPACFile,
  extractHostsFromPAC
};


