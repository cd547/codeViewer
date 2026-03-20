#!/usr/bin/env node

/**
 * 前后端分离迁移脚本
 * 
 * 使用方法：
 * node migrate.js
 * 
 * 注意事项：
 * 1. 在项目根目录执行
 * 2. 确保有文件写入权限
 * 3. 执行前建议备份数据
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(message) {
  log(`\n${message}`, 'cyan');
  log('='.repeat(50), 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// 创建目录
function createDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logSuccess(`创建目录：${dirPath}`);
    } else {
      logWarning(`目录已存在：${dirPath}`);
    }
  } catch (error) {
    logError(`创建目录失败：${dirPath} - ${error.message}`);
    return false;
  }
  return true;
}

// 复制文件
function copyFile(src, dest) {
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      logSuccess(`复制文件：${path.basename(src)}`);
      return true;
    } else {
      logWarning(`源文件不存在：${src}`);
      return false;
    }
  } catch (error) {
    logError(`复制文件失败：${src} - ${error.message}`);
    return false;
  }
}

// 复制目录
function copyDirectory(srcDir, destDir) {
  try {
    if (!fs.existsSync(srcDir)) {
      logWarning(`源目录不存在：${srcDir}`);
      return false;
    }

    // 创建目标目录
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const files = fs.readdirSync(srcDir);
    
    files.forEach(file => {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);
      
      const stat = fs.statSync(srcFile);
      
      if (stat.isDirectory()) {
        copyDirectory(srcFile, destFile);
      } else {
        fs.copyFileSync(srcFile, destFile);
        logSuccess(`复制文件：${file}`);
      }
    });
    
    return true;
  } catch (error) {
    logError(`复制目录失败：${srcDir} - ${error.message}`);
    return false;
  }
}

// 主函数
function migrate() {
  log('\n🚀 开始前后端分离迁移', 'cyan');
  log('='.repeat(50), 'cyan');
  
  const projectRoot = process.cwd();
  const srcServerDir = path.join(projectRoot, 'src', 'server');
  const serverDir = path.join(projectRoot, 'server');
  const webDir = path.join(projectRoot, 'web');
  
  // 检查源目录
  if (!fs.existsSync(srcServerDir)) {
    logError(`源目录不存在：${srcServerDir}`);
    logWarning('请确保在项目根目录执行此脚本');
    return false;
  }
  
  // ========== 阶段一：创建目录结构 ==========
  logStep('阶段一：创建目录结构');
  
  // 创建后端目录
  log('\n创建后端目录...', 'blue');
  const serverDirs = [
    serverDir,
    path.join(serverDir, 'config'),
    path.join(serverDir, 'controllers'),
    path.join(serverDir, 'services'),
    path.join(serverDir, 'parser'),
    path.join(serverDir, 'parser', 'utils'),
    path.join(serverDir, 'router'),
    path.join(serverDir, 'validation'),
    path.join(serverDir, 'utils'),
    path.join(serverDir, 'tmp')
  ];
  
  serverDirs.forEach(dir => createDirectory(dir));
  
  // 创建前端目录
  log('\n创建前端目录...', 'blue');
  const webDirs = [
    webDir,
    path.join(webDir, 'css'),
    path.join(webDir, 'js'),
    path.join(webDir, 'js', 'config'),
    path.join(webDir, 'js', 'ui'),
    path.join(webDir, 'js', 'search'),
    path.join(webDir, 'js', 'visualizer'),
    path.join(webDir, 'js', 'services'),
    path.join(webDir, 'imgs'),
    path.join(webDir, 'config'),
    path.join(webDir, 'vendor')
  ];
  
  webDirs.forEach(dir => createDirectory(dir));
  
  // ========== 阶段二：迁移后端文件 ==========
  logStep('阶段二：迁移后端文件');
  
  const backendFiles = [
    { src: 'config.js', dest: path.join('config', 'index.js') },
    { src: 'controllers/analysisController.js', dest: 'controllers/analysisController.js' },
    { src: 'lib/parser/codeParser.js', dest: 'parser/CodeParser.js' },
    { src: 'router/analysisRouter.js', dest: 'router/analysisRouter.js' },
    { src: 'validation/analysisValidation.js', dest: 'validation/analysisValidation.js' },
    { src: 'server.js', dest: 'server.js' }
  ];
  
  backendFiles.forEach(file => {
    const src = path.join(srcServerDir, file.src);
    const dest = path.join(serverDir, file.dest);
    copyFile(src, dest);
  });
  
  // ========== 阶段三：迁移前端文件 ==========
  logStep('阶段三：迁移前端文件');
  
  // 复制 HTML
  copyFile(
    path.join(srcServerDir, 'index.html'),
    path.join(webDir, 'index.html')
  );
  
  // 复制 CSS
  copyFile(
    path.join(srcServerDir, 'css', 'style.css'),
    path.join(webDir, 'css', 'style.css')
  );
  
  // 复制 JS
  copyFile(
    path.join(srcServerDir, 'js', 'script.js'),
    path.join(webDir, 'js', 'script.js')
  );
  
  // 复制图片
  log('\n复制图片资源...', 'blue');
  const imgsDir = path.join(srcServerDir, 'imgs');
  const destImgsDir = path.join(webDir, 'imgs');
  if (fs.existsSync(imgsDir)) {
    fs.readdirSync(imgsDir).forEach(file => {
      if (file.endsWith('.svg')) {
        copyFile(path.join(imgsDir, file), path.join(destImgsDir, file));
      }
    });
  }
  
  // 复制配置文件
  log('\n复制配置文件...', 'blue');
  const configSrc = path.join(srcServerDir, 'config', 'frontendConfig.json');
  const configDest = path.join(webDir, 'config', 'frontendConfig.json');
  copyFile(configSrc, configDest);
  
  // 复制 vendor 目录
  log('\n复制第三方库...', 'blue');
  const vendorSrc = path.join(srcServerDir, 'vendor', 'highlight.js');
  const vendorDest = path.join(webDir, 'vendor', 'highlight.js');
  copyDirectory(vendorSrc, vendorDest);
  
  // ========== 阶段四：创建配置文件 ==========
  logStep('阶段四：创建配置文件');
  
  // 创建新的 server.js
  const newServerJs = `const express = require('express');
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
  console.log(\`服务器运行在 http://\${host}:\${port}\`);
});
`;
  
  fs.writeFileSync(path.join(serverDir, 'server.js'), newServerJs, 'utf8');
  logSuccess('更新 server.js');
  
  // ========== 完成 ==========
  logStep('迁移完成');
  
  logSuccess('后端目录：server/');
  logSuccess('前端目录：web/');
  logSuccess('旧目录：src/server/ (可以删除)');
  
  log('\n下一步操作：', 'cyan');
  log('1. 测试应用是否正常运行：cd server && node server.js');
  log('2. 访问：http://localhost:3001');
  log('3. 确认功能正常后，可以删除 src 目录');
  log('4. 参考 REFACTORING_ANALYSIS.md 进行代码重构');
  
  log('\n✓ 迁移完成！', 'green');
  return true;
}

// 运行迁移
try {
  const success = migrate();
  process.exit(success ? 0 : 1);
} catch (error) {
  logError(`迁移过程中发生错误：${error.message}`);
  console.error(error);
  process.exit(1);
}
