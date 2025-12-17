const db = require('../index');

/**
 * 用户模型
 */
class UserModel {
  /**
   * 创建用户
   */
  static async create(userData) {
    const { username, passwordHash, email } = userData;
    const sql = `
      INSERT INTO users (username, password_hash, email)
      VALUES (?, ?, ?)
    `;
    const result = await db.run(sql, [username, passwordHash, email || null]);
    return this.findById(result.lastID);
  }

  /**
   * 根据ID查找用户
   */
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return await db.get(sql, [id]);
  }

  /**
   * 根据用户名查找用户
   */
  static async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?';
    return await db.get(sql, [username]);
  }

  /**
   * 根据邮箱查找用户
   */
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return await db.get(sql, [email]);
  }

  /**
   * 更新用户信息
   */
  static async update(id, userData) {
    const { username, passwordHash, email } = userData;
    const updates = [];
    const params = [];

    if (username !== undefined) {
      updates.push('username = ?');
      params.push(username);
    }
    if (passwordHash !== undefined) {
      updates.push('password_hash = ?');
      params.push(passwordHash);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(sql, params);
    return this.findById(id);
  }

  /**
   * 删除用户
   */
  static async delete(id) {
    const sql = 'DELETE FROM users WHERE id = ?';
    await db.run(sql, [id]);
  }

  /**
   * 获取所有用户
   */
  static async findAll() {
    const sql = 'SELECT id, username, email, created_at, updated_at FROM users';
    return await db.all(sql);
  }
}

module.exports = UserModel;







