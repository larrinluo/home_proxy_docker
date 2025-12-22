# Docker部署指南

## 一、环境要求

### 1.1 系统要求

- **操作系统**：Linux（推荐 Ubuntu 20.04+ 或 CentOS 7+）
- **Docker版本**：Docker 20.10+ 或 Docker Compose 1.29+
- **硬件要求**：
  - CPU：1核心以上
  - 内存：512MB以上
  - 磁盘：2GB以上可用空间

### 1.2 网络要求

- 确保端口 8090、11081、11082、11083 未被占用
- 如需访问外部SSH服务器，确保网络连通

## 二、构建步骤

### 2.1 使用build.sh脚本构建（推荐）

```bash
# 自动检测IP并构建
./build.sh

# 指定参数构建
./build.sh --host 192.168.1.4 --port 8090

# 构建并运行
./build.sh --host 192.168.1.4 --run

# 指定版本标签
./build.sh --host 192.168.1.4 --tag v1.0.0 --run
```

### 2.2 手动构建

```bash
# 构建镜像
docker build \
  --build-arg PROXY_HOST=192.168.1.4 \
  --build-arg PROXY_PORT=8090 \
  --build-arg APP_VERSION=1.0.0 \
  --build-arg BUILD_DATE=$(date +%Y%m%d_%H%M%S) \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  -t socks-proxy:latest .

# 查看镜像信息
docker images socks-proxy:latest
```

## 三、运行步骤

### 3.1 使用build.sh运行

```bash
# 构建并运行
./build.sh --host 192.168.1.4 --run
```

### 3.2 使用docker run运行

```bash
# 创建数据目录
mkdir -p ./data/{database,ssh-keys,logs,pac,backups}
chmod 700 ./data/ssh-keys

# 运行容器
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
  socks-proxy:latest
```

### 3.3 使用docker-compose运行

```bash
# 设置环境变量
export PROXY_HOST=192.168.1.4
export PROXY_PORT=8090

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 四、配置说明

### 4.1 环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| PROXY_HOST | 代理服务地址 | - | 是 |
| PROXY_PORT | 代理服务端口 | 8090 | 否 |
| NODE_ENV | 运行环境 | production | 否 |
| DB_PATH | 数据库路径 | /data/database/database.db | 否 |
| SESSION_SECRET | 会话密钥 | - | 否 |
| CORS_ORIGIN | 允许的跨域源（支持逗号分隔多个值） | 自动根据 PROXY_HOST 和 PROXY_PORT 生成 | 否 |

**CORS 配置说明**：
- 系统会根据 `PROXY_HOST` 和 `PROXY_PORT` 自动生成允许的 Origin（格式：`http://PROXY_HOST:PROXY_PORT`）
- 如需额外配置允许的源，可通过 `CORS_ORIGIN` 环境变量设置，支持逗号分隔多个值
- 示例：`CORS_ORIGIN=http://example.com:8090,http://other.com:8090`
- 生产环境中，通过 nginx 代理的同源请求会自动允许

### 4.2 端口映射

| 容器端口 | 主机端口 | 说明 |
|----------|----------|------|
| 8090 | 8090 | Web界面和API |
| 11081 | 11081 | 代理服务端口1 |
| 11082 | 11082 | 代理服务端口2 |
| 11083 | 11083 | 代理服务端口3 |

### 4.3 数据目录

| 目录 | 说明 | 权限 |
|------|------|------|
| /data/database | 数据库文件 | 755 |
| /data/ssh-keys | SSH密钥 | 700 |
| /data/logs | 日志文件 | 755 |
| /data/pac | PAC配置文件 | 755 |

## 五、热升级步骤

### 5.1 热升级架构说明

本系统支持零停机时间的滚动更新，升级过程包括：

1. **优雅关闭**：旧容器接收SIGTERM信号后，等待正在处理的请求完成
2. **健康检查**：新容器启动后，通过健康检查确保服务就绪
3. **流量切换**：新容器就绪后，停止旧容器，实现平滑切换
4. **数据保留**：所有数据通过Volume挂载，升级后自动保留
5. **自动备份**：升级前自动备份数据库和配置

### 5.2 升级前准备

1. **检查当前版本**
   ```bash
   curl http://192.168.1.4:8090/api/version
   ```

2. **构建新版本镜像**
   ```bash
   # 使用build.sh构建（推荐）
   ./build.sh --host 192.168.1.4 --tag v1.1.0 --version 1.1.0
   
   # 或手动构建
   docker build \
     --build-arg PROXY_HOST=192.168.1.4 \
     --build-arg PROXY_PORT=8090 \
     --build-arg APP_VERSION=1.1.0 \
     --build-arg BUILD_DATE=$(date +%Y%m%d_%H%M%S) \
     --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
     -t socks-proxy:v1.1.0 .
   ```

3. **检查新版本信息**
   ```bash
   docker inspect socks-proxy:v1.1.0 | grep -A 5 Labels
   ```

4. **验证新镜像**
   ```bash
   docker images socks-proxy:v1.1.0
   ```

### 5.3 执行升级

使用升级脚本执行滚动更新：

```bash
# 基本用法
./scripts/upgrade.sh --new-tag v1.1.0 --host 192.168.1.4

# 指定容器名称
./scripts/upgrade.sh --new-tag v1.1.0 --container socks-proxy --host 192.168.1.4

# 跳过自动备份（不推荐）
./scripts/upgrade.sh --new-tag v1.1.0 --no-backup --host 192.168.1.4
```

升级脚本执行流程：

1. **自动备份数据**（除非使用 `--no-backup`）
   - 备份数据库到 `./data/backups/`
   - 备份SSH密钥和PAC配置

2. **停止旧容器**
   - 发送SIGTERM信号，等待优雅关闭
   - 移除旧容器

3. **启动新容器**
   - 使用临时名称启动新容器
   - 挂载相同的数据卷

4. **健康检查**
   - 等待新容器就绪（检查 `/ready` 端点）
   - 超时时间：60秒（可通过环境变量调整）

5. **完成升级**
   - 重命名新容器为正式名称
   - 显示升级结果

### 5.4 验证升级

```bash
# 检查容器状态
docker ps | grep socks-proxy

# 检查版本信息
curl http://192.168.1.4:8090/api/version | jq .

# 检查健康状态
curl http://192.168.1.4:8090/health
curl http://192.168.1.4:8090/ready

# 检查服务功能
# 访问Web界面，测试核心功能是否正常
```

### 5.5 回滚（如需要）

如果升级后出现问题，可以快速回滚：

```bash
# 列出可用版本
./scripts/rollback.sh --list

# 回滚到指定版本
./scripts/rollback.sh --tag v1.0.0 --host 192.168.1.4

# 指定容器名称
./scripts/rollback.sh --tag v1.0.0 --container socks-proxy --host 192.168.1.4
```

回滚流程：

1. 停止当前容器
2. 启动指定版本的容器
3. 等待健康检查通过（支持 `/ready` 和 `/health` 端点）
4. 验证回滚成功

**注意**：回滚会保留当前数据，确保数据兼容性。

## 六、验证部署

### 6.1 健康检查

```bash
# 存活检查
curl http://192.168.1.4:8090/health

# 就绪检查
curl http://192.168.1.4:8090/ready

# 版本信息
curl http://192.168.1.4:8090/api/version
```

### 6.2 访问Web界面

在浏览器中访问：
- Web界面：`http://192.168.1.4:8090`
- PAC文件：`http://192.168.1.4:8090/proxy.pac`

### 6.3 查看日志

```bash
# 查看容器日志
docker logs -f socks-proxy

# 查看应用日志
tail -f ./data/logs/nodejs.log
tail -f ./data/logs/nginx.log
tail -f ./data/logs/supervisord.log
```

## 七、常见问题

### 7.1 容器无法启动

**问题**：容器启动后立即退出

**解决方案**：
1. 查看容器日志：`docker logs socks-proxy`
2. 检查数据目录权限
3. 检查端口是否被占用
4. 检查环境变量配置

### 7.2 数据库初始化失败

**问题**：数据库初始化错误

**解决方案**：
1. 检查数据目录权限：`chmod 755 ./data/database`
2. 删除旧数据库文件重新初始化
3. 查看日志：`docker logs socks-proxy`

### 7.3 无法访问Web界面

**问题**：浏览器无法访问

**解决方案**：
1. 检查防火墙设置
2. 检查端口映射：`docker ps`
3. 检查容器状态：`docker ps -a`
4. 查看nginx日志：`tail -f ./data/logs/nginx.log`

### 7.4 升级失败

**问题**：升级过程中出错

**解决方案**：
1. 检查新镜像是否存在：`docker images`
2. 检查健康检查URL是否可访问
3. 查看升级日志
4. 使用回滚脚本恢复：`./scripts/rollback.sh --tag <old-version>`

## 八、维护操作

### 8.1 数据备份

```bash
# 手动备份
./scripts/backup.sh

# 备份文件位置
ls -lh ./data/backups/
```

### 8.2 日志清理

```bash
# 清理旧日志（保留最近7天）
find ./data/logs -name "*.log" -mtime +7 -delete
```

### 8.3 容器重启

```bash
# 重启容器
docker restart socks-proxy

# 停止容器
docker stop socks-proxy

# 启动容器
docker start socks-proxy
```

## 九、多架构支持

### 9.1 构建x86镜像

```bash
docker buildx build --platform linux/amd64 -t socks-proxy:amd64 --load .
```

### 9.2 构建arm64镜像

```bash
docker buildx build --platform linux/arm64 -t socks-proxy:arm64 --load .
```

### 9.3 创建多架构清单

```bash
docker manifest create socks-proxy:latest \
  --amend socks-proxy:amd64 \
  --amend socks-proxy:arm64
```

## 十、安全建议

1. **修改默认会话密钥**：设置 `SESSION_SECRET` 环境变量
2. **限制网络访问**：使用防火墙限制端口访问
3. **定期更新**：及时更新到最新版本
4. **数据备份**：定期备份重要数据
5. **日志监控**：定期检查日志文件

## 十一、技术支持

如遇到问题，请：
1. 查看日志文件
2. 参考故障排查文档：`docs/故障排查/Docker故障排查.md`
3. 检查GitHub Issues
4. 联系技术支持






