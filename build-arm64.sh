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
IMAGE_TAG="arm64-latest"
CONTAINER_NAME="socks-proxy-arm64"
DATA_DIR="./data-arm64"
RUN_CONTAINER=false

# 版本信息（自动检测）
APP_VERSION="1.0.0"
BUILD_DATE=$(date +%Y%m%d_%H%M%S)
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# 帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "构建和测试 arm64 架构的 Docker 容器"
    echo ""
    echo "Options:"
    echo "  --host HOST         代理服务地址（默认：自动检测本机IP）"
    echo "  --port PORT         代理服务端口（默认：8090）"
    echo "  --image NAME        镜像名称（默认：socks-proxy）"
    echo "  --tag TAG           镜像标签（默认：arm64-latest）"
    echo "  --container NAME    容器名称（默认：socks-proxy-arm64）"
    echo "  --data-dir DIR      数据目录（默认：./data-arm64）"
    echo "  --version VERSION   应用版本（默认：从package.json读取）"
    echo "  --run               构建后立即运行容器"
    echo "  --help              显示帮助信息"
    echo ""
    echo "Examples:"
    echo "  $0 --host 192.168.1.4 --port 8090"
    echo "  $0 --host 192.168.1.4 --run"
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

# 检查 Docker Buildx
if ! docker buildx version &> /dev/null; then
    echo -e "${RED}Error: Docker Buildx is not installed${NC}"
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

# 检查并设置 Buildx 构建器
echo -e "${YELLOW}检查 Buildx 构建器...${NC}"

# 检查 Docker 镜像加速配置
echo -e "${YELLOW}检查 Docker 镜像加速配置...${NC}"
if docker info 2>/dev/null | grep -q "Registry Mirrors"; then
    echo -e "${GREEN}Docker 镜像加速已配置，将自动使用镜像源${NC}"
    docker info 2>/dev/null | grep -A 3 "Registry Mirrors" | head -4
else
    echo -e "${YELLOW}未检测到 Docker 镜像加速配置${NC}"
    echo -e "${YELLOW}提示：如果网络较慢，可以运行 ./configure-docker-mirrors.sh 配置镜像加速${NC}"
fi

# 尝试拉取 buildkit 镜像的函数（会使用已配置的镜像加速）
pull_buildkit_image() {
    echo -e "${YELLOW}尝试拉取 buildkit 镜像（将使用已配置的镜像加速）...${NC}"
    local LOG_FILE="/tmp/buildkit-pull-$$.log"
    
    # 先检查镜像是否已存在
    if docker images moby/buildkit:buildx-stable-1 --format '{{.Repository}}:{{.Tag}}' | grep -q "moby/buildkit:buildx-stable-1"; then
        echo -e "${GREEN}Buildkit 镜像已存在，跳过拉取${NC}"
        return 0
    fi
    
    # 尝试拉取镜像，捕获输出和退出码
    if timeout 30 docker pull moby/buildkit:buildx-stable-1 > "$LOG_FILE" 2>&1; then
        # 再次检查镜像是否存在
        if docker images moby/buildkit:buildx-stable-1 --format '{{.Repository}}:{{.Tag}}' | grep -q "moby/buildkit:buildx-stable-1"; then
            echo -e "${GREEN}Buildkit 镜像拉取成功${NC}"
            rm -f "$LOG_FILE" 2>/dev/null
            return 0
        else
            echo -e "${YELLOW}Buildkit 镜像拉取可能失败（镜像不存在）${NC}"
            cat "$LOG_FILE" | tail -3
            rm -f "$LOG_FILE" 2>/dev/null
            return 1
        fi
    else
        local EXIT_CODE=$?
        echo -e "${YELLOW}Buildkit 镜像拉取失败或超时（退出码: $EXIT_CODE）${NC}"
        cat "$LOG_FILE" | tail -5
        if grep -q "timeout\|Timeout\|connection\|reset\|refused" "$LOG_FILE" 2>/dev/null; then
            echo -e "${YELLOW}检测到网络问题，建议：${NC}"
            echo -e "${YELLOW}  1. 确保 Docker 镜像加速已生效（重启 Docker: sudo systemctl restart docker）${NC}"
            echo -e "${YELLOW}  2. 检查网络连接${NC}"
            echo -e "${YELLOW}  3. 或使用代理: export HTTP_PROXY=...${NC}"
        fi
        rm -f "$LOG_FILE" 2>/dev/null
        return 1
    fi
}

USE_DEFAULT_BUILDER=false

if ! docker buildx ls | grep -q "multiarch-arm64"; then
    echo -e "${YELLOW}创建支持 arm64 的构建器...${NC}"
    # 尝试先拉取 buildkit 镜像（会使用已配置的镜像加速）
    pull_buildkit_image || echo -e "${YELLOW}将在创建构建器时自动拉取镜像${NC}"
    if ! docker buildx create --name multiarch-arm64 --platform linux/amd64,linux/arm64 --use --driver docker-container --bootstrap 2>/dev/null; then
        echo -e "${YELLOW}创建 multiarch-arm64 构建器失败，将使用 default 构建器${NC}"
        USE_DEFAULT_BUILDER=true
    fi
else
    echo -e "${GREEN}使用现有构建器: multiarch-arm64${NC}"
    docker buildx use multiarch-arm64
    # 检查构建器是否处于活动状态
    echo -e "${YELLOW}检查构建器状态...${NC}"
    if ! docker buildx inspect multiarch-arm64 --bootstrap &>/dev/null; then
        echo -e "${YELLOW}构建器未启动，尝试重新启动（可能需要拉取镜像）...${NC}"
        # 如果构建器启动失败，尝试先拉取镜像
        pull_buildkit_image || echo -e "${YELLOW}无法拉取 buildkit 镜像${NC}"
        # 尝试重新启动构建器
        if ! docker buildx inspect multiarch-arm64 --bootstrap 2>&1 | grep -q "running\|active"; then
            echo -e "${YELLOW}构建器启动失败，将使用 default 构建器${NC}"
            USE_DEFAULT_BUILDER=true
        fi
    fi
fi

# 如果 multiarch-arm64 构建器不可用，使用 default 构建器
if [ "$USE_DEFAULT_BUILDER" = true ]; then
    echo -e "${YELLOW}切换到 default 构建器（支持 arm64）...${NC}"
    docker buildx use default
    if docker buildx inspect default --bootstrap &>/dev/null; then
        echo -e "${GREEN}Default 构建器已就绪${NC}"
    else
        echo -e "${RED}Default 构建器也无法使用，请检查 Docker 环境${NC}"
        exit 1
    fi
fi

# 安装 QEMU 模拟器（用于在 x86 上运行 arm64 容器）
echo -e "${YELLOW}检查 QEMU 模拟器...${NC}"

# 检查 QEMU 是否已经注册
QEMU_ALREADY_INSTALLED=false
if [ -f /proc/sys/fs/binfmt_misc/qemu-aarch64 ] || [ -f /proc/sys/fs/binfmt_misc/qemu-arm ]; then
    echo -e "${GREEN}QEMU 模拟器已安装${NC}"
    QEMU_ALREADY_INSTALLED=true
else
    echo -e "${YELLOW}QEMU 模拟器未安装，尝试安装...${NC}"
    # 检查本地是否有 QEMU 镜像
    if docker images multiarch/qemu-user-static --format '{{.Repository}}:{{.Tag}}' | grep -q "multiarch/qemu-user-static:latest"; then
        echo -e "${GREEN}找到本地 QEMU 镜像，使用本地镜像安装...${NC}"
        if docker run --rm --privileged multiarch/qemu-user-static --reset -p yes 2>/dev/null; then
            QEMU_ALREADY_INSTALLED=true
            echo -e "${GREEN}QEMU 安装成功${NC}"
        else
            echo -e "${YELLOW}使用本地镜像安装失败，尝试从镜像源拉取...${NC}"
        fi
    fi
    
    # 如果本地安装失败，尝试从镜像源拉取
    if [ "$QEMU_ALREADY_INSTALLED" = false ]; then
        echo -e "${YELLOW}从镜像源拉取 QEMU 镜像（可能需要一些时间）...${NC}"
        if docker run --rm --privileged multiarch/qemu-user-static --reset -p yes 2>&1; then
            QEMU_ALREADY_INSTALLED=true
            echo -e "${GREEN}QEMU 安装成功${NC}"
        else
            echo -e "${RED}QEMU 安装失败，但可以继续尝试构建${NC}"
            echo -e "${YELLOW}提示：如果构建失败，请检查网络连接或手动安装 QEMU${NC}"
            echo -e "${YELLOW}手动安装命令：docker run --rm --privileged multiarch/qemu-user-static --reset -p yes${NC}"
        fi
    fi
fi

# 显示配置信息
echo ""
echo -e "${GREEN}=== ARM64 Build Configuration ===${NC}"
echo "  Platform: linux/arm64"
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
echo -e "${YELLOW}Building ARM64 Docker image...${NC}"

# 检查本地是否有 ubuntu:latest 镜像，如果有则使用镜像 ID
USE_LOCAL_IMAGE=false
UBUNTU_IMAGE_ID=""
if docker images ubuntu:latest --format '{{.Repository}}:{{.Tag}}' | grep -q "ubuntu:latest"; then
    UBUNTU_IMAGE_ID=$(docker images ubuntu:latest --format '{{.ID}}' | head -1)
    UBUNTU_ARCH=$(docker inspect ubuntu:latest --format '{{.Architecture}}' 2>/dev/null || echo "")
    if [ "$UBUNTU_ARCH" = "arm64" ] || [ "$UBUNTU_ARCH" = "aarch64" ]; then
        echo -e "${GREEN}Found local arm64 ubuntu:latest image (ID: $UBUNTU_IMAGE_ID), using it...${NC}"
        USE_LOCAL_IMAGE=true
    else
        echo -e "${YELLOW}Found local ubuntu:latest but architecture is $UBUNTU_ARCH, will try to pull arm64 version...${NC}"
    fi
else
    echo -e "${YELLOW}No local ubuntu:latest found, will pull from registry...${NC}"
fi

if [ "$USE_LOCAL_IMAGE" = true ]; then
    echo -e "${BLUE}Importing local ubuntu image into buildx cache...${NC}"
    # 导出本地镜像
    TEMP_TAR="/tmp/ubuntu-arm64-$$.tar"
    docker save ubuntu:latest -o "$TEMP_TAR" 2>/dev/null
    if [ $? -eq 0 ] && [ -f "$TEMP_TAR" ]; then
        echo -e "${GREEN}Local image exported, will use it during build${NC}"
        # 在构建时使用 --cache-from 和导入的镜像
        BUILD_ARGS+=(--cache-from "type=local,src=$TEMP_TAR")
        # 同时创建一个临时 Dockerfile 使用本地镜像
        sed "s|FROM ubuntu:latest AS builder|FROM ubuntu:latest AS builder|g; s|FROM ubuntu:latest AS runtime|FROM ubuntu:latest AS runtime|g" Dockerfile > Dockerfile.arm64.local
        DOCKERFILE_PATH="Dockerfile.arm64.local"
        # 在构建前导入镜像到 buildx
        echo -e "${YELLOW}Loading image into buildx...${NC}"
        docker load -i "$TEMP_TAR" 2>/dev/null || true
        rm -f "$TEMP_TAR"
    else
        echo -e "${YELLOW}Failed to export local image, will use original Dockerfile${NC}"
        DOCKERFILE_PATH="Dockerfile"
    fi
else
    DOCKERFILE_PATH="Dockerfile"
    echo -e "${BLUE}This may take a while, especially if pulling base images...${NC}"
fi

# 检查是否有代理环境变量
BUILD_ARGS=(
    --platform linux/arm64
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

# 使用 buildx 构建 arm64 镜像
echo -e "${YELLOW}Starting build (this may take a while)...${NC}"
docker buildx build "${BUILD_ARGS[@]}" -t "$IMAGE_NAME:$IMAGE_TAG" --load -f "$DOCKERFILE_PATH" .

BUILD_EXIT_CODE=$?

# 清理临时文件
if [ "$USE_LOCAL_IMAGE" = true ]; then
    if [ -f "Dockerfile.arm64.local" ]; then
        rm -f Dockerfile.arm64.local
    fi
    # 清理可能残留的临时 tar 文件
    rm -f /tmp/ubuntu-arm64-*.tar 2>/dev/null || true
fi

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}Build completed successfully!${NC}"
    
    # 显示镜像信息
    echo ""
    echo -e "${BLUE}=== Image Information ===${NC}"
    docker images "$IMAGE_NAME:$IMAGE_TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    # 检查镜像架构
    echo ""
    echo -e "${BLUE}=== Image Architecture ===${NC}"
    docker inspect "$IMAGE_NAME:$IMAGE_TAG" --format '{{.Architecture}}' || echo "无法检测架构"
else
    echo -e "${RED}Build failed!${NC}"
    echo ""
    echo -e "${YELLOW}=== Troubleshooting ===${NC}"
    echo -e "${YELLOW}If you see network timeout errors, try one of the following:${NC}"
    echo ""
    echo -e "${BLUE}1. Configure Docker registry mirrors:${NC}"
    echo -e "   sudo ./configure-docker-mirrors.sh"
    echo ""
    echo -e "${BLUE}2. Set HTTP/HTTPS proxy:${NC}"
    echo -e "   export HTTP_PROXY=http://proxy.example.com:8080"
    echo -e "   export HTTPS_PROXY=http://proxy.example.com:8080"
    echo -e "   ./build-arm64.sh --host 192.168.2.4 --port 8091"
    echo ""
    echo -e "${BLUE}3. Wait for network connection to stabilize and retry${NC}"
    echo ""
    exit 1
fi

# 运行容器
if [ "$RUN_CONTAINER" = true ]; then
    echo ""
    echo -e "${YELLOW}Starting ARM64 container...${NC}"
    
    # 检查是否存在旧容器
    OLD_CONTAINER_EXISTS=false
    TEMP_CONTAINER_NAME="${CONTAINER_NAME}-new-$$"
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        OLD_CONTAINER_EXISTS=true
        echo "Found existing container: ${CONTAINER_NAME}"
        echo "Will use temporary name for new container: ${TEMP_CONTAINER_NAME}"
    fi
    
    # 启动新容器（使用临时名称和 --platform 指定架构）
    docker run -d \
        --name "$TEMP_CONTAINER_NAME" \
        --platform linux/arm64 \
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
        echo -e "${GREEN}New container started successfully!${NC}"
        
        # 新容器启动成功，现在可以安全删除旧容器并重命名新容器
        if [ "$OLD_CONTAINER_EXISTS" = true ]; then
            echo "Stopping and removing old container..."
            docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
            docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
            
            echo "Renaming new container to ${CONTAINER_NAME}..."
            docker rename "$TEMP_CONTAINER_NAME" "$CONTAINER_NAME"
        else
            # 如果没有旧容器，直接重命名
            docker rename "$TEMP_CONTAINER_NAME" "$CONTAINER_NAME"
        fi
        echo ""
        echo -e "${GREEN}=== Container Information ===${NC}"
        echo "  Container Name: $CONTAINER_NAME"
        echo "  Platform: linux/arm64"
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
        echo -e "${YELLOW}等待容器启动（10秒）...${NC}"
        sleep 10
        
        # 检查容器状态
        echo ""
        echo -e "${BLUE}=== Container Status ===${NC}"
        docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        
        # 检查容器架构
        echo ""
        echo -e "${BLUE}=== Container Architecture ===${NC}"
        docker exec "$CONTAINER_NAME" uname -m 2>/dev/null || echo "无法检测容器架构"
        
        # 测试健康检查
        echo ""
        echo -e "${BLUE}=== Health Check ===${NC}"
        if curl -s -f "http://$PROXY_HOST:$PROXY_PORT/health" > /dev/null; then
            echo -e "${GREEN}✓ Health check passed${NC}"
        else
            echo -e "${YELLOW}⚠ Health check failed (container may still be starting)${NC}"
        fi
    else
        echo -e "${RED}Failed to start new container!${NC}"
        
        # 清理临时容器
        docker rm "$TEMP_CONTAINER_NAME" > /dev/null 2>&1 || true
        
        # 新容器启动失败，尝试恢复旧容器
        if [ "$OLD_CONTAINER_EXISTS" = true ]; then
            echo -e "${YELLOW}Attempting to restart old container...${NC}"
            docker start "$CONTAINER_NAME" > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Old container restored successfully!${NC}"
            else
                echo -e "${RED}Failed to restore old container. Manual intervention required.${NC}"
            fi
        fi
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"

