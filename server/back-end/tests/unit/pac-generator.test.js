const pacGenerator = require('../../services/pac-generator');
const ProxyServiceModel = require('../../db/models/proxy-services');
const HostConfigModel = require('../../db/models/host-configs');
const db = require('../../db/index');

describe('PAC Generator', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db.run('DELETE FROM host_configs');
    await db.run('DELETE FROM proxy_services');
    
    // 清除PAC缓存
    pacGenerator.clearCache();
  });

  describe('generatePACConfig', () => {
    test('should return direct when no running services', async () => {
      const config = await pacGenerator.generatePACConfig('127.0.0.1', false);
      
      expect(config.direct).toBe(true);
      expect(config.proxyRules).toEqual([]);
    });

    test('should generate PAC config with single host config', async () => {
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

      const config = await pacGenerator.generatePACConfig('127.0.0.1', false);
      
      expect(config.direct).toBe(false);
      expect(config.proxyRules).toHaveLength(1);
      expect(config.proxyRules[0].proxy).toBe('SOCKS5 127.0.0.1:11081');
      expect(config.proxyRules[0].domains).toContain('example.com');
      expect(config.proxyRules[0].domains).toContain('test.com');
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
        hosts: ['example.com']
      });

      await HostConfigModel.create({
        name: 'Config 2',
        proxyServiceId: service2.id,
        hosts: ['test.com', 'demo.com']
      });

      const config = await pacGenerator.generatePACConfig('127.0.0.1', false);
      
      expect(config.direct).toBe(false);
      expect(config.proxyRules).toHaveLength(2);
      
      // 验证分组
      const rule1 = config.proxyRules.find(r => r.proxy === 'SOCKS5 127.0.0.1:11081');
      const rule2 = config.proxyRules.find(r => r.proxy === 'SOCKS5 127.0.0.1:11082');
      
      expect(rule1).toBeTruthy();
      expect(rule1.domains).toContain('example.com');
      
      expect(rule2).toBeTruthy();
      expect(rule2.domains).toContain('test.com');
      expect(rule2.domains).toContain('demo.com');
    });

    test('should exclude stopped services', async () => {
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

      const config = await pacGenerator.generatePACConfig('127.0.0.1', false);
      
      expect(config.direct).toBe(false);
      expect(config.proxyRules).toHaveLength(1);
      expect(config.proxyRules[0].domains).toContain('example.com');
      expect(config.proxyRules[0].domains).not.toContain('test.com');
    });

    test('should handle multiple hosts in same config', async () => {
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
        name: 'Multi Host Config',
        proxyServiceId: service.id,
        hosts: ['google.com', 'youtube.com', 'github.com']
      });

      const config = await pacGenerator.generatePACConfig('127.0.0.1', false);
      
      expect(config.proxyRules[0].domains).toHaveLength(3);
      expect(config.proxyRules[0].domains).toContain('google.com');
      expect(config.proxyRules[0].domains).toContain('youtube.com');
      expect(config.proxyRules[0].domains).toContain('github.com');
    });

    test('should use custom proxy host', async () => {
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

      const config = await pacGenerator.generatePACConfig('192.168.100.1', false);
      
      expect(config.proxyRules[0].proxy).toBe('SOCKS5 192.168.100.1:11081');
    });
  });

  describe('generatePACFile', () => {
    test('should generate valid PAC file format', async () => {
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

      const pacFile = await pacGenerator.generatePACFile('127.0.0.1', false);
      
      // 验证PAC文件格式
      expect(pacFile).toContain('function FindProxyForURL');
      expect(pacFile).toContain('return "DIRECT"');
      expect(pacFile).toContain('SOCKS5 127.0.0.1:11081');
      expect(pacFile).toContain('example.com');
    });

    test('should return DIRECT when no running services', async () => {
      const pacFile = await pacGenerator.generatePACFile('127.0.0.1', false);
      
      expect(pacFile).toContain('function FindProxyForURL');
      expect(pacFile).toContain('return "DIRECT"');
    });

    test('should handle subdomain matching', async () => {
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

      const pacFile = await pacGenerator.generatePACFile('127.0.0.1', false);
      
      // 验证子域名匹配逻辑
      expect(pacFile).toContain('host.endsWith');
      expect(pacFile).toContain('example.com');
    });
  });

  describe('Cache functionality', () => {
    test('should cache PAC config', async () => {
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

      const config1 = await pacGenerator.generatePACConfig('127.0.0.1', true);
      const config2 = await pacGenerator.generatePACConfig('127.0.0.1', true);
      
      // 两次调用应该返回相同的配置（使用缓存）
      expect(config1).toEqual(config2);
    });

    test('should clear cache', async () => {
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

      const config1 = await pacGenerator.generatePACConfig('127.0.0.1', true);
      
      // 添加新的host配置
      await HostConfigModel.create({
        name: 'New Config',
        proxyServiceId: service.id,
        hosts: ['newdomain.com']
      });

      // 清除缓存后应该包含新配置
      pacGenerator.clearCache();
      const config2 = await pacGenerator.generatePACConfig('127.0.0.1', false);
      
      // 验证新配置被包含
      const allDomains = config2.proxyRules[0].domains;
      expect(allDomains).toContain('example.com');
      expect(allDomains).toContain('newdomain.com');
    });
  });
});







