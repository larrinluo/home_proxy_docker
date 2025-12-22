const request = require('supertest');
const app = require('../../server');

/**
 * 创建测试用户并登录
 */
async function createTestUserAndLogin(username = 'testuser', password = 'testpass123') {
  // 注册用户
  await request(app)
    .post('/api/v1/auth/register')
    .send({ username, password });

  // 登录获取session
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ username, password });

  // 提取cookie
  const cookies = loginRes.headers['set-cookie'];
  return cookies;
}

/**
 * 获取认证的请求
 */
function authenticatedRequest(app, cookies) {
  return request(app).set('Cookie', cookies);
}

module.exports = {
  createTestUserAndLogin,
  authenticatedRequest
};







