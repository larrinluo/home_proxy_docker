const bcrypt = require('bcryptjs');
const UserModel = require('../db/models/users');

/**
 * 修改密码
 */
async function changePassword(req, res) {
  try {
    const userId = req.session.userId;
    const { oldPassword, newPassword } = req.body;

    // 获取用户信息
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

    // 验证旧密码
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: '旧密码错误'
        }
      });
    }

    // 加密新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await UserModel.update(userId, { passwordHash });

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '密码修改失败，请稍后重试'
      }
    });
  }
}

/**
 * 更新用户信息
 */
async function updateProfile(req, res) {
  try {
    const userId = req.session.userId;
    const { email } = req.body;

    // 如果提供了邮箱，检查邮箱是否已被使用
    if (email) {
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail && existingEmail.id !== userId) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: '邮箱已被使用'
          }
        });
      }
    }

    // 更新用户信息
    const user = await UserModel.update(userId, { email });

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      message: '更新成功'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新失败，请稍后重试'
      }
    });
  }
}

module.exports = {
  changePassword,
  updateProfile
};








