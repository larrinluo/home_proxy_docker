const request = require('supertest');
const app = require('../../server');
const db = require('../../db/index');
const ProxyServiceModel = require('../../db/models/proxy-services');
const HostConfigModel = require('../../db/models/host-configs');
const pacGenerator = require('../../services/pac-generator');

describe('PAC Configuration API', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db.run('DELETE FROM host_configs');
    await db.run('DELETE FROM proxy_services');
    
    // 清除PAC缓存
    pacGenerator.clearCache();
  });

  describe('GET /api/v1/pac/config', () => {
    test('should return direct config when no running services', async () => {
      const response = await request(app)
        .get('/api/v1/pac/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.direct).toBe(true);
      expect(response.body.data.proxyRules).toEqual([]);
    });

    test('should return PAC config with host configs', async () => {
      // 创建运行中的代理服务
      const service = await ProxyServiceModel.create({
        name: 'Test Service',
        jumpHost: '192.168.1.1',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11081,
        sshKeyPath: '/path/to/key',
        status: 'running'
      });

      // 创建Host配置
      await HostConfigModel.create({
        name: 'Test Config',
        proxyServiceId: service.id,
        hosts: ['example.com', 'test.com']
      });

      const response = await request(app)
        .get('/api/v1/pac/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.direct).toBe(false);
      expect(response.body.data.proxyRules).toHaveLength(1);
      expect(response.body.data.proxyRules[0].proxy).toBe('SOCKS5 127.0.0.1:11081');
      expect(response.body.data.proxyRules[0].domains).toContain('example.com');
      expect(response.body.data.proxyRules[0].domains).toContain('test.com');
    });

    test('should exclude stopped services from PAC config', async () => {
      // 创建运行中的代理服务
      const runningService = await ProxyServiceModel.create({
        name: 'Running Service',
        jumpHost: '192.168.1.1',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11081,
        sshKeyPath: '/path/to/key1',
        status: 'running'
      });

      // 创建停止的代理服务
      const stoppedService = await ProxyServiceModel.create({
        name: 'Stopped Service',
        jumpHost: '192.168.1.2',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11082,
        sshKeyPath: '/path/to/key2',
        status: 'stopped'
      });

      // 创建Host配置
      await HostConfigModel.create({
        name: 'Running Config',
        proxyServiceId: runningService.id,
        hosts: ['example.com']
      });

      await HostConfigModel.create({
        name: 'Stopped Config',
        proxyServiceId: stoppedService.id,
        hosts: ['test.com']
      });

      const response = await request(app)
        .get('/api/v1/pac/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.proxyRules).toHaveLength(1);
      expect(response.body.data.proxyRules[0].domains).toContain('example.com');
      expect(response.body.data.proxyRules[0].domains).not.toContain('test.com');
    });

    test('should group hosts by proxy port', async () => {
      // 创建两个运行中的代理服务
      const service1 = await ProxyServiceModel.create({
        name: 'Service 1',
        jumpHost: '192.168.1.1',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11081,
        sshKeyPath: '/path/to/key1',
        status: 'running'
      });

      const service2 = await ProxyServiceModel.create({
        name: 'Service 2',
        jumpHost: '192.168.1.2',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11082,
        sshKeyPath: '/path/to/key2',
        status: 'running'
      });

      // 创建Host配置
      await HostConfigModel.create({
        name: 'Config 1',
        proxyServiceId: service1.id,
        hosts: ['google.com']
      });

      await HostConfigModel.create({
        name: 'Config 2',
        proxyServiceId: service2.id,
        hosts: ['youtube.com', 'github.com']
      });

      const response = await request(app)
        .get('/api/v1/pac/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.proxyRules).toHaveLength(2);
      
      const rule1 = response.body.data.proxyRules.find(r => r.proxy === 'SOCKS5 127.0.0.1:11081');
      const rule2 = response.body.data.proxyRules.find(r => r.proxy === 'SOCKS5 127.0.0.1:11082');
      
      expect(rule1).toBeTruthy();
      expect(rule1.domains).toContain('google.com');
      
      expect(rule2).toBeTruthy();
      expect(rule2.domains).toContain('youtube.com');
      expect(rule2.domains).toContain('github.com');
    });
  });

  describe('GET /proxy.pac', () => {
    test('should return PAC file content', async () => {
      const service = await ProxyServiceModel.create({
        name: 'Test Service',
        jumpHost: '192.168.1.1',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11081,
        sshKeyPath: '/path/to/key',
        status: 'running'
      });

      await HostConfigModel.create({
        name: 'Test Config',
        proxyServiceId: service.id,
        hosts: ['example.com']
      });

      const response = await request(app)
        .get('/proxy.pac');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/x-ns-proxy-autoconfig');
      expect(response.text).toContain('function FindProxyForURL');
      expect(response.text).toContain('SOCKS5 127.0.0.1:11081');
      expect(response.text).toContain('example.com');
    });

    test('should return DIRECT when no running services', async () => {
      const response = await request(app)
        .get('/proxy.pac');

      expect(response.status).toBe(200);
      expect(response.text).toContain('function FindProxyForURL');
      expect(response.text).toContain('return "DIRECT"');
    });

    test('should not require authentication', async () => {
      // 不提供认证信息
      const response = await request(app)
        .get('/proxy.pac');

      expect(response.status).toBe(200);
    });
  });
});







