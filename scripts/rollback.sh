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
ROLLBACK_TAG=""
CONTAINER_NAME="socks-proxy"
DATA_DIR="./data"
PROXY_HOST=""
PROXY_PORT=8090
HEALTH_CHECK_URL=""
HEALTH_CHECK_TIMEOUT=60

# 帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --image NAME        镜像名称（默认：socks-proxy）"
    echo "  --tag TAG           要回滚到的版本标签（必需）"
    echo "  --container NAME    容器名称（默认：socks-proxy）"
    echo "  --host HOST         代理服务地址（默认：自动检测）"
    echo "  --port PORT         代理服务端口（默认：8090）"
    echo "  --list              列出可用的镜像版本"
    echo "  --help              显示帮助信息"
    echo ""
    echo "Examples:"
    echo "  $0 --tag v1.0.0"
    echo "  $0 --list"
}

# 列出可用版本
list_versions() {
    echo -e "${BLUE}Available image versions:${NC}"
    docker images "$IMAGE_NAME" --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" | head -20
    exit 0
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        --tag)
            ROLLBACK_TAG="$2"
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
        --list)
            list_versions
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
if [ -z "$ROLLBACK_TAG" ]; then
    echo -e "${RED}Error: --tag is required${NC}"
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

echo -e "${BLUE}=== Rollback Configuration ===${NC}"
echo "  Image: $IMAGE_NAME"
echo "  Rollback Tag: $ROLLBACK_TAG"
echo "  Container: $CONTAINER_NAME"
echo "  Health Check: $HEALTH_CHECK_URL"
echo ""

# 检查回滚镜像是否存在
if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${IMAGE_NAME}:${ROLLBACK_TAG}$"; then
    echo -e "${RED}Error: Image $IMAGE_NAME:$ROLLBACK_TAG not found${NC}"
    echo -e "${YELLOW}Available versions:${NC}"
    list_versions
    exit 1
fi

# 检查当前容器是否存在
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}Stopping current container...${NC}"
    docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
    
    # 等待容器完全停止
    sleep 3
    
    echo -e "${YELLOW}Removing current container...${NC}"
    docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
fi

# 启动回滚容器
echo -e "${YELLOW}Starting rollback container...${NC}"
docker run -d \
    --name "$CONTAINER_NAME" \
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
    "$IMAGE_NAME:$ROLLBACK_TAG"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start rollback container!${NC}"
    exit 1
fi

# 等待容器健康检查（先尝试/ready，如果失败则使用/health）
echo -e "${YELLOW}Waiting for container to be ready (timeout: ${HEALTH_CHECK_TIMEOUT}s)...${NC}"
ELAPSED=0
HEALTH_CHECK_PASSED=false
HEALTH_URL="$HEALTH_CHECK_URL"
FALLBACK_URL="http://$PROXY_HOST:$PROXY_PORT/health"

while [ $ELAPSED -lt $HEALTH_CHECK_TIMEOUT ]; do
    # 先尝试 /ready 端点
    if curl -sf --max-time 3 "$HEALTH_URL" > /dev/null 2>&1; then
        HEALTH_CHECK_PASSED=true
        break
    fi
    # 如果 /ready 超时，尝试 /health 端点（向后兼容旧版本）
    if curl -sf --max-time 3 "$FALLBACK_URL" > /dev/null 2>&1; then
        echo -e "${YELLOW}Note: /ready endpoint not available, using /health instead${NC}"
        HEALTH_CHECK_PASSED=true
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -n "."
done
echo ""

if [ "$HEALTH_CHECK_PASSED" = false ]; then
    echo -e "${RED}Container failed health check!${NC}"
    echo -e "${YELLOW}Container logs:${NC}"
    docker logs --tail 50 "$CONTAINER_NAME"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Rollback Completed Successfully ===${NC}"
echo "  Container: $CONTAINER_NAME"
echo "  Image: $IMAGE_NAME:$ROLLBACK_TAG"
echo "  Web Interface: http://$PROXY_HOST:$PROXY_PORT"
echo ""


