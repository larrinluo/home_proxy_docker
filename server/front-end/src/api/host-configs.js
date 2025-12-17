import request from '../utils/request';

export function getHostConfigs(params) {
  return request({
    url: '/v1/host-configs',
    method: 'get',
    params
  });
}

export function createHostConfig(data) {
  return request({
    url: '/v1/host-configs',
    method: 'post',
    data
  });
}

export function updateHostConfig(id, data) {
  return request({
    url: `/v1/host-configs/${id}`,
    method: 'put',
    data
  });
}

export function deleteHostConfig(id) {
  return request({
    url: `/v1/host-configs/${id}`,
    method: 'delete'
  });
}

export function checkHostConflict(data) {
  return request({
    url: '/v1/host-configs/check-conflict',
    method: 'post',
    data
  });
}

export function enableHostConfig(id) {
  return request({
    url: `/v1/host-configs/${id}/enable`,
    method: 'post'
  });
}

export function disableHostConfig(id) {
  return request({
    url: `/v1/host-configs/${id}/disable`,
    method: 'post'
  });
}

export function testHost(data) {
  return request({
    url: '/v1/host-configs/test-host',
    method: 'post',
    data
  });
}

