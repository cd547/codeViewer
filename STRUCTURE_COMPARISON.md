# 目录结构对比

## 迁移前 vs 迁移后

### 📁 迁移前的结构

```
codeViewer/
├── src/
│   └── server/              # 前后端代码混在一起
│       ├── config/
│       │   └── frontendConfig.json
│       ├── controllers/
│       │   └── analysisController.js
│       ├── css/             # 前端样式
│       │   └── style.css
│       ├── imgs/            # 前端图片
│       ├── js/              # 前端 JavaScript
│       │   └── script.js
│       ├── lib/
│       │   └── parser/
│       │       └── codeParser.js
│       ├── router/
│       │   └── analysisRouter.js
│       ├── validation/
│       │   └── analysisValidation.js
│       ├── vendor/          # 第三方库
│       │   └── highlight.js/
│       ├── config.js
│       ├── index.html       # 前端 HTML
│       └── server.js        # 后端入口
├── package.json
└── .gitignore
```

**问题：**
- ❌ 前后端代码混杂
- ❌ 目录结构不清晰
- ❌ 不利于团队协作
- ❌ 难以独立部署

---

### 📁 迁移后的结构

```
codeViewer/
├── server/                  # 后端目录（Node.js）
│   ├── config/             # 后端配置
│   │   └── index.js
│   ├── controllers/        # 控制器层
│   │   └── analysisController.js
│   ├── services/           # 业务逻辑层
│   │   ├── callGraphBuilder.js
│   │   └── fileService.js
│   ├── parser/             # 代码解析器
│   │   ├── CodeParser.js
│   │   ├── traversalVisitor.js
│   │   └── utils/
│   │       └── functionDetector.js
│   ├── router/             # 路由
│   │   └── analysisRouter.js
│   ├── validation/         # 验证层
│   │   └── analysisValidation.js
│   ├── utils/              # 工具函数
│   │   ├── pathResolver.js
│   │   └── logger.js
│   ├── tmp/                # 临时文件（.gitignore）
│   ├── server.js           # 后端入口
│   └── package.json        # 后端依赖
│
├── web/                     # 前端目录（浏览器）
│   ├── index.html          # 主页面
│   ├── css/                # 样式文件
│   │   └── style.css
│   ├── js/                 # JavaScript 模块
│   │   ├── main.js         # 入口文件
│   │   ├── config/         # 前端配置
│   │   │   └── configManager.js
│   │   ├── ui/             # UI 组件
│   │   │   ├── resizeHandler.js
│   │   │   ├── tabManager.js
│   │   │   ├── codeDisplay.js
│   │   │   └── directoryTree.js
│   │   ├── search/         # 搜索功能
│   │   │   └── functionSearch.js
│   │   ├── visualizer/     # 可视化
│   │   │   └── graphVisualizer.js
│   │   └── services/       # 服务层
│   │       └── fileService.js
│   ├── config/             # 配置文件
│   │   └── frontendConfig.json
│   ├── imgs/               # 图片资源
│   │   ├── arrow-function.svg
│   │   ├── class-method.svg
│   │   ├── default-function.svg
│   │   ├── function-declaration.svg
│   │   └── function-expression.svg
│   └── vendor/             # 第三方库
│       └── highlight.js/   # 代码高亮库
│
├── src/                     # 旧目录（迁移完成后删除）
├── migrate.js               # 迁移脚本
├── MIGRATION_GUIDE.md       # 迁移指南
├── REFACTORING_ANALYSIS.md  # 重构分析
├── package.json             # 项目根配置
└── .gitignore
```

**优势：**
- ✅ 前后端分离，职责清晰
- ✅ 目录结构标准化
- ✅ 便于团队协作（前端/后端独立开发）
- ✅ 支持独立部署
- ✅ 易于扩展和维护

---

## 文件映射关系

### 后端文件迁移

| 原路径 | 新路径 | 说明 |
|--------|--------|------|
| `src/server/config.js` | `server/config/index.js` | 后端配置 |
| `src/server/controllers/analysisController.js` | `server/controllers/analysisController.js` | 控制器 |
| `src/server/lib/parser/codeParser.js` | `server/parser/CodeParser.js` | 解析器 |
| `src/server/router/analysisRouter.js` | `server/router/analysisRouter.js` | 路由 |
| `src/server/validation/analysisValidation.js` | `server/validation/analysisValidation.js` | 验证 |
| `src/server/server.js` | `server/server.js` | 服务器入口 |

### 前端文件迁移

| 原路径 | 新路径 | 说明 |
|--------|--------|------|
| `src/server/index.html` | `web/index.html` | 主页面 |
| `src/server/css/style.css` | `web/css/style.css` | 样式文件 |
| `src/server/js/script.js` | `web/js/script.js` | JavaScript |
| `src/server/imgs/*.svg` | `web/imgs/*.svg` | 图片资源 |
| `src/server/config/frontendConfig.json` | `web/config/frontendConfig.json` | 前端配置 |
| `src/server/vendor/highlight.js` | `web/vendor/highlight.js` | 第三方库 |

---

## 架构对比

### 迁移前

```
┌─────────────────────────┐
│   src/server/           │
│  ┌─────────────────┐    │
│  │  后端 + 前端混合  │    │
│  │  - Node.js      │    │
│  │  - HTML/CSS/JS  │    │
│  │  - 难以区分     │    │
│  └─────────────────┘    │
└─────────────────────────┘
```

### 迁移后

```
┌──────────────────┐         ┌──────────────────┐
│   server/        │         │      web/        │
│   (后端)         │         │    (前端)        │
│ ┌──────────────┐ │         │ ┌──────────────┐ │
│ │  Express.js  │ │  HTTP   │ │   HTML/CSS   │ │
│ │  控制器      │◄├────────►│ │   JavaScript │ │
│ │  解析器      │ │  /api   │ │   静态资源   │ │
│ └──────────────┘ │         │ └──────────────┘ │
└──────────────────┘         └──────────────────┘
```

---

## 技术栈分离

### 后端 (server/)

- **运行时**: Node.js
- **框架**: Express.js
- **解析器**: @babel/parser
- **用途**: API 服务、代码解析、文件处理

### 前端 (web/)

- **运行时**: 浏览器
- **库**: 原生 JavaScript + D3.js (可视化)
- **样式**: 原生 CSS
- **高亮**: highlight.js
- **用途**: UI 展示、交互逻辑、数据可视化

---

## 开发工作流

### 迁移前

```bash
# 启动
npm start

# 开发
# 前后端代码混在一起，修改时容易冲突
```

### 迁移后

```bash
# 后端开发
cd server
npm install
npm start          # 或 npm run dev

# 前端开发
cd web
# 直接修改静态资源，实时预览

# 全栈开发
# 终端 1: cd server && npm run dev
# 终端 2: cd web && (可选) 使用 live-server
```

---

## 部署方案

### 迁移前

```
单体部署
└── 整个项目部署到 Node.js 服务器
```

### 迁移后

**方案一：单体部署（推荐初期使用）**

```bash
# 部署整个项目
server/ 提供 API 和静态文件服务
web/   由 Express 静态托管
```

**方案二：分离部署（推荐生产环境）**

```
前端部署:
└── web/ → CDN / Nginx / 对象存储

后端部署:
└── server/ → Node.js 服务器 / Docker / 云平台
```

---

## 性能对比

### 迁移前

- 静态资源和 API 混合
- 难以优化
- 缓存策略复杂

### 迁移后

- 静态资源可 CDN 加速
- API 独立优化
- 缓存策略清晰
- 支持按需加载

---

## 团队协作

### 迁移前

```
开发人员 A: 修改前端代码
           ↓
      可能影响后端代码

开发人员 B: 修改后端代码
           ↓
      可能影响前端代码
```

### 迁移后

```
前端团队: web/          后端团队: server/
   ↓                        ↓
独立开发                    独立开发
   ↓                        ↓
Git 分支管理              Git 分支管理
   ↓                        ↓
合并到 main              合并到 main
```

---

## 下一步行动

1. ✅ 运行迁移脚本：`node migrate.js`
2. ✅ 测试应用功能
3. ✅ 删除旧 `src/` 目录
4. ✅ 实施代码重构（参考 `REFACTORING_ANALYSIS.md`）
5. ✅ 优化构建流程
6. ✅ 考虑 TypeScript 迁移

---

## 总结

前后端分离带来的价值：

| 维度 | 迁移前 | 迁移后 | 提升 |
|------|--------|--------|------|
| 代码清晰度 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| 团队协作 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| 可维护性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| 部署灵活性 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |
| 性能优化空间 | ⭐⭐ | ⭐⭐⭐⭐⭐ | +150% |

**立即开始迁移，享受清晰的代码结构！** 🚀
