const db = require('../../db/index');
const UserModel = require('../../db/models/users');
const ProxyServiceModel = require('../../db/models/proxy-services');
const HostConfigModel = require('../../db/models/host-configs');
const SystemConfigModel = require('../../db/models/system-configs');

describe('Database Models', () => {
  beforeEach(async () => {
    // 清理测试数据
    await db.run('DELETE FROM host_configs');
    await db.run('DELETE FROM proxy_services');
    await db.run('DELETE FROM users');
    await db.run("DELETE FROM system_configs WHERE key != 'register_enabled'");
  });

  describe('UserModel', () => {
    test('should create a user', async () => {
      const user = await UserModel.create({
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com'
      });
      expect(user).toHaveProperty('id');
      expect(user.username).toBe('testuser');
    });

    test('should find user by username', async () => {
      await UserModel.create({
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com'
      });
      const user = await UserModel.findByUsername('testuser');
      expect(user).toBeTruthy();
      expect(user.username).toBe('testuser');
    });

    test('should update password', async () => {
      const user = await UserModel.create({
        username: 'testuser',
        passwordHash: 'oldhash',
        email: 'test@example.com'
      });
      await UserModel.update(user.id, { passwordHash: 'newhash' });
      const updated = await UserModel.findById(user.id);
      expect(updated.password_hash).toBe('newhash');
    });
  });

  describe('ProxyServiceModel', () => {
    test('should create a proxy service', async () => {
      const service = await ProxyServiceModel.create({
        name: 'Test Service',
        jumpHost: '192.168.1.1',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11081,
        sshKeyPath: '/path/to/key'
      });
      expect(service).toHaveProperty('id');
      expect(service.name).toBe('Test Service');
    });

    test('should find all proxy services', async () => {
      await ProxyServiceModel.create({
        name: 'Service 1',
        jumpHost: '192.168.1.1',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11081,
        sshKeyPath: '/path/to/key'
      });
      await ProxyServiceModel.create({
        name: 'Service 2',
        jumpHost: '192.168.1.2',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11082,
        sshKeyPath: '/path/to/key2'
      });
      const services = await ProxyServiceModel.findAll();
      expect(services.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('HostConfigModel', () => {
    test('should create a host config', async () => {
      const proxyService = await ProxyServiceModel.create({
        name: 'Test Service',
        jumpHost: '192.168.1.1',
        jumpPort: 22,
        jumpUsername: 'user',
        proxyPort: 11081,
        sshKeyPath: '/path/to/key'
      });
      const config = await HostConfigModel.create({
        name: 'Test Config',
        proxyServiceId: proxyService.id,
        hosts: ['example.com', 'test.com']
      });
      expect(config).toHaveProperty('id');
      expect(config.hosts).toEqual(['example.com', 'test.com']);
    });
  });

  describe('SystemConfigModel', () => {
    test('should find system config by key', async () => {
      const config = await SystemConfigModel.findByKey('register_enabled');
      expect(config).toBeTruthy();
    });

    test('should update system config', async () => {
      await SystemConfigModel.update('register_enabled', 'false');
      const config = await SystemConfigModel.findByKey('register_enabled');
      expect(config.value).toBe('false');
    });
  });
});

