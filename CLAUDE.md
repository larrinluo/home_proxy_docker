# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 项目概述

这是一个**家庭代理管理系统** - 基于 Web 的应用程序，用于管理带有 SSH 隧道的 SOCKS 代理服务。系统提供集中式界面来创建、监控和控制多个代理实例，这些实例通过 SSH 将流量路由到远程跳板机。

## 架构

### 多阶段 Docker 部署
- **构建阶段**: 安装 Node.js，构建前端（Vue.js），准备后端依赖
- **运行阶段**: 基于 Ubuntu 的镜像，通过 Supervisor 运行 Nginx + Node.js
- **进程管理**: Supervisor 同时运行 Node.js 后端（端口 3000）和 Nginx（端口 8090）

### 服务层
1. **前端** (`server/front-end/`): Vue.js 3 单页应用，使用 Element Plus UI
2. **后端** (`server/back-end/`): Express.js REST API，基于会话的身份认证
3. **数据存储**: 基于 JSON 文件的存储（尽管代码中有 SQLite 引用，但实际使用 JSON）
4. **PAC 生成器**: 动态生成 PAC 文件用于自动代理路由

### 核心后端服务 (`server/back-end/services/`)
- `proxy-process-manager.js` - 管理每个代理实例的 autossh 进程
- `ssh-service.js` - 处理 SSH 连接和密钥管理
- `pac-generator.js` - 根据活动代理配置生成 PAC 文件
- `port-manager.js` - 管理端口分配（默认范围：11081-11083）
- `proxy-status-monitor.js` - 监控代理健康状态
- `host-conflict-checker.js` - 验证主机配置冲突

## 常用开发命令

### 本地开发
```bash
# 快速启动（前端和后端）
./scripts/dev.sh

# 仅启动后端（运行在端口 3000）
cd server/back-end && npm install && npm run dev

# 仅启动前端（运行在端口 5173）
cd server/front-end && npm install && npm run dev
```

### 生产构建
```bash
# 标准构建（自动检测主机 IP）
./build.sh

# 使用自定义主机/端口构建
./build.sh --host 192.168.1.4 --port 8090

# 构建并运行容器
./build.sh --host 192.168.1.4 --run

# ARM64 构建
./build-arm64.sh
```

### Docker 操作
```bash
# 启动服务
docker-compose up -d

# 查看日志
docker logs -f socks-proxy

# 停止服务
docker stop socks-proxy
```

### 测试
```bash
# 后端测试
cd server/back-end && npm test
cd server/back-end && npm run test:unit
cd server/back-end && npm run test:integration

# 前端测试
cd server/front-end && npm test
cd server/front-end && npm run test:unit
cd server/front-end && npm run test:e2e
```

## 重要配置细节

### 环境变量

**后端** (`.env` 或 Docker 环境变量):
- `NODE_ENV` - `development` 或 `production`
- `PORT` - 后端 API 端口（默认：3000）
- `PROXY_HOST` - 用于 PAC 文件生成的代理服务主机名
- `PROXY_PORT` - Web 界面端口（默认：8090）
- `DB_PATH` - 数据库目录路径（根据 NODE_ENV 自动设置）
- `SESSION_SECRET` - 会话加密密钥
- `CORS_ORIGIN` - 逗号分隔的允许来源列表

**前端** (`.env.local`):
- `VITE_API_BASE_URL` - 后端 API URL（默认：http://localhost:3000）

### 数据库路径处理
代码根据环境自动选择数据库路径：
- **开发环境**: `./data/database/`（相对于后端目录）
- **生产环境**: `/data/database/`（容器中的绝对路径）

在处理数据库代码时，永远不要硬编码路径 - 使用 `process.env.DB_PATH` 或 `json-store` 模块。

### 端口暴露
- **8090** - 主 Web 界面（Nginx）
- **11081-11083** - SOCKS 代理端口（可通过 port-manager 配置）
- **3000** - 后端 API（内部，通过 Nginx 代理暴露）

## 代码组织模式

### API 路由 (`server/back-end/routes/`)
所有路由都以 `/api/v1/` 为前缀。主要端点：
- `/auth/*` - 身份认证（登录、登出、会话检查）
- `/proxy-services/*` - 代理配置的 CRUD 操作
- `/proxy-services/:id/start` - 启动代理实例
- `/proxy-services/:id/stop` - 停止代理实例
- `/proxy-services/:id/status` - 获取代理状态
- `/host-configs/*` - 管理目标主机配置
- `/system/*` - 系统状态和配置

### 前端结构 (`server/front-end/src/`)
- `views/` - 页面级组件
- `components/` - 可复用的 UI 组件
- `stores/` - Pinia 状态管理
- `api/` - API 客户端模块（Axios）
- `router/` - Vue Router 配置

### 数据模型
系统使用 JSON 文件存储，包含以下表：
- `users.json` - 用户账户及 password_hash
- `proxy_services.json` - 代理服务配置
- `host_configs.json` - 目标主机定义
- `system_configs.json` - 系统级设置

**重要**: 字段命名在存储中使用 snake_case，但在 API 响应中使用 camelCase。`json-store` 模块通过 `FIELD_MAPPING` 处理转换。

## 关键开发注意事项

### 进程管理
- 代理实例作为独立的 `autossh` 进程运行，由 `proxy-process-manager.js` 管理
- 每个代理从配置的端口范围中分配唯一的 `proxy_port`
- 进程 ID 在代理服务配置中跟踪

### PAC 文件生成
- PAC 文件在 `/proxy.pac` 提供（开发和生产环境）
- 根据活动代理配置动态生成
- 浏览器使用它自动通过代理路由流量

### SSH 密钥管理
- SSH 密钥存储在 `/data/ssh-keys/`（容器）或 `server/back-end/data/ssh-keys/`（开发环境）
- 目录权限：700 (drwx------)
- 密钥文件权限：600 (-rw-------)
- 密钥在代理服务配置中通过文件名引用

### CORS 配置
CORS 配置复杂且感知环境：
- **开发环境**: 允许所有 localhost 来源
- **生产环境**: 根据 `PROXY_HOST` 和 `PROXY_PORT` 动态允许来源
- **Docker**: 允许同源请求（nginx 将前端代理到后端）

修改 CORS 时，在开发和生产环境中都要测试。

## 关键文件关系

1. **Dockerfile → entrypoint.sh**: 入口点在启动 Supervisor 之前初始化数据库并设置权限
2. **supervisord.conf**: 在生产环境中管理 nginx 和 Node.js 进程
3. **nginx-site.conf**: 将 `/api/*` 代理到 backend:3000，为其他路由提供前端静态文件
4. **proxy-process-manager.js**: 使用来自 `host_configs` 和 `proxy_services` 的 SSH 配置生成 autossh 进程
5. **pac-generator.js**: 读取活动代理服务以生成 PAC 文件规则

## 测试注意事项

- 后端测试使用 Jest 和 Supertest 进行 API 测试
- 前端使用 Vitest 进行单元测试，Playwright 进行 E2E 测试
- 数据库测试应使用模拟或测试数据库文件（不是生产数据）
- 进程管理测试可能需要模拟 `child_process.spawn`

## 构建脚本行为

`build.sh` 脚本：
1. 如果未提供主机 IP，则自动检测
2. 创建具有正确权限的数据目录
3. 将构建参数传递给 Docker（包括用于权限的 UID/GID）
4. 通过在新容器旁边运行旧容器来支持零停机部署
5. 成功启动后原子性地重命名容器

排查构建失败时，检查：
- Docker 守护进程是否运行
- 网络连接（用于 npm 注册表）
- 足够的磁盘空间
- 端口冲突（8090, 11081-11083）
