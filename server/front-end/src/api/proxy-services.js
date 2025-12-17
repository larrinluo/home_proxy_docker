import request from '../utils/request';

export function getProxyServices(params) {
  return request({
    url: '/v1/proxy-services',
    method: 'get',
    params
  });
}

export function getProxyService(id) {
  return request({
    url: `/v1/proxy-services/${id}`,
    method: 'get'
  });
}

export function createProxyService(data) {
  return request({
    url: '/v1/proxy-services',
    method: 'post',
    data
  });
}

export function updateProxyService(id, data) {
  return request({
    url: `/v1/proxy-services/${id}`,
    method: 'put',
    data
  });
}

export function deleteProxyService(id) {
  return request({
    url: `/v1/proxy-services/${id}`,
    method: 'delete'
  });
}

export function startProxyService(id) {
  return request({
    url: `/v1/proxy-services/${id}/start`,
    method: 'post'
  });
}

export function stopProxyService(id) {
  return request({
    url: `/v1/proxy-services/${id}/stop`,
    method: 'post'
  });
}

/**
 * 连接代理服务（使用fetch读取SSE流）
 */
export function connectProxyService(data, onLog, onComplete, onError, onReaderReady) {
  return new Promise((resolve, reject) => {
    // 开发环境使用相对路径，生产环境使用完整URL
    const API_BASE_URL = import.meta.env.PROD 
      ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000')
      : '';
    const url = `${API_BASE_URL}/api/v1/proxy-services/connect`;
    
    const abortController = new AbortController();
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(data),
      signal: abortController.signal
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error?.message || `HTTP error! status: ${response.status}`);
        });
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      const reader = response.body.getReader();
      
      // 通知外部reader已准备好（用于取消）
      if (onReaderReady) {
        onReaderReady({
          cancel: () => {
            abortController.abort();
            reader.cancel();
          }
        });
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;
      
      function readChunk() {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (!completed) {
              // 如果没有收到完成消息，尝试解析buffer
              if (buffer.trim()) {
                const lines = buffer.split('\n').filter(line => line.trim());
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      if (parsed.success !== undefined) {
                        onComplete(parsed);
                        completed = true;
                      }
                    } catch (e) {
                      console.error('Parse final data error:', e);
                    }
                  }
                }
              }
            }
            resolve();
            return;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后不完整的行
          
          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.level && parsed.message) {
                  onLog(parsed.level, parsed.message);
                } else if (parsed.success !== undefined) {
                  onComplete(parsed);
                  completed = true;
                }
              } catch (e) {
                console.error('Parse SSE data error:', e, 'Line:', line);
              }
            }
          }
          
          readChunk();
        }).catch(err => {
          // 如果是取消操作，不显示错误
          if (err.name === 'AbortError') {
            resolve();
            return;
          }
          if (!completed) {
            onError(err);
            reject(err);
          }
        });
      }
      
      readChunk();
    })
    .catch(err => {
      // 如果是取消操作，不显示错误
      if (err.name === 'AbortError') {
        resolve();
        return;
      }
      onError(err);
      reject(err);
    });
  });
}

