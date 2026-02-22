const ProxyServiceModel = require('../db/models/proxy-services');
const HostConfigModel = require('../db/models/host-configs');
const sshService = require('../services/ssh-service');
const portManager = require('../services/port-manager');
const processManager = require('../services/proxy-process-manager');
const pacGenerator = require('../services/pac-generator');
const { exec } = require('child_process');
const { promisify } = require('util');
const { Client } = require('ssh2');

const execAsync = promisify(exec);

/**
 * 发送日志消息（用于SSE）
 */
function sendLog(res, level, message) {
  res.write(`data: ${JSON.stringify({ level, message })}\n\n`);
}

/**
 * 测试基本SSH连接（使用密码）
 */
function testBasicSSHConnection(host, port, username, password, onLog) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let connectionEstablished = false;
    
    const log = (level, message) => {
      if (onLog) {
        onLog(level, message);
      }
    };
    
    conn.on('ready', () => {
      connectionEstablished = true;
      log('SUCCESS', '✅ SSH连接测试成功');
      // 连接成功即表示网络和认证正常，立即resolve，不等待命令执行
      conn.end();
      resolve(true);
    });
    
    conn.on('error', (err) => {
      if (!connectionEstablished) {
        log('ERROR', `❌ SSH连接测试失败: ${err.message}`);
        if (err.code === 'ECONNREFUSED') {
          log('INFO', '原因: 连接被拒绝');
          log('INFO', '检查项:');
          log('INFO', `  - 服务器地址是否正确: ${host}`);
          log('INFO', `  - 端口是否正确: ${port}`);
          log('INFO', '  - 服务器是否可访问');
          log('INFO', '  - 防火墙是否允许SSH连接');
        } else if (err.code === 'ETIMEDOUT') {
          log('INFO', '原因: 连接超时');
          log('INFO', '检查项:');
          log('INFO', '  - 网络连接是否正常');
          log('INFO', '  - 服务器是否在线');
          log('INFO', '  - 防火墙设置');
        } else if (err.message.includes('Authentication') || err.message.includes('password')) {
          log('INFO', '原因: 认证失败');
          log('INFO', '检查项:');
          log('INFO', `  - 用户名是否正确: ${username}`);
          log('INFO', '  - 密码是否正确');
        }
      }
      reject(err);
    });
    
    log('INFO', `正在测试SSH连接: ${username}@${host}:${port}`);
    conn.connect({
      host,
      port,
      username,
      password,
      readyTimeout: 10000
    });
  });
}

/**
 * 测试SSH免密登录
 */
function testSSHKeyAuth(host, port, username, sshKeyPath) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const conn = new Client();
    
    conn.on('ready', () => {
      conn.end();
      resolve(true);
    });
    
    conn.on('error', (err) => {
      reject(err);
    });
    
    conn.connect({
      host,
      port,
      username,
      privateKey: fs.readFileSync(sshKeyPath),
      readyTimeout: 10000
    });
  });
}

/**
 * 测试代理服务连接
 */
function testProxyConnection(proxyPort) {
  return new Promise((resolve, reject) => {
    // 使用curl测试SOCKS5代理连接
    const command = `timeout 5 curl -s --socks5 127.0.0.1:${proxyPort} http://www.google.com 2>&1 | head -c 100`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        // 如果curl失败，检查端口是否在监听
        const net = require('net');
        const client = new net.Socket();
        client.setTimeout(2000);
        
        client.on('connect', () => {
          client.destroy();
          resolve(true); // 端口在监听，认为连接成功
        });
        
        client.on('timeout', () => {
          client.destroy();
          reject(new Error('Proxy port not listening'));
        });
        
        client.on('error', () => {
          reject(new Error('Proxy connection failed'));
        });
        
        client.connect(proxyPort, '127.0.0.1');
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * 创建代理服务
 */
async function create(req, res) {
  try {
    const { name, jumpHost, jumpPort, jumpUsername, jumpPassword, hosts, proxyPort, sshKeyPath } = req.body;

    // 验证参数
    if (!name || !jumpHost || !jumpUsername || !proxyPort || !sshKeyPath) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败：name, jumpHost, jumpUsername, proxyPort, sshKeyPath是必填项'
        }
      });
    }

    // 确保分配的端口是可用的
    const isPortInUse = await portManager.isPortInUse(proxyPort);
    if (isPortInUse) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PORT_IN_USE',
          message: `代理端口 ${proxyPort} 已被占用`
        }
      });
    }

    // 1. 创建代理服务记录
    const service = await ProxyServiceModel.create({
      name,
      jumpHost,
      jumpPort: jumpPort || 22,
      jumpUsername,
      proxyPort,
      sshKeyPath,
      status: 'stopped'
    });

    // 2. 如果提供了hosts，创建Host配置
    if (hosts && Array.isArray(hosts) && hosts.length > 0) {
      await HostConfigModel.create({
        name: `${name} - 默认配置`,
        proxyServiceId: service.id,
        hosts
      });
      // 清除PAC缓存
      pacGenerator.clearCache();
    }

    res.status(201).json({
      success: true,
      data: {
        id: service.id,
        name: service.name,
        jumpHost: service.jump_host,
        jumpPort: service.jump_port,
        jumpUsername: service.jump_username,
        proxyPort: service.proxy_port,
        status: service.status
      },
      message: '创建成功'
    });
  } catch (error) {
    console.error('Create proxy service error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '创建代理服务失败'
      }
    });
  }
}

/**
 * 获取代理服务列表
 */
async function list(req, res) {
  try {
    const { page, pageSize, status } = req.query;
    const options = {};

    if (status) {
      options.status = status;
    }
    if (page) {
      options.page = parseInt(page);
    }
    if (pageSize) {
      options.pageSize = parseInt(pageSize);
    }

    const services = await ProxyServiceModel.findAll(options);
    const total = await ProxyServiceModel.count(options);

    res.json({
      success: true,
      data: {
        items: services,
        total,
        page: options.page || 1,
        pageSize: options.pageSize || 10
      }
    });
  } catch (error) {
    console.error('List proxy services error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取代理服务列表失败'
      }
    });
  }
}

/**
 * 获取代理服务详情
 */
async function getById(req, res) {
  try {
    const { id } = req.params;
    const service = await ProxyServiceModel.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: '代理服务不存在'
        }
      });
    }

    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error('Get proxy service error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取代理服务详情失败'
      }
    });
  }
}

/**
 * 更新代理服务
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, jumpHost, jumpPort, jumpUsername, jumpPassword } = req.body;

    // 检查服务是否存在
    const existingService = await ProxyServiceModel.findById(id);
    if (!existingService) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: '代理服务不存在'
        }
      });
    }

    const updates = {};
    let needRepushKey = false;

    if (name !== undefined) updates.name = name;
    if (jumpHost !== undefined) {
      updates.jumpHost = jumpHost;
      needRepushKey = true;
    }
    if (jumpPort !== undefined) {
      updates.jumpPort = jumpPort;
      needRepushKey = true;
    }
    if (jumpUsername !== undefined) {
      updates.jumpUsername = jumpUsername;
      needRepushKey = true;
    }

    // 如果跳板服务器信息变化，重新推送公钥
    if (needRepushKey && jumpPassword) {
      const keyName = existingService.ssh_key_path.split('/').pop();
      const publicKey = await sshService.getPublicKey(keyName);
      await sshService.pushPublicKey({
        host: jumpHost || existingService.jump_host,
        port: jumpPort || existingService.jump_port,
        username: jumpUsername || existingService.jump_username,
        password: jumpPassword,
        publicKey
      });
    }

    // 更新数据库
    const service = await ProxyServiceModel.update(id, updates);

    // 如果服务正在运行，可能需要重启
    if (existingService.status === 'running' && needRepushKey) {
      await processManager.stopService(id);
      // 将数据库字段名（下划线）转换为函数期望的字段名（驼峰）
      const serviceForProcess = {
        id: service.id,
        jumpHost: service.jump_host,
        jumpPort: service.jump_port,
        jumpUsername: service.jump_username,
        proxyPort: service.proxy_port,
        sshKeyPath: service.ssh_key_path
      };
      const { processId: _processId } = await processManager.startProcess(serviceForProcess);
    }

    res.json({
      success: true,
      data: service,
      message: '更新成功'
    });
  } catch (error) {
    console.error('Update proxy service error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新代理服务失败'
      }
    });
  }
}

/**
 * 删除代理服务
 */
async function deleteService(req, res) {
  try {
    const { id } = req.params;

    const service = await ProxyServiceModel.findById(id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: '代理服务不存在'
        }
      });
    }

    // 1. 停止进程
    if (service.status === 'running' && service.process_id) {
      await processManager.stopProcess(service.process_id);
    }

    // 2. 删除SSH密钥文件
    const keyName = service.ssh_key_path.split('/').pop();
    try {
      await sshService.deleteKeyPair(keyName);
    } catch (error) {
      console.error('Failed to delete SSH key:', error);
    }

    // 3. 删除代理服务记录（关联的Host配置会通过外键级联删除）
    await ProxyServiceModel.delete(id);

    // 清除PAC缓存
    pacGenerator.clearCache();

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('Delete proxy service error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除代理服务失败'
      }
    });
  }
}

/**
 * 启动代理服务
 */
async function start(req, res) {
  const startTime = Date.now();
  const serviceId = req.params.id;

  console.log('\n' + '='.repeat(60));
  console.log(`[StartProxyService] 开始启动代理服务 (ID: ${serviceId})`);
  console.log('='.repeat(60));

  try {
    // 步骤1: 查询服务配置
    console.log(`\n[步骤 1/6] 查询服务配置...`);
    const service = await ProxyServiceModel.findById(serviceId);

    if (!service) {
      console.error(`[步骤 1/6] ❌ 服务不存在 (ID: ${serviceId})`);
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: '代理服务不存在'
        }
      });
    }

    console.log(`[步骤 1/6] ✅ 服务配置查询成功`);
    console.log(`  - 服务名称: ${service.name}`);
    console.log(`  - 跳板服务器: ${service.jump_host}:${service.jump_port}`);
    console.log(`  - 用户名: ${service.jump_username}`);
    console.log(`  - 代理端口: ${service.proxy_port}`);
    console.log(`  - 当前状态: ${service.status}`);
    console.log(`  - SSH密钥: ${service.ssh_key_path}`);

    // 步骤2: 检查服务状态
    console.log(`\n[步骤 2/6] 检查服务状态...`);
    if (service.status === 'running') {
      console.log(`[步骤 2/6] ℹ️  服务已在运行中`);
      return res.json({
        success: true,
        data: {
          id: service.id,
          status: service.status
        },
        message: '服务已在运行'
      });
    }
    console.log(`[步骤 2/6] ✅ 服务未运行，可以启动`);

    // 步骤3: 停止旧进程（如果存在）
    console.log(`\n[步骤 3/6] 检查并停止旧进程...`);
    if (service.process_id && service.process_id > 0) {
      console.log(`  - 发现旧进程 PID: ${service.process_id}`);
      try {
        const isRunning = await processManager.isProcessRunning(service.process_id);
        if (isRunning) {
          console.log(`  - 正在停止旧进程...`);
          await processManager.stopProcess(service.process_id);
          console.log(`[步骤 3/6] ✅ 旧进程已停止 (PID: ${service.process_id})`);
        } else {
          console.log(`[步骤 3/6] ℹ️  旧进程已不存在 (PID: ${service.process_id})`);
        }
      } catch (error) {
        console.warn(`[步骤 3/6] ⚠️  停止旧进程失败，继续: ${error.message}`);
      }
    } else {
      console.log(`[步骤 3/6] ✅ 无旧进程需要停止`);
    }

    // 步骤4: 准备启动参数
    console.log(`\n[步骤 4/6] 准备启动参数...`);
    const serviceForProcess = {
      id: service.id,
      jumpHost: service.jump_host,
      jumpPort: service.jump_port,
      jumpUsername: service.jump_username,
      proxyPort: service.proxy_port,
      sshKeyPath: service.ssh_key_path
    };

    // 验证必要字段
    const validationErrors = [];
    if (!serviceForProcess.sshKeyPath) {
      validationErrors.push(`SSH密钥路径为空 (ssh_key_path: ${service.ssh_key_path})`);
    }
    if (!serviceForProcess.proxyPort) {
      validationErrors.push(`代理端口为空 (proxy_port: ${service.proxy_port})`);
    }
    if (!serviceForProcess.jumpHost) {
      validationErrors.push(`跳板主机为空 (jump_host: ${service.jump_host})`);
    }
    if (!serviceForProcess.jumpUsername) {
      validationErrors.push(`跳板用户名为空 (jump_username: ${service.jump_username})`);
    }

    if (validationErrors.length > 0) {
      console.error(`[步骤 4/6] ❌ 参数验证失败:`);
      validationErrors.forEach(err => console.error(`  - ${err}`));
      throw new Error(`参数验证失败: ${validationErrors.join('; ')}`);
    }

    console.log(`[步骤 4/6] ✅ 启动参数准备完成`);
    console.log(`  - 命令格式: autossh -M 0 -N -o "ServerAliveInterval=60" -o "ServerAliveCountMax=3" -o "StrictHostKeyChecking=no" -i <密钥> -D 0.0.0.0:${serviceForProcess.proxyPort} ${serviceForProcess.jumpUsername}@${serviceForProcess.jumpHost} -p ${serviceForProcess.jumpPort}`);

    // 步骤5: 启动autossh进程
    console.log(`\n[步骤 5/6] 启动autossh进程...`);
    console.log(`  - 正在执行进程启动...`);
    const { processId, command } = await processManager.startProcess(serviceForProcess);

    console.log(`[步骤 5/6] ✅ autossh进程启动成功`);
    console.log(`  - 进程PID: ${processId}`);
    console.log(`  - 完整命令: ${command}`);

    // 步骤6: 更新数据库状态
    console.log(`\n[步骤 6/6] 更新数据库状态...`);
    await ProxyServiceModel.update(service.id, {
      status: 'running',
      processId
    });
    console.log(`[步骤 6/6] ✅ 数据库状态已更新`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[StartProxyService] ✅ 代理服务启动成功!`);
    console.log(`  - 服务ID: ${service.id}`);
    console.log(`  - 进程PID: ${processId}`);
    console.log(`  - 代理端口: ${service.proxy_port}`);
    console.log(`  - 耗时: ${duration}秒`);
    console.log(`${'='.repeat(60)}\n`);

    res.json({
      success: true,
      data: {
        id: service.id,
        name: service.name,
        status: 'running',
        processId,
        proxyPort: service.proxy_port,
        command
      },
      message: '启动成功'
    });
  } catch (startError) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 尝试获取服务信息（用于错误提示）
    let service = null;
    try {
      service = await ProxyServiceModel.findById(serviceId);
    } catch (e) {
      console.error('[StartProxyService] Failed to fetch service details for error reporting:', e.message);
    }

    // 启动失败，更新状态为 error
    console.error(`\n${'='.repeat(60)}`);
    console.error(`[StartProxyService] ❌ 代理服务启动失败!`);
    console.error(`  - 服务ID: ${serviceId}`);
    console.error(`  - 耗时: ${duration}秒`);
    console.error(`  - 错误类型: ${startError.name}`);
    console.error(`  - 错误消息: ${startError.message}`);
    console.error(`\n失败原因分析:`);

    // 构建详细的错误信息对象（返回给用户）
    let errorDetails = {
      serviceId,
      duration: `${duration}s`,
      errorType: startError.name,
      reason: '',
      solution: [],
      troubleshooting: []
    };

    // 详细分析错误原因
    if (startError.message.includes('SSH密钥文件不存在')) {
      errorDetails.reason = 'SSH密钥文件不存在或路径错误';
      errorDetails.solution = [
        `请检查密钥文件路径: ${service ? service.ssh_key_path : 'N/A'}`,
        `运行命令查看目录: ls -la /data/ssh-keys/`,
        `确认密钥文件名正确`
      ];
      errorDetails.troubleshooting = [
        `可能原因:`,
        `  1. 密钥文件从未生成`,
        `  2. 密钥文件路径配置错误`,
        `  3. 密钥文件被误删除`,
        ``,
        `解决方案:`,
        `  1. 重新创建该跳板服务（会自动生成新密钥）`,
        `  2. 或手动上传密钥文件到 /data/ssh-keys/ 目录`
      ];

      console.error(`  【原因】SSH密钥文件不存在或路径错误`);
      console.error(`  【解决】请检查密钥文件路径: ${service ? service.ssh_key_path : 'N/A'}`);
      console.error(`  【命令】ls -la /data/ssh-keys/`);
    } else if (startError.message.includes('Permission denied') || startError.message.includes('permissions')) {
      errorDetails.reason = 'SSH密钥文件权限错误';
      errorDetails.solution = [
        `请设置正确的文件权限: chmod 600 <密钥文件>`,
        `或重新创建服务（系统会自动设置权限）`
      ];
      errorDetails.troubleshooting = [
        `SSH 要求私钥文件权限必须为 600 或 400`,
        `当前权限过于开放，SSH 拒绝使用该密钥`
      ];

      console.error(`  【原因】SSH密钥文件权限错误`);
      console.error(`  【解决】请设置正确的文件权限: chmod 600 <密钥文件>`);
    } else if (startError.message.includes('Connection refused') || startError.message.includes('ETIMEDOUT')) {
      errorDetails.reason = '无法连接到跳板服务器';
      errorDetails.solution = [
        `检查服务器地址是否正确: ${service ? service.jump_host : 'N/A'}`,
        `检查端口是否正确: ${service ? service.jump_port : 'N/A'}`,
        `确认服务器是否在线`,
        `检查防火墙是否允许SSH连接`
      ];
      errorDetails.troubleshooting = [
        `手动测试连接:`,
        `  ssh ${service ? service.jump_username : 'user'}@${service ? service.jump_host : 'host'} -p ${service ? service.jump_port : '22'}`,
        ``,
        `可能原因:`,
        `  1. 服务器未启动或网络不可达`,
        `  2. 防火墙阻止连接`,
        `  3. SSH服务未运行`,
        `  4. 端口号配置错误`
      ];

      console.error(`  【原因】无法连接到跳板服务器`);
      console.error(`  【检查】`);
      console.error(`    1. 服务器地址是否正确: ${service ? service.jump_host : 'N/A'}`);
      console.error(`    2. 端口是否正确: ${service ? service.jump_port : 'N/A'}`);
      console.error(`    3. 服务器是否在线`);
      console.error(`    4. 防火墙是否允许SSH连接`);
    } else if (startError.message.includes('Authentication failed') || startError.message.includes('publickey')) {
      errorDetails.reason = 'SSH认证失败';
      errorDetails.solution = [
        `检查公钥是否正确添加到跳板服务器`,
        `验证 authorized_keys 文件权限为 600`,
        `确认SSH密钥匹配`
      ];
      errorDetails.troubleshooting = [
        `验证命令:`,
        `  ssh -i <密钥文件> ${service ? service.jump_username : 'user'}@${service ? service.jump_host : 'host'} -p ${service ? service.jump_port : '22'}`,
        ``,
        `可能原因:`,
        `  1. 公钥未正确添加到服务器`,
        `  2. authorized_keys 文件权限不正确`,
        `  3. SSH密钥不匹配`,
        `  4. .ssh 目录权限不正确（应为 700）`
      ];

      console.error(`  【原因】SSH认证失败`);
      console.error(`  【可能】`);
      console.error(`    1. 公钥未正确添加到服务器`);
      console.error(`    2. authorized_keys文件权限不正确`);
      console.error(`    3. SSH密钥不匹配`);
      console.error(`  【验证】ssh -i <密钥文件> ${service ? service.jump_username : 'user'}@${service ? service.jump_host : 'host'} -p ${service ? service.jump_port : '22'}`);
    } else if (startError.message.includes('端口') && startError.message.includes('已被占用')) {
      errorDetails.reason = '代理端口已被占用';
      errorDetails.solution = [
        `检查端口占用: lsof -i :${service ? service.proxy_port : 'port'}`,
        `停止占用该端口的进程`,
        `或更新服务配置使用其他端口`
      ];

      console.error(`  【原因】代理端口已被占用`);
      console.error(`  【检查】lsof -i :${service ? service.proxy_port : 'port'}`);
    } else {
      errorDetails.reason = '未知错误';
      errorDetails.troubleshooting = [startError.stack || startError.message];
      console.error(`  【其他】${startError.stack}`);
    }
    console.error(`${'='.repeat(60)}\n`);

    await ProxyServiceModel.update(serviceId, {
      status: 'error',
      processId: -1
    }).catch(err => {
      console.error('[StartProxyService] 更新数据库状态失败:', err);
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'START_FAILED',
        message: startError.message,
        details: errorDetails
      }
    });
  }
}

/**
 * 停止代理服务
 */
async function stop(req, res) {
  console.log(`[ProxyServiceController] ========== STOP REQUEST RECEIVED for service ${req.params.id} ==========`);
  try {
    const { id } = req.params;
    console.log(`[ProxyServiceController] Stop request for service ID: ${id}`);

    const service = await ProxyServiceModel.findById(id);
    if (!service) {
      console.log(`[ProxyServiceController] Service ${id} not found`);
      return res.status(404).json({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: '代理服务不存在'
        }
      });
    }

    console.log(`[ProxyServiceController] Service found: ${service.name}, status: ${service.status}, processId: ${service.process_id}, port: ${service.proxy_port}`);

    // 如果已经停止，直接返回
    if (service.status === 'stopped') {
      console.log(`[ProxyServiceController] Service ${id} already stopped, returning success`);
      return res.json({
        success: true,
        data: {
          id: service.id,
          status: service.status
        },
        message: '服务已停止'
      });
    }

    // 停止进程（使用stopService确保停止所有相关进程，包括子进程）
    // stopService 内部已经更新了数据库状态，这里不需要重复更新
    console.log(`[ProxyServiceController] Starting stopService for service ${id}...`);
    
    // 添加整体超时保护（最多等待10秒）
    const stopWithTimeout = Promise.race([
      processManager.stopService(id),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('停止操作超时（10秒）'));
        }, 10000);
      })
    ]);
    
    try {
      await stopWithTimeout;
      
      console.log(`[ProxyServiceController] Stop completed for service ${id}`);
      res.json({
        success: true,
        data: {
          id: service.id,
          status: 'stopped'
        },
        message: '停止成功'
      });
    } catch (error) {
      console.error(`[ProxyServiceController] Error in stopService for ${id}:`, error);
      // 即使停止过程出错，也尝试更新数据库状态（防止卡住）
      try {
        await ProxyServiceModel.update(id, {
          status: 'stopped',
          processId: -1
        });
        console.log(`[ProxyServiceController] Database status updated to stopped after error for service ${id}`);
      } catch (updateError) {
        console.error(`[ProxyServiceController] Error updating service status for ${id}:`, updateError);
      }
      
      // 即使出错也返回成功，因为数据库状态已更新
      res.json({
        success: true,
        data: {
          id: service.id,
          status: 'stopped'
        },
        message: '停止完成（可能部分进程未完全停止）'
      });
    }
  } catch (error) {
    console.error('Stop proxy service error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '停止代理服务失败'
      }
    });
  }
}

/**
 * 带超时的Promise包装器
 */
function withTimeout(promise, timeoutMs, stepName, sendLogFn) {
  let timeoutId;
  let countdownInterval;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      reject(new Error(`操作超时: ${stepName} 在 ${timeoutMs / 1000} 秒内未完成`));
    }, timeoutMs);
    
    // 启动倒计时
    let remaining = timeoutMs;
    countdownInterval = setInterval(() => {
      remaining -= 1000;
      if (remaining > 0) {
        sendLogFn('INFO', `⏱️ ${stepName} 进行中... (剩余 ${remaining / 1000} 秒)`);
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);
  });
  
  return Promise.race([
    promise.then(result => {
      if (timeoutId) clearTimeout(timeoutId);
      if (countdownInterval) clearInterval(countdownInterval);
      return result;
    }).catch(error => {
      if (timeoutId) clearTimeout(timeoutId);
      if (countdownInterval) clearInterval(countdownInterval);
      throw error;
    }),
    timeoutPromise
  ]);
}

/**
 * 连接代理服务（实时日志推送）
 */
async function connect(req, res) {
  try {
    const { jumpHost, jumpPort, jumpUsername, jumpPassword } = req.body;

    // 验证参数
    if (!jumpHost || !jumpUsername || !jumpPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败：jumpHost、jumpUsername、jumpPassword是必填项'
        }
      });
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 超时配置（毫秒）
    const TIMEOUTS = {
      PORT_ALLOCATION: 10000,    // 10秒
      KEY_GENERATION: 30000,     // 30秒
      SSH_CONNECTION: 60000,     // 60秒
      KEY_PUSH: 60000,           // 60秒
      AUTH_TEST: 30000           // 30秒
    };

    try {
      // 0. 测试基本SSH连接（使用密码）
      sendLog(res, 'INFO', '═══════════════════════════════════════');
      sendLog(res, 'INFO', '开始创建流程...');
      sendLog(res, 'INFO', `跳板服务器: ${jumpHost}:${jumpPort || 22}`);
      sendLog(res, 'INFO', `用户名: ${jumpUsername}`);
      sendLog(res, 'INFO', '═══════════════════════════════════════');
      
      sendLog(res, 'INFO', '');
      sendLog(res, 'INFO', '【步骤 0/6】测试基本SSH连接');
      sendLog(res, 'INFO', `执行命令: ssh ${jumpUsername}@${jumpHost} -p ${jumpPort || 22}`);
      sendLog(res, 'INFO', '目的: 验证网络连接和账号密码是否正确');
      
      try {
        await withTimeout(
          testBasicSSHConnection(
            jumpHost,
            jumpPort || 22,
            jumpUsername,
            jumpPassword,
            (level, message) => sendLog(res, level, message)
          ),
          TIMEOUTS.SSH_CONNECTION,
          'SSH连接测试',
          (level, message) => sendLog(res, level, message)
        );
        sendLog(res, 'SUCCESS', '✅ 基本SSH连接测试通过');
        sendLog(res, 'INFO', '网络连接正常，账号密码正确，可以继续后续步骤');
      } catch (error) {
        sendLog(res, 'ERROR', `❌ 基本SSH连接测试失败: ${error.message}`);
        sendLog(res, 'INFO', '');
        sendLog(res, 'INFO', '⚠️ 无法建立基本SSH连接，请检查:');
        sendLog(res, 'INFO', `  1. 服务器地址: ${jumpHost}`);
        sendLog(res, 'INFO', `  2. 端口: ${jumpPort || 22}`);
        sendLog(res, 'INFO', `  3. 用户名: ${jumpUsername}`);
        sendLog(res, 'INFO', '  4. 密码是否正确');
        sendLog(res, 'INFO', '  5. 网络连接是否正常');
        sendLog(res, 'INFO', '');
        sendLog(res, 'INFO', '建议:');
        sendLog(res, 'INFO', `  - 手动测试: ssh ${jumpUsername}@${jumpHost} -p ${jumpPort || 22}`);
        sendLog(res, 'INFO', '  - 检查服务器是否在线');
        sendLog(res, 'INFO', '  - 检查防火墙设置');
        throw error; // 基本连接失败，不继续后续步骤
      }
      
      // 1. 选择可用代理端口
      sendLog(res, 'INFO', '');
      sendLog(res, 'INFO', '【步骤 1/6】选择可用代理端口');
      const portRange = portManager.getPortRange();
      sendLog(res, 'INFO', `执行命令: 检查端口范围 ${portRange.start}-${portRange.end} 的可用性`);
      
      const proxyPort = await withTimeout(
        portManager.allocatePort(),
        TIMEOUTS.PORT_ALLOCATION,
        '端口分配',
        (level, message) => sendLog(res, level, message)
      );
      
      sendLog(res, 'SUCCESS', `✅ 已分配代理端口: ${proxyPort}`);
      sendLog(res, 'INFO', `端口检查命令: net.createServer().listen(${proxyPort})`);

      // 2. 创建密钥对
      sendLog(res, 'INFO', '');
      sendLog(res, 'INFO', '【步骤 2/6】创建SSH密钥对');
      const keyName = `proxy_${Date.now()}_${proxyPort}`;
      const privateKeyPath = `/data/ssh-keys/${keyName}`;
      const publicKeyPath = `${privateKeyPath}.pub`;
      
      sendLog(res, 'INFO', `执行命令: ssh-keygen -t rsa -b 2048 -f "${privateKeyPath}" -N "" -C "socks-proxy-${keyName}"`);
      sendLog(res, 'INFO', `密钥名称: ${keyName}`);
      sendLog(res, 'INFO', `私钥路径: ${privateKeyPath}`);
      sendLog(res, 'INFO', `公钥路径: ${publicKeyPath}`);
      
      let keyPair;
      try {
        keyPair = await withTimeout(
          sshService.generateKeyPair(keyName),
          TIMEOUTS.KEY_GENERATION,
          '密钥生成',
          (level, message) => sendLog(res, level, message)
        );
        sendLog(res, 'SUCCESS', '✅ SSH密钥对创建成功');
        sendLog(res, 'INFO', `密钥类型: RSA 2048位`);
        sendLog(res, 'INFO', `文件权限设置: 私钥 600, 公钥 644`);
      } catch (error) {
        sendLog(res, 'ERROR', `❌ 密钥生成失败: ${error.message}`);
        if (error.message.includes('already exists')) {
          sendLog(res, 'INFO', '原因: 密钥文件已存在，请稍后重试');
        } else if (error.message.includes('超时')) {
          sendLog(res, 'INFO', '原因: 密钥生成操作超时，可能是磁盘IO问题');
        } else {
          sendLog(res, 'INFO', `详细错误: ${error.stack || error.message}`);
        }
        throw error;
      }

      // 3. 使用ssh-copy-id复制公钥到跳板服务器
      sendLog(res, 'INFO', '');
      sendLog(res, 'INFO', '【步骤 3/6】复制公钥到跳板服务器');
      sendLog(res, 'INFO', `执行操作: SSH连接到 ${jumpHost}:${jumpPort || 22}`);
      sendLog(res, 'INFO', `连接命令: ssh ${jumpUsername}@${jumpHost} -p ${jumpPort || 22}`);
      sendLog(res, 'INFO', `操作步骤:`);
      sendLog(res, 'INFO', `  1. 创建 ~/.ssh 目录 (mkdir -p ~/.ssh && chmod 700 ~/.ssh)`);
      sendLog(res, 'INFO', `  2. 读取 ~/.ssh/authorized_keys 文件`);
      sendLog(res, 'INFO', `  3. 追加公钥到 authorized_keys`);
      sendLog(res, 'INFO', `  4. 设置文件权限 (chmod 600 ~/.ssh/authorized_keys)`);
      
      try {
        await withTimeout(
          sshService.pushPublicKey({
            host: jumpHost,
            port: jumpPort || 22,
            username: jumpUsername,
            password: jumpPassword,
            publicKey: keyPair.publicKey,
            onLog: (level, message) => sendLog(res, level, message)
          }),
          TIMEOUTS.KEY_PUSH,
          '公钥推送',
          (level, message) => sendLog(res, level, message)
        );
        
        sendLog(res, 'SUCCESS', '✅ 公钥已成功复制到跳板服务器');
        sendLog(res, 'INFO', '已添加到跳板服务器授权密钥列表');
      } catch (error) {
        sendLog(res, 'ERROR', `❌ 公钥推送失败: ${error.message}`);
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
          sendLog(res, 'INFO', '原因: 无法连接到跳板服务器');
          sendLog(res, 'INFO', `检查项:`);
          sendLog(res, 'INFO', `  - 跳板服务器地址是否正确: ${jumpHost}`);
          sendLog(res, 'INFO', `  - 端口是否正确: ${jumpPort || 22}`);
          sendLog(res, 'INFO', `  - 服务器是否可访问`);
          sendLog(res, 'INFO', `  - 防火墙是否允许SSH连接`);
        } else if (error.message.includes('Authentication failed') || error.message.includes('password')) {
          sendLog(res, 'INFO', '原因: SSH认证失败');
          sendLog(res, 'INFO', `检查项:`);
          sendLog(res, 'INFO', `  - 用户名是否正确: ${jumpUsername}`);
          sendLog(res, 'INFO', `  - 密码是否正确`);
        } else if (error.message.includes('超时') || error.message.includes('timeout')) {
          sendLog(res, 'INFO', '原因: 公钥推送操作超时（60秒）');
          sendLog(res, 'INFO', `可能卡住的步骤:`);
          sendLog(res, 'INFO', `  - SSH连接建立`);
          sendLog(res, 'INFO', `  - 获取用户主目录路径`);
          sendLog(res, 'INFO', `  - 创建.ssh目录`);
          sendLog(res, 'INFO', `  - 读取authorized_keys文件`);
          sendLog(res, 'INFO', `  - 写入authorized_keys文件`);
          sendLog(res, 'INFO', `  - 设置文件权限 (chmod)`);
          sendLog(res, 'INFO', ``);
          sendLog(res, 'INFO', `解决方案:`);
          sendLog(res, 'INFO', `  1. 检查跳板服务器状态和响应速度`);
          sendLog(res, 'INFO', `  2. 检查网络连接是否稳定`);
          sendLog(res, 'INFO', `  3. 检查跳板服务器磁盘空间和IO性能`);
          sendLog(res, 'INFO', `  4. 尝试手动SSH连接测试: ssh ${jumpUsername}@${jumpHost} -p ${jumpPort || 22}`);
          sendLog(res, 'INFO', `  5. 检查跳板服务器日志: tail -f /var/log/auth.log`);
          sendLog(res, 'INFO', `  6. 如果问题持续，可以尝试增加超时时间或联系服务器管理员`);
        } else if (error.message.includes('chmod')) {
          sendLog(res, 'INFO', '原因: chmod命令执行超时或失败');
          sendLog(res, 'INFO', `检查项:`);
          sendLog(res, 'INFO', `  - 文件是否已成功创建`);
          sendLog(res, 'INFO', `  - 是否有权限执行chmod命令`);
          sendLog(res, 'INFO', `  - 跳板服务器响应是否正常`);
        } else {
          sendLog(res, 'INFO', `详细错误: ${error.stack || error.message}`);
        }
        throw error;
      }

      // 4. 测试免密登录
      sendLog(res, 'INFO', '');
      sendLog(res, 'INFO', '【步骤 4/6】测试免密登录');
      sendLog(res, 'INFO', `执行命令: ssh -i "${keyPair.privateKeyPath}" ${jumpUsername}@${jumpHost} -p ${jumpPort || 22}`);
      sendLog(res, 'INFO', `使用私钥: ${keyPair.privateKeyPath}`);
      
      try {
        await withTimeout(
          testSSHKeyAuth(jumpHost, jumpPort || 22, jumpUsername, keyPair.privateKeyPath),
          TIMEOUTS.AUTH_TEST,
          '免密登录测试',
          (level, message) => sendLog(res, level, message)
        );
        sendLog(res, 'SUCCESS', '✅ 免密登录测试成功');
        sendLog(res, 'INFO', 'SSH密钥认证已配置完成');
      } catch (error) {
        sendLog(res, 'ERROR', `❌ 免密登录测试失败: ${error.message}`);
        if (error.message.includes('Authentication failed')) {
          sendLog(res, 'INFO', '原因: 密钥认证失败');
          sendLog(res, 'INFO', `检查项:`);
          sendLog(res, 'INFO', `  - 公钥是否正确添加到跳板服务器`);
          sendLog(res, 'INFO', `  - authorized_keys 文件权限是否正确 (600)`);
          sendLog(res, 'INFO', `  - .ssh 目录权限是否正确 (700)`);
        } else if (error.message.includes('超时')) {
          sendLog(res, 'INFO', '原因: SSH连接超时');
        } else {
          sendLog(res, 'INFO', `详细错误: ${error.stack || error.message}`);
        }
        throw error;
      }

      // 5. 准备autossh配置
      sendLog(res, 'INFO', '');
      sendLog(res, 'INFO', '【步骤 5/6】准备autossh代理配置');
      sendLog(res, 'INFO', `autossh命令预览:`);
      sendLog(res, 'INFO', `  autossh -M 0 -N \\`);
      sendLog(res, 'INFO', `    -o "ServerAliveInterval=60" \\`);
      sendLog(res, 'INFO', `    -o "ServerAliveCountMax=3" \\`);
      sendLog(res, 'INFO', `    -o "StrictHostKeyChecking=no" \\`);
      sendLog(res, 'INFO', `    -i "${keyPair.privateKeyPath}" \\`);
      sendLog(res, 'INFO', `    -D 0.0.0.0:${proxyPort} \\`);
      sendLog(res, 'INFO', `    ${jumpUsername}@${jumpHost} -p ${jumpPort || 22}`);
      sendLog(res, 'INFO', `说明: 在本地端口 ${proxyPort} 创建SOCKS5代理服务器`);
      sendLog(res, 'SUCCESS', '✅ autossh配置已准备就绪');
      sendLog(res, 'INFO', '注意: autossh进程将在创建服务后启动');

      sendLog(res, 'INFO', '');
      sendLog(res, 'SUCCESS', '═══════════════════════════════════════');
      sendLog(res, 'SUCCESS', '✅ 创建流程完成！');
      sendLog(res, 'SUCCESS', '═══════════════════════════════════════');

      // 返回结果
      res.write(`data: ${JSON.stringify({ 
        success: true, 
        proxyPort,
        keyName,
        sshKeyPath: keyPair.privateKeyPath
      })}\n\n`);
      
      res.end();
    } catch (error) {
      sendLog(res, 'ERROR', '');
      sendLog(res, 'ERROR', '═══════════════════════════════════════');
        sendLog(res, 'ERROR', `❌ 创建失败: ${error.message}`);
      sendLog(res, 'ERROR', '═══════════════════════════════════════');
      res.write(`data: ${JSON.stringify({ success: false, error: error.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('Connect proxy service error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '连接代理服务失败'
      }
    });
  }
}

// ... existing code ...

module.exports = {
  create,
  list,
  getById,
  update,
  delete: deleteService,
  start,
  stop,
  connect
};
