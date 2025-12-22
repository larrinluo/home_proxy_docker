# 本地开发指南

## 快速启动

使用提供的开发脚本同时启动后端和前端：

```bash
./scripts/dev.sh
```

或者分别启动：

### 启动后端

```bash
cd server/back-end
npm install  # 首次运行需要安装依赖
npm run dev  # 使用 nodemon 自动重启
```

后端服务运行在: http://localhost:3000

### 启动前端

```bash
cd server/front-end
npm install  # 首次运行需要安装依赖
npm run dev  # 使用 Vite 开发服务器
```

前端服务运行在: http://localhost:5173

## 环境配置

### 后端环境变量

后端使用 `.env` 文件配置环境变量。开发环境建议配置：

```env
NODE_ENV=development
PORT=3000
DB_PATH=./data/database/database.db
SESSION_SECRET=dev-secret-key
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

### 前端环境变量

前端使用 Vite 环境变量，可以通过 `.env.local` 文件配置：

```env
VITE_API_BASE_URL=http://localhost:3000
```

**注意**: 开发环境通常不需要设置 `VITE_API_BASE_URL`，因为 Vite 已经配置了代理，前端请求 `/api` 会自动转发到 `http://localhost:3000`。

## 数据库路径

- **本地开发**: 使用相对路径 `./data/database/database.db`
- **Docker 生产**: 使用绝对路径 `/data/database/database.db`

代码会自动根据 `NODE_ENV` 环境变量选择正确的路径。

## 开发工具

### 后端

- **nodemon**: 自动重启服务器（文件变化时）
- **调试**: 可以在 `server.js` 中添加 `console.log` 或使用 Node.js 调试器

### 前端

- **Vite**: 快速热更新（HMR）
- **Vue DevTools**: 浏览器扩展，用于调试 Vue 组件

## 常见问题

### 1. 端口被占用

如果 3000 或 5173 端口被占用，可以：

- **后端**: 修改 `.env` 中的 `PORT` 变量
- **前端**: 修改 `vite.config.js` 中的 `server.port`

### 2. 数据库连接失败

确保：
- 数据库目录存在: `server/back-end/data/database/`
- 数据库文件权限正确
- `.env` 中 `DB_PATH` 配置正确

### 3. 前端无法连接后端

检查：
- 后端服务是否正常运行
- `vite.config.js` 中的代理配置是否正确
- 浏览器控制台是否有 CORS 错误

### 4. 依赖安装失败

如果 npm 安装依赖很慢，可以：

```bash
# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 或者使用 cnpm
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

## 停止服务

如果使用 `./scripts/dev.sh` 启动，按 `Ctrl+C` 即可停止所有服务。

如果分别启动，需要在各自的终端按 `Ctrl+C` 停止。

