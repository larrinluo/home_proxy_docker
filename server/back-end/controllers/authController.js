const bcrypt = require('bcryptjs');
const UserModel = require('../db/models/users');
const SystemConfigModel = require('../db/models/system-configs');

/**
 * 用户注册
 */
async function register(req, res) {
  try {
    // 检查注册开关
    const registerEnabled = await SystemConfigModel.getBoolean('register_enabled', true);
    if (!registerEnabled) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'REGISTER_DISABLED',
          message: '账号注册功能已关闭'
        }
      });
    }

    const { username, password, email } = req.body;

    // 检查用户名是否已存在
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USERNAME_EXISTS',
          message: '用户名已存在'
        }
      });
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: '邮箱已被使用'
          }
        });
      }
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await UserModel.create({
      username,
      passwordHash,
      email: email || null
    });

    // 返回用户信息（不包含密码）
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      message: '注册成功'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '注册失败，请稍后重试'
      }
    });
  }
}

/**
 * 用户登录
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await UserModel.findByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        }
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误'
        }
      });
    }

    // 设置Session
    req.session.userId = user.id;
    req.session.username = user.username;

    // 显式保存session，确保cookie正确设置
    return new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: '登录失败，session保存失败'
            }
          });
        }

        // 返回用户信息
        res.json({
          success: true,
          data: {
            user: {
              id: user.id,
              username: user.username,
              email: user.email
            }
          },
          message: '登录成功'
        });
        resolve();
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '登录失败，请稍后重试'
      }
    });
  }
}

/**
 * 用户注销
 */
async function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '注销失败'
        }
      });
    }
    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: '注销成功'
    });
  });
}

/**
 * 获取当前用户信息
 */
async function getMe(req, res) {
  try {
    const userId = req.session.userId;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在'
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取用户信息失败'
      }
    });
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe
};

