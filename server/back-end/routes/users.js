const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');
const { validateChangePassword } = require('../middleware/validation');

/**
 * PUT /api/v1/users/password
 * 修改密码
 */
router.put('/password', requireAuth, validateChangePassword, userController.changePassword);

/**
 * PUT /api/v1/users/profile
 * 更新用户信息
 */
router.put('/profile', requireAuth, userController.updateProfile);

module.exports = router;








