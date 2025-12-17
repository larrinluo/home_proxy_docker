const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseJestOutput, parseVitestOutput } = require('./parse-test-results');
const { extractTestCode } = require('./extract-test-code');

const REPORT_DIR = path.join(__dirname, '../reports');
const BACKEND_DIR = path.join(__dirname, '../server/back-end');
const FRONTEND_DIR = path.join(__dirname, '../server/front-end');

// 确保报告目录存在
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

console.log('开始生成自动化测试报告...\n');

// 收集测试结果
const results = {
  timestamp: new Date().toISOString(),
  backend: {
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
  },
  frontend: {
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 }
  },
  coverage: {
    backend: {},
    frontend: {}
  }
};

// 运行后端测试
console.log('📦 运行后端测试...');
try {
  process.chdir(BACKEND_DIR);
  
  // 先运行测试获取结果（即使失败也要获取输出）
  // 使用--verbose模式获取详细的测试用例信息
  let testOutput = '';
  try {
    testOutput = execSync('npm test -- --verbose 2>&1', {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe'
    });
  } catch (error) {
    // Jest测试失败时也会抛出错误，但输出在stdout中
    testOutput = error.stdout || error.message || '';
  }
  
  // 解析Jest测试结果
  // Jest输出格式有多种:
  // "Tests:       2 failed, 12 passed, 14 total"
  // "Tests:       14 passed, 14 total"
  // "Tests:       12 passed, 2 failed"
  let jestMatch = testOutput.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (jestMatch) {
    results.backend.summary.failed = parseInt(jestMatch[1]);
    results.backend.summary.passed = parseInt(jestMatch[2]);
    results.backend.summary.total = parseInt(jestMatch[3]);
  } else {
    // 尝试格式: "Tests:       14 passed, 14 total"
    jestMatch = testOutput.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (jestMatch) {
      results.backend.summary.passed = parseInt(jestMatch[1]);
      results.backend.summary.total = parseInt(jestMatch[2]);
      results.backend.summary.failed = 0;
    } else {
      // 尝试格式: "Tests:       12 passed, 2 failed"
      jestMatch = testOutput.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed/);
      if (jestMatch) {
        results.backend.summary.passed = parseInt(jestMatch[1]);
        results.backend.summary.failed = parseInt(jestMatch[2]);
        results.backend.summary.total = results.backend.summary.passed + results.backend.summary.failed;
      } else {
        // 尝试其他格式
        const testMatch = testOutput.match(/(\d+)\s+passing|(\d+)\s+failing|(\d+)\s+skipped/g);
        if (testMatch) {
          testMatch.forEach(match => {
            const num = parseInt(match.match(/\d+/)[0]);
            if (match.includes('passing')) {
              results.backend.summary.passed = num;
              results.backend.summary.total += num;
            } else if (match.includes('failing')) {
              results.backend.summary.failed = num;
              results.backend.summary.total += num;
            } else if (match.includes('skipped')) {
              results.backend.summary.skipped = num;
            }
          });
        }
      }
    }
  }
  
  results.backend.output = testOutput;
  results.backend.success = results.backend.summary.failed === 0;
  
  // 解析测试用例详情
  try {
    const parsed = parseJestOutput(testOutput);
    results.backend.testSuites = parsed.suites;
    results.backend.testCases = parsed.testCases;
    
    // 为每个测试用例提取代码
    if (results.backend.testCases) {
      for (const testCase of results.backend.testCases) {
        // 尝试提取代码（不依赖describe分组，直接匹配测试名称）
        const codeInfo = extractTestCode(testCase.file, testCase.name, []);
        if (codeInfo) {
          testCase.code = codeInfo.code;
          testCase.codeStartLine = codeInfo.startLine;
          testCase.codeEndLine = codeInfo.endLine;
        }
      }
    }
    
    // 为测试套件中的测试也添加代码和完整信息
    if (results.backend.testSuites) {
      for (const suite of results.backend.testSuites) {
        if (suite.tests) {
          for (const test of suite.tests) {
            // 找到对应的完整测试用例信息
            const fullTestCase = results.backend.testCases.find(
              tc => (tc.name === test.name || tc.fullName === test.fullName) && tc.file === suite.file
            );
            if (fullTestCase) {
              // 复制所有信息到套件的测试中
              test.code = fullTestCase.code;
              test.codeStartLine = fullTestCase.codeStartLine;
              test.codeEndLine = fullTestCase.codeEndLine;
              test.fullName = fullTestCase.fullName || test.name;
              test.describeGroup = fullTestCase.describeGroup;
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('解析测试用例详情失败:', e.message);
  }
  
  console.log(`✓ 后端测试完成: ${results.backend.summary.passed} 通过, ${results.backend.summary.failed} 失败`);
  
  // 尝试获取覆盖率
  try {
    const coverageOutput = execSync('npm run test:coverage 2>&1', {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe'
    });
    results.coverage.backend.output = coverageOutput;
  } catch (e) {
    // 覆盖率获取失败不影响主报告
  }
} catch (error) {
  console.log(`✗ 后端测试执行异常: ${error.message}`);
  results.backend.error = error.message;
  results.backend.success = false;
  if (error.stdout) {
    results.backend.output = error.stdout;
  }
}

// 运行前端单元测试
console.log('\n🎨 运行前端单元测试...');
try {
  process.chdir(FRONTEND_DIR);
  
  const testOutput = execSync('npm test -- --run --reporter=verbose 2>&1', {
    encoding: 'utf-8',
    timeout: 120000,
    stdio: 'pipe'
  });
  
  // 解析测试结果
  const testMatch = testOutput.match(/(\d+) passed|(\d+) failed/g);
  if (testMatch) {
    testMatch.forEach(match => {
      const num = parseInt(match.match(/\d+/)[0]);
      if (match.includes('passed')) {
        results.frontend.summary.passed = num;
        results.frontend.summary.total += num;
      } else if (match.includes('failed')) {
        results.frontend.summary.failed = num;
        results.frontend.summary.total += num;
      }
    });
  }
  
  results.frontend.output = testOutput;
  results.frontend.success = results.frontend.summary.failed === 0;
  
  // 解析测试用例详情
  try {
    const parsed = parseVitestOutput(testOutput);
    results.frontend.testSuites = parsed.suites;
    results.frontend.testCases = parsed.testCases;
    
    // 为每个测试用例提取代码（如果需要）
    // 前端测试代码提取可以后续添加
  } catch (e) {
    console.log('解析前端测试用例详情失败:', e.message);
  }
  
  console.log(`✓ 前端单元测试完成: ${results.frontend.summary.passed} 通过, ${results.frontend.summary.failed} 失败`);
} catch (error) {
  console.log(`✗ 前端单元测试失败: ${error.message}`);
  results.frontend.error = error.message;
  results.frontend.success = false;
  if (error.stdout) {
    results.frontend.output = error.stdout;
  }
}

// 计算总体统计
const totalTests = results.backend.summary.total + results.frontend.summary.total;
const totalPassed = results.backend.summary.passed + results.frontend.summary.passed;
const totalFailed = results.backend.summary.failed + results.frontend.summary.failed;
const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0;

results.summary = {
  totalTests,
  totalPassed,
  totalFailed,
  passRate: parseFloat(passRate),
  timestamp: results.timestamp
};

// 生成HTML报告
const htmlReport = generateHTMLReport(results);

// 保存报告
fs.writeFileSync(
  path.join(REPORT_DIR, 'test-report.json'),
  JSON.stringify(results, null, 2)
);

fs.writeFileSync(
  path.join(REPORT_DIR, 'test-report.html'),
  htmlReport
);

console.log('\n✅ 测试报告已生成:');
console.log(`   📄 JSON: ${path.join(REPORT_DIR, 'test-report.json')}`);
console.log(`   🌐 HTML: ${path.join(REPORT_DIR, 'test-report.html')}`);
console.log(`\n📊 测试摘要:`);
console.log(`   总测试数: ${totalTests}`);
console.log(`   通过: ${totalPassed}`);
console.log(`   失败: ${totalFailed}`);
console.log(`   通过率: ${passRate}%`);

function generateHTMLReport(results) {
  const { summary, backend, frontend } = results;
  
  const backendStatus = backend.success ? 'success' : backend.error ? 'error' : 'warning';
  const frontendStatus = frontend.success ? 'success' : frontend.error ? 'error' : 'warning';
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>自动化测试报告 - ${new Date(results.timestamp).toLocaleString('zh-CN')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      line-height: 1.6;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      padding: 40px;
    }
    h1 {
      color: #333;
      border-bottom: 4px solid #409eff;
      padding-bottom: 15px;
      margin-bottom: 30px;
      font-size: 32px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: transform 0.3s;
    }
    .stat-card:hover {
      transform: translateY(-5px);
    }
    .stat-card.success {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }
    .stat-card.warning {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .stat-card.error {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    .stat-value {
      font-size: 48px;
      font-weight: bold;
      margin: 15px 0;
    }
    .stat-label {
      font-size: 16px;
      opacity: 0.95;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      margin-bottom: 40px;
      background: #f9f9f9;
      padding: 25px;
      border-radius: 8px;
      border-left: 5px solid #409eff;
    }
    .section h2 {
      color: #409eff;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e4e7ed;
      font-size: 24px;
    }
    .test-results {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-top: 15px;
    }
    .test-item {
      padding: 15px;
      margin: 10px 0;
      background: white;
      border-left: 4px solid #409eff;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .test-item.passed {
      border-left-color: #67c23a;
      background: #f0f9ff;
    }
    .test-item.failed {
      border-left-color: #f56c6c;
      background: #fef0f0;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 10px;
    }
    .status-badge.success {
      background: #67c23a;
      color: white;
    }
    .status-badge.error {
      background: #f56c6c;
      color: white;
    }
    .status-badge.warning {
      background: #e6a23c;
      color: white;
    }
    .test-suites {
      margin-top: 15px;
    }
    .test-suite {
      background: white;
      border: 1px solid #e4e7ed;
      border-radius: 6px;
      margin-bottom: 15px;
      overflow: hidden;
    }
    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 15px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
    }
    .suite-file {
      font-family: monospace;
      font-size: 13px;
      color: #606266;
      font-weight: 500;
    }
    .suite-tests {
      padding: 10px 15px;
    }
    .test-cases-list {
      margin-top: 15px;
    }
    .test-case-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 15px;
      margin-bottom: 8px;
      background: white;
      border: 1px solid #e4e7ed;
      border-radius: 6px;
      border-left: 4px solid #409eff;
      transition: all 0.2s;
    }
    .test-case-item:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transform: translateX(2px);
    }
    .test-case-item.passed {
      border-left-color: #67c23a;
      background: #f0f9ff;
    }
    .test-case-item.failed {
      border-left-color: #f56c6c;
      background: #fef0f0;
    }
    .test-icon {
      font-size: 18px;
      margin-right: 12px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .test-case-item.passed .test-icon {
      color: #67c23a;
    }
    .test-case-item.failed .test-icon {
      color: #f56c6c;
    }
    .test-info {
      flex: 1;
    }
    .test-name {
      font-weight: 500;
      color: #303133;
      margin-bottom: 4px;
      display: block;
    }
    .test-group {
      font-size: 12px;
      color: #909399;
      margin-bottom: 4px;
      font-style: italic;
    }
    .test-meta {
      display: flex;
      gap: 15px;
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }
    .test-file {
      font-family: monospace;
    }
    .test-duration {
      color: #606266;
    }
    .code-toggle {
      color: #409eff;
      font-size: 12px;
      margin-left: 10px;
      text-decoration: underline;
    }
    .test-code-container {
      margin: 10px 0 10px 30px;
      border: 1px solid #e4e7ed;
      border-radius: 6px;
      overflow: hidden;
      background: #fafafa;
    }
    .test-code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      font-size: 12px;
      color: #606266;
    }
    .copy-btn {
      background: #409eff;
      color: white;
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .copy-btn:hover {
      background: #66b1ff;
    }
    .test-code {
      margin: 0;
      padding: 15px;
      background: #282c34;
      color: #abb2bf;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      overflow-x: auto;
      max-height: 400px;
      overflow-y: auto;
    }
    .test-code code {
      color: #abb2bf;
    }
    .timestamp {
      color: #909399;
      font-size: 14px;
      margin-bottom: 25px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .timestamp::before {
      content: "🕐";
    }
    .error-details {
      background: #fef0f0;
      border: 1px solid #fde2e2;
      color: #f56c6c;
      padding: 20px;
      border-radius: 8px;
      margin-top: 15px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      max-height: 400px;
      overflow-y: auto;
    }
    .output-details {
      background: #f5f7fa;
      border: 1px solid #e4e7ed;
      padding: 15px;
      border-radius: 6px;
      margin-top: 10px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .metric {
      text-align: center;
      padding: 15px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-value {
      font-size: 28px;
      font-weight: bold;
      color: #409eff;
      margin: 5px 0;
    }
    .metric-label {
      font-size: 12px;
      color: #909399;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 自动化测试报告</h1>
    <div class="timestamp">${new Date(results.timestamp).toLocaleString('zh-CN')}</div>
    
    <div class="summary">
      <div class="stat-card ${summary.totalFailed === 0 ? 'success' : 'warning'}">
        <div class="stat-label">总测试数</div>
        <div class="stat-value">${summary.totalTests}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">通过</div>
        <div class="stat-value">${summary.totalPassed}</div>
      </div>
      <div class="stat-card ${summary.totalFailed > 0 ? 'error' : 'success'}">
        <div class="stat-label">失败</div>
        <div class="stat-value">${summary.totalFailed}</div>
      </div>
      <div class="stat-card ${summary.passRate >= 80 ? 'success' : summary.passRate >= 60 ? 'warning' : 'error'}">
        <div class="stat-label">通过率</div>
        <div class="stat-value">${summary.passRate}%</div>
      </div>
    </div>

    <div class="section">
      <h2>📦 后端测试结果 
        <span class="status-badge ${backendStatus}">
          ${backend.success ? '✓ 成功' : backend.error ? '✗ 错误' : '⚠ 警告'}
        </span>
      </h2>
      <div class="test-results">
        <div class="metrics">
          <div class="metric">
            <div class="metric-value">${backend.summary.total}</div>
            <div class="metric-label">总测试数</div>
          </div>
          <div class="metric">
            <div class="metric-value" style="color: #67c23a;">${backend.summary.passed}</div>
            <div class="metric-label">通过</div>
          </div>
          <div class="metric">
            <div class="metric-value" style="color: #f56c6c;">${backend.summary.failed}</div>
            <div class="metric-label">失败</div>
          </div>
          <div class="metric">
            <div class="metric-value" style="color: #909399;">${backend.summary.skipped}</div>
            <div class="metric-label">跳过</div>
          </div>
        </div>
        
        ${backend.testSuites && backend.testSuites.length > 0 ? `
        <h3 style="margin-top: 25px; margin-bottom: 15px; color: #606266; font-size: 18px;">📋 测试套件详情</h3>
        <div class="test-suites">
          ${backend.testSuites.map((suite, suiteIndex) => `
            <div class="test-suite">
              <div class="suite-header">
                <span class="suite-file">${suite.file}</span>
                <span class="status-badge ${suite.status === 'passed' ? 'success' : 'error'}">
                  ${suite.status === 'passed' ? '✓' : '✗'} ${suite.tests ? suite.tests.length : 0} 个测试
                </span>
              </div>
              ${suite.tests && suite.tests.length > 0 ? `
                <div class="suite-tests">
                  ${suite.tests.map((test, testIndex) => {
                    const testId = `test-${suiteIndex}-${testIndex}`;
                    return `
                    <div class="test-case-item ${test.status}" onclick="toggleTestCode('${testId}')" style="cursor: pointer;">
                      <span class="test-icon">${test.status === 'passed' ? '✓' : '✗'}</span>
                      <div class="test-info" style="flex: 1;">
                        ${test.fullName ? `<div class="test-name">${escapeHtml(test.fullName)}</div>` : `<div class="test-name">${escapeHtml(test.name)}</div>`}
                        ${test.describeGroup ? `<div class="test-group">${escapeHtml(test.describeGroup)}</div>` : ''}
                        <div class="test-meta">
                          ${test.duration ? `<span class="test-duration">⏱ ${test.duration}ms</span>` : ''}
                          ${test.code ? `<span class="code-toggle">📄 查看代码</span>` : ''}
                        </div>
                      </div>
                    </div>
                    ${test.code ? `
                    <div class="test-code-container" id="${testId}-code" style="display: none;">
                      <div class="test-code-header">
                        <span>测试代码 (${test.codeStartLine}-${test.codeEndLine}行)</span>
                        <button onclick="event.stopPropagation(); copyTestCode('${testId}-code-content')" class="copy-btn">复制</button>
                      </div>
                      <pre class="test-code" id="${testId}-code-content"><code>${escapeHtml(test.code)}</code></pre>
                    </div>
                    ` : ''}
                  `;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${backend.error ? `<div class="error-details">错误: ${escapeHtml(backend.error)}</div>` : ''}
        ${backend.output ? `<details style="margin-top: 20px;"><summary style="cursor: pointer; color: #409eff; font-weight: 500;">📄 查看详细输出</summary><div class="output-details">${escapeHtml(backend.output.substring(0, 10000))}</div></details>` : ''}
      </div>
    </div>

    <div class="section">
      <h2>🎨 前端测试结果 
        <span class="status-badge ${frontendStatus}">
          ${frontend.success ? '✓ 成功' : frontend.error ? '✗ 错误' : '⚠ 警告'}
        </span>
      </h2>
      <div class="test-results">
        <div class="metrics">
          <div class="metric">
            <div class="metric-value">${frontend.summary.total}</div>
            <div class="metric-label">总测试数</div>
          </div>
          <div class="metric">
            <div class="metric-value" style="color: #67c23a;">${frontend.summary.passed}</div>
            <div class="metric-label">通过</div>
          </div>
          <div class="metric">
            <div class="metric-value" style="color: #f56c6c;">${frontend.summary.failed}</div>
            <div class="metric-label">失败</div>
          </div>
        </div>
        
        ${frontend.testSuites && frontend.testSuites.length > 0 ? `
        <h3 style="margin-top: 25px; margin-bottom: 15px; color: #606266; font-size: 18px;">📋 测试套件详情</h3>
        <div class="test-suites">
          ${frontend.testSuites.map((suite, suiteIndex) => `
            <div class="test-suite">
              <div class="suite-header">
                <span class="suite-file">${suite.file}</span>
                <span class="status-badge ${suite.status === 'passed' ? 'success' : 'error'}">
                  ${suite.status === 'passed' ? '✓' : '✗'} ${suite.tests ? suite.tests.length : 0} 个测试
                </span>
              </div>
              ${suite.tests && suite.tests.length > 0 ? `
                <div class="suite-tests">
                  ${suite.tests.map((test, testIndex) => {
                    return `
                    <div class="test-case-item ${test.status}" style="cursor: default;">
                      <span class="test-icon">${test.status === 'passed' ? '✓' : '✗'}</span>
                      <div class="test-info" style="flex: 1;">
                        ${test.fullName ? `<div class="test-name">${escapeHtml(test.fullName)}</div>` : `<div class="test-name">${escapeHtml(test.name)}</div>`}
                        ${test.describeGroup ? `<div class="test-group">${escapeHtml(test.describeGroup)}</div>` : ''}
                        <div class="test-meta">
                          ${test.duration ? `<span class="test-duration">⏱ ${test.duration}ms</span>` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${frontend.error ? `<div class="error-details">错误: ${escapeHtml(frontend.error)}</div>` : ''}
        ${frontend.output ? `<details style="margin-top: 20px;"><summary style="cursor: pointer; color: #409eff; font-weight: 500;">📄 查看详细输出</summary><div class="output-details">${escapeHtml(frontend.output.substring(0, 5000))}</div></details>` : ''}
      </div>
    </div>

    <div class="section">
      <h2>📋 测试说明</h2>
      <div class="test-results">
        <p><strong>测试框架:</strong></p>
        <ul>
          <li>后端: Jest (Node.js)</li>
          <li>前端: Vitest (Vue 3)</li>
        </ul>
        <p style="margin-top: 15px;"><strong>查看详细覆盖率:</strong></p>
        <ul>
          <li>后端: <code>cd server/back-end && npm run test:coverage</code></li>
          <li>前端: <code>cd server/front-end && npm run test:coverage</code></li>
        </ul>
      </div>
    </div>
  </div>
  <script>
    function toggleTestCode(testId) {
      const codeContainer = document.getElementById(testId + '-code');
      if (codeContainer) {
        codeContainer.style.display = codeContainer.style.display === 'none' ? 'block' : 'none';
      }
    }
    
    function copyTestCode(codeId) {
      const codeElement = document.getElementById(codeId);
      if (codeElement) {
        const text = codeElement.textContent || codeElement.innerText;
        navigator.clipboard.writeText(text).then(() => {
          const btn = event.target;
          const originalText = btn.textContent;
          btn.textContent = '已复制!';
          btn.style.background = '#67c23a';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '#409eff';
          }, 2000);
        }).catch(err => {
          console.error('复制失败:', err);
          alert('复制失败，请手动选择代码复制');
        });
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

