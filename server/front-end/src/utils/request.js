import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '../router';

// 创建axios实例
// 优先使用环境变量，如果没有则使用默认值
// 如果前端和后端不在同一服务器，需要设置 VITE_API_BASE_URL 环境变量
// 开发环境：使用相对路径，让Vite的proxy处理（避免跨域和cookie问题）
// 生产环境：在Docker容器中，前端和后端在同一容器，使用相对路径 /api 让nginx代理
// 如果设置了 VITE_API_BASE_URL，则使用该值（用于前后端分离部署）
const API_BASE_URL = import.meta.env.PROD 
  ? (import.meta.env.VITE_API_BASE_URL || '/api')
  : '/api'; // 开发环境使用相对路径，通过Vite proxy转发

const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // 支持cookie
  validateStatus: function (status) {
    // 接受 200-299 范围内的状态码为成功（包括 201 Created）
    return status >= 200 && status < 300;
  }
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 如果是文本响应（如/proxy.pac），直接返回
    if (response.config.responseType === 'text' || typeof response.data === 'string') {
      return response;
    }
    
    const res = response.data;
    
    // 如果返回的状态码为200，说明接口请求成功
    if (res.success) {
      return res;
    } else {
      // 如果返回的状态码不是200，说明接口请求失败
      // 检查是否是静默模式
      if (!response.config.silent) {
        ElMessage.error(res.error?.message || '请求失败');
      }
      return Promise.reject(new Error(res.error?.message || '请求失败'));
    }
  },
  (error) => {
    // 处理HTTP错误
    if (error.response) {
      const { status, data, config } = error.response;
      const currentPath = router.currentRoute.value.path;
      const isSilent = config?.silent || false;
      const isAuthCheck = config?.url?.includes('/auth/me');
      
      if (status === 401) {
        // 未授权处理
        // 如果是认证检查API且是静默模式，不显示错误消息
        // 如果已经在登录页或注册页，也不显示错误消息
        // 路由守卫会处理认证检查，这里只处理非认证检查的401错误
        // 但是，如果路由守卫已经检查过认证，这里不应该再显示错误消息
        // 因为路由守卫会在未认证时直接跳转到登录页
        // 所以这里只处理特殊情况：API调用时session过期
        if (!isSilent && !isAuthCheck && currentPath !== '/login' && currentPath !== '/register') {
          // 不显示错误消息，让路由守卫处理
          // 如果路由守卫没有跳转，说明可能是session过期，但用户仍然在页面上
          // 这种情况下，静默跳转到登录页，不显示错误消息（避免与路由守卫冲突）
          router.push('/login');
        }
        // 静默处理401错误，让调用方自己处理
      } else if (status === 403) {
        if (!isSilent) {
          ElMessage.error('没有权限');
        }
      } else if (status === 404) {
        if (!isSilent) {
          ElMessage.error('请求的资源不存在');
        }
      } else if (status >= 500) {
        if (!isSilent) {
          ElMessage.error('服务器错误');
        }
      } else {
        if (!isSilent) {
          ElMessage.error(data?.error?.message || '请求失败');
        }
      }
    } else {
      if (!error.config?.silent) {
        ElMessage.error('网络错误，请检查网络连接');
      }
    }
    
    return Promise.reject(error);
  }
);

export default request;

