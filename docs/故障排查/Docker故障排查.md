# Docker故障排查指南

## 一、常见问题及解决方案

### 1.1 容器无法启动

#### 问题描述
容器启动后立即退出，或无法正常启动。

#### 排查步骤

1. **查看容器日志**
   ```bash
   docker logs socks-proxy
   docker logs --tail 100 socks-proxy
   ```

2. **检查容器状态**
   ```bash
   docker ps -a | grep socks-proxy
   docker inspect socks-proxy | grep -A 10 State
   ```

3. **检查数据目录权限**
   ```bash
   ls -la ./data/
   chmod 755 ./data/database
   chmod 700 ./data/ssh-keys
   ```

4. **检查端口占用**
   ```bash
   netstat -tuln | grep -E "(8090|11081|11082|11083)"
   # 或
   ss -tuln | grep -E "(8090|11081|11082|11083)"
   ```

5. **检查环境变量**
   ```bash
   docker inspect socks-proxy | grep -A 20 Env
   ```

#### 常见原因及解决方案

| 原因 | 解决方案 |
|------|----------|
| 端口被占用 | 修改端口映射或停止占用端口的服务 |
| 数据目录权限错误 | 设置正确的目录权限：`chmod 755 ./data/database` |
| 环境变量缺失 | 确保设置了 `PROXY_HOST` 环境变量 |
| 镜像不存在 | 重新构建镜像：`./build.sh --host <IP>` |
| 磁盘空间不足 | 清理磁盘空间：`df -h` |

### 1.2 服务无响应

#### 问题描述
容器运行正常，但无法访问Web界面或API。

#### 排查步骤

1. **检查容器状态**
   ```bash
   docker ps | grep socks-proxy
   docker exec socks-proxy ps aux | grep -E "nginx|node"
   ```

2. **检查端口监听**
   ```bash
   docker exec socks-proxy netstat -tlnp | grep -E "(8090|3000)"
   # 或
   docker exec socks-proxy ss -tlnp | grep -E "(8090|3000)"
   ```

3. **检查健康检查端点**
   ```bash
   curl http://192.168.1.4:8090/health
   curl http://192.168.1.4:8090/ready
   ```

4. **查看应用日志**
   ```bash
   docker logs socks-proxy
   tail -f ./data/logs/nodejs.log
   tail -f ./data/logs/nginx.log
   ```

5. **检查防火墙设置**
   ```bash
   # Ubuntu/Debian
   sudo ufw status
   
   # CentOS/RHEL
   sudo firewall-cmd --list-all
   ```

#### 常见原因及解决方案

| 原因 | 解决方案 |
|------|----------|
| Nginx未启动 | 检查supervisor日志：`tail -f ./data/logs/supervisord.log` |
| Node.js服务崩溃 | 查看Node.js错误日志：`tail -f ./data/logs/nodejs.error.log` |
| 端口映射错误 | 检查端口映射：`docker port socks-proxy` |
| 防火墙阻止 | 开放端口：`sudo ufw allow 8090` |
| 网络配置问题 | 检查Docker网络：`docker network ls` |

### 1.3 数据库问题

#### 问题描述
数据库初始化失败、数据库连接错误、数据丢失等。

#### 排查步骤

1. **检查数据库文件**
   ```bash
   ls -lh ./data/database/
   file ./data/database/database.db
   ```

2. **检查数据库权限**
   ```bash
   ls -la ./data/database/
   chmod 644 ./data/database/database.db
   ```

3. **检查数据库完整性**
   ```bash
   docker exec -it socks-proxy sqlite3 /data/database/database.db "PRAGMA integrity_check;"
   ```

4. **查看数据库日志**
   ```bash
   docker logs socks-proxy | grep -i database
   tail -f ./data/logs/nodejs.log | grep -i database
   ```

5. **检查数据库迁移**
   ```bash
   docker exec -it socks-proxy sqlite3 /data/database/database.db "SELECT * FROM schema_migrations;"
   ```

#### 常见原因及解决方案

| 原因 | 解决方案 |
|------|----------|
| 数据库文件损坏 | 从备份恢复：`cp ./data/backups/database_*.db ./data/database/database.db` |
| 权限不足 | 设置正确权限：`chmod 644 ./data/database/database.db` |
| 磁盘空间不足 | 清理磁盘空间 |
| 迁移失败 | 检查迁移脚本，手动执行迁移 |
| 数据库锁定 | 重启容器：`docker restart socks-proxy` |

### 1.4 升级失败

#### 问题描述
升级过程中出错，新容器无法启动或健康检查失败。

#### 排查步骤

1. **检查新镜像是否存在**
   ```bash
   docker images | grep socks-proxy
   docker inspect socks-proxy:v1.1.0
   ```

2. **查看升级日志**
   ```bash
   # 查看升级脚本输出
   ./scripts/upgrade.sh --new-tag v1.1.0 --host 192.168.1.4 2>&1 | tee upgrade.log
   ```

3. **检查新容器状态**
   ```bash
   docker ps -a | grep socks-proxy
   docker logs <new-container-name>
   ```

4. **检查健康检查端点**
   ```bash
   # 检查新容器的健康状态
   docker exec <new-container-name> curl -s http://localhost:8090/ready
   ```

5. **检查端口冲突**
   ```bash
   # 检查是否有多个容器使用相同端口
   docker ps --format "{{.Names}}\t{{.Ports}}" | grep 8090
   ```

#### 常见原因及解决方案

| 原因 | 解决方案 |
|------|----------|
| 新镜像不存在 | 重新构建镜像：`./build.sh --tag v1.1.0` |
| 健康检查超时 | 增加超时时间或检查服务启动时间 |
| 端口冲突 | 确保旧容器已完全停止 |
| 数据不兼容 | 检查数据库迁移，必要时回滚 |
| 资源不足 | 检查系统资源：`docker stats` |

#### 升级失败处理流程

1. **立即回滚**
   ```bash
   ./scripts/rollback.sh --tag <previous-version> --host 192.168.1.4
   ```

2. **检查备份**
   ```bash
   ls -lh ./data/backups/
   ```

3. **分析失败原因**
   ```bash
   # 查看新容器日志
   docker logs <failed-container-name>
   
   # 查看升级日志
   cat upgrade.log
   ```

4. **修复问题后重试**
   ```bash
   # 修复问题后，重新执行升级
   ./scripts/upgrade.sh --new-tag v1.1.0 --host 192.168.1.4
   ```

### 1.5 回滚失败

#### 问题描述
回滚操作失败，无法恢复到旧版本。

#### 排查步骤

1. **检查回滚镜像是否存在**
   ```bash
   docker images | grep socks-proxy
   ./scripts/rollback.sh --list
   ```

2. **检查当前容器状态**
   ```bash
   docker ps -a | grep socks-proxy
   ```

3. **查看回滚日志**
   ```bash
   ./scripts/rollback.sh --tag v1.0.0 --host 192.168.1.4 2>&1 | tee rollback.log
   ```

4. **手动回滚**
   ```bash
   # 停止当前容器
   docker stop socks-proxy
   docker rm socks-proxy
   
   # 启动旧版本容器
   docker run -d \
     --name socks-proxy \
     -p 8090:8090 \
     -p 11081:11081 \
     -p 11082:11082 \
     -p 11083:11083 \
     -v $(pwd)/data/database:/data/database \
     -v $(pwd)/data/ssh-keys:/data/ssh-keys \
     -v $(pwd)/data/logs:/data/logs \
     -v $(pwd)/data/pac:/data/pac \
     -e PROXY_HOST=192.168.1.4 \
     -e PROXY_PORT=8090 \
     -e NODE_ENV=production \
     socks-proxy:v1.0.0
   ```

#### 常见原因及解决方案

| 原因 | 解决方案 |
|------|----------|
| 回滚镜像不存在 | 重新构建旧版本镜像或从仓库拉取 |
| 健康检查失败 | 检查旧版本的 `/health` 端点（旧版本可能不支持 `/ready`） |
| 数据不兼容 | 恢复备份数据：`cp ./data/backups/database_*.db ./data/database/database.db` |
| 端口冲突 | 确保当前容器已完全停止 |

## 二、日志查看方法

### 2.1 容器日志

```bash
# 查看所有日志
docker logs socks-proxy

# 实时查看日志
docker logs -f socks-proxy

# 查看最近100行
docker logs --tail 100 socks-proxy

# 查看指定时间后的日志
docker logs --since 2024-01-15T10:00:00 socks-proxy

# 查看指定时间范围的日志
docker logs --since 2024-01-15T10:00:00 --until 2024-01-15T11:00:00 socks-proxy
```

### 2.2 应用日志

```bash
# Node.js应用日志
tail -f ./data/logs/nodejs.log
tail -f ./data/logs/nodejs.error.log

# Nginx日志
tail -f ./data/logs/nginx.log
tail -f ./data/logs/nginx.error.log

# Supervisor日志
tail -f ./data/logs/supervisord.log

# 查看所有日志
tail -f ./data/logs/*.log
```

### 2.3 系统日志

```bash
# Docker守护进程日志（systemd）
sudo journalctl -u docker.service -f

# 系统日志
sudo journalctl -f

# 查看特定服务的日志
sudo journalctl -u docker -n 100
```

## 三、调试技巧

### 3.1 进入容器调试

```bash
# 进入容器
docker exec -it socks-proxy bash

# 在容器内执行命令
docker exec socks-proxy ps aux
docker exec socks-proxy netstat -tlnp
docker exec socks-proxy curl http://localhost:8090/health
```

### 3.2 检查服务状态

```bash
# 检查进程
docker exec socks-proxy ps aux | grep -E "nginx|node|supervisor"

# 检查端口监听
docker exec socks-proxy netstat -tlnp
docker exec socks-proxy ss -tlnp

# 检查环境变量
docker exec socks-proxy env | grep -E "PROXY|NODE|DB"

# 检查文件权限
docker exec socks-proxy ls -la /data/
docker exec socks-proxy ls -la /app/
```

### 3.3 网络调试

```bash
# 测试容器内网络
docker exec socks-proxy curl http://localhost:3000/health
docker exec socks-proxy curl http://localhost:8090/health

# 测试外部访问
curl http://192.168.1.4:8090/health
curl http://192.168.1.4:8090/ready

# 检查端口映射
docker port socks-proxy

# 检查Docker网络
docker network inspect bridge
```

### 3.4 数据库调试

```bash
# 进入容器并连接数据库
docker exec -it socks-proxy sqlite3 /data/database/database.db

# 在SQLite中执行命令
.tables
.schema users
SELECT * FROM users LIMIT 5;
SELECT * FROM schema_migrations;
PRAGMA integrity_check;
.quit
```

### 3.5 性能调试

```bash
# 查看容器资源使用
docker stats socks-proxy

# 查看容器详细信息
docker inspect socks-proxy

# 查看镜像大小
docker images socks-proxy

# 查看容器层信息
docker history socks-proxy:latest
```

## 四、升级失败处理

### 4.1 升级失败场景

#### 场景1：新容器启动失败

**症状**：新容器无法启动或立即退出

**处理步骤**：
1. 查看新容器日志：`docker logs <new-container-name>`
2. 检查镜像是否正确构建
3. 检查数据目录权限
4. 如果问题无法快速解决，立即回滚

#### 场景2：健康检查超时

**症状**：新容器启动但健康检查一直失败

**处理步骤**：
1. 检查新容器内的服务状态
2. 手动测试健康检查端点
3. 检查数据库连接
4. 如果超时，回滚到旧版本

#### 场景3：端口冲突

**症状**：新容器无法启动，提示端口已被占用

**处理步骤**：
1. 确保旧容器已完全停止：`docker stop <old-container> && docker rm <old-container>`
2. 检查端口占用：`netstat -tuln | grep 8090`
3. 重新执行升级

#### 场景4：数据迁移失败

**症状**：新容器启动但数据库迁移失败

**处理步骤**：
1. 查看迁移日志
2. 检查数据库备份
3. 手动执行迁移脚本
4. 如果无法修复，回滚并恢复备份

### 4.2 升级失败恢复流程

```bash
# 1. 立即停止升级过程
docker stop <new-container-name>
docker rm <new-container-name>

# 2. 检查旧容器状态
docker ps -a | grep socks-proxy

# 3. 如果旧容器还在，重启它
docker start <old-container-name>

# 4. 如果旧容器已删除，执行回滚
./scripts/rollback.sh --tag <previous-version> --host 192.168.1.4

# 5. 验证服务恢复
curl http://192.168.1.4:8090/health
curl http://192.168.1.4:8090/api/version

# 6. 分析失败原因
docker logs <failed-container-name>
cat upgrade.log
```

## 五、回滚操作指南

### 5.1 回滚前检查

1. **确认回滚版本**
   ```bash
   ./scripts/rollback.sh --list
   ```

2. **检查数据备份**
   ```bash
   ls -lh ./data/backups/
   ```

3. **确认当前版本**
   ```bash
   curl http://192.168.1.4:8090/api/version | jq .
   ```

### 5.2 执行回滚

```bash
# 基本回滚
./scripts/rollback.sh --tag v1.0.0 --host 192.168.1.4

# 指定容器名称
./scripts/rollback.sh --tag v1.0.0 --container socks-proxy --host 192.168.1.4
```

### 5.3 回滚后验证

```bash
# 检查容器状态
docker ps | grep socks-proxy

# 检查版本信息
curl http://192.168.1.4:8090/api/version | jq .

# 检查健康状态
curl http://192.168.1.4:8090/health
curl http://192.168.1.4:8090/ready

# 测试核心功能
# 访问Web界面，测试登录、代理服务等功能
```

### 5.4 回滚失败处理

如果回滚脚本失败，可以手动回滚：

```bash
# 1. 停止当前容器
docker stop socks-proxy
docker rm socks-proxy

# 2. 启动旧版本容器
docker run -d \
  --name socks-proxy \
  -p 8090:8090 \
  -p 11081:11081 \
  -p 11082:11082 \
  -v $(pwd)/data/database:/data/database \
  -v $(pwd)/data/ssh-keys:/data/ssh-keys \
  -v $(pwd)/data/logs:/data/logs \
  -v $(pwd)/data/pac:/data/pac \
  -e PROXY_HOST=192.168.1.4 \
  -e PROXY_PORT=8090 \
  -e NODE_ENV=production \
  socks-proxy:v1.0.0

# 3. 等待容器启动
sleep 10

# 4. 验证服务
curl http://192.168.1.4:8090/health
```

## 六、预防措施

### 6.1 升级前准备

1. **测试环境验证**：在测试环境先测试升级流程
2. **数据备份**：升级前确保数据已备份
3. **版本检查**：确认新版本镜像已正确构建
4. **资源检查**：确保有足够的磁盘空间和内存

### 6.2 监控和告警

1. **健康检查监控**：定期检查健康检查端点
2. **日志监控**：监控应用日志，及时发现异常
3. **资源监控**：监控容器资源使用情况
4. **版本管理**：保留最近几个版本的镜像

### 6.3 最佳实践

1. **使用版本标签**：使用语义化版本标签（v1.0.0）
2. **保留旧镜像**：保留最近3-5个版本的镜像
3. **定期备份**：设置自动备份任务
4. **文档记录**：记录每次升级的版本、时间和遇到的问题
5. **测试验证**：升级后立即验证核心功能

## 七、获取帮助

如果以上方法无法解决问题，请：

1. **收集信息**
   - 容器日志：`docker logs socks-proxy > container.log`
   - 应用日志：`tar -czf logs.tar.gz ./data/logs/`
   - 系统信息：`docker info > docker-info.txt`
   - 版本信息：`curl http://192.168.1.4:8090/api/version > version.json`

2. **查看文档**
   - 部署文档：`docs/部署文档/Docker部署指南.md`
   - 使用手册：`docs/使用手册/Docker使用手册.md`

3. **联系支持**
   - 提交Issue（附上收集的信息）
   - 联系技术支持团队

