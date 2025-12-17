/**
 * 认证中间件
 * 用于保护需要登录才能访问的路由
 */

/**
 * 要求用户已登录
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '请先登录'
      }
    });
  }
  next();
}

module.exports = {
  requireAuth
};







