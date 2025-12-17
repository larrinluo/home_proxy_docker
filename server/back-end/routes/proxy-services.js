const express = require('express');
const router = express.Router();
const proxyServiceController = require('../controllers/proxyServiceController');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/v1/proxy-services
 * 创建代理服务
 */
router.post('/', requireAuth, proxyServiceController.create);

/**
 * GET /api/v1/proxy-services
 * 获取代理服务列表
 */
router.get('/', requireAuth, proxyServiceController.list);

/**
 * POST /api/v1/proxy-services/connect
 * 连接代理服务（实时日志推送）
 * 注意：必须在/:id路由之前定义，否则connect会被当作id
 */
router.post('/connect', requireAuth, proxyServiceController.connect);

/**
 * GET /api/v1/proxy-services/:id
 * 获取代理服务详情
 */
router.get('/:id', requireAuth, proxyServiceController.getById);

/**
 * PUT /api/v1/proxy-services/:id
 * 更新代理服务
 */
router.put('/:id', requireAuth, proxyServiceController.update);

/**
 * DELETE /api/v1/proxy-services/:id
 * 删除代理服务
 */
router.delete('/:id', requireAuth, proxyServiceController.delete);

/**
 * POST /api/v1/proxy-services/:id/start
 * 启动代理服务
 */
router.post('/:id/start', requireAuth, proxyServiceController.start);

/**
 * POST /api/v1/proxy-services/:id/stop
 * 停止代理服务
 */
router.post('/:id/stop', requireAuth, proxyServiceController.stop);

module.exports = router;

