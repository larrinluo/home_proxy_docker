#!/bin/bash

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认配置
DATA_DIR=${DATA_DIR:-./data}
BACKUP_DIR=${BACKUP_DIR:-./data/backups}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Starting backup...${NC}"

# 备份数据库
if [ -f "$DATA_DIR/database/database.db" ]; then
    echo "Backing up database..."
    cp "$DATA_DIR/database/database.db" "$BACKUP_DIR/database_$TIMESTAMP.db"
    echo -e "${GREEN}Database backed up: database_$TIMESTAMP.db${NC}"
else
    echo -e "${YELLOW}Database file not found, skipping...${NC}"
fi

# 备份SSH密钥
if [ -d "$DATA_DIR/ssh-keys" ] && [ "$(ls -A $DATA_DIR/ssh-keys)" ]; then
    echo "Backing up SSH keys..."
    tar -czf "$BACKUP_DIR/ssh-keys_$TIMESTAMP.tar.gz" -C "$DATA_DIR" ssh-keys/
    echo -e "${GREEN}SSH keys backed up: ssh-keys_$TIMESTAMP.tar.gz${NC}"
else
    echo -e "${YELLOW}SSH keys directory empty, skipping...${NC}"
fi

# 备份PAC配置
if [ -d "$DATA_DIR/pac" ] && [ "$(ls -A $DATA_DIR/pac)" ]; then
    echo "Backing up PAC configuration..."
    tar -czf "$BACKUP_DIR/pac_$TIMESTAMP.tar.gz" -C "$DATA_DIR" pac/
    echo -e "${GREEN}PAC configuration backed up: pac_$TIMESTAMP.tar.gz${NC}"
else
    echo -e "${YELLOW}PAC directory empty, skipping...${NC}"
fi

echo -e "${GREEN}Backup completed: $BACKUP_DIR${NC}"

# 显示备份文件
echo ""
echo -e "${GREEN}Backup files:${NC}"
ls -lh "$BACKUP_DIR" | grep "$TIMESTAMP"


