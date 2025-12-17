# 自动化测试报告

## 报告说明

本目录包含项目的自动化测试报告，包括：

- **test-report.json**: JSON格式的测试结果数据
- **test-report.html**: HTML格式的可视化测试报告

## 生成报告

运行以下命令生成最新的测试报告：

```bash
node scripts/generate-test-report-enhanced.js
```

## 查看报告

### HTML报告
直接在浏览器中打开 `test-report.html` 文件即可查看可视化报告。

### JSON报告
JSON报告包含详细的测试数据，可用于：
- 集成到CI/CD流程
- 生成自定义报告
- 数据分析

## 测试覆盖范围

### 后端测试
- 单元测试：数据库模型、工具函数
- 集成测试：API接口、认证流程

### 前端测试
- 单元测试：Vue组件、工具函数
- E2E测试：用户流程、页面交互

## 测试框架

- **后端**: Jest
- **前端**: Vitest + Playwright

## 报告更新

报告会在每次运行测试时自动更新。建议在以下情况运行测试：

1. 代码提交前
2. Pull Request创建时
3. 每日构建时
4. 发布前






