import { describe, test, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../../src/stores/auth';
import * as authApi from '../../src/api/auth';

// Mock API
vi.mock('../../src/api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn()
}));

// Mock router
vi.mock('../../src/router', () => ({
  default: {
    push: vi.fn()
  }
}));

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com'
          }
        }
      };
      
      authApi.login.mockResolvedValue(mockResponse);
      
      const authStore = useAuthStore();
      const result = await authStore.login('testuser', 'password123');
      
      expect(result.success).toBe(true);
      expect(authStore.isAuthenticated).toBe(true);
      expect(authStore.user).toEqual(mockResponse.data.user);
      expect(authApi.login).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123'
      });
    });

    test('should handle login failure', async () => {
      const mockResponse = {
        success: false
      };
      
      authApi.login.mockResolvedValue(mockResponse);
      
      const authStore = useAuthStore();
      const result = await authStore.login('testuser', 'wrongpassword');
      
      expect(result.success).toBe(false);
      expect(authStore.isAuthenticated).toBe(false);
    });

    test('should handle login error', async () => {
      authApi.login.mockRejectedValue(new Error('Network error'));
      
      const authStore = useAuthStore();
      const result = await authStore.login('testuser', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error');
    });
  });

  describe('register', () => {
    test('should register successfully', async () => {
      const mockResponse = {
        success: true
      };
      
      authApi.register.mockResolvedValue(mockResponse);
      
      const authStore = useAuthStore();
      const result = await authStore.register({
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com'
      });
      
      expect(result.success).toBe(true);
      expect(authApi.register).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com'
      });
    });

    test('should handle registration failure', async () => {
      const mockResponse = {
        success: false
      };
      
      authApi.register.mockResolvedValue(mockResponse);
      
      const authStore = useAuthStore();
      const result = await authStore.register({
        username: 'newuser',
        password: 'password123'
      });
      
      expect(result.success).toBe(false);
    });
  });

  describe('logout', () => {
    test('should logout successfully', async () => {
      authApi.logout.mockResolvedValue({});
      
      const authStore = useAuthStore();
      authStore.user = { id: 1, username: 'testuser' };
      authStore.isAuthenticated = true;
      
      await authStore.logout();
      
      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
      expect(authApi.logout).toHaveBeenCalled();
    });
  });

  describe('fetchUser', () => {
    test('should fetch user successfully', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com'
      };
      
      const mockResponse = {
        success: true,
        data: mockUser
      };
      
      authApi.getMe.mockResolvedValue(mockResponse);
      
      const authStore = useAuthStore();
      const result = await authStore.fetchUser();
      
      expect(result).toBe(true);
      expect(authStore.user).toEqual(mockUser);
      expect(authStore.isAuthenticated).toBe(true);
    });

    test('should handle fetch user failure', async () => {
      const mockResponse = {
        success: false
      };
      
      authApi.getMe.mockResolvedValue(mockResponse);
      
      const authStore = useAuthStore();
      const result = await authStore.fetchUser();
      
      expect(result).toBe(false);
      expect(authStore.isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth', () => {
    test('should return true if already authenticated', async () => {
      const authStore = useAuthStore();
      authStore.isAuthenticated = true;
      
      const result = await authStore.checkAuth();
      
      expect(result).toBe(true);
      expect(authApi.getMe).not.toHaveBeenCalled();
    });

    test('should fetch user if not authenticated', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser'
      };
      
      const mockResponse = {
        success: true,
        data: mockUser
      };
      
      authApi.getMe.mockResolvedValue(mockResponse);
      
      const authStore = useAuthStore();
      authStore.isAuthenticated = false;
      
      const result = await authStore.checkAuth();
      
      expect(result).toBe(true);
      expect(authApi.getMe).toHaveBeenCalled();
    });
  });
});







