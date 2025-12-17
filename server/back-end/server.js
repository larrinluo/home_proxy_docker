const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
require('dotenv').config();

const db = require('./db/index');
const { initDatabase } = require('./scripts/init-db');
const proxyStatusMonitor = require('./services/proxy-status-monitor');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // 允许的源列表
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.2.4:5173',
      process.env.CORS_ORIGIN
    ].filter(Boolean); // 移除undefined值
    
    // 如果没有origin（比如同源请求或Postman），允许
    if (!origin) {
      return callback(null, true);
    }
    
    // 检查origin是否在允许列表中
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // 开发环境：允许所有来源（可选，生产环境应移除）
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session配置
app.use(session({
  store: new SQLiteStore({
    db: process.env.DB_PATH || './data/database.db',
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-here-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000, // 24小时
    sameSite: 'lax'
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

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    console.log('Database initialized');

    // 启动服务器（监听所有网络接口）
    app.listen(PORT, '0.0.0.0', () => {
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

// 仅在非测试环境且直接运行此文件时启动服务器
if (require.main === module && process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;

