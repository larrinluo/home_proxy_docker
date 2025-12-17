const fs = require('fs');
const path = require('path');

/**
 * 从测试文件中提取测试用例的代码
 */
function extractTestCode(testFile, testName, describeGroups = []) {
  try {
    const filePath = path.join(__dirname, '../server/back-end', testFile);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 构建测试用例的完整路径
    const fullPath = describeGroups.length > 0 
      ? [...describeGroups, testName].join(' › ')
      : testName;

    // 查找测试用例
    let inTargetDescribe = describeGroups.length === 0;
    let describeDepth = 0;
    let testStartLine = -1;
    let testEndLine = -1;
    let braceCount = 0;
    let inTest = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 匹配describe
      const describeMatch = line.match(/describe\(['"]([^'"]+)['"]/);
      if (describeMatch) {
        const descName = describeMatch[1];
        if (describeGroups.length > describeDepth && describeGroups[describeDepth] === descName) {
          if (describeDepth === describeGroups.length - 1) {
            inTargetDescribe = true;
          }
          describeDepth++;
        } else {
          describeDepth++;
        }
        continue;
      }

      // 匹配test/it - 简化：不依赖describe，直接匹配测试名称
      const testMatch = line.match(/(test|it)\(['"]([^'"]+)['"]/);
      if (testMatch) {
        const currentTestName = testMatch[2];
        // 精确匹配或包含匹配
        if (currentTestName === testName || 
            currentTestName.includes(testName) || 
            testName.includes(currentTestName)) {
          testStartLine = i;
          
          // 计算起始行的缩进
          const indentMatch = line.match(/^(\s*)/);
          const baseIndent = indentMatch ? indentMatch[1].length : 0;
          
          // 查找测试代码块的结束位置
          braceCount = 0;
          let foundOpenBrace = false;
          
          for (let j = i; j < lines.length; j++) {
            const testLine = lines[j];
            
            // 计算大括号
            for (const char of testLine) {
              if (char === '{') {
                braceCount++;
                foundOpenBrace = true;
              } else if (char === '}') {
                braceCount--;
              }
            }
            
            // 如果找到了开括号且大括号平衡
            if (foundOpenBrace && braceCount === 0) {
              // 检查下一行是否是同级或更高级的缩进
              if (j + 1 < lines.length) {
                const nextLine = lines[j + 1];
                const nextIndentMatch = nextLine.match(/^(\s*)/);
                const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;
                
                // 如果下一行是test/describe/it且缩进相同或更小，则结束
                if (nextLine.match(/(test|it|describe)\(/) && nextIndent <= baseIndent) {
                  testEndLine = j;
                  break;
                }
                // 如果下一行缩进明显减少，也结束
                if (nextIndent < baseIndent - 2 && nextLine.trim() !== '') {
                  testEndLine = j;
                  break;
                }
              } else {
                testEndLine = j;
                break;
              }
            }
            
            // 如果遇到下一个test/it（同级），也结束
            if (j > i && foundOpenBrace) {
              const nextTestMatch = testLine.match(/(test|it)\(/);
              if (nextTestMatch) {
                const nextIndentMatch = testLine.match(/^(\s*)/);
                const nextIndent = nextIndentMatch ? nextIndentMatch[1].length : 0;
                if (nextIndent === baseIndent) {
                  testEndLine = j - 1;
                  break;
                }
              }
            }
          }
          
          // 如果还没找到结束位置，尝试找到下一个同级test
          if (testEndLine === -1 && foundOpenBrace) {
            for (let j = i + 1; j < lines.length; j++) {
              const testLine = lines[j];
              const indentMatch = testLine.match(/^(\s*)/);
              const indent = indentMatch ? indentMatch[1].length : 0;
              
              // 找到同级或更高级的test/it
              if (testLine.match(/(test|it)\(/) && indent <= baseIndent) {
                testEndLine = j - 1;
                break;
              }
              // 或者遇到describe且缩进更小
              if (testLine.match(/describe\(/) && indent < baseIndent) {
                testEndLine = j - 1;
                break;
              }
            }
          }
          
          // 如果还是没找到，使用默认范围（最多30行）
          if (testEndLine === -1) {
            testEndLine = Math.min(i + 30, lines.length - 1);
          }
          
          break;
        }
      }
    }

    if (testStartLine !== -1) {
      const endLine = testEndLine !== -1 ? testEndLine : Math.min(testStartLine + 20, lines.length - 1);
      const codeLines = lines.slice(testStartLine, endLine + 1);
      
      // 清理代码，移除多余的空行
      while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
        codeLines.pop();
      }
      
      return {
        code: codeLines.join('\n'),
        startLine: testStartLine + 1,
        endLine: endLine + 1,
        file: testFile
      };
    }

    return null;
  } catch (error) {
    console.error(`Error extracting test code for ${testFile}:${testName}:`, error.message);
    return null;
  }
}

module.exports = {
  extractTestCode
};

