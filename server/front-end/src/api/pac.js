import request from '../utils/request';
import axios from 'axios';

export function getPACConfig() {
  return request({
    url: '/v1/pac/config',
    method: 'get'
  });
}

export function getPACFile() {
  // PAC文件返回的是纯文本，不是JSON格式
  // /proxy.pac 在根路径，不在 /api 下，所以需要单独处理
  // 在Docker容器中，使用相对路径让nginx代理
  const API_BASE_URL = import.meta.env.PROD 
    ? (import.meta.env.VITE_API_BASE_URL || '')
    : ''; // 开发环境使用相对路径，通过Vite proxy转发
  
  return axios({
    url: `${API_BASE_URL}/proxy.pac`,
    method: 'get',
    responseType: 'text',
    withCredentials: true // 支持cookie
  });
}

export function extractHostsFromPAC(pacUrl) {
  return request({
    url: '/v1/pac/extract-hosts',
    method: 'get',
    params: { pacUrl }
  });
}
