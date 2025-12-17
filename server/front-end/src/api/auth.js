import request from '../utils/request';

/**
 * 用户注册
 */
export function register(data) {
  return request({
    url: '/v1/auth/register',
    method: 'post',
    data
  });
}

/**
 * 用户登录
 */
export function login(data) {
  return request({
    url: '/v1/auth/login',
    method: 'post',
    data
  });
}

/**
 * 用户注销
 */
export function logout() {
  return request({
    url: '/v1/auth/logout',
    method: 'post'
  });
}

/**
 * 获取当前用户信息
 * @param {boolean} silent - 是否静默模式（不显示错误消息）
 */
export function getMe(silent = false) {
  return request({
    url: '/v1/auth/me',
    method: 'get',
    silent // 传递静默标志
  });
}

