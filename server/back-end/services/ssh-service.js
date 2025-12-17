const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { Client } = require('ssh2');
require('dotenv').config();

const execAsync = promisify(exec);

const SSH_KEYS_DIR = process.env.SSH_KEYS_DIR || './data/ssh-keys';

/**
 * SSH服务
 */
class SSHService {
  /**
   * 确保SSH密钥目录存在
   */
  async ensureKeysDirectory() {
    try {
      await fs.mkdir(SSH_KEYS_DIR, { recursive: true, mode: 0o700 });
    } catch (error) {
      console.error('Failed to create SSH keys directory:', error);
      throw error;
    }
  }

  /**
   * 生成SSH密钥对
   * @param {string} keyName - 密钥名称（用于文件名）
   * @returns {Promise<{privateKeyPath: string, publicKeyPath: string, publicKey: string}>}
   */
  async generateKeyPair(keyName) {
    try {
      // 确保目录存在
      await this.ensureKeysDirectory();

      const privateKeyPath = path.join(SSH_KEYS_DIR, `${keyName}`);
      const publicKeyPath = `${privateKeyPath}.pub`;

      // 检查密钥是否已存在
      try {
        await fs.access(privateKeyPath);
        throw new Error(`SSH key ${keyName} already exists`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // 生成SSH密钥对（RSA 2048位）
      const command = `ssh-keygen -t rsa -b 2048 -f "${privateKeyPath}" -N "" -C "socks-proxy-${keyName}"`;
      await execAsync(command);

      // 设置文件权限
      await fs.chmod(privateKeyPath, 0o600); // 私钥：600
      await fs.chmod(publicKeyPath, 0o644); // 公钥：644

      // 读取公钥内容
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');

      return {
        privateKeyPath,
        publicKeyPath,
        publicKey: publicKey.trim()
      };
    } catch (error) {
      console.error('Failed to generate SSH key pair:', error);
      throw error;
    }
  }

  /**
   * 删除SSH密钥对
   * @param {string} keyName - 密钥名称
   */
  async deleteKeyPair(keyName) {
    try {
      const privateKeyPath = path.join(SSH_KEYS_DIR, `${keyName}`);
      const publicKeyPath = `${privateKeyPath}.pub`;

      // 删除私钥
      try {
        await fs.unlink(privateKeyPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // 删除公钥
      try {
        await fs.unlink(publicKeyPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to delete SSH key pair:', error);
      throw error;
    }
  }

  /**
   * 读取公钥内容
   * @param {string} keyName - 密钥名称
   * @returns {Promise<string>}
   */
  async getPublicKey(keyName) {
    try {
      const publicKeyPath = path.join(SSH_KEYS_DIR, `${keyName}.pub`);
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      return publicKey.trim();
    } catch (error) {
      console.error('Failed to read public key:', error);
      throw error;
    }
  }

  /**
   * 推送公钥到跳板服务器
   * @param {Object} options - 连接选项
   * @param {string} options.host - 跳板服务器地址
   * @param {number} options.port - 跳板服务器端口
   * @param {string} options.username - 跳板服务器用户名
   * @param {string} options.password - 跳板服务器密码
   * @param {string} options.publicKey - 公钥内容
   * @param {Function} options.onLog - 日志回调函数 (可选)
   * @returns {Promise<void>}
   */
  async pushPublicKey(options) {
    const { host, port = 22, username, password, publicKey, onLog } = options;

    const log = (level, message) => {
      if (onLog) {
        onLog(level, message);
      } else {
        console.log(`[${level}] ${message}`);
      }
    };

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let connectionEstablished = false;

      conn.on('ready', () => {
        connectionEstablished = true;
        log('INFO', `✅ SSH连接已建立`);
        
        // 先获取用户主目录的绝对路径
        log('INFO', `[步骤 3.1] 获取用户主目录路径...`);
        conn.exec('echo $HOME', (err, stream) => {
          if (err) {
            log('ERROR', `❌ 获取主目录失败: ${err.message}`);
            conn.end();
            return reject(err);
          }

          let homeDir = '';
          stream.on('data', (data) => {
            homeDir += data.toString().trim();
          });

          stream.stderr.on('data', (data) => {
            // 忽略stderr
          });

          stream.on('close', (code) => {
            if (code !== 0 || !homeDir) {
              log('WARNING', `无法获取主目录，使用默认路径 ~/.ssh`);
              homeDir = '~';
            }
            
            const sshDir = `${homeDir}/.ssh`;
            const authorizedKeysPath = `${sshDir}/authorized_keys`;
            
            log('SUCCESS', `✅ 主目录路径: ${homeDir}`);
            log('INFO', `SSH目录路径: ${sshDir}`);
            log('INFO', `authorized_keys路径: ${authorizedKeysPath}`);
            
            // 确保.ssh目录存在
            log('INFO', `[步骤 3.2] 创建.ssh目录: mkdir -p ${sshDir} && chmod 700 ${sshDir}`);
            conn.exec(`mkdir -p ${sshDir} && chmod 700 ${sshDir}`, (err, stream) => {
              if (err) {
                log('ERROR', `❌ 创建.ssh目录失败: ${err.message}`);
                conn.end();
                return reject(err);
              }

              let stdout = '';
              let stderr = '';

              stream.on('data', (data) => {
                stdout += data.toString();
              });

              stream.stderr.on('data', (data) => {
                stderr += data.toString();
              });

              stream.on('close', (code) => {
                if (code !== 0 && stderr) {
                  log('WARNING', `命令执行警告: ${stderr.trim()}`);
                }
                log('SUCCESS', `✅ .ssh目录已创建/确认存在`);
                
                // 读取authorized_keys文件
                log('INFO', `[步骤 3.3] 建立SFTP连接...`);
                conn.sftp((err, sftp) => {
                  if (err) {
                    log('ERROR', `❌ SFTP连接失败: ${err.message}`);
                    conn.end();
                    return reject(err);
                  }
                  log('SUCCESS', `✅ SFTP连接已建立`);

                  log('INFO', `[步骤 3.4] 读取authorized_keys文件: ${authorizedKeysPath}`);
                  sftp.readFile(authorizedKeysPath, (err, data) => {
                    let authorizedKeys = '';
                    if (!err && data) {
                      authorizedKeys = data.toString();
                      log('SUCCESS', `✅ 已读取现有authorized_keys文件 (${authorizedKeys.split('\n').filter(k => k.trim()).length} 个密钥)`);
                    } else {
                      log('INFO', `authorized_keys文件不存在，将创建新文件`);
                    }

                    // 检查公钥是否已存在
                    const keyFingerprint = publicKey.trim().split(' ')[1] || 'unknown';
                    if (authorizedKeys.includes(publicKey.trim())) {
                      log('INFO', `公钥已存在于authorized_keys中 (指纹: ${keyFingerprint.substring(0, 20)}...)`);
                      conn.end();
                      return resolve(); // 公钥已存在，直接返回
                    }

                    // 追加公钥
                    log('INFO', `[步骤 3.5] 追加公钥到authorized_keys (指纹: ${keyFingerprint.substring(0, 20)}...)`);
                    authorizedKeys += (authorizedKeys ? '\n' : '') + publicKey.trim() + '\n';

                    // 写入authorized_keys文件
                    log('INFO', `[步骤 3.6] 写入文件: ${authorizedKeysPath}`);
                    sftp.writeFile(authorizedKeysPath, authorizedKeys, (err) => {
                      if (err) {
                        log('ERROR', `❌ 写入authorized_keys失败: ${err.message}`);
                        log('INFO', `尝试使用touch命令创建文件...`);
                        // 如果写入失败，尝试先创建文件
                        conn.exec(`touch ${authorizedKeysPath} && chmod 600 ${authorizedKeysPath}`, (err, touchStream) => {
                          if (err) {
                            log('ERROR', `❌ 创建文件失败: ${err.message}`);
                            conn.end();
                            return reject(err);
                          }
                          
                          touchStream.on('close', (touchCode) => {
                            if (touchCode !== 0) {
                              log('ERROR', `❌ touch命令执行失败`);
                              conn.end();
                              return reject(new Error('无法创建authorized_keys文件'));
                            }
                            
                            // 再次尝试写入
                            log('INFO', `文件已创建，重新写入...`);
                            sftp.writeFile(authorizedKeysPath, authorizedKeys, (err2) => {
                              if (err2) {
                                log('ERROR', `❌ 写入authorized_keys失败: ${err2.message}`);
                                conn.end();
                                return reject(err2);
                              }
                              
                              log('SUCCESS', `✅ 公钥已成功添加到authorized_keys`);
                              conn.end();
                              resolve();
                            });
                          });
                        });
                        return;
                      }

                      // 设置文件权限
                      log('SUCCESS', `✅ authorized_keys文件写入成功`);
                      log('INFO', `[步骤 3.7] 设置文件权限: chmod 600 ${authorizedKeysPath}`);
                      
                      // 设置chmod命令超时（10秒）
                      const chmodTimeout = setTimeout(() => {
                        log('ERROR', `❌ chmod命令执行超时（10秒）`);
                        log('INFO', `当前步骤: 设置authorized_keys文件权限`);
                        log('INFO', `可能原因:`);
                        log('INFO', `  - 跳板服务器响应缓慢`);
                        log('INFO', `  - 网络连接不稳定`);
                        log('INFO', `  - 文件权限问题`);
                        log('INFO', `  - SSH连接可能已断开`);
                        log('INFO', `建议:`);
                        log('INFO', `  - 检查跳板服务器状态`);
                        log('INFO', `  - 检查网络连接`);
                        log('INFO', `  - 尝试手动执行: chmod 600 ${authorizedKeysPath}`);
                        log('INFO', `  - 检查文件是否已创建: ls -la ${authorizedKeysPath}`);
                        conn.end();
                        reject(new Error('chmod命令执行超时'));
                      }, 10000);
                      
                      conn.exec(`chmod 600 ${authorizedKeysPath}`, (err, stream) => {
                        if (err) {
                          clearTimeout(chmodTimeout);
                          log('ERROR', `❌ 设置文件权限失败: ${err.message}`);
                          conn.end();
                          return reject(err);
                        }
                        
                        let chmodStdout = '';
                        let chmodStderr = '';
                        
                        stream.on('data', (data) => {
                          chmodStdout += data.toString();
                        });
                        
                        stream.stderr.on('data', (data) => {
                          chmodStderr += data.toString();
                        });
                        
                        stream.on('close', (code) => {
                          clearTimeout(chmodTimeout);
                          
                          if (chmodStdout) {
                            log('INFO', `chmod命令输出: ${chmodStdout.trim()}`);
                          }
                          
                          if (code !== 0) {
                            if (chmodStderr) {
                              log('WARNING', `chmod命令警告: ${chmodStderr.trim()}`);
                            }
                            log('WARNING', `chmod命令退出码: ${code}`);
                            // 即使退出码不为0，也继续执行，因为chmod可能已经成功
                          }
                          
                          log('SUCCESS', `✅ 公钥已成功添加到authorized_keys`);
                          log('INFO', `文件路径: ${authorizedKeysPath}`);
                          log('INFO', `文件权限: 600`);
                          conn.end();
                          resolve();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });

      conn.on('error', (err) => {
        if (!connectionEstablished) {
          log('ERROR', `❌ SSH连接失败: ${err.message}`);
          if (err.code === 'ECONNREFUSED') {
            log('INFO', `原因: 连接被拒绝，请检查服务器地址和端口`);
          } else if (err.code === 'ETIMEDOUT') {
            log('INFO', `原因: 连接超时，请检查网络连接和防火墙设置`);
          } else if (err.message.includes('Authentication')) {
            log('INFO', `原因: 认证失败，请检查用户名和密码`);
          }
        }
        reject(err);
      });

      // 连接服务器
      log('INFO', `正在建立SSH连接...`);
      log('INFO', `连接参数: ${username}@${host}:${port}`);
      conn.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 10000
      });
    });
  }
}

module.exports = new SSHService();

