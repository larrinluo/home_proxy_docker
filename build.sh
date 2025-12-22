#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
PROXY_HOST=""
PROXY_PORT=8090
IMAGE_NAME="socks-proxy"
IMAGE_TAG="latest"
CONTAINER_NAME="socks-proxy"
DATA_DIR="./data"
RUN_CONTAINER=false

# 版本信息（自动检测）
APP_VERSION="1.0.0"
BUILD_DATE=$(date +%Y%m%d_%H%M%S)
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --host HOST         代理服务地址（默认：自动检测本机IP）"
    echo "  --port PORT         代理服务端口（默认：8090）"
    echo "  --image NAME        镜像名称（默认：socks-proxy）"
    echo "  --tag TAG           镜像标签（默认：latest）"
    echo "  --container NAME    容器名称（默认：socks-proxy）"
    echo "  --data-dir DIR      数据目录（默认：./data）"
    echo "  --version VERSION   应用版本（默认：从package.json读取）"
    echo "  --run               构建后立即运行容器"
    echo "  --help              显示帮助信息"
    echo ""
    echo "Examples:"
    echo "  $0 --host 192.168.1.4 --port 8090"
    echo "  $0 --host 192.168.1.4 --run"
    echo "  $0 --host 192.168.1.4 --tag v1.0.0 --run"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            PROXY_HOST="$2"
            shift 2
            ;;
        --port)
            PROXY_PORT="$2"
            shift 2
            ;;
        --image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        --tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --container)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --data-dir)
            DATA_DIR="$2"
            shift 2
            ;;
        --version)
            APP_VERSION="$2"
            shift 2
            ;;
        --run)
            RUN_CONTAINER=true
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

# 检查Docker环境
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# 检查Docker是否运行
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

# 自动检测IP地址
if [ -z "$PROXY_HOST" ]; then
    echo -e "${YELLOW}Detecting host IP address...${NC}"
    if command -v hostname &> /dev/null; then
        PROXY_HOST=$(hostname -I | awk '{print $1}')
    elif command -v ip &> /dev/null; then
        PROXY_HOST=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
    else
        echo -e "${RED}Error: Cannot detect host IP. Please specify --host${NC}"
        exit 1
    fi
    echo -e "${GREEN}Detected IP: $PROXY_HOST${NC}"
fi

# 显示配置信息
echo ""
echo -e "${GREEN}=== Build Configuration ===${NC}"
echo "  Host: $PROXY_HOST"
echo "  Port: $PROXY_PORT"
echo "  Image: $IMAGE_NAME:$IMAGE_TAG"
echo "  Container: $CONTAINER_NAME"
echo "  Data Directory: $DATA_DIR"
echo "  Version: $APP_VERSION"
echo "  Build Date: $BUILD_DATE"
echo "  Git Commit: $GIT_COMMIT"
echo ""

# 创建数据目录
echo -e "${YELLOW}Creating data directories...${NC}"
mkdir -p "$DATA_DIR"/{database,ssh-keys,logs,pac,backups}
chmod 700 "$DATA_DIR/ssh-keys"
echo -e "${GREEN}Data directories created${NC}"

# 构建镜像
echo ""
echo -e "${YELLOW}Building Docker image...${NC}"

# 检查是否有代理环境变量
BUILD_ARGS=(
    --build-arg PROXY_HOST="$PROXY_HOST"
    --build-arg PROXY_PORT="$PROXY_PORT"
    --build-arg APP_VERSION="$APP_VERSION"
    --build-arg BUILD_DATE="$BUILD_DATE"
    --build-arg GIT_COMMIT="$GIT_COMMIT"
)

# 如果设置了HTTP代理，传递给构建
if [ -n "$HTTP_PROXY" ]; then
    BUILD_ARGS+=(--build-arg HTTP_PROXY="$HTTP_PROXY")
    echo -e "${BLUE}Using HTTP proxy: $HTTP_PROXY${NC}"
fi
if [ -n "$HTTPS_PROXY" ]; then
    BUILD_ARGS+=(--build-arg HTTPS_PROXY="$HTTPS_PROXY")
    echo -e "${BLUE}Using HTTPS proxy: $HTTPS_PROXY${NC}"
fi
if [ -n "$NO_PROXY" ]; then
    BUILD_ARGS+=(--build-arg NO_PROXY="$NO_PROXY")
fi

# 获取当前用户的 UID/GID（用于统一容器和宿主机用户权限）
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)
BUILD_ARGS+=("--build-arg" "USER_UID=$CURRENT_UID")
BUILD_ARGS+=("--build-arg" "USER_GID=$CURRENT_GID")

docker build "${BUILD_ARGS[@]}" -t "$IMAGE_NAME:$IMAGE_TAG" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Build completed successfully!${NC}"
    
    # 显示镜像信息
    echo ""
    echo -e "${BLUE}=== Image Information ===${NC}"
    docker images "$IMAGE_NAME:$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
else
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

# 运行容器
if [ "$RUN_CONTAINER" = true ]; then
    echo ""
    echo -e "${YELLOW}Starting container...${NC}"
    
    # 停止并删除旧容器（如果存在）
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "Stopping existing container..."
        docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
        docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
    fi
    
    # 启动新容器
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
        -e DB_PATH=/data/database/database.db \
        "$IMAGE_NAME:$IMAGE_TAG"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Container started successfully!${NC}"
        echo ""
        echo -e "${GREEN}=== Container Information ===${NC}"
        echo "  Container Name: $CONTAINER_NAME"
        echo "  Web Interface: http://$PROXY_HOST:$PROXY_PORT"
        echo "  PAC File URL: http://$PROXY_HOST:$PROXY_PORT/proxy.pac"
        echo "  Health Check: http://$PROXY_HOST:$PROXY_PORT/health"
        echo "  Ready Check: http://$PROXY_HOST:$PROXY_PORT/ready"
        echo ""
        echo -e "${GREEN}=== Volume Mounts ===${NC}"
        echo "  Database: $(pwd)/$DATA_DIR/database -> /data/database"
        echo "  SSH Keys: $(pwd)/$DATA_DIR/ssh-keys -> /data/ssh-keys"
        echo "  Logs: $(pwd)/$DATA_DIR/logs -> /data/logs"
        echo "  PAC Files: $(pwd)/$DATA_DIR/pac -> /data/pac"
        echo ""
        echo "To view logs: docker logs -f $CONTAINER_NAME"
        echo "To stop: docker stop $CONTAINER_NAME"
        echo "To remove: docker rm $CONTAINER_NAME"
        echo ""
        echo "To view mounts: docker inspect $CONTAINER_NAME --format '{{range .Mounts}}{{printf \"%-50s -> %s\\n\" .Source .Destination}}{{end}}'"
    else
        echo -e "${RED}Failed to start container!${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"


