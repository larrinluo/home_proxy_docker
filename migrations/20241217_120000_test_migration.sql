-- Migration: 20241217_120000_test_migration
-- Description: 测试迁移脚本 - 添加测试表

-- 创建测试表（用于验证迁移功能）
CREATE TABLE IF NOT EXISTS test_migration_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_test_migration_name ON test_migration_table(name);

