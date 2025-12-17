const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/v1/auth/register
 * 用户注册
 */
router.post('/register', validateRegister, authController.register);

/**
 * POST /api/v1/auth/login
 * 用户登录
 */
router.post('/login', validateLogin, authController.login);

/**
 * POST /api/v1/auth/logout
 * 用户注销
 */
router.post('/logout', requireAuth, authController.logout);

/**
 * GET /api/v1/auth/me
 * 获取当前用户信息
 */
router.get('/me', requireAuth, authController.getMe);

module.exports = router;
