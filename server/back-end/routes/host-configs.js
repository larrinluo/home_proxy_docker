const express = require('express');
const router = express.Router();
const hostConfigController = require('../controllers/hostConfigController');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/v1/host-configs
 * 创建Host配置
 */
router.post('/', requireAuth, hostConfigController.create);

/**
 * GET /api/v1/host-configs
 * 获取Host配置列表
 */
router.get('/', requireAuth, hostConfigController.list);

/**
 * GET /api/v1/host-configs/:id
 * 获取Host配置详情
 */
router.get('/:id', requireAuth, hostConfigController.getById);

/**
 * PUT /api/v1/host-configs/:id
 * 更新Host配置
 */
router.put('/:id', requireAuth, hostConfigController.update);

/**
 * DELETE /api/v1/host-configs/:id
 * 删除Host配置
 */
router.delete('/:id', requireAuth, hostConfigController.delete);

/**
 * POST /api/v1/host-configs/check-conflict
 * 检查Host冲突
 */
router.post('/check-conflict', requireAuth, hostConfigController.checkConflict);
router.post('/:id/enable', requireAuth, hostConfigController.enable);
router.post('/:id/disable', requireAuth, hostConfigController.disable);
router.post('/test-host', requireAuth, hostConfigController.testHost);

module.exports = router;
