#!/bin/sh
set -e

echo "=== Starting container initialization ==="

# 设置数据库目录权限（确保appuser可以读写）
# 项目使用 JSON 文件存储，不需要 SQLite
echo "Setting up data directory..."
chmod 755 /data/database
chown appuser:appuser /data/database 2>/dev/null || true

# 创建默认的 JSON 数据文件（如果不存在）并修复权限
echo "Initializing JSON data files..."
for table in users.json proxy_services.json host_configs.json system_configs.json; do
    if [ ! -f "/data/database/$table" ]; then
        echo "  Creating $table..."
        echo "[]" > "/data/database/$table"
    fi
    # 确保文件所有者是 appuser（即使文件已存在）
    chown appuser:appuser "/data/database/$table" 2>/dev/null || true
    chmod 664 "/data/database/$table" 2>/dev/null || true
done
echo "JSON data files initialized"

# 修复 .backup 目录权限
if [ -d "/data/database/.backup" ]; then
    chown -R appuser:appuser "/data/database/.backup" 2>/dev/null || true
    chmod -R 755 "/data/database/.backup" 2>/dev/null || true
fi

# 清理 /app/data 目录中的旧数据库文件（如果存在）
# 这些文件可能是之前构建时留下的，不应该使用
# 确保应用只使用 /data/database/database.db
if [ -d /app/data ]; then
    echo "Warning: Found /app/data directory, cleaning up old database files..."
    # 删除所有数据库相关文件
    rm -f /app/data/database.db /app/data/database.db.backup /app/data/test-database.db 2>/dev/null || true
    # 检查 /app/data 目录中是否还有其他文件（除了 ssh-keys 目录）
    REMAINING_FILES=$(find /app/data -mindepth 1 -maxdepth 1 ! -name ssh-keys 2>/dev/null | wc -l)
    if [ "$REMAINING_FILES" -eq 0 ]; then
        # 如果只有 ssh-keys 目录或为空，保留目录结构
        echo "Cleaned up database files from /app/data, keeping directory structure"
    else
        # 如果有其他文件，只删除数据库相关文件，保留其他文件
        echo "Cleaned up database files from /app/data, other files preserved"
    fi
fi

# 设置SSH密钥目录权限
echo "Setting SSH key permissions..."
chmod 700 /data/ssh-keys
chmod 600 /data/ssh-keys/* 2>/dev/null || true

# 确保日志目录存在
mkdir -p /data/logs
chmod 755 /data/logs

# 确保PAC目录存在
mkdir -p /data/pac
chmod 755 /data/pac

echo "=== Container initialization completed ==="

# 启动supervisor
exec "$@"

