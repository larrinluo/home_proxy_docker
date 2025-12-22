/**
 * 参数验证中间件
 */

/**
 * 验证注册请求参数
 */
const validateRegister = (req, res, next) => {
  const { username, password, email } = req.body;
  const errors = [];

  // 验证用户名
  if (!username || typeof username !== 'string') {
    errors.push('用户名是必填项');
  } else if (username.length < 3 || username.length > 20) {
    errors.push('用户名长度必须在3-20个字符之间');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('用户名只能包含字母、数字和下划线');
  }

  // 验证密码
  if (!password || typeof password !== 'string') {
    errors.push('密码是必填项');
  } else if (password.length < 6 || password.length > 50) {
    errors.push('密码长度必须在6-50个字符之间');
  }

  // 验证邮箱（可选）
  if (email && typeof email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('邮箱格式不正确');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数验证失败',
        details: errors
      }
    });
  }

  next();
};

/**
 * 验证登录请求参数
 */
const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username || typeof username !== 'string') {
    errors.push('用户名是必填项');
  }

  if (!password || typeof password !== 'string') {
    errors.push('密码是必填项');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数验证失败',
        details: errors
      }
    });
  }

  next();
};

/**
 * 验证修改密码请求参数
 */
const validateChangePassword = (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const errors = [];

  if (!oldPassword || typeof oldPassword !== 'string') {
    errors.push('旧密码是必填项');
  }

  if (!newPassword || typeof newPassword !== 'string') {
    errors.push('新密码是必填项');
  } else if (newPassword.length < 6 || newPassword.length > 50) {
    errors.push('新密码长度必须在6-50个字符之间');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数验证失败',
        details: errors
      }
    });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword
};








