const express = require('express');
const router = express.Router();
const systemConfigController = require('../controllers/systemConfigController');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/v1/system-configs
 * 获取系统配置列表
 */
router.get('/', systemConfigController.list);

/**
 * GET /api/v1/system-configs/service-address
 * 获取当前服务地址（动态获取，不存储）
 * 注意：必须在 /:key 路由之前定义，避免匹配错误
 */
router.get('/service-address', systemConfigController.getServiceAddress);

/**
 * GET /api/v1/system-configs/:key
 * 获取单个系统配置
 */
router.get('/:key', systemConfigController.getByKey);

/**
 * PUT /api/v1/system-configs/:key
 * 更新系统配置
 */
router.put('/:key', requireAuth, systemConfigController.update);

module.exports = router;
