#!/bin/bash

# 本地开发环境启动脚本
# 同时启动后端和前端开发服务器

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${BLUE}=== 启动本地开发环境 ===${NC}"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 Node.js，请先安装 Node.js${NC}"
    exit 1
fi

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到 npm，请先安装 npm${NC}"
    exit 1
fi

# 检查后端依赖
if [ ! -d "$PROJECT_ROOT/server/back-end/node_modules" ]; then
    echo -e "${YELLOW}后端依赖未安装，正在安装...${NC}"
    cd "$PROJECT_ROOT/server/back-end"
    npm install
fi

# 检查前端依赖
if [ ! -d "$PROJECT_ROOT/server/front-end/node_modules" ]; then
    echo -e "${YELLOW}前端依赖未安装，正在安装...${NC}"
    cd "$PROJECT_ROOT/server/front-end"
    npm install
fi

# 确保数据库目录存在
mkdir -p "$PROJECT_ROOT/server/back-end/data/database"
mkdir -p "$PROJECT_ROOT/server/back-end/data/ssh-keys"
mkdir -p "$PROJECT_ROOT/server/back-end/data/logs"

# 检查后端 .env 文件
if [ ! -f "$PROJECT_ROOT/server/back-end/.env" ]; then
    echo -e "${YELLOW}后端 .env 文件不存在，从 .env.example 复制...${NC}"
    if [ -f "$PROJECT_ROOT/server/back-end/.env.example" ]; then
        cp "$PROJECT_ROOT/server/back-end/.env.example" "$PROJECT_ROOT/server/back-end/.env"
        echo -e "${GREEN}✓ 已创建 .env 文件，请根据需要修改配置${NC}"
    else
        echo -e "${YELLOW}警告: .env.example 文件也不存在${NC}"
    fi
fi

# 设置数据库路径（如果 .env 中没有设置）
if ! grep -q "^DB_PATH=" "$PROJECT_ROOT/server/back-end/.env" 2>/dev/null; then
    echo "DB_PATH=./data/database/database.db" >> "$PROJECT_ROOT/server/back-end/.env"
    echo -e "${GREEN}✓ 已添加 DB_PATH 到 .env 文件${NC}"
fi

# 确保数据库路径使用相对路径（本地开发）
# 将绝对路径改为相对路径，但保留用户自定义的相对路径
if grep -q "^DB_PATH=/data/database/database.db" "$PROJECT_ROOT/server/back-end/.env" 2>/dev/null; then
    sed -i 's|^DB_PATH=/data/database/database.db|DB_PATH=./data/database/database.db|g' "$PROJECT_ROOT/server/back-end/.env"
    echo -e "${GREEN}✓ 已更新 DB_PATH 为相对路径${NC}"
fi

# 确保 NODE_ENV 设置为 development
if ! grep -q "^NODE_ENV=" "$PROJECT_ROOT/server/back-end/.env" 2>/dev/null; then
    echo "NODE_ENV=development" >> "$PROJECT_ROOT/server/back-end/.env"
    echo -e "${GREEN}✓ 已添加 NODE_ENV=development${NC}"
elif grep -q "^NODE_ENV=production" "$PROJECT_ROOT/server/back-end/.env" 2>/dev/null; then
    sed -i 's|^NODE_ENV=production|NODE_ENV=development|g' "$PROJECT_ROOT/server/back-end/.env"
    echo -e "${GREEN}✓ 已更新 NODE_ENV 为 development${NC}"
fi

echo ""
echo -e "${GREEN}=== 启动服务 ===${NC}"
echo ""
echo -e "${BLUE}后端服务:${NC} http://localhost:3000"
echo -e "${BLUE}前端服务:${NC} http://localhost:5173"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

# 清理函数：当脚本退出时停止所有后台进程
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

# 注册清理函数
trap cleanup SIGINT SIGTERM

# 启动后端服务
echo -e "${BLUE}[后端]${NC} 启动中..."
cd "$PROJECT_ROOT/server/back-end"
npm run dev > /tmp/socks-proxy-backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端启动
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}后端启动失败，查看日志:${NC}"
    cat /tmp/socks-proxy-backend.log
    exit 1
fi

echo -e "${GREEN}✓ 后端已启动 (PID: $BACKEND_PID)${NC}"

# 启动前端服务
echo -e "${BLUE}[前端]${NC} 启动中..."
cd "$PROJECT_ROOT/server/front-end"
npm run dev > /tmp/socks-proxy-frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端启动
sleep 2
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}前端启动失败，查看日志:${NC}"
    cat /tmp/socks-proxy-frontend.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✓ 前端已启动 (PID: $FRONTEND_PID)${NC}"
echo ""

# 显示日志（可选：使用 tail -f 实时查看）
echo -e "${YELLOW}提示:${NC}"
echo "  - 后端日志: tail -f /tmp/socks-proxy-backend.log"
echo "  - 前端日志: tail -f /tmp/socks-proxy-frontend.log"
echo ""

# 等待用户中断
wait

