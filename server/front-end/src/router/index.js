import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('../components/Layout/Main.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue')
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/Profile.vue')
      },
      {
        path: 'system-config',
        name: 'SystemConfig',
        component: () => import('../views/SystemConfig.vue')
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫
router.beforeEach(async (to, from, next) => {
  try {
    const authStore = useAuthStore();
    
    if (to.meta.requiresAuth) {
      // 需要认证的路由
      const isAuthenticated = await authStore.checkAuth();
      if (!isAuthenticated) {
        // 未认证，跳转到登录页
        next({ name: 'Login', query: { redirect: to.fullPath } });
      } else {
        next();
      }
    } else {
      // 不需要认证的路由（登录页、注册页）
      if (to.name === 'Login' || to.name === 'Register') {
        // 如果已经登录，跳转到首页
        // 静默检查，不显示错误消息
        try {
          const isAuthenticated = await authStore.checkAuth();
          if (isAuthenticated) {
            next({ name: 'Dashboard' });
          } else {
            next();
          }
        } catch (error) {
          // 检查失败，允许访问登录页
          next();
        }
      } else {
        next();
      }
    }
  } catch (error) {
    console.error('Router guard error:', error);
    // 如果出错，允许访问登录页
    if (to.name !== 'Login' && to.name !== 'Register') {
      next({ name: 'Login' });
    } else {
      next();
    }
  }
});

export default router;

