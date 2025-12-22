const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 本地开发环境使用相对路径，生产环境使用绝对路径
const DB_PATH = process.env.DB_PATH || (process.env.NODE_ENV === 'development' 
  ? './data/database/database.db' 
  : '/data/database/database.db');
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

/**
 * 获取所有迁移文件
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort(); // 按文件名排序（应该按时间戳排序）

  return files.map(file => ({
    filename: file,
    path: path.join(MIGRATIONS_DIR, file),
    version: file.replace('.sql', '')
  }));
}

/**
 * 获取已执行的迁移版本
 */
function getAppliedMigrations(db) {
  return new Promise((resolve, reject) => {
    // 检查schema_migrations表是否存在
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'",
      [],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          // 表不存在，返回空数组
          resolve([]);
          return;
        }

        // 获取已执行的迁移
        db.all(
          'SELECT version FROM schema_migrations ORDER BY version',
          [],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(rows.map(row => row.version));
          }
        );
      }
    );
  });
}

/**
 * 记录迁移执行
 */
function recordMigration(db, version) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP)',
      [version],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

/**
 * 执行迁移文件
 */
function executeMigration(db, migrationFile) {
  return new Promise((resolve, reject) => {
    const sql = fs.readFileSync(migrationFile.path, 'utf8');
    
    db.exec(sql, (err) => {
      if (err) {
        reject(new Error(`Migration ${migrationFile.filename} failed: ${err.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * 运行所有待执行的迁移
 */
async function runMigrations() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
    });

    // 启用外键约束
    db.run('PRAGMA foreign_keys = ON');

    (async () => {
      try {
        // 确保数据库目录存在
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        // 确保schema_migrations表存在
        await new Promise((resolve, reject) => {
          db.run(
            `CREATE TABLE IF NOT EXISTS schema_migrations (
              version TEXT PRIMARY KEY,
              applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // 获取所有迁移文件和已执行的迁移
        const migrationFiles = getMigrationFiles();
        const appliedMigrations = await getAppliedMigrations(db);

        console.log(`Found ${migrationFiles.length} migration files`);
        console.log(`Applied migrations: ${appliedMigrations.length}`);

        // 找出待执行的迁移
        const pendingMigrations = migrationFiles.filter(
          m => !appliedMigrations.includes(m.version)
        );

        if (pendingMigrations.length === 0) {
          console.log('No pending migrations');
          db.close();
          resolve();
          return;
        }

        console.log(`Running ${pendingMigrations.length} pending migrations...`);

        // 执行每个待执行的迁移
        for (const migration of pendingMigrations) {
          console.log(`Running migration: ${migration.filename}`);
          
          try {
            // 开始事务
            await new Promise((resolve, reject) => {
              db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            // 执行迁移
            await executeMigration(db, migration);

            // 记录迁移
            await recordMigration(db, migration.version);

            // 提交事务
            await new Promise((resolve, reject) => {
              db.run('COMMIT', (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            console.log(`Migration ${migration.filename} completed successfully`);
          } catch (error) {
            // 回滚事务
            await new Promise((resolve) => {
              db.run('ROLLBACK', () => resolve());
            });
            throw error;
          }
        }

        console.log('All migrations completed successfully');
        db.close();
        resolve();
      } catch (error) {
        db.close();
        reject(error);
      }
    })();
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration process failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };


