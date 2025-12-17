/**
 * 解析测试结果，提取测试用例详情
 */

function parseJestOutput(output) {
  const testCases = [];
  const testSuites = [];
  
  // 解析测试套件
  const suiteRegex = /(PASS|FAIL)\s+(tests\/[\w\/\-\.]+\.test\.js)/g;
  let suiteMatch;
  const suiteMap = new Map();
  
  while ((suiteMatch = suiteRegex.exec(output)) !== null) {
    const suite = {
      status: suiteMatch[1] === 'PASS' ? 'passed' : 'failed',
      file: suiteMatch[2],
      tests: []
    };
    testSuites.push(suite);
    suiteMap.set(suite.file, suite);
  }
  
  // 解析测试用例 - Jest详细输出格式:
  // PASS tests/integration/auth.test.js
  //   Authentication API
  //     POST /api/v1/auth/register
  //       ✓ should register a new user (144 ms)
  //       ✓ should reject duplicate username (63 ms)
  const lines = output.split('\n');
  let currentSuite = null;
  const describeStack = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 匹配测试套件开始
    const suiteMatch = line.match(/(PASS|FAIL)\s+(tests\/[\w\/\-\.]+\.test\.js)/);
    if (suiteMatch) {
      currentSuite = suiteMatch[2];
      describeStack.length = 0; // 清空describe栈
      continue;
    }
    
    // 跳过Console输出
    if (line.includes('● Console') || line.includes('console.log')) {
      continue;
    }
    
    // 匹配describe分组（缩进2个空格，不以✓或✗开头）
    const describeMatch = line.match(/^\s{2}([A-Z][^\n]+)$/);
    if (describeMatch && currentSuite && !line.includes('✓') && !line.includes('✗')) {
      describeStack.push(describeMatch[1].trim());
      continue;
    }
    
    // 匹配嵌套的describe（缩进4个或更多空格）
    const nestedDescribeMatch = line.match(/^\s{4,}([A-Z][^\n]+)$/);
    if (nestedDescribeMatch && currentSuite && !line.includes('✓') && !line.includes('✗')) {
      // 如果已经有相同层级的describe，替换最后一个
      const indent = line.match(/^\s+/)[0].length;
      const level = Math.floor(indent / 2) - 1;
      describeStack[level] = nestedDescribeMatch[1].trim();
      describeStack.length = level + 1; // 截断到当前层级
      continue;
    }
    
    // 匹配测试用例（包含✓或✗，且有ms时间）
    const testMatch = line.match(/[✓✗]\s+([^\n(]+?)\s*\((\d+)\s*ms\)/);
    if (testMatch && currentSuite) {
      const testName = testMatch[1].trim();
      const duration = parseInt(testMatch[2]);
      const status = line.includes('✓') ? 'passed' : 'failed';
      const describeGroup = describeStack.length > 0 ? describeStack.join(' › ') : '';
      
      testCases.push({
        name: testName,
        fullName: describeGroup ? `${describeGroup} › ${testName}` : testName,
        suite: currentSuite,
        describeGroup: describeGroup,
        status: status,
        duration: duration,
        file: currentSuite
      });
      
      // 添加到套件的测试列表
      const suite = suiteMap.get(currentSuite);
      if (suite) {
        suite.tests.push({
          name: testName,
          fullName: describeGroup ? `${describeGroup} › ${testName}` : testName,
          status: status,
          duration: duration
        });
      }
    }
  }
  
  return {
    suites: testSuites,
    testCases: testCases
  };
}

function parseVitestOutput(output) {
  const suites = [];
  const testCases = [];
  const suiteMap = new Map();
  
  const lines = output.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 匹配测试用例行: "✓ tests/unit/utils.test.js > Utils Tests > should pass basic test"
    // 或: "✓ tests/unit/auth-store.test.js > Auth Store > login > should login successfully with valid credentials"
    const testLineMatch = line.match(/^[✓✗]\s+(tests\/[\w\/\-\.]+\.(test|spec)\.(js|ts))\s+>\s+(.+)$/);
    if (testLineMatch) {
      const file = testLineMatch[1];
      const fullPath = testLineMatch[4]; // 完整路径，如 "Utils Tests > should pass basic test"
      const status = line.includes('✓') ? 'passed' : 'failed';
      
      // 解析路径，最后一个部分是测试名称，前面的部分是describe组
      const parts = fullPath.split(' > ');
      const testName = parts[parts.length - 1];
      const describeGroup = parts.length > 1 ? parts.slice(0, -1).join(' › ') : '';
      
      // 获取或创建测试套件
      let currentSuite = suiteMap.get(file);
      if (!currentSuite) {
        // 使用第一个describe组作为套件名称，如果没有则使用文件名
        const suiteName = parts.length > 1 ? parts[0] : file.split('/').pop().replace(/\.(test|spec)\.(js|ts)$/, '');
        currentSuite = {
          status: status,
          file: file,
          name: suiteName,
          tests: []
        };
        suites.push(currentSuite);
        suiteMap.set(file, currentSuite);
      }
      
      // 更新套件状态（如果有失败的测试）
      if (status === 'failed') {
        currentSuite.status = 'failed';
      }
      
      // 提取持续时间（如果有）
      const durationMatch = line.match(/\((\d+)\s*ms\)/);
      const duration = durationMatch ? parseInt(durationMatch[1]) : null;
      
      const fullTestName = fullPath;
      
      const testCase = {
        name: testName,
        fullName: fullTestName,
        describeGroup: describeGroup,
        status: status,
        duration: duration,
        file: file
      };
      
      testCases.push(testCase);
      currentSuite.tests.push({
        name: testName,
        fullName: fullTestName,
        describeGroup: describeGroup,
        status: status,
        duration: duration
      });
      
      continue;
    }
    
    // 匹配旧格式: "✓ tests/unit/utils.test.js (2 tests) 2ms"
    const oldFormatMatch = line.match(/^[✓✗]\s+(tests\/[\w\/\-\.]+\.(test|spec)\.(js|ts))\s+\((\d+)\s+tests?\)/);
    if (oldFormatMatch) {
      const status = oldFormatMatch[0].startsWith('✓') ? 'passed' : 'failed';
      const file = oldFormatMatch[1];
      
      if (!suiteMap.has(file)) {
        const currentSuite = {
          status: status,
          file: file,
          name: file.split('/').pop().replace(/\.(test|spec)\.(js|ts)$/, ''),
          tests: []
        };
        suites.push(currentSuite);
        suiteMap.set(file, currentSuite);
      }
    }
  }
  
  return {
    suites: suites,
    testCases: testCases
  };
}

module.exports = {
  parseJestOutput,
  parseVitestOutput
};

