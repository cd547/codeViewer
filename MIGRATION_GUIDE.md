# 前后端分离迁移指南

## 快速开始

本文档提供详细的步骤指导，帮助您将项目从 `src/server/` 迁移到新的前后端分离结构。

## 迁移步骤

### 阶段一：创建新目录结构

#### 1. 创建后端目录 (server/)

```bash
# 在项目根目录执行
mkdir server
cd server

# 创建后端目录结构
mkdir -p config controllers services parser/utils router validation utils tmp
```

#### 2. 创建前端目录 (web/)

```bash
cd ..
mkdir web
cd web

# 创建前端目录结构
mkdir -p css js/config js/ui js/search js/visualizer js/services imgs config vendor
```

#### 3. 迁移文件

**后端文件迁移：**

```bash
# 从 src/server 迁移到 server
cp src/server/config.js server/config/index.js
cp src/server/controllers/analysisController.js server/controllers/
cp src/server/lib/parser/codeParser.js server/parser/
cp src/server/router/analysisRouter.js server/router/
cp src/server/validation/analysisValidation.js server/validation/
cp src/server/server.js server/

# 更新 package.json 路径（如果有）
cp package.json server/
```

**前端文件迁移：**

```bash
# 从 src/server 迁移到 web
cp src/server/index.html web/
cp src/server/css/style.css web/css/
cp src/server/js/script.js web/js/
cp src/server/imgs/*.svg web/imgs/
cp src/server/config/frontendConfig.json web/config/
cp -r src/server/vendor/highlight.js web/vendor/
```

### 阶段二：更新配置

#### 1. 更新 server.js

修改 `server/server.js`：

```javascript
const express = require('express');
const path = require('path');
const { serverConfig, pathConfig } = require('./config/index.js');

const app = express();
const port = serverConfig.port;
const host = serverConfig.host;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 指向 web 目录
app.use(express.static(path.join(__dirname, '../web')));

// API 路由
app.use('/api', require('./router/analysisRouter'));

// 配置文件路由
app.get('/config/frontendConfig.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../web/config/frontendConfig.json'));
});

// 启动服务器
app.listen(port, host, () => {
  console.log(`服务器运行在 http://${host}:${port}`);
});
```

#### 2. 更新 config.js

修改 `server/config/index.js`：

```javascript
const path = require('path');

// 分析配置
const analysisConfig = {
  maxDepth: 10,
  recursionDepthLimit: 100,
  fileCountLimit: 1000,
  functionCountLimit: 5000,
  fileSizeLimit: 1024 * 1024 // 1MB
};

// 函数类型
const functionTypes = {
  DECLARATION: 'FunctionDeclaration',
  EXPRESSION: 'FunctionExpression',
  ARROW: 'ArrowFunctionExpression',
  METHOD: 'ClassMethod',
  EXTERNAL: 'ExternalFunction'
};

// 导入类型
const importTypes = {
  REQUIRE: 'require',
  IMPORT: 'import'
};

// 文件路径配置
const pathConfig = {
  // 临时目录相对路径（相对于 server 目录）
  tmpDir: './tmp',
  // 需要排除的文件和文件夹路径
  excludePaths: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '*.log',
    '*.tmp',
    '*.temp',
    '.vscode'
  ]
};

// 服务器配置
const serverConfig = {
  port: 3001,
  host: 'localhost'
};

module.exports = {
  analysisConfig,
  functionTypes,
  importTypes,
  pathConfig,
  serverConfig
};
```

#### 3. 更新前端 API 请求

修改 `web/js/script.js` 中的 API 请求（如果有相对路径调整）：

```javascript
// 确保 API 请求路径正确
fetch('/api/analyze', { ... })
```

### 阶段三：测试验证

#### 1. 启动服务器

```bash
cd server
node server.js
```

#### 2. 访问应用

打开浏览器访问：`http://localhost:3001`

#### 3. 测试功能

- [ ] 文件上传功能
- [ ] 代码分析功能
- [ ] 调用图展示
- [ ] 代码高亮显示
- [ ] Tab 切换功能
- [ ] 搜索功能

### 阶段四：代码重构

参考 `REFACTORING_ANALYSIS.md` 中的详细重构方案：

1. 拆分 `web/js/script.js` (1,668 行)
2. 拆分 `server/parser/codeParser.js` (1,231 行)
3. 拆分 `server/controllers/analysisController.js` (884 行)

### 阶段五：清理旧代码

#### 1. 备份（可选）

```bash
# 如果需要备份旧代码
mv src src.backup
```

#### 2. 删除旧目录

```bash
# 确认新结构工作正常后
rm -rf src
```

#### 3. 更新项目根配置

更新根目录的 `package.json`：

```json
{
  "name": "code-viewer",
  "version": "1.0.0",
  "description": "代码调用图可视化工具",
  "scripts": {
    "start": "cd server && node server.js",
    "dev": "cd server && nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["code", "visualization", "call-graph"],
  "author": "",
  "license": "ISC"
}
```

#### 4. 更新 .gitignore

确保 `.gitignore` 包含：

```gitignore
# 临时文件
server/tmp/*

# 依赖
node_modules/
server/node_modules/

# 日志
*.log

# 系统文件
.DS_Store
Thumbs.db

# IDE 配置
.idea/
.vscode/
*.swp
*.swo
```

## 常见问题

### Q1: 迁移后静态资源加载失败

**解决方案：** 检查 `server.js` 中的静态文件路径配置，确保指向正确的 `web` 目录。

### Q2: API 请求返回 404

**解决方案：** 
1. 检查路由配置是否正确
2. 确认 API 路径前缀 `/api`
3. 检查 CORS 配置（如果有）

### Q3: 配置文件加载失败

**解决方案：** 检查 `/config/frontendConfig.json` 的路由配置，确保文件路径正确。

### Q4: 模块导入路径错误

**解决方案：** 更新所有相对路径导入，使用正确的相对路径或绝对路径。

## 回滚方案

如果迁移过程中遇到问题，可以快速回滚：

```bash
# 新结构有问题时，使用备份的旧版本
rm -rf server web
mv src.backup src
```

## 下一步

完成迁移后，可以：

1. 实施代码重构（参考 `REFACTORING_ANALYSIS.md`）
2. 添加单元测试
3. 优化构建流程
4. 考虑迁移到 TypeScript

## 技术支持

如有问题，请参考：
- Express.js 官方文档：https://expressjs.com/
- Node.js 路径处理：https://nodejs.org/api/path.html
