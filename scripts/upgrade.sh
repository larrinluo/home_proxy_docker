#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
IMAGE_NAME="socks-proxy"
NEW_TAG=""
OLD_TAG="latest"
CONTAINER_NAME="socks-proxy"
DATA_DIR="./data"
PROXY_HOST=""
PROXY_PORT=8090
HEALTH_CHECK_URL=""
HEALTH_CHECK_TIMEOUT=60
BACKUP_BEFORE_UPGRADE=true

# 帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --image NAME        镜像名称（默认：socks-proxy）"
    echo "  --new-tag TAG       新版本标签（必需）"
    echo "  --old-tag TAG       旧版本标签（默认：latest）"
    echo "  --container NAME    容器名称（默认：socks-proxy）"
    echo "  --host HOST         代理服务地址（默认：自动检测）"
    echo "  --port PORT         代理服务端口（默认：8090）"
    echo "  --no-backup         升级前不备份"
    echo "  --help              显示帮助信息"
    echo ""
    echo "Examples:"
    echo "  $0 --new-tag v1.1.0"
    echo "  $0 --new-tag v1.1.0 --host 192.168.1.4"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        --new-tag)
            NEW_TAG="$2"
            shift 2
            ;;
        --old-tag)
            OLD_TAG="$2"
            shift 2
            ;;
        --container)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --host)
            PROXY_HOST="$2"
            shift 2
            ;;
        --port)
            PROXY_PORT="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_BEFORE_UPGRADE=false
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 检查必需参数
if [ -z "$NEW_TAG" ]; then
    echo -e "${RED}Error: --new-tag is required${NC}"
    show_help
    exit 1
fi

# 检查Docker环境
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# 自动检测IP地址
if [ -z "$PROXY_HOST" ]; then
    if command -v hostname &> /dev/null; then
        PROXY_HOST=$(hostname -I | awk '{print $1}')
    elif command -v ip &> /dev/null; then
        PROXY_HOST=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
    else
        echo -e "${RED}Error: Cannot detect host IP. Please specify --host${NC}"
        exit 1
    fi
fi

HEALTH_CHECK_URL="http://$PROXY_HOST:$PROXY_PORT/ready"

echo -e "${BLUE}=== Upgrade Configuration ===${NC}"
echo "  Image: $IMAGE_NAME"
echo "  Old Tag: $OLD_TAG"
echo "  New Tag: $NEW_TAG"
echo "  Container: $CONTAINER_NAME"
echo "  Health Check: $HEALTH_CHECK_URL"
echo ""

# 检查旧容器是否存在
OLD_CONTAINER_EXISTS=false
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    OLD_CONTAINER_EXISTS=true
    echo -e "${YELLOW}Found existing container: $CONTAINER_NAME${NC}"
else
    echo -e "${YELLOW}No existing container found, will create new one${NC}"
fi

# 备份数据
if [ "$BACKUP_BEFORE_UPGRADE" = true ]; then
    echo -e "${YELLOW}Creating backup before upgrade...${NC}"
    DATA_DIR="$DATA_DIR" ./scripts/backup.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}Backup failed! Aborting upgrade.${NC}"
        exit 1
    fi
    echo ""
fi

# 检查新镜像是否存在
if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}:${NEW_TAG}$"; then
    echo -e "${YELLOW}New image $IMAGE_NAME:$NEW_TAG not found locally${NC}"
    echo -e "${YELLOW}Please build the new image first using:${NC}"
    echo "  ./build.sh --tag $NEW_TAG"
    exit 1
fi

# 创建临时容器名称
TEMP_CONTAINER_NAME="${CONTAINER_NAME}-new-$$"

# 停止旧容器（如果存在）
if [ "$OLD_CONTAINER_EXISTS" = true ]; then
    echo -e "${YELLOW}Stopping old container...${NC}"
    docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
    
    # 等待旧容器完全停止
    sleep 2
fi

# 启动新容器
echo -e "${YELLOW}Starting new container: $TEMP_CONTAINER_NAME${NC}"
docker run -d \
    --name "$TEMP_CONTAINER_NAME" \
    -p "$PROXY_PORT:8090" \
    -p 11081:11081 \
    -p 11082:11082 \
    -p 11083:11083 \
    -v "$(pwd)/$DATA_DIR/database:/data/database" \
    -v "$(pwd)/$DATA_DIR/ssh-keys:/data/ssh-keys" \
    -v "$(pwd)/$DATA_DIR/logs:/data/logs" \
    -v "$(pwd)/$DATA_DIR/pac:/data/pac" \
    -e PROXY_HOST="$PROXY_HOST" \
    -e PROXY_PORT="$PROXY_PORT" \
    -e NODE_ENV=production \
    "$IMAGE_NAME:$NEW_TAG"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start new container!${NC}"
    # 如果新容器启动失败，尝试重启旧容器
    if [ "$OLD_CONTAINER_EXISTS" = true ]; then
        echo -e "${YELLOW}Attempting to restart old container...${NC}"
        docker start "$CONTAINER_NAME" > /dev/null 2>&1 || true
    fi
    exit 1
fi

# 等待新容器健康检查
echo -e "${YELLOW}Waiting for new container to be ready (timeout: ${HEALTH_CHECK_TIMEOUT}s)...${NC}"
ELAPSED=0
while [ $ELAPSED -lt $HEALTH_CHECK_TIMEOUT ]; do
    if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}New container is ready!${NC}"
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -n "."
done
echo ""

if [ $ELAPSED -ge $HEALTH_CHECK_TIMEOUT ]; then
    echo -e "${RED}New container failed health check! Rolling back...${NC}"
    docker stop "$TEMP_CONTAINER_NAME" > /dev/null 2>&1 || true
    docker rm "$TEMP_CONTAINER_NAME" > /dev/null 2>&1 || true
    # 尝试重启旧容器
    if [ "$OLD_CONTAINER_EXISTS" = true ]; then
        echo -e "${YELLOW}Attempting to restart old container...${NC}"
        docker start "$CONTAINER_NAME" > /dev/null 2>&1 || true
    fi
    exit 1
fi

# 删除旧容器（如果存在）
if [ "$OLD_CONTAINER_EXISTS" = true ]; then
    echo -e "${YELLOW}Removing old container...${NC}"
    docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
fi

# 重命名新容器
echo -e "${YELLOW}Renaming new container to $CONTAINER_NAME...${NC}"
docker rename "$TEMP_CONTAINER_NAME" "$CONTAINER_NAME"

echo ""
echo -e "${GREEN}=== Upgrade Completed Successfully ===${NC}"
echo "  Container: $CONTAINER_NAME"
echo "  Image: $IMAGE_NAME:$NEW_TAG"
echo "  Web Interface: http://$PROXY_HOST:$PROXY_PORT"
echo ""


