const jsonStore = require('../json-store');

/**
 * 用户模型
 */
class UserModel {
  /**
   * 创建用户
   */
  static async create(userData) {
    const { username, passwordHash, email } = userData;
    const result = await jsonStore.insert('users', {
      username,
      password_hash: passwordHash,
      email
    });
    return result;
  }

  /**
   * 根据ID查找用户
   */
  static async findById(id) {
    return await jsonStore.findById('users', id);
  }

  /**
   * 根据用户名查找用户
   */
  static async findByUsername(username) {
    const users = await jsonStore.findAll('users', {
      where: { username }
    });
    return users.length > 0 ? users[0] : null;
  }

  /**
   * 根据邮箱查找用户
   */
  static async findByEmail(email) {
    const users = await jsonStore.findAll('users', {
      where: { email }
    });
    return users.length > 0 ? users[0] : null;
  }

  /**
   * 更新用户信息
   */
  static async update(id, userData) {
    const { username, passwordHash, email } = userData;
    const updateData = {};

    if (username !== undefined) {
      updateData.username = username;
    }
    if (passwordHash !== undefined) {
      updateData.password_hash = passwordHash;
    }
    if (email !== undefined) {
      updateData.email = email;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    return await jsonStore.update('users', id, updateData);
  }

  /**
   * 删除用户
   */
  static async delete(id) {
    return await jsonStore.delete('users', id);
  }

  /**
   * 获取所有用户
   */
  static async findAll() {
    const users = await jsonStore.findAll('users');
    // 只返回非敏感字段
    return users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
  }
}

module.exports = UserModel;
