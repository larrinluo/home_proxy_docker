# 数据库迁移脚本

## 命名规范

迁移脚本文件命名格式：`YYYYMMDD_HHMMSS_description.sql`

示例：
- `20240101_120000_initial_schema.sql`
- `20240115_143000_add_user_email_index.sql`

## 迁移脚本模板

```sql
-- Migration: YYYYMMDD_HHMMSS_description
-- Description: 描述本次迁移的内容

-- 示例：添加新表
CREATE TABLE IF NOT EXISTS new_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 示例：添加索引
CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table(name);

-- 示例：修改表结构
-- ALTER TABLE existing_table ADD COLUMN new_column TEXT;
```

## 注意事项

1. 迁移脚本应该是幂等的（可以安全地多次执行）
2. 使用 `IF NOT EXISTS` 和 `IF EXISTS` 来确保幂等性
3. 不要删除或修改已有的迁移脚本
4. 迁移脚本按文件名排序执行
5. 每个迁移脚本应该只做一件事

## 执行迁移

迁移会在容器启动时自动执行（通过 entrypoint.sh）。

也可以手动执行：
```bash
DB_PATH=/data/database/database.db node scripts/migrate.js
```


