const express = require('express');
const path = require('path');
const fs = require('fs');
const { serverConfig, pathConfig } = require('./config');
const analysisRouter = require('./router/analysisRouter');
const app = express();
const port = serverConfig.port;
const host = serverConfig.host;

// 清空临时目录
const tmpDir = path.join(__dirname, pathConfig.tmpDir);
if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
fs.mkdirSync(tmpDir, { recursive: true });

// 中间件
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// 提供静态文件
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API 路由
app.use('/api', analysisRouter);

// 启动服务器
app.listen(port, host, () => {
  console.log(`服务器运行在 http://${host}:${port}`);
  // 自动打开浏览器（添加延迟，确保服务器完全启动）
  const { exec } = require('child_process');
  setTimeout(() => {
    exec(`start http://${host}:${port}`);
  }, 1000);
});
