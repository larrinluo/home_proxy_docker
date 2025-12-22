# Docker使用手册

## 一、build.sh使用说明

### 1.1 基本用法

```bash
# 显示帮助信息
./build.sh --help

# 自动检测IP并构建
./build.sh

# 指定参数构建
./build.sh --host 192.168.1.4 --port 8090

# 构建并运行
./build.sh --host 192.168.1.4 --run
```

### 1.2 参数说明

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| --host | 代理服务地址 | 自动检测 | --host 192.168.1.4 |
| --port | 代理服务端口 | 8090 | --port 8090 |
| --image | 镜像名称 | socks-proxy | --image my-proxy |
| --tag | 镜像标签 | latest | --tag v1.0.0 |
| --container | 容器名称 | socks-proxy | --container my-container |
| --data-dir | 数据目录 | ./data | --data-dir /opt/data |
| --version | 应用版本 | 1.0.0 | --version 1.1.0 |
| --run | 构建后运行 | false | --run |
| --help | 显示帮助 | - | --help |

### 1.3 使用示例

```bash
# 示例1：基础构建
./build.sh --host 192.168.1.4

# 示例2：指定版本构建
./build.sh --host 192.168.1.4 --tag v1.0.0 --version 1.0.0

# 示例3：构建并运行
./build.sh --host 192.168.1.4 --port 8090 --run

# 示例4：自定义数据目录
./build.sh --host 192.168.1.4 --data-dir /opt/socks-proxy/data --run
```

## 二、docker-compose使用说明

### 2.1 基本用法

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

### 2.2 环境变量配置

创建 `.env` 文件：

```bash
PROXY_HOST=192.168.1.4
PROXY_PORT=8090
SESSION_SECRET=your-secret-key-here
```

### 2.3 自定义配置

编辑 `docker-compose.yml` 文件修改：
- 端口映射
- Volume挂载路径
- 环境变量
- 健康检查配置

## 三、环境变量配置

### 3.1 必需环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| PROXY_HOST | 代理服务地址 | 192.168.1.4 |

### 3.2 可选环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PROXY_PORT | 代理服务端口 | 8090 |
| NODE_ENV | 运行环境 | production |
| DB_PATH | 数据库路径 | /data/database/database.db |
| SESSION_SECRET | 会话密钥 | - |
| SHUTDOWN_TIMEOUT | 关闭超时时间（毫秒） | 30000 |

### 3.3 设置方法

**方法1：在docker run命令中设置**
```bash
docker run -e PROXY_HOST=192.168.1.4 -e PROXY_PORT=8090 ...
```

**方法2：在docker-compose.yml中设置**
```yaml
environment:
  - PROXY_HOST=192.168.1.4
  - PROXY_PORT=8090
```

**方法3：使用.env文件**
```bash
# .env
PROXY_HOST=192.168.1.4
PROXY_PORT=8090
```

## 四、数据备份和恢复

### 4.1 数据备份

```bash
# 使用备份脚本
./scripts/backup.sh

# 备份文件位置
ls -lh ./data/backups/
```

备份内容包括：
- 数据库文件（database_YYYYMMDD_HHMMSS.db）
- SSH密钥（ssh-keys_YYYYMMDD_HHMMSS.tar.gz）
- PAC配置（pac_YYYYMMDD_HHMMSS.tar.gz）

### 4.2 数据恢复

**恢复数据库**
```bash
# 停止容器
docker stop socks-proxy

# 恢复数据库
cp ./data/backups/database_20240101_120000.db ./data/database/database.db

# 启动容器
docker start socks-proxy
```

**恢复SSH密钥**
```bash
# 停止容器
docker stop socks-proxy

# 恢复SSH密钥
tar -xzf ./data/backups/ssh-keys_20240101_120000.tar.gz -C ./data/

# 设置权限
chmod 700 ./data/ssh-keys
chmod 600 ./data/ssh-keys/*

# 启动容器
docker start socks-proxy
```

### 4.3 自动备份

可以设置定时任务自动备份：

```bash
# 编辑crontab
crontab -e

# 添加定时任务（每天凌晨2点备份）
0 2 * * * cd /path/to/socks-proxy-docker && ./scripts/backup.sh
```

## 五、升级和回滚操作

### 5.1 升级操作

#### 5.1.1 升级前准备

1. **检查当前版本**
   ```bash
   curl http://192.168.1.4:8090/api/version | jq .
   ```

2. **查看当前容器状态**
   ```bash
   docker ps | grep socks-proxy
   docker inspect socks-proxy | grep -A 5 Labels
   ```

3. **确保数据已备份**（升级脚本会自动备份，但建议手动备份一次）
   ```bash
   ./scripts/backup.sh
   ```

#### 5.1.2 构建新版本镜像

**使用build.sh构建（推荐）**
```bash
# 构建新版本
./build.sh --host 192.168.1.4 --tag v1.1.0 --version 1.1.0

# 验证镜像构建成功
docker images socks-proxy:v1.1.0
```

**手动构建**
```bash
docker build \
  --build-arg PROXY_HOST=192.168.1.4 \
  --build-arg PROXY_PORT=8090 \
  --build-arg APP_VERSION=1.1.0 \
  --build-arg BUILD_DATE=$(date +%Y%m%d_%H%M%S) \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  -t socks-proxy:v1.1.0 .
```

#### 5.1.3 执行升级

**基本用法**
```bash
./scripts/upgrade.sh --new-tag v1.1.0 --host 192.168.1.4
```

**指定容器名称**
```bash
./scripts/upgrade.sh \
  --new-tag v1.1.0 \
  --container socks-proxy \
  --host 192.168.1.4 \
  --port 8090
```

**跳过自动备份**（不推荐，仅在测试环境使用）
```bash
./scripts/upgrade.sh --new-tag v1.1.0 --no-backup --host 192.168.1.4
```

#### 5.1.4 升级流程说明

升级脚本执行以下步骤：

1. **检查新镜像是否存在**
   - 验证指定标签的镜像是否存在
   - 如果不存在，显示错误并退出

2. **自动备份数据**（除非使用 `--no-backup`）
   - 备份数据库到 `./data/backups/database_YYYYMMDD_HHMMSS.db`
   - 备份SSH密钥和PAC配置

3. **停止旧容器**
   - 发送SIGTERM信号，等待优雅关闭
   - 等待容器完全停止
   - 移除旧容器

4. **启动新容器**
   - 使用临时名称启动新容器（格式：`<container-name>-new-<timestamp>`）
   - 挂载相同的数据卷，确保数据保留
   - 使用相同的端口映射和环境变量

5. **健康检查**
   - 等待新容器启动（最多60秒）
   - 检查 `/ready` 端点，确保服务就绪
   - 如果 `/ready` 不可用，自动尝试 `/health` 端点（向后兼容）

6. **完成升级**
   - 重命名新容器为正式名称
   - 显示升级结果和访问地址

#### 5.1.5 验证升级

```bash
# 检查容器状态
docker ps | grep socks-proxy

# 检查版本信息
curl http://192.168.1.4:8090/api/version | jq .

# 检查健康状态
curl http://192.168.1.4:8090/health
curl http://192.168.1.4:8090/ready

# 检查服务功能
# 访问Web界面，测试登录、代理服务创建等核心功能
```

### 5.2 回滚操作

#### 5.2.1 列出可用版本

```bash
./scripts/rollback.sh --list
```

输出示例：
```
Available image versions:
TAG                 CREATED AT              SIZE
v1.1.0              2024-01-15 10:30:00    450MB
v1.0.0              2024-01-10 08:20:00    440MB
latest              2024-01-15 10:30:00    450MB
```

#### 5.2.2 执行回滚

**基本用法**
```bash
./scripts/rollback.sh --tag v1.0.0 --host 192.168.1.4
```

**指定容器名称**
```bash
./scripts/rollback.sh \
  --tag v1.0.0 \
  --container socks-proxy \
  --host 192.168.1.4 \
  --port 8090
```

#### 5.2.3 回滚流程说明

回滚脚本执行以下步骤：

1. **检查回滚镜像是否存在**
   - 验证指定标签的镜像是否存在
   - 如果不存在，显示可用版本列表并退出

2. **停止当前容器**
   - 发送停止信号
   - 等待容器完全停止
   - 移除当前容器

3. **启动回滚容器**
   - 使用指定版本的镜像启动容器
   - 挂载相同的数据卷，保留所有数据
   - 使用相同的端口映射和环境变量

4. **健康检查**
   - 等待容器启动（最多60秒）
   - 优先检查 `/ready` 端点
   - 如果 `/ready` 不可用（旧版本可能不支持），自动尝试 `/health` 端点

5. **完成回滚**
   - 显示回滚结果和访问地址

**注意**：
- 回滚会保留当前数据，确保数据格式兼容
- 如果回滚到旧版本后数据不兼容，可能需要恢复备份

#### 5.2.4 验证回滚

```bash
# 检查容器状态
docker ps | grep socks-proxy

# 检查版本信息
curl http://192.168.1.4:8090/api/version | jq .

# 检查健康状态
curl http://192.168.1.4:8090/health
curl http://192.168.1.4:8090/ready

# 测试核心功能是否正常
```

### 5.3 升级脚本参数

**upgrade.sh参数**
| 参数 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| --image | 镜像名称 | socks-proxy | 否 |
| --new-tag | 新版本标签 | - | **是** |
| --old-tag | 旧版本标签 | latest | 否 |
| --container | 容器名称 | socks-proxy | 否 |
| --host | 代理服务地址 | 自动检测 | 否 |
| --port | 代理服务端口 | 8090 | 否 |
| --no-backup | 升级前不备份 | false | 否 |
| --help | 显示帮助信息 | - | 否 |

**rollback.sh参数**
| 参数 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| --image | 镜像名称 | socks-proxy | 否 |
| --tag | 回滚版本标签 | - | **是** |
| --container | 容器名称 | socks-proxy | 否 |
| --host | 代理服务地址 | 自动检测 | 否 |
| --port | 代理服务端口 | 8090 | 否 |
| --list | 列出可用版本 | - | 否 |
| --help | 显示帮助信息 | - | 否 |

### 5.4 升级最佳实践

1. **测试环境验证**：在测试环境先测试升级流程
2. **备份数据**：升级前确保数据已备份
3. **版本检查**：升级后立即验证版本信息
4. **功能测试**：升级后测试核心功能是否正常
5. **保留旧镜像**：保留最近几个版本的镜像，方便回滚
6. **监控日志**：升级后监控日志，确保无异常
7. **文档记录**：记录升级时间、版本和遇到的问题

## 六、日志管理

### 6.1 查看日志

**容器日志**
```bash
# 查看所有日志
docker logs socks-proxy

# 实时查看日志
docker logs -f socks-proxy

# 查看最近100行
docker logs --tail 100 socks-proxy
```

**应用日志**
```bash
# Node.js日志
tail -f ./data/logs/nodejs.log
tail -f ./data/logs/nodejs.error.log

# Nginx日志
tail -f ./data/logs/nginx.log
tail -f ./data/logs/nginx.error.log

# Supervisor日志
tail -f ./data/logs/supervisord.log
```

### 6.2 日志清理

```bash
# 清理7天前的日志
find ./data/logs -name "*.log" -mtime +7 -delete

# 清理所有日志（谨慎使用）
rm -f ./data/logs/*.log
```

### 6.3 日志轮转

可以配置logrotate进行日志轮转：

```bash
# /etc/logrotate.d/socks-proxy
/path/to/socks-proxy-docker/data/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

## 七、性能优化

### 7.1 资源限制

在docker-compose.yml中添加资源限制：

```yaml
services:
  socks-proxy:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 7.2 日志优化

限制日志大小：

```yaml
services:
  socks-proxy:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 八、监控和维护

### 8.1 健康检查

```bash
# 存活检查
curl http://192.168.1.4:8090/health

# 就绪检查
curl http://192.168.1.4:8090/ready

# 版本信息
curl http://192.168.1.4:8090/api/version
```

### 8.2 容器状态

```bash
# 查看容器状态
docker ps | grep socks-proxy

# 查看容器详细信息
docker inspect socks-proxy

# 查看资源使用
docker stats socks-proxy
```

### 8.3 数据库维护

```bash
# 进入容器
docker exec -it socks-proxy bash

# 连接数据库
sqlite3 /data/database/database.db

# 执行SQL查询
.tables
SELECT * FROM users;
.exit
```

## 九、故障排查

### 9.1 容器无法启动

1. 查看容器日志：`docker logs socks-proxy`
2. 检查数据目录权限
3. 检查端口占用：`netstat -tuln | grep 8090`
4. 检查环境变量配置

### 9.2 服务无响应

1. 检查容器状态：`docker ps -a`
2. 检查健康检查：`curl http://192.168.1.4:8090/health`
3. 查看应用日志：`tail -f ./data/logs/nodejs.log`
4. 重启容器：`docker restart socks-proxy`

### 9.3 数据库问题

1. 检查数据库文件权限
2. 检查数据库文件完整性
3. 查看数据库日志
4. 恢复备份数据库

详细故障排查请参考：`docs/故障排查/Docker故障排查.md`

## 十、最佳实践

1. **定期备份**：设置自动备份任务
2. **版本管理**：使用语义化版本标签
3. **监控日志**：定期检查日志文件
4. **资源限制**：设置合理的资源限制
5. **安全配置**：修改默认密钥和密码
6. **升级测试**：在测试环境先测试升级
7. **文档记录**：记录配置变更和问题






