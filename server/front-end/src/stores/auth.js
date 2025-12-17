import { defineStore } from 'pinia';
import { ref } from 'vue';
import { login as loginApi, register as registerApi, logout as logoutApi, getMe } from '../api/auth';
import router from '../router';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const isAuthenticated = ref(false);

  /**
   * 登录
   */
  async function login(username, password) {
    try {
      const response = await loginApi({ username, password });
      if (response.success) {
        user.value = response.data.user;
        isAuthenticated.value = true;
        return { success: true };
      }
      return { success: false, message: '登录失败' };
    } catch (error) {
      return { success: false, message: error.message || '登录失败' };
    }
  }

  /**
   * 注册
   */
  async function register(userData) {
    try {
      const response = await registerApi(userData);
      if (response.success) {
        return { success: true, message: response.message || '注册成功' };
      }
      return { success: false, message: response.error?.message || '注册失败' };
    } catch (error) {
      // 如果错误响应中有错误信息，使用它
      if (error.response?.data?.error?.message) {
        return { success: false, message: error.response.data.error.message };
      }
      return { success: false, message: error.message || '注册失败' };
    }
  }

  /**
   * 注销
   */
  async function logout() {
    try {
      await logoutApi();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      user.value = null;
      isAuthenticated.value = false;
      router.push('/login');
    }
  }

  /**
   * 获取当前用户信息
   * @param {boolean} silent - 是否静默模式（不显示错误消息）
   */
  async function fetchUser(silent = true) {
    try {
      const response = await getMe(silent);
      if (response.success) {
        user.value = response.data;
        isAuthenticated.value = true;
        return true;
      }
      user.value = null;
      isAuthenticated.value = false;
      return false;
    } catch (error) {
      // 静默处理错误，不抛出异常
      user.value = null;
      isAuthenticated.value = false;
      return false;
    }
  }

  /**
   * 检查登录状态
   */
  async function checkAuth() {
    // 如果已经认证，直接返回true
    if (isAuthenticated.value) {
      return true;
    }
    // 否则尝试获取用户信息
    return await fetchUser();
  }

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    fetchUser,
    checkAuth
  };
});

