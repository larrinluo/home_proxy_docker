const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
require('dotenv').config();

const db = require('./db/index');
const { initDatabase } = require('./scripts/init-db');
const proxyStatusMonitor = require('./services/proxy-status-monitor');
const { getFullVersionInfo } = require('./utils/version');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // 如果没有origin（比如同源请求、Postman或服务器端请求），允许
    if (!origin) {
      return callback(null, true);
    }
    
    // 从环境变量读取允许的源列表（支持逗号分隔的多个值）
    const corsOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    
    // 开发环境：允许常见的本地开发地址
    const devOrigins = process.env.NODE_ENV === 'development' ? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ] : [];
    
    // 生产环境：根据 PROXY_HOST 和 PROXY_PORT 动态生成允许的 Origin
    const dynamicOrigins = [];
    if (process.env.NODE_ENV === 'production') {
      const proxyHost = process.env.PROXY_HOST;
      const proxyPort = process.env.PROXY_PORT || '8090';
      
      if (proxyHost) {
        // 生成 http://HOST:PORT 格式的 Origin
        dynamicOrigins.push(`http://${proxyHost}:${proxyPort}`);
        // 如果 host 是 IP 地址，也允许 localhost（用于本地访问）
        if (/^\d+\.\d+\.\d+\.\d+$/.test(proxyHost)) {
          dynamicOrigins.push(`http://localhost:${proxyPort}`);
        }
      } else {
        // 如果没有设置 PROXY_HOST，允许 localhost
        dynamicOrigins.push(`http://localhost:${proxyPort}`);
      }
    }
    
    // 合并所有允许的源
    const allowedOrigins = [...corsOrigins, ...devOrigins, ...dynamicOrigins];
    
    // 检查origin是否在允许列表中
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // 生产环境：在Docker容器中，前端和后端在同一容器，通过nginx代理
    // 如果请求的Origin与当前服务的Host匹配，允许（同源策略）
    if (process.env.NODE_ENV === 'production') {
      try {
        const originUrl = new URL(origin);
        // 允许与当前服务同源的请求（通过nginx代理时，Host会被正确设置）
        // 这里允许所有同源请求，因为nginx已经处理了路由
        return callback(null, true);
      } catch (e) {
        // URL解析失败，拒绝
        return callback(new Error('Invalid origin'));
      }
    }
    
    // 开发环境：允许所有来源
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // 其他情况：拒绝
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session配置
// secure: 如果使用 HTTPS，设置为 true；如果使用 HTTP，设置为 false
// 可以通过环境变量 SESSION_SECURE 显式控制（'true' 或 'false'）
// 如果没有设置 SESSION_SECURE，则根据 PROXY_PROTOCOL 判断（'https' 时使用 true）
// 默认情况下使用 false（允许 HTTP 环境下的 cookie 正常发送）
const isSecure = process.env.SESSION_SECURE !== undefined
  ? process.env.SESSION_SECURE === 'true'
  : (process.env.PROXY_PROTOCOL === 'https');

// SQLiteStore配置
// 延迟初始化SQLiteStore，使用dir+db方式，让SQLiteStore在需要时再打开数据库
// connect-sqlite3支持两种方式：
// 1. db: 完整路径（立即打开）
// 2. dir + db: 目录和文件名（延迟打开）
// 本地开发环境使用相对路径，生产环境使用绝对路径
const dbPath = process.env.DB_PATH || (process.env.NODE_ENV === 'development' 
  ? './data/database/database.db' 
  : '/data/database/database.db');
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
const sessionStoreOptions = {
  dir: path.dirname(resolvedDbPath),
  db: path.basename(resolvedDbPath),
  table: 'sessions'
};

let sessionStore;
try {
  sessionStore = new SQLiteStore(sessionStoreOptions);
} catch (storeErr) {
  console.error('Error creating SQLiteStore:', storeErr);
  // 如果SQLiteStore创建失败，使用内存session store作为fallback
  console.warn('Falling back to memory session store');
  sessionStore = null; // 使用默认的MemoryStore
}
app.use(session({
  store: sessionStore || undefined,
  secret: process.env.SESSION_SECRET || 'your-secret-key-here-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isSecure, // 默认在 HTTP 环境下为 false，允许 cookie 正常发送
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24小时
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax' // 在HTTP环境下使用lax，允许跨站请求携带cookie
  }
}));

// API路由
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/system-configs', require('./routes/system-configs'));
app.use('/api/v1/pac', require('./routes/pac'));
app.use('/api/v1/host-configs', require('./routes/host-configs'));
app.use('/api/v1/proxy-services', require('./routes/proxy-services'));
app.get('/proxy.pac', require('./routes/pac'));

// 健康检查 - 存活检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 就绪检查 - 检查服务是否准备好接收请求
app.get('/ready', async (req, res) => {
  try {
    const checks = {
      database: false,
      services: true
    };

    // 检查数据库连接
    try {
      // 确保数据库连接已打开
      if (db.ensureOpen && !db.db) {
        await db.ensureOpen();
      }
      if (db.db) {
        await db.get('SELECT 1');
        checks.database = true;
      }
    } catch (error) {
      console.error('Database check failed:', error);
    }

    // 检查代理服务状态（可选）
    // 这里可以添加更多的健康检查逻辑

    const isReady = checks.database && checks.services;

    if (isReady) {
      res.json({
        status: 'ready',
        checks,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        checks,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 版本信息API
app.get('/api/version', async (req, res) => {
  try {
    const versionInfo = await getFullVersionInfo(db);
    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    console.error('Failed to get version info:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VERSION_ERROR',
        message: 'Failed to get version information'
      }
    });
  }
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    }
  });
});

// 启动服务器
let server = null;

async function startServer() {
  try {
    // 确保数据库连接已打开
    if (db.ensureOpen) {
      await db.ensureOpen();
    }
    
    // 初始化数据库（如果不存在）
    await initDatabase();
    console.log('Database initialized');

    // 启动服务器（监听所有网络接口）
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on http://0.0.0.0:${PORT}`);
      console.log(`Local: http://localhost:${PORT}`);
      console.log(`Network: http://192.168.2.4:${PORT}`);
      
      // 启动代理服务状态监控（仅在非测试环境）
      if (process.env.NODE_ENV !== 'test') {
        proxyStatusMonitor.start();
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭函数
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received, starting graceful shutdown...`);
  
  const shutdownTimeout = parseInt(process.env.SHUTDOWN_TIMEOUT) || 30000; // 默认30秒
  let shutdownTimer = null;

  const forceShutdown = () => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  };

  shutdownTimer = setTimeout(forceShutdown, shutdownTimeout);

  try {
    // 1. 停止接收新请求
    if (server) {
      server.close(() => {
        console.log('HTTP server closed');
      });
    }

    // 2. 等待正在处理的请求完成（给一些时间）
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. 停止代理服务状态监控
    if (process.env.NODE_ENV !== 'test') {
      try {
        proxyStatusMonitor.stop();
        console.log('Proxy status monitor stopped');
      } catch (error) {
        console.error('Error stopping proxy status monitor:', error);
      }
    }

    // 4. 停止所有运行的代理服务
    const processManager = require('./services/proxy-process-manager');
    try {
      // 获取所有运行中的代理服务并停止
      const ProxyServiceModel = require('./db/models/proxy-services');
      const runningServices = await ProxyServiceModel.findAll({ status: 'running' });
      
      console.log(`Stopping ${runningServices.length} running proxy services...`);
      for (const service of runningServices) {
        try {
          await processManager.stopService(service.id);
          console.log(`Stopped proxy service ${service.id}`);
        } catch (error) {
          console.error(`Error stopping proxy service ${service.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error stopping proxy services:', error);
    }

    // 5. 关闭数据库连接
    try {
      await db.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }

    // 6. 清除定时器并退出
    clearTimeout(shutdownTimer);
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

// 注册信号处理器
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// 仅在非测试环境且直接运行此文件时启动服务器
if (require.main === module && process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;

