import request from '../utils/request';

export function getSystemConfigs() {
  return request({
    url: '/v1/system-configs',
    method: 'get'
  });
}

export function getSystemConfig(key) {
  return request({
    url: `/v1/system-configs/${key}`,
    method: 'get'
  });
}

export function updateSystemConfig(key, value) {
  return request({
    url: `/v1/system-configs/${key}`,
    method: 'put',
    data: { value }
  });
}

/**
 * 获取当前服务地址（动态获取）
 */
export function getServiceAddress() {
  return request({
    url: '/v1/system-configs/service-address',
    method: 'get'
  });
}

