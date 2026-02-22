#!/bin/sh
set -e

echo "=== Starting container initialization ==="

# 重新编译sqlite3 native模块（确保与当前架构兼容）
echo "Rebuilding sqlite3 native module for current architecture..."
if [ ! -f /app/node_modules/sqlite3/build/Release/node_sqlite3.node ] || \
   [ /app/node_modules/sqlite3/build/Release/node_sqlite3.node -ot /app/node_modules/sqlite3/binding.gyp ]; then
    echo "Installing build dependencies and rebuilding sqlite3..."
    apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ build-essential libsqlite3-dev && \
    cd /app && \
    npm rebuild sqlite3 --build-from-source && \
    cd / && \
    apt-get remove -y python3 make g++ build-essential libsqlite3-dev && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
    echo "sqlite3 rebuild completed"
else
    echo "sqlite3 native module already built, skipping rebuild"
fi

# 初始化数据库（如果不存在）
if [ ! -f /data/database/database.db ]; then
    echo "Initializing database..."
    if DB_PATH=/data/database/database.db node /app/scripts/init-db.js; then
        echo "Database initialized successfully"
    else
        echo "Warning: Database initialization failed, but continuing..."
    fi
else
    echo "Database already exists, skipping initialization"
fi

# 执行数据库迁移
if [ -d /app/migrations ]; then
    echo "Running database migrations..."
    DB_PATH=/data/database/database.db node /app/scripts/migrate.js
    echo "Database migrations completed"
fi

# 设置数据库目录权限（确保appuser可以读写）
echo "Setting database directory permissions..."
chmod 755 /data/database
if [ -f /data/database/database.db ]; then
    # 设置文件权限为 664（所有者可读写，组可读写，其他可读）
    chmod 664 /data/database/database.db
    # 尝试设置所有者为 appuser，如果失败则保持原所有者（可能是宿主机用户）
    chown appuser:appuser /data/database/database.db 2>/dev/null || \
    chown $(stat -c '%U:%G' /data/database/database.db) /data/database/database.db 2>/dev/null || true
    # 确保文件不是只读的
    chattr -i /data/database/database.db 2>/dev/null || true
fi
# 尝试设置目录所有者为 appuser，如果失败则保持原所有者
chown appuser:appuser /data/database 2>/dev/null || \
chown $(stat -c '%U:%G' /data/database) /data/database 2>/dev/null || true
# 确保目录可写（755：所有者可读写执行，组和其他可读执行）
chmod 755 /data/database

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

