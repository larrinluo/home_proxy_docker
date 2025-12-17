const express = require('express');
const router = express.Router();
const pacController = require('../controllers/pacController');

/**
 * GET /api/v1/pac/config
 * 获取PAC配置JSON
 */
router.get('/config', pacController.getConfig);

/**
 * GET /proxy.pac
 * 获取PAC文件（供客户端使用，无需认证）
 */
router.get('/proxy.pac', pacController.getPACFile);

/**
 * GET /api/v1/pac/preview
 * 预览PAC文件内容（在浏览器中直接显示，不下载）
 */
router.get('/preview', pacController.previewPACFile);

/**
 * GET /api/v1/pac/extract-hosts
 * 从PAC文件中提取host列表
 */
router.get('/extract-hosts', pacController.extractHostsFromPAC);

module.exports = router;
