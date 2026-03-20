const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
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

// 启动服务器并自动打开浏览器
app.listen(port, host, () => {
  console.log(`服务器运行在 http://${host}:${port}`);
  
  // 自动打开浏览器
  const url = `http://${host}:${port}`;
  
  // 根据操作系统选择打开方式
  const platform = process.platform;
  
  if (platform === 'win32') {
    // Windows
    spawn('cmd', ['/c', 'start', url]);
  } else if (platform === 'darwin') {
    // macOS
    spawn('open', [url]);
  } else {
    // Linux
    spawn('xdg-open', [url]);
  }
  
  console.log(`正在打开浏览器：${url}`);
});
