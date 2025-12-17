import request from '../utils/request';

export function changePassword(data) {
  return request({
    url: '/v1/users/password',
    method: 'put',
    data
  });
}

export function updateProfile(data) {
  return request({
    url: '/v1/users/profile',
    method: 'put',
    data
  });
}


