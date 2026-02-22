const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const ProxyServiceModel = require('../db/models/proxy-services');

/**
 * 代理进程管理器
 */
class ProxyProcessManager {
  /**
   * 启动autossh进程
   * @param {Object} service - 代理服务配置
   * @returns {Promise<{processId: number, command: string}>} 进程ID和命令
   */
  async startProcess(service) {
    console.log(`\n[ProxyProcessManager] 开始启动autossh进程...`);
    console.log(`  - 服务ID: ${service.id}`);
    console.log(`  - 跳板服务器: ${service.jumpHost}:${service.jumpPort}`);
    console.log(`  - 用户名: ${service.jumpUsername}`);
    console.log(`  - 代理端口: ${service.proxyPort}`);
    console.log(`  - SSH密钥路径: ${service.sshKeyPath}`);

    const {
      id,
      jumpHost,
      jumpPort,
      jumpUsername,
      proxyPort,
      sshKeyPath
    } = service;

    // 将相对路径转换为绝对路径
    // 在Docker容器中，SSH密钥应该在 /data/ssh-keys/ 目录下
    // 如果路径是绝对路径，直接使用；否则尝试多个可能的路径
    const path = require('path');
    let absoluteSshKeyPath = null;

    console.log(`\n[ProxyProcessManager] 步骤 1/4: 解析SSH密钥路径...`);
    if (path.isAbsolute(sshKeyPath)) {
      absoluteSshKeyPath = sshKeyPath;
      console.log(`  - 已是绝对路径: ${absoluteSshKeyPath}`);
    } else {
      console.log(`  - 相对路径，尝试解析...`);
      // 尝试多个可能的路径
      const possiblePaths = [
        // Docker容器中的标准路径 - 只取basename避免重复路径
        path.join('/data/ssh-keys', path.basename(sshKeyPath)),
        // 相对于项目根目录的路径
        path.resolve(__dirname, '..', '..', sshKeyPath),
        // 相对于当前文件的路径
        path.resolve(__dirname, '..', sshKeyPath),
        // 如果sshKeyPath已经包含data/ssh-keys，直接解析
        path.resolve(__dirname, '..', '..', 'data', 'ssh-keys', path.basename(sshKeyPath))
      ];

      console.log(`  - 尝试的路径:`);
      possiblePaths.forEach((p, idx) => console.log(`    ${idx + 1}. ${p}`));

      // 检查哪个路径存在
      for (let i = 0; i < possiblePaths.length; i++) {
        const possiblePath = possiblePaths[i];
        try {
          await fs.access(possiblePath);
          absoluteSshKeyPath = possiblePath;
          console.log(`  ✅ 使用路径 ${i + 1}: ${absoluteSshKeyPath}`);
          break;
        } catch (e) {
          // 继续尝试下一个路径
        }
      }

      // 如果所有路径都不存在，使用第一个可能的路径（用于错误提示）
      if (!absoluteSshKeyPath) {
        absoluteSshKeyPath = possiblePaths[0];
        console.log(`  ⚠️  所有路径都不存在，将使用第一个: ${absoluteSshKeyPath}`);
      }
    }

    // 验证SSH密钥文件是否存在
    console.log(`\n[ProxyProcessManager] 步骤 2/4: 验证SSH密钥文件...`);
    try {
      await fs.access(absoluteSshKeyPath);
      const stats = await fs.stat(absoluteSshKeyPath);
      console.log(`  ✅ 密钥文件存在: ${absoluteSshKeyPath}`);
      console.log(`  - 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    } catch (error) {
      // 提供更详细的错误信息，包括尝试过的路径
      const errorMsg = `SSH密钥文件不存在或不可访问: ${absoluteSshKeyPath}`;
      console.error(`  ❌ 文件验证失败`);
      console.error(`    - 原始路径: ${sshKeyPath}`);
      console.error(`    - 解析路径: ${absoluteSshKeyPath}`);
      console.error(`    - 错误信息: ${error.message}`);
      console.error(`\n  💡 可能的解决方案:`);
      console.error(`    1. 检查密钥文件是否存在于 /data/ssh-keys/ 目录`);
      console.error(`    2. 运行命令查看目录: ls -la /data/ssh-keys/`);
      console.error(`    3. 确保密钥文件名正确`);
      throw new Error(errorMsg);
    }

    // 验证文件权限（SSH要求私钥权限为600）
    console.log(`\n[ProxyProcessManager] 步骤 3/4: 检查并修复文件权限...`);
    try {
      const stats = await fs.stat(absoluteSshKeyPath);
      const mode = stats.mode & parseInt('777', 8);
      console.log(`  - 当前权限: ${mode.toString(8)} (八进制)`);

      if (mode !== parseInt('600', 8) && mode !== parseInt('400', 8)) {
        console.warn(`  ⚠️  权限不正确，应该是 600 或 400`);
        // 尝试修复权限
        try {
          await fs.chmod(absoluteSshKeyPath, 0o600);
          console.log(`  ✅ 已自动修复权限为 600`);
        } catch (chmodError) {
          console.warn(`  ❌ 无法自动修复权限: ${chmodError.message}`);
          console.warn(`  💡 请手动运行: chmod 600 ${absoluteSshKeyPath}`);
        }
      } else {
        console.log(`  ✅ 权限正确`);
      }
    } catch (statError) {
      console.warn(`  ⚠️  无法检查文件权限: ${statError.message}`);
    }

    // 构建autossh命令
    console.log(`\n[ProxyProcessManager] 步骤 4/4: 构建并启动autossh进程...`);
    // autossh -M 0 -N -o "ServerAliveInterval 60" -o "ServerAliveCountMax 3" 
    // -i <私钥路径> -D <绑定地址>:<本地端口> <用户名>@<跳板服务器>
    // -D 选项会在本地创建一个SOCKS5代理服务器
    const autosshArgs = [
      '-M', '0', // 禁用监控端口
      '-N', // 不执行远程命令
      '-o', 'ServerAliveInterval=60',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ExitOnForwardFailure=no', // 即使端口转发失败也不退出，允许后续重试
      '-i', absoluteSshKeyPath,
      '-D', `0.0.0.0:${proxyPort}`, // 绑定到所有IP地址，在本地创建SOCKS5代理服务器
      `${jumpUsername}@${jumpHost}`,
      '-p', String(jumpPort)
    ];
    
    // 构建完整的命令字符串用于日志显示
    const commandParts = ['autossh'];
    for (let i = 0; i < autosshArgs.length; i++) {
      const arg = autosshArgs[i];
      // 如果参数包含空格或特殊字符，需要加引号
      if (arg.includes(' ') || arg.includes('=') || arg.includes('@')) {
        commandParts.push(`"${arg}"`);
      } else {
        commandParts.push(arg);
      }
    }
    const autosshCommand = commandParts.join(' ');

    return new Promise((resolve, reject) => {
      // 启动autossh进程
      const process = spawn('autossh', autosshArgs, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        const dataStr = data.toString();
        stderr += dataStr;
        // 实时记录stderr，便于调试
        console.error(`[ProxyProcessManager] autossh stderr (real-time):`, dataStr.trim());
      });

      let processExited = false;
      let processExitedCode = null;

      process.on('error', (error) => {
        // 如果进程启动失败（如命令不存在）
        if (error.code === 'ENOENT') {
          reject(new Error('autossh 命令未找到，请确保已安装 autossh。在Docker容器中，autossh应该已经安装。'));
        } else {
          reject(new Error(`启动autossh进程失败: ${error.message}`));
        }
      });

      process.on('exit', (code) => {
        processExited = true;
        processExitedCode = code;
        // 记录退出信息用于调试
        if (stderr) {
          console.error(`[ProxyProcessManager] autossh stderr (pid ${process.pid}):`, stderr);
        }
        if (stdout) {
          console.log(`[ProxyProcessManager] autossh stdout (pid ${process.pid}):`, stdout);
        }
        if (code !== 0 && code !== null) {
          // 进程异常退出，更新状态
          ProxyServiceModel.update(id, {
            status: 'error',
            processId: -1  // 进程异常退出时设置为 -1
          }).catch(err => {
            console.error('Failed to update process status:', err);
          });
          
          // 分析错误原因，提供更详细的错误信息
          let errorMsg = '';
          if (stderr) {
            // 尝试从stderr中提取有用的错误信息
            const stderrLower = stderr.toLowerCase();
            if (stderrLower.includes('permission denied') || stderrLower.includes('permissions')) {
              errorMsg = `SSH密钥权限错误: ${stderr.trim()}`;
            } else if (stderrLower.includes('no such file') || stderrLower.includes('cannot find')) {
              errorMsg = `SSH密钥文件不存在: ${stderr.trim()}`;
            } else if (stderrLower.includes('connection refused') || stderrLower.includes('could not resolve')) {
              errorMsg = `无法连接到跳板服务器 ${jumpHost}:${jumpPort}: ${stderr.trim()}`;
            } else if (stderrLower.includes('authentication failed') || stderrLower.includes('publickey')) {
              errorMsg = `SSH认证失败，请检查SSH密钥是否正确: ${stderr.trim()}`;
            } else {
              errorMsg = stderr.trim();
            }
          }
          
          if (!errorMsg) {
            errorMsg = `autossh 进程异常退出，退出码: ${code}`;
          }
          
          reject(new Error(errorMsg));
        }
      });

      // 等待一段时间检查进程是否成功启动
      setTimeout(() => {
        if (processExited) {
          // 进程已经退出，错误已在 exit 事件中处理
          return;
        }
        
        if (process.pid) {
          // 检查进程是否仍在运行
          try {
            process.kill(0); // 发送信号0检查进程是否存在
            // 更新数据库中的进程ID和状态
            ProxyServiceModel.update(id, {
              processId: process.pid,
              status: 'running'
            }).catch(err => {
              console.error('Failed to update process status:', err);
            });

            resolve({ processId: process.pid, command: autosshCommand });
          } catch (err) {
            // 进程不存在
            reject(new Error('autossh 进程启动后立即退出'));
          }
        } else {
          reject(new Error('无法获取进程ID，autossh 启动失败'));
        }
      }, 2000); // 增加到2秒，给进程更多时间启动
    });
  }

  /**
   * 停止进程
   * @param {number} processId - 进程ID
   * @returns {Promise<void>}
   */
  async stopProcess(processId) {
    return new Promise((resolve, reject) => {
      if (!processId) {
        resolve();
        return;
      }

      try {
        // 先尝试优雅停止（SIGTERM），给进程时间清理
        const killProcess = spawn('kill', ['-TERM', String(processId)]);
        
        killProcess.on('close', (code) => {
          // 等待一段时间让进程优雅退出
          setTimeout(() => {
            // 检查进程是否还在运行，如果还在则强制杀死
            const checkProcess = spawn('kill', ['-0', String(processId)]);
            checkProcess.on('close', (checkCode) => {
              if (checkCode === 0) {
                // 进程仍在运行，强制杀死
                const forceKill = spawn('kill', ['-9', String(processId)]);
                forceKill.on('close', () => resolve());
                forceKill.on('error', () => resolve()); // 进程可能已经退出
              } else {
                // 进程已退出
                resolve();
              }
            });
            checkProcess.on('error', () => resolve()); // 进程可能已经退出
          }, 1000);
        });

        killProcess.on('error', (error) => {
          // 如果进程不存在，也算成功
          if (error.code === 'ENOENT' || error.message.includes('No such process')) {
            resolve();
          } else {
            // 尝试强制杀死
            const forceKill = spawn('kill', ['-9', String(processId)]);
            forceKill.on('close', () => resolve());
            forceKill.on('error', () => resolve());
          }
        });
      } catch (error) {
        // 如果进程不存在，也算成功
        resolve();
      }
    });
  }

  /**
   * 检查进程是否运行
   * @param {number} processId - 进程ID
   * @returns {Promise<boolean>}
   */
  async isProcessRunning(processId) {
    if (!processId) {
      return false;
    }

    return new Promise((resolve) => {
      try {
        // 使用kill -0检查进程是否存在
        const checkProcess = spawn('kill', ['-0', String(processId)]);
        
        checkProcess.on('close', (code) => {
          resolve(code === 0);
        });

        checkProcess.on('error', () => {
          resolve(false);
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * 停止代理服务进程
   * @param {number} serviceId - 代理服务ID
   * @returns {Promise<void>}
   */
  async stopService(serviceId) {
    console.log(`[ProxyProcessManager] ========== stopService START for service ${serviceId} ==========`);
    
    try {
      const service = await ProxyServiceModel.findById(serviceId);
      if (!service) {
        console.log(`[ProxyProcessManager] Service ${serviceId} not found`);
        return;
      }

      const processId = service.process_id;
      const port = service.proxy_port;
      
      console.log(`[ProxyProcessManager] stopService called for service ${serviceId}, port: ${port}, processId: ${processId}`);
      
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // 添加超时包装函数（捕获超时错误但不抛出，继续执行）
      const withTimeout = (promise, timeoutMs, operation) => {
        return Promise.race([
          promise.catch(err => {
            console.log(`[ProxyProcessManager] ${operation} error (non-fatal):`, err.message);
            return { stdout: '', stderr: '' }; // 返回空对象而不是null，避免后续访问错误
          }),
          new Promise((resolve) => {
            setTimeout(() => {
              console.log(`[ProxyProcessManager] ${operation} timeout after ${timeoutMs}ms, continuing...`);
              resolve({ stdout: '', stderr: '' }); // 超时也返回空对象，不抛出错误
            }, timeoutMs);
          })
        ]);
      };
    
    // 第一步：查找并停止所有监听该端口的进程（包括主进程和子进程）
    try {
      if (!port) {
        console.error(`[ProxyProcessManager] Port is undefined for service ${serviceId}`);
        // 如果端口未定义，尝试通过process_id停止
        if (processId) {
          try {
            await withTimeout(
              execAsync(`kill -TERM ${processId} 2>/dev/null || kill -9 ${processId} 2>/dev/null || true`),
              3000,
              'Kill process by PID'
            );
          } catch (err) {
            console.error(`[ProxyProcessManager] Error killing process ${processId}:`, err.message);
          }
        }
      } else {
        // 查找所有监听该端口的进程
        console.log(`[ProxyProcessManager] Finding processes listening on port ${port}...`);
        let pids = [];
        try {
          const result = await withTimeout(
            execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`),
            5000,
            'Find processes by port'
          );
          if (result && result.stdout) {
            pids = result.stdout.trim().split('\n').filter(Boolean);
          } else {
            console.log(`[ProxyProcessManager] No stdout from lsof command`);
          }
        } catch (err) {
          console.error(`[ProxyProcessManager] Error finding processes:`, err.message);
        }
        
        console.log(`[ProxyProcessManager] Found ${pids.length} process(es) listening on port ${port}:`, pids);
        
        if (pids.length === 0) {
          console.log(`[ProxyProcessManager] No processes found listening on port ${port}`);
        } else {
          // 停止所有相关进程（包括主进程和子进程）
          const killPromises = pids.map(pid => {
            if (pid) {
              return withTimeout(
                execAsync(`kill -TERM ${pid} 2>/dev/null || true`),
                2000,
                `Kill process ${pid}`
              ).catch(err => {
                console.error(`[ProxyProcessManager] Error stopping process ${pid}:`, err.message);
              });
            }
          });
          
          // 并行停止所有进程
          await Promise.allSettled(killPromises);
          
          // 等待进程退出（减少等待时间）
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 再次检查，强制杀死仍在运行的进程
          let remainingPids = [];
          try {
            const result2 = await withTimeout(
              execAsync(`lsof -ti :${port} 2>/dev/null || echo ""`),
              3000,
              'Check remaining processes'
            );
            if (result2 && result2.stdout) {
              remainingPids = result2.stdout.trim().split('\n').filter(Boolean);
            } else {
              console.log(`[ProxyProcessManager] No stdout from second lsof check`);
            }
          } catch (err) {
            console.error(`[ProxyProcessManager] Error checking remaining processes:`, err.message);
          }
          
          if (remainingPids.length > 0) {
            console.log(`[ProxyProcessManager] ${remainingPids.length} process(es) still running, force killing:`, remainingPids);
            const forceKillPromises = remainingPids.map(pid => {
              if (pid) {
                return withTimeout(
                  execAsync(`kill -9 ${pid} 2>/dev/null || true`),
                  2000,
                  `Force kill process ${pid}`
                ).then(() => {
                  console.log(`[ProxyProcessManager] Force killed process ${pid}`);
                }).catch(err => {
                  console.error(`[ProxyProcessManager] Error force killing process ${pid}:`, err.message);
                });
              }
            });
            
            await Promise.allSettled(forceKillPromises);
          } else {
            console.log(`[ProxyProcessManager] All processes stopped successfully`);
          }
        }
        
        // 如果指定了process_id，也尝试停止它（可能已经变成孤儿进程）
        if (processId) {
          try {
            // 检查进程是否还在运行
            const checkResult = await withTimeout(
              execAsync(`kill -0 ${processId} 2>&1 || echo "not running"`),
              2000,
              'Check process status'
            );
            if (checkResult && checkResult.stdout && !checkResult.stdout.includes('not running')) {
              console.log(`[ProxyProcessManager] Process ${processId} still running, stopping...`);
              await withTimeout(
                execAsync(`kill -TERM ${processId} 2>/dev/null || kill -9 ${processId} 2>/dev/null || true`),
                2000,
                'Kill process by PID'
              );
            }
          } catch (err) {
            // 进程可能已经不存在，忽略错误
            console.log(`[ProxyProcessManager] Process ${processId} check result:`, err.message);
          }
        }
      }
      
    } catch (err) {
      console.error('[ProxyProcessManager] Error stopping processes:', err);
      // 即使出错也继续，尝试停止主进程
      if (processId) {
        try {
          await withTimeout(
            execAsync(`kill -9 ${processId} 2>/dev/null || true`),
            2000,
            'Force kill main process'
          );
        } catch (e) {
          // 忽略错误
          console.log(`[ProxyProcessManager] Force kill main process result:`, e.message);
        }
      }
    }
    
      // 更新数据库状态（无论停止是否成功，都更新状态）
      console.log(`[ProxyProcessManager] Updating database status to stopped...`);
      try {
        await ProxyServiceModel.update(serviceId, {
          status: 'stopped',
          processId: -1  // 停止时设置为 -1，表示没有进程运行
        });
        console.log(`[ProxyProcessManager] Database status updated to stopped for service ${serviceId}`);
      } catch (err) {
        console.error(`[ProxyProcessManager] Error updating database status:`, err);
        // 即使数据库更新失败，也不抛出错误，因为进程可能已经停止
      }
      
      console.log(`[ProxyProcessManager] ========== stopService END for service ${serviceId} ==========`);
    } catch (err) {
      console.error(`[ProxyProcessManager] ========== stopService ERROR for service ${serviceId}:`, err);
      // 即使出错，也尝试更新数据库状态
      try {
        await ProxyServiceModel.update(serviceId, {
          status: 'stopped',
          processId: -1
        });
        console.log(`[ProxyProcessManager] Database status updated to stopped after error`);
      } catch (updateErr) {
        console.error(`[ProxyProcessManager] Error updating database status after error:`, updateErr);
      }
      throw err;
    }
  }
}

module.exports = new ProxyProcessManager();


