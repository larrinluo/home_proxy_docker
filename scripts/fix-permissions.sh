#!/bin/bash

# 修复数据库文件权限脚本
# 将数据库目录和文件的所有者设置为当前用户，确保容器和宿主机用户权限一致

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"

echo -e "${BLUE}=== 修复数据库文件权限 ===${NC}"
echo ""

# 检查当前用户
CURRENT_USER=$(whoami)
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

echo "当前用户: $CURRENT_USER (UID:$CURRENT_UID, GID:$CURRENT_GID)"
echo "数据目录: $DATA_DIR"
echo ""

# 检查数据目录是否存在
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}数据目录不存在，创建中...${NC}"
    mkdir -p "$DATA_DIR/database" "$DATA_DIR/ssh-keys" "$DATA_DIR/logs" "$DATA_DIR/pac"
fi

# 修复数据库目录权限
if [ -d "$DATA_DIR/database" ]; then
    echo -e "${BLUE}修复数据库目录权限...${NC}"
    sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$DATA_DIR/database"
    chmod 755 "$DATA_DIR/database"
    echo -e "${GREEN}✓ 数据库目录权限已修复${NC}"
    
    # 修复数据库文件权限
    if [ -f "$DATA_DIR/database/database.db" ]; then
        sudo chown "$CURRENT_USER:$CURRENT_USER" "$DATA_DIR/database/database.db"
        chmod 664 "$DATA_DIR/database/database.db"
        echo -e "${GREEN}✓ 数据库文件权限已修复${NC}"
    fi
fi

# 修复其他数据目录权限
for dir in ssh-keys logs pac; do
    if [ -d "$DATA_DIR/$dir" ]; then
        sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$DATA_DIR/$dir"
        if [ "$dir" = "ssh-keys" ]; then
            chmod 700 "$DATA_DIR/$dir"
        else
            chmod 755 "$DATA_DIR/$dir"
        fi
        echo -e "${GREEN}✓ $dir 目录权限已修复${NC}"
    fi
done

echo ""
echo -e "${GREEN}=== 权限修复完成 ===${NC}"
echo ""
echo "验证权限："
ls -ld "$DATA_DIR/database"
if [ -f "$DATA_DIR/database/database.db" ]; then
    ls -l "$DATA_DIR/database/database.db"
fi
echo ""
echo -e "${YELLOW}提示：如果容器正在运行，请重启容器以使权限生效：${NC}"
echo "  docker restart socks-proxy"

