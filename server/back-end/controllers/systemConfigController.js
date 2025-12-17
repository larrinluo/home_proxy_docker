const SystemConfigModel = require('../db/models/system-configs');
const { getServiceHost, getServiceURL } = require('../utils/get-service-host');

/**
 * 获取当前服务地址（动态获取）
 */
async function getServiceAddress(req, res) {
  try {
    const host = getServiceHost(req);
    const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'http';
    const port = req.get('X-Forwarded-Port') || (req.socket && req.socket.localPort) || (protocol === 'https' ? 443 : 80);
    
    // 构建完整的服务URL
    let serviceURL;
    if ((protocol === 'http' && port === 80) || (protocol === 'https' && port === 443)) {
      serviceURL = `${protocol}://${host}`;
    } else {
      serviceURL = `${protocol}://${host}:${port}`;
    }
    
    // PAC文件URL
    const pacURL = `${serviceURL}/proxy.pac`;
    
    res.json({
      success: true,
      data: {
        host,
        port: port.toString(),
        protocol,
        serviceURL,
        pacURL
      }
    });
  } catch (error) {
    console.error('Get service address error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取服务地址失败'
      }
    });
  }
}

/**
 * 获取系统配置列表
 */
async function list(req, res) {
  try {
    const configs = await SystemConfigModel.findAll();
    
    // 对于pac_service_host，如果为空或默认值，返回动态获取的值
    const pacHostConfig = configs.find(c => c.key === 'pac_service_host');
    const pacPortConfig = configs.find(c => c.key === 'pac_service_port');
    
    const items = configs.map(config => {
      let value = config.value === 'true' ? true : config.value === 'false' ? false : config.value;
      
      // 如果pac_service_host为空或默认值，使用动态获取的值
      if (config.key === 'pac_service_host' && (!value || value === '192.168.1.4')) {
        value = getServiceHost(req);
      }
      
      // 如果pac_service_port为空，使用请求端口
      if (config.key === 'pac_service_port' && !value) {
        const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'http';
        value = req.get('X-Forwarded-Port') || (req.socket && req.socket.localPort) || (protocol === 'https' ? 443 : 80);
        value = value.toString();
      }
      
      return {
        key: config.key,
        value,
        description: config.description
      };
    });

    res.json({
      success: true,
      data: { items }
    });
  } catch (error) {
    console.error('List system configs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取系统配置失败'
      }
    });
  }
}

/**
 * 获取单个系统配置
 */
async function getByKey(req, res) {
  try {
    const { key } = req.params;
    const config = await SystemConfigModel.findByKey(key);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: '配置不存在'
        }
      });
    }

    res.json({
      success: true,
      data: {
        key: config.key,
        value: config.value === 'true' ? true : config.value === 'false' ? false : config.value,
        description: config.description
      }
    });
  } catch (error) {
    console.error('Get system config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取系统配置失败'
      }
    });
  }
}

/**
 * 更新系统配置
 */
async function update(req, res) {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '配置值不能为空'
        }
      });
    }

    // 转换值为字符串
    const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);

    const config = await SystemConfigModel.update(key, stringValue);

    res.json({
      success: true,
      data: {
        key: config.key,
        value: config.value === 'true' ? true : config.value === 'false' ? false : config.value,
        description: config.description
      },
      message: '更新成功'
    });
  } catch (error) {
    console.error('Update system config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新系统配置失败'
      }
    });
  }
}

module.exports = {
  list,
  getByKey,
  update,
  getServiceAddress
};


