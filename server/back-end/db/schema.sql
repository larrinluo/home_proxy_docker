-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 代理服务表
CREATE TABLE IF NOT EXISTS proxy_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    jump_host TEXT NOT NULL,
    jump_port INTEGER NOT NULL DEFAULT 22,
    jump_username TEXT NOT NULL,
    proxy_port INTEGER NOT NULL UNIQUE,
    ssh_key_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'stopped',
    process_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Host配置表
CREATE TABLE IF NOT EXISTS host_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    proxy_service_id INTEGER NOT NULL,
    hosts TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proxy_service_id) REFERENCES proxy_services(id) ON DELETE CASCADE
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 数据库迁移表
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_proxy_services_status ON proxy_services(status);
CREATE INDEX IF NOT EXISTS idx_proxy_services_created_at ON proxy_services(created_at);
CREATE INDEX IF NOT EXISTS idx_host_configs_proxy_service_id ON host_configs(proxy_service_id);
CREATE INDEX IF NOT EXISTS idx_host_configs_name ON host_configs(name);

-- 初始化系统配置数据
INSERT OR IGNORE INTO system_configs (key, value, description) 
VALUES 
  ('register_enabled', 'true', '允许注册用户'),
  ('pac_service_host', '192.168.1.4', '代理配置服务地址'),
  ('pac_service_port', '8090', '代理配置服务端口');

-- 记录初始版本
INSERT OR IGNORE INTO schema_migrations (version) 
VALUES ('1.0.0');


