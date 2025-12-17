const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPORT_DIR = path.join(__dirname, '../reports');
const BACKEND_DIR = path.join(__dirname, '../server/back-end');
const FRONTEND_DIR = path.join(__dirname, '../server/front-end');

// 确保报告目录存在
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

console.log('开始生成测试报告...\n');

// 收集测试结果
const results = {
  timestamp: new Date().toISOString(),
  backend: {},
  frontend: {},
  summary: {}
};

// 运行后端测试
console.log('运行后端测试...');
try {
  process.chdir(BACKEND_DIR);
  const backendOutput = execSync('npm test -- --coverage --json 2>&1', {
    encoding: 'utf-8',
    timeout: 60000
  });
  
  // 尝试解析JSON输出
  try {
    const jsonMatch = backendOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      results.backend = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // 如果JSON解析失败，使用文本输出
    results.backend.output = backendOutput;
  }
  
  console.log('✓ 后端测试完成');
} catch (error) {
  console.log('✗ 后端测试失败:', error.message);
  results.backend.error = error.message;
}

// 运行前端单元测试
console.log('\n运行前端单元测试...');
try {
  process.chdir(FRONTEND_DIR);
  const frontendOutput = execSync('npm test -- --run --reporter=json 2>&1', {
    encoding: 'utf-8',
    timeout: 60000
  });
  
  try {
    const jsonMatch = frontendOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      results.frontend.unit = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    results.frontend.unit = { output: frontendOutput };
  }
  
  console.log('✓ 前端单元测试完成');
} catch (error) {
  console.log('✗ 前端单元测试失败:', error.message);
  results.frontend.unit = { error: error.message };
}

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

console.log('\n测试报告已生成:');
console.log(`- JSON: ${path.join(REPORT_DIR, 'test-report.json')}`);
console.log(`- HTML: ${path.join(REPORT_DIR, 'test-report.html')}`);

function generateHTMLReport(results) {
  const backendStats = results.backend.numTotalTests 
    ? {
        total: results.backend.numTotalTests,
        passed: results.backend.numPassedTests || 0,
        failed: results.backend.numFailedTests || 0,
        coverage: results.backend.coverageMap || {}
      }
    : { total: 0, passed: 0, failed: 0 };

  const frontendStats = results.frontend.unit?.numTotalTests
    ? {
        total: results.frontend.unit.numTotalTests,
        passed: results.frontend.unit.numPassedTests || 0,
        failed: results.frontend.unit.numFailedTests || 0
      }
    : { total: 0, passed: 0, failed: 0 };

  const totalTests = backendStats.total + frontendStats.total;
  const totalPassed = backendStats.passed + frontendStats.passed;
  const totalFailed = backendStats.failed + frontendStats.failed;
  const passRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0;

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
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #409eff;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
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
      font-size: 36px;
      font-weight: bold;
      margin: 10px 0;
    }
    .stat-label {
      font-size: 14px;
      opacity: 0.9;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #409eff;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e4e7ed;
    }
    .test-results {
      background: #f9f9f9;
      padding: 15px;
      border-radius: 4px;
      margin-top: 10px;
    }
    .test-item {
      padding: 10px;
      margin: 5px 0;
      background: white;
      border-left: 4px solid #409eff;
      border-radius: 4px;
    }
    .test-item.passed {
      border-left-color: #67c23a;
    }
    .test-item.failed {
      border-left-color: #f56c6c;
    }
    .coverage-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .coverage-table th,
    .coverage-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e4e7ed;
    }
    .coverage-table th {
      background: #f5f7fa;
      font-weight: 600;
    }
    .coverage-bar {
      height: 20px;
      background: #e4e7ed;
      border-radius: 10px;
      overflow: hidden;
      margin-top: 5px;
    }
    .coverage-fill {
      height: 100%;
      background: linear-gradient(90deg, #67c23a 0%, #85ce61 100%);
      transition: width 0.3s;
    }
    .timestamp {
      color: #909399;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .error-details {
      background: #fef0f0;
      border: 1px solid #fde2e2;
      color: #f56c6c;
      padding: 15px;
      border-radius: 4px;
      margin-top: 10px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>自动化测试报告</h1>
    <div class="timestamp">生成时间: ${new Date(results.timestamp).toLocaleString('zh-CN')}</div>
    
    <div class="summary">
      <div class="stat-card ${totalFailed === 0 ? 'success' : 'warning'}">
        <div class="stat-label">总测试数</div>
        <div class="stat-value">${totalTests}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-label">通过</div>
        <div class="stat-value">${totalPassed}</div>
      </div>
      <div class="stat-card ${totalFailed > 0 ? 'error' : 'success'}">
        <div class="stat-label">失败</div>
        <div class="stat-value">${totalFailed}</div>
      </div>
      <div class="stat-card ${passRate >= 80 ? 'success' : passRate >= 60 ? 'warning' : 'error'}">
        <div class="stat-label">通过率</div>
        <div class="stat-value">${passRate}%</div>
      </div>
    </div>

    <div class="section">
      <h2>后端测试结果</h2>
      <div class="test-results">
        <p><strong>测试总数:</strong> ${backendStats.total}</p>
        <p><strong>通过:</strong> ${backendStats.passed}</p>
        <p><strong>失败:</strong> ${backendStats.failed}</p>
        ${results.backend.error ? `<div class="error-details">${results.backend.error}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <h2>前端测试结果</h2>
      <div class="test-results">
        <p><strong>单元测试总数:</strong> ${frontendStats.total}</p>
        <p><strong>通过:</strong> ${frontendStats.passed}</p>
        <p><strong>失败:</strong> ${frontendStats.failed}</p>
        ${results.frontend.unit?.error ? `<div class="error-details">${results.frontend.unit.error}</div>` : ''}
      </div>
    </div>

    <div class="section">
      <h2>测试详情</h2>
      <p>详细的测试结果请查看 JSON 报告文件。</p>
      <p>如需查看代码覆盖率，请运行:</p>
      <ul>
        <li>后端: <code>cd server/back-end && npm run test:coverage</code></li>
        <li>前端: <code>cd server/front-end && npm run test:coverage</code></li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}






