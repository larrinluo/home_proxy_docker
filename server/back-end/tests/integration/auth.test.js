const request = require('supertest');
const app = require('../../server');
const db = require('../../db/index');
const UserModel = require('../../db/models/users');
const SystemConfigModel = require('../../db/models/system-configs');
const bcrypt = require('bcryptjs');

describe('Authentication API', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db.run('DELETE FROM users');
    
    // 确保注册功能启用
    await SystemConfigModel.update('register_enabled', 'true');
  });

  describe('POST /api/v1/auth/register', () => {
    test('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'newuser',
          password: 'password123',
          email: 'newuser@example.com'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('username', 'newuser');
    });

    test('should reject duplicate username', async () => {
      await UserModel.create({
        username: 'existinguser',
        passwordHash: 'hash',
        email: 'existing@example.com'
      });
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'existinguser',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    test('should validate password length', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'shortpass',
          password: '12345' // Too short
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      await UserModel.create({
        username: 'testuser',
        passwordHash: passwordHash,
        email: 'test@example.com'
      });
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('username', 'testuser');
    });

    test('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });
  });
});

