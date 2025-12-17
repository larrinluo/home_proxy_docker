const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const HostConfigModel = require('../db/models/host-configs');
const ProxyServiceModel = require('../db/models/proxy-services');
const hostConflictChecker = require('../services/host-conflict-checker');
const pacGenerator = require('../services/pac-generator');
const SystemConfigModel = require('../db/models/system-configs');
const { getServiceHost } = require('../utils/get-service-host');

/**
 * 创建Host配置
 */
async function create(req, res) {
  try {
    const { name, proxyServiceId, hosts } = req.body;

    // 验证参数
    if (!name || !proxyServiceId || !hosts || !Array.isArray(hosts)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败：name、proxyServiceId和hosts是必填项（hosts可以为空数组）'
        }
      });
    }

    // 验证代理服务是否存在
    // 确保 proxyServiceId 是数字类型
    const serviceId = parseInt(proxyServiceId, 10);
    if (isNaN(serviceId)) {
      console.error('[HostConfigController] Invalid proxyServiceId:', proxyServiceId);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PROXY_SERVICE_ID',
          message: '代理服务ID格式无效'
        }
      });
    }
    
    console.log('[HostConfigController] Looking for proxy service with ID:', serviceId);
    const proxyService = await ProxyServiceModel.findById(serviceId);
    console.log('[HostConfigController] Proxy service found:', proxyService ? 'Yes' : 'No');
    
    if (!proxyService) {
      console.error('[HostConfigController] Proxy service not found for ID:', serviceId);
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROXY_SERVICE_NOT_FOUND',
          message: `代理服务不存在 (ID: ${serviceId})`
        }
      });
    }

    // 检查Host冲突（只有当hosts不为空时才检查）
    if (hosts.length > 0) {
      const conflictResult = await hostConflictChecker.checkConflictWithDetails(hosts);
      if (conflictResult.hasConflict) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'HOST_CONFLICT',
            message: 'Host配置冲突',
            details: conflictResult.conflicts
          }
        });
      }
    }

    // 创建Host配置（使用转换后的 serviceId）
    const config = await HostConfigModel.create({
      name,
      proxyServiceId: serviceId,
      hosts
    });

    // 清除PAC缓存
    pacGenerator.clearCache();

    res.status(201).json({
      success: true,
      data: {
        id: config.id,
        name: config.name,
        proxyServiceId: config.proxy_service_id,
        hosts: config.hosts
      },
      message: '创建成功'
    });
  } catch (error) {
    console.error('Create host config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '创建Host配置失败'
      }
    });
  }
}

/**
 * 获取Host配置列表
 */
async function list(req, res) {
  try {
    const { proxyServiceId, page, pageSize } = req.query;
    const options = {};

    if (proxyServiceId) {
      options.proxyServiceId = parseInt(proxyServiceId);
    }
    if (page) {
      options.page = parseInt(page);
    }
    if (pageSize) {
      options.pageSize = parseInt(pageSize);
    }

    const configs = await HostConfigModel.findAllWithProxyService(options);
    
    // 转换enabled字段为布尔值
    const formattedConfigs = configs.map(config => ({
      ...config,
      enabled: config.enabled === 1 || config.enabled === true
    }));

    res.json({
      success: true,
      data: {
        items: formattedConfigs,
        total: formattedConfigs.length
      }
    });
  } catch (error) {
    console.error('List host configs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取Host配置列表失败'
      }
    });
  }
}

/**
 * 获取Host配置详情
 */
async function getById(req, res) {
  try {
    const { id } = req.params;
    const config = await HostConfigModel.findById(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'Host配置不存在'
        }
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Get host config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取Host配置失败'
      }
    });
  }
}

/**
 * 更新Host配置
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, proxyServiceId, hosts } = req.body;

    // 检查配置是否存在
    const existingConfig = await HostConfigModel.findById(id);
    if (!existingConfig) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'Host配置不存在'
        }
      });
    }

    // 如果更新了hosts，检查冲突（只有当hosts不为空时才检查）
    if (hosts && Array.isArray(hosts) && hosts.length > 0) {
      const conflictResult = await hostConflictChecker.checkConflictWithDetails(hosts, id);
      if (conflictResult.hasConflict) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'HOST_CONFLICT',
            message: 'Host配置冲突',
            details: conflictResult.conflicts
          }
        });
      }
    }

    // 如果更新了proxyServiceId，验证代理服务是否存在
    if (proxyServiceId) {
      const proxyService = await ProxyServiceModel.findById(proxyServiceId);
      if (!proxyService) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PROXY_SERVICE_NOT_FOUND',
            message: '代理服务不存在'
          }
        });
      }
    }

    // 更新配置
    const config = await HostConfigModel.update(id, {
      name,
      proxyServiceId,
      hosts
    });

    // 清除PAC缓存
    pacGenerator.clearCache();

    res.json({
      success: true,
      data: {
        id: config.id,
        name: config.name,
        proxyServiceId: config.proxy_service_id,
        hosts: config.hosts
      },
      message: '更新成功'
    });
  } catch (error) {
    console.error('Update host config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新Host配置失败'
      }
    });
  }
}

/**
 * 删除Host配置
 */
async function deleteConfig(req, res) {
  try {
    const { id } = req.params;

    // 检查配置是否存在
    const config = await HostConfigModel.findById(id);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'Host配置不存在'
        }
      });
    }

    // 删除配置
    await HostConfigModel.delete(id);

    // 清除PAC缓存
    pacGenerator.clearCache();

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('Delete host config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除Host配置失败'
      }
    });
  }
}

/**
 * 检查Host冲突
 */
async function checkConflict(req, res) {
  try {
    const { hosts, excludeConfigId } = req.body;

    // 验证 hosts 参数
    if (!hosts || !Array.isArray(hosts)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'hosts参数是必填项，且必须是数组'
        }
      });
    }

    // 如果 hosts 为空数组，直接返回没有冲突
    if (hosts.length === 0) {
      return res.json({
        success: true,
        data: {
          hasConflict: false,
          conflicts: []
        }
      });
    }

    const conflictResult = await hostConflictChecker.checkConflictWithDetails(
      hosts,
      excludeConfigId || null
    );

    res.json({
      success: true,
      data: conflictResult
    });
  } catch (error) {
    console.error('Check host conflict error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '检查Host冲突失败'
      }
    });
  }
}

/**
 * 启用Host配置
 */
async function enable(req, res) {
  try {
    const { id } = req.params;
    const config = await HostConfigModel.update(id, { enabled: true });
    pacGenerator.clearCache();
    res.json({
      success: true,
      data: config,
      message: '配置已启用'
    });
  } catch (error) {
    console.error('Enable host config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '启用配置失败'
      }
    });
  }
}

/**
 * 停用Host配置
 */
async function disable(req, res) {
  try {
    const { id } = req.params;
    const config = await HostConfigModel.update(id, { enabled: false });
    pacGenerator.clearCache();
    res.json({
      success: true,
      data: config,
      message: '配置已停用'
    });
  } catch (error) {
    console.error('Disable host config error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '停用配置失败'
      }
    });
  }
}

/**
 * 测试域名通过代理服务
 */
async function testHost(req, res) {
  try {
    const { configId, host } = req.body;

    if (!configId || !host) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败：configId和host是必填项'
        }
      });
    }

    // 获取配置信息
    const config = await HostConfigModel.findById(configId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'Host配置不存在'
        }
      });
    }

    // 获取代理服务信息
    const proxyService = await ProxyServiceModel.findById(config.proxy_service_id);
    if (!proxyService) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROXY_SERVICE_NOT_FOUND',
          message: '代理服务不存在'
        }
      });
    }

    if (proxyService.status !== 'running') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROXY_SERVICE_NOT_RUNNING',
          message: '代理服务未运行'
        }
      });
    }

    const proxyPort = proxyService.proxy_port;
    const testUrl = `http://${host}`;
    
    // 获取代理服务的实际IP地址（从系统配置或动态获取）
    let proxyHost = '127.0.0.1';
    try {
      const pacHostConfig = await SystemConfigModel.findByKey('pac_service_host');
      if (pacHostConfig && pacHostConfig.value && pacHostConfig.value !== '192.168.1.4') {
        proxyHost = pacHostConfig.value;
      } else {
        // 如果未配置或为默认值，动态获取
        proxyHost = getServiceHost(req);
      }
    } catch (error) {
      console.error('Get proxy host error:', error);
      // 如果出错，使用默认值
      proxyHost = process.env.PROXY_HOST || '127.0.0.1';
    }
    
    // 检查SSH隧道连接状态
    const tunnelCheckResults = {
      autosshRunning: false,
      sshProcessRunning: false,
      portListening: false,
      tunnelDetails: []
    };
    
    try {
      // 1. 检查autossh进程是否在运行
      const processId = proxyService.process_id;
      if (processId && processId > 0) {
        try {
          const { stdout: psOutput } = await execAsync(`ps -p ${processId} -o pid= 2>/dev/null || echo ""`);
          tunnelCheckResults.autosshRunning = psOutput.trim().length > 0;
          tunnelCheckResults.tunnelDetails.push(`autossh进程 (PID: ${processId}): ${tunnelCheckResults.autosshRunning ? '运行中' : '未运行'}`);
        } catch (err) {
          tunnelCheckResults.tunnelDetails.push(`autossh进程检查失败: ${err.message}`);
        }
      }
      
      // 2. 检查SSH子进程是否在运行（autossh会启动ssh子进程）
      try {
        const { stdout: sshPids } = await execAsync(`pgrep -P ${processId} 2>/dev/null || echo ""`);
        const sshPidList = sshPids.trim().split('\n').filter(Boolean);
        tunnelCheckResults.sshProcessRunning = sshPidList.length > 0;
        tunnelCheckResults.tunnelDetails.push(`SSH子进程: ${tunnelCheckResults.sshProcessRunning ? `运行中 (PIDs: ${sshPidList.join(', ')})` : '未运行'}`);
      } catch (err) {
        tunnelCheckResults.tunnelDetails.push(`SSH进程检查失败: ${err.message}`);
      }
      
      // 3. 检查端口是否在监听
      try {
        const { stdout: lsofOutput } = await execAsync(`lsof -ti :${proxyPort} 2>/dev/null || echo ""`);
        const listeningPids = lsofOutput.trim().split('\n').filter(Boolean);
        tunnelCheckResults.portListening = listeningPids.length > 0;
        tunnelCheckResults.tunnelDetails.push(`端口 ${proxyPort} 监听状态: ${tunnelCheckResults.portListening ? `监听中 (PIDs: ${listeningPids.join(', ')})` : '未监听'}`);
      } catch (err) {
        tunnelCheckResults.tunnelDetails.push(`端口检查失败: ${err.message}`);
      }
      
      // 4. 检查SSH连接状态（通过检查autossh日志或连接）
      try {
        const { stdout: netstatOutput } = await execAsync(`netstat -tn 2>/dev/null | grep ":${proxyPort}" | grep ESTABLISHED || ss -tn 2>/dev/null | grep ":${proxyPort}" | grep ESTAB || echo ""`);
        const hasEstablishedConnection = netstatOutput.trim().length > 0;
        tunnelCheckResults.tunnelDetails.push(`SSH连接状态: ${hasEstablishedConnection ? '已建立' : '未建立或无法检测'}`);
      } catch (err) {
        tunnelCheckResults.tunnelDetails.push(`连接状态检查失败: ${err.message}`);
      }
      
      // 5. 检查SSH动态端口转发（-D选项）是否正常工作
      // 使用-D选项时，SSH会在本地创建SOCKS5代理，不需要远程服务器运行SOCKS5服务
      try {
        // 尝试通过本地SOCKS5代理端口进行简单连接测试
        const testCommand = `timeout 3 bash -c 'echo -ne "\\x05\\x01\\x00" | nc -w 1 127.0.0.1 ${proxyPort} 2>/dev/null | od -An -tx1 | head -1' || echo ""`;
        const { stdout: socks5TestOutput } = await execAsync(testCommand);
        const hasSocks5Response = socks5TestOutput.trim().length > 0 && socks5TestOutput.includes('05');
        
        if (hasSocks5Response) {
          tunnelCheckResults.tunnelDetails.push(`SOCKS5代理服务: 正常工作`);
        } else {
          tunnelCheckResults.tunnelDetails.push(`SOCKS5代理服务: 无响应或异常`);
          tunnelCheckResults.tunnelDetails.push(`  提示: SSH动态端口转发(-D)可能未正常工作`);
        }
      } catch (err) {
        tunnelCheckResults.tunnelDetails.push(`SOCKS5代理服务检查失败: ${err.message}`);
      }
    } catch (error) {
      console.error('Tunnel check error:', error);
      tunnelCheckResults.tunnelDetails.push(`检查过程出错: ${error.message}`);
    }
    
    // 构建curl命令（使用代理服务的实际IP地址和端口）
    const command = `timeout 10 curl -v --socks5 ${proxyHost}:${proxyPort} "${testUrl}" 2>&1 | head -n 50`;

    // 执行测试命令
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 12000,
        maxBuffer: 1024 * 1024 // 1MB
      });
      
      const output = stdout || stderr || '';
      const outputStr = output.toString();
      
      // 检查输出中是否包含错误信息
      const hasError = outputStr.includes('curl: (') || 
                       outputStr.includes('Connection reset') ||
                       outputStr.includes('SOCKS: Failed') ||
                       outputStr.includes('Recv failure') ||
                       outputStr.includes('Connection refused') ||
                       outputStr.includes('timeout') ||
                       outputStr.includes('Failed to connect');
      
      // 检查是否包含HTTP成功响应（200 OK等）
      const hasSuccess = outputStr.includes('HTTP/') && 
                        (outputStr.includes('200') || 
                         outputStr.includes('301') || 
                         outputStr.includes('302') ||
                         outputStr.includes('301') ||
                         outputStr.includes('< HTTP'));
      
      // 如果包含错误信息且没有成功响应，则认为测试失败
      const testFailed = hasError && !hasSuccess;
      
      res.json({
        success: true,
        data: {
          command,
          output: outputStr,
          host,
          proxyPort,
          testUrl,
          error: testFailed,
          tunnelCheck: tunnelCheckResults
        }
      });
    } catch (error) {
      // curl命令执行失败，返回错误信息
      const output = error.stdout || error.stderr || error.message || '';
      
      res.json({
        success: true,
        data: {
          command,
          output: output.toString(),
          host,
          proxyPort,
          testUrl,
          error: true,
          tunnelCheck: tunnelCheckResults
        }
      });
    }
  } catch (error) {
    console.error('Test host error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '测试域名失败: ' + (error.message || '未知错误')
      }
    });
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  delete: deleteConfig,
  checkConflict,
  enable,
  disable,
  testHost
};


