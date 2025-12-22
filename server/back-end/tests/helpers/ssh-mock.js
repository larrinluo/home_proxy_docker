/**
 * SSH Mock辅助函数
 * 用于测试中模拟SSH连接
 */

/**
 * Mock SSH连接
 */
function mockSSHConnection(options) {
  return {
    on: jest.fn((event, callback) => {
      if (event === 'ready') {
        setTimeout(() => callback(), 100);
      }
      return this;
    }),
    exec: jest.fn((command, callback) => {
      const stream = {
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(), 50);
          }
          return stream;
        }),
        stderr: {
          on: jest.fn()
        }
      };
      callback(null, stream);
      return stream;
    }),
    sftp: jest.fn((callback) => {
      const sftp = {
        readFile: jest.fn((path, callback) => {
          callback(null, Buffer.from(''));
        }),
        writeFile: jest.fn((path, content, callback) => {
          callback(null);
        })
      };
      callback(null, sftp);
    }),
    end: jest.fn()
  };
}

module.exports = {
  mockSSHConnection
};







