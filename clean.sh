#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== 清理所有数据并重建Docker容器 ===${NC}"
echo ""

# 默认配置
CONTAINER_NAME="socks-proxy"
IMAGE_NAME="socks-proxy"
DATA_DIR="./data"

# 1. 停止并删除容器
echo -e "${BLUE}步骤 1: 停止并删除容器...${NC}"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "停止容器: ${CONTAINER_NAME}"
    docker stop "${CONTAINER_NAME}" > /dev/null 2>&1 || true
    echo "删除容器: ${CONTAINER_NAME}"
    docker rm "${CONTAINER_NAME}" > /dev/null 2>&1 || true
    echo -e "${GREEN}✓ 容器已删除${NC}"
else
    echo -e "${YELLOW}容器不存在，跳过${NC}"
fi
echo ""

# 2. 删除数据目录
echo -e "${BLUE}步骤 2: 删除数据目录...${NC}"
if [ -d "${DATA_DIR}" ]; then
    echo "删除数据目录: ${DATA_DIR}"
    rm -rf "${DATA_DIR}"
    echo -e "${GREEN}✓ 数据目录已删除${NC}"
    echo "   - 数据库文件"
    echo "   - SSH密钥"
    echo "   - 日志文件"
    echo "   - PAC文件"
else
    echo -e "${YELLOW}数据目录不存在，跳过${NC}"
fi
echo ""

# 3. 删除Docker镜像（可选）
echo -e "${BLUE}步骤 3: 删除Docker镜像（可选）...${NC}"
read -p "是否删除Docker镜像 ${IMAGE_NAME}? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if docker images "${IMAGE_NAME}" --format '{{.Repository}}' | grep -q "^${IMAGE_NAME}$"; then
        echo "删除镜像: ${IMAGE_NAME}"
        docker rmi "${IMAGE_NAME}:latest" > /dev/null 2>&1 || true
        # 删除所有标签的镜像
        docker images "${IMAGE_NAME}" --format '{{.ID}}' | xargs -r docker rmi > /dev/null 2>&1 || true
        echo -e "${GREEN}✓ 镜像已删除${NC}"
    else
        echo -e "${YELLOW}镜像不存在，跳过${NC}"
    fi
else
    echo -e "${YELLOW}保留镜像${NC}"
fi
echo ""

# 4. 重新创建数据目录结构
echo -e "${BLUE}步骤 4: 重新创建数据目录结构...${NC}"
mkdir -p "${DATA_DIR}/database"
mkdir -p "${DATA_DIR}/ssh-keys"
mkdir -p "${DATA_DIR}/logs"
mkdir -p "${DATA_DIR}/pac"
chmod 700 "${DATA_DIR}/ssh-keys"
chmod 755 "${DATA_DIR}/database"
chmod 755 "${DATA_DIR}/logs"
chmod 755 "${DATA_DIR}/pac"
echo -e "${GREEN}✓ 数据目录结构已创建${NC}"
echo ""

# 5. 显示清理结果
echo -e "${GREEN}=== 清理完成 ===${NC}"
echo ""
echo "已清理的内容："
echo "  ✓ Docker容器: ${CONTAINER_NAME}"
echo "  ✓ 数据目录: ${DATA_DIR}"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  ✓ Docker镜像: ${IMAGE_NAME}"
fi
echo ""
echo "下一步操作："
echo "  1. 重新构建镜像: ./build.sh --host <IP> --port 8090"
echo "  2. 构建并启动: ./build.sh --host <IP> --port 8090 --run"
echo ""

