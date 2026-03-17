const CodeParser = require('../lib/parser/codeParser');
const path = require('path');
const fs = require('fs');
const { analysisConfig, functionTypes, importTypes, pathConfig } = require('../config');
const iconConfig = require('../config/frontendConfig.json');

// 基于入口函数构建调用关系图
function buildCallGraphFromEntry(allFunctions, calls, imports, entryFile, entryFunction) {
  const callGraph = {
    nodes: [],
    links: []
  };

  // 查找入口函数，使用完整路径匹配
  const entryFunc = allFunctions.find(func => {
    // 确保路径格式一致（使用正斜杠）
    const normalizedFuncFile = func.file.replace(/\\/g, '/');
    const normalizedEntryFile = entryFile.replace(/\\/g, '/');
    return normalizedFuncFile === normalizedEntryFile && func.name === entryFunction;
  });
  if (!entryFunc) {
    return callGraph;
  }

  // 构建文件依赖关系
  const fileDependencies = {};
  imports.forEach(imp => {
    if (!fileDependencies[imp.file]) {
      fileDependencies[imp.file] = [];
    }
    // 对于require语句，记录导入的模块名和本地变量名
    if (imp.type === 'require') {
      fileDependencies[imp.file].push({
        type: 'require',
        modulePath: imp.modulePath,
        localName: imp.localName
      });
    }
    // 对于import语句，记录导入的模块名和本地变量名
    else if (imp.type === 'import') {
      imp.specifiers.forEach(spec => {
        fileDependencies[imp.file].push({
          type: 'import',
          modulePath: imp.modulePath,
          localName: spec.local,
          importedName: spec.imported
        });
      });
    }
  });

  // 递归查找调用关系，使用广度优先搜索
  const visited = new Set();
  const queue = [entryFunc];
  const maxDepth = analysisConfig.maxDepth; // 限制调用图深度
  const depthMap = new Map();
  const currentId = entryFunc.file + '_' + entryFunc.name + '_' + entryFunc.start.line + '_' + entryFunc.start.column;
  depthMap.set(currentId, 0);

  // 检查节点是否已经存在的辅助函数
  function nodeExists(id) {
    return callGraph.nodes.some(node => node && node.id === id);
  }

  while (queue.length > 0) {
    const currentFunc = queue.shift();
    const currentId = currentFunc.file + '_' + currentFunc.name + '_' + currentFunc.start.line + '_' + currentFunc.start.column;
    const currentDepth = depthMap.get(currentId) || 0;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // 添加当前函数节点（如果不存在）
    if (!nodeExists(currentId)) {
      callGraph.nodes.push({
        id: currentId,
        name: currentFunc.name,
        file: currentFunc.file,
        type: currentFunc.type,
        start: currentFunc.start,
        end: currentFunc.end
      });
    }

    // 如果达到最大深度，不再继续分析
    if (currentDepth >= maxDepth) {
      continue;
    }

    // 查找当前函数调用的其他函数
      // 优化：只处理与当前函数相关的调用
      console.log('当前函数:', currentFunc.name, '文件:', currentFunc.file);
      const relevantCalls = calls.filter(call => {
        const isMatch = call.parent && call.parent.name === currentFunc.name && call.parent.file === currentFunc.file;
        if (call.name === 'findCourseListQueryDocStudy') {
          console.log('检查调用:', call.name, '父函数:', call.parent ? call.parent.name : '无', '父文件:', call.parent ? call.parent.file : '无', '匹配:', isMatch);
        }
        return isMatch;
      });
      console.log('找到相关调用:', relevantCalls.length, '个');

      relevantCalls.forEach(call => {
      let calleeFunc = null;
      
      // 检查是否是直接调用的函数
      if (!call.name.includes('.')) {
        console.log('查找直接调用的函数:', call.name, '在文件:', currentFunc.file);
        // 首先在当前文件中查找函数定义
        calleeFunc = allFunctions.find(func => {
          const normalizedFuncFile = func.file.replace(/\\/g, '/');
          const normalizedCurrentFile = currentFunc.file.replace(/\\/g, '/');
          return normalizedFuncFile === normalizedCurrentFile && func.name === call.name;
        });
        console.log('在当前文件中找到:', calleeFunc ? '是' : '否');
        
        // 如果找不到，在所有文件中查找同名函数，但优先选择FunctionDeclaration类型
        if (!calleeFunc) {
          // 优先查找FunctionDeclaration类型的函数
          calleeFunc = allFunctions.find(func => func.name === call.name && func.type === 'FunctionDeclaration');
          if (calleeFunc) {
            console.log('在所有文件中找到FunctionDeclaration类型的函数:', calleeFunc.name, '在文件:', calleeFunc.file);
          } else {
            // 如果没有FunctionDeclaration，再查找其他类型
            calleeFunc = allFunctions.find(func => func.name === call.name);
            console.log('在所有文件中找到:', calleeFunc ? '是' : '否');
          }
        }
        
        // 如果仍然找不到，尝试查找可能的模块导出函数
        if (!calleeFunc) {
          calleeFunc = allFunctions.find(func => 
            func.name === 'module_exports_' + call.name || 
            func.name === 'exports_' + call.name
          );
          console.log('找到模块导出函数:', calleeFunc ? '是' : '否');
        }
        console.log('最终找到的函数:', calleeFunc);
      } else {
        // 处理成员表达式调用，如 campusService.findCampusByAdminUserId
        const parts = call.name.split('.');
        const moduleName = parts[0];
        const funcName = parts[parts.length - 1];
        
        // 查找当前文件的导入信息，看moduleName是否是导入的模块
        const currentFileImports = fileDependencies[currentFunc.file] || [];
        const matchedImport = currentFileImports.find(imp => imp.localName === moduleName);
        
        if (matchedImport) {
          // 构建导入文件的路径
          const currentDir = path.dirname(currentFunc.file);
          
          // 构建相对于当前目录的完整路径
          let fullImportPath;
          if (matchedImport.modulePath.startsWith('../')) {
            // 处理上级目录
            const currentParts = currentDir.split('/');
            const relativeParts = matchedImport.modulePath.split('/');
            
            for (const part of relativeParts) {
              if (part === '..') {
                // 向上一级目录
                if (currentParts.length > 0) {
                  currentParts.pop();
                }
              } else if (part !== '.') {
                // 向下一级目录
                currentParts.push(part);
              }
            }
            
            fullImportPath = currentParts.join('/');
          } else if (matchedImport.modulePath.startsWith('./')) {
            // 处理同级目录
            fullImportPath = path.join(currentDir, matchedImport.modulePath.substring(2)).replace(/\\/g, '/');
          } else {
            // 处理模块名或绝对路径
            fullImportPath = matchedImport.modulePath;
          }
          
          // 尝试不同的文件扩展名
          const possiblePaths = [
            fullImportPath + '.js',
            fullImportPath
          ];
          
          let importFilePath = null;
          for (const possiblePath of possiblePaths) {
            // 首先在tmp目录下查找
            const tmpPath = path.join(__dirname, pathConfig.tmpDir, possiblePath);
            if (fs.existsSync(tmpPath)) {
              // 直接使用可能的路径作为导入文件路径
              importFilePath = possiblePath;
              break;
            }
          }
          
          // 首先在导入的文件中查找函数，包括类方法
          if (importFilePath) {
            // 移除文件扩展名进行匹配，确保路径格式一致
            const importFilePathWithoutExt = importFilePath.replace(/\.js$/, '');
            calleeFunc = allFunctions.find(func => {
              const funcFileWithoutExt = func.file.replace(/\.js$/, '');
              // 确保路径格式一致（使用正斜杠）
              const normalizedFuncFile = funcFileWithoutExt.replace(/\\/g, '/');
              const normalizedImportFile = importFilePathWithoutExt.replace(/\\/g, '/');
              return normalizedFuncFile === normalizedImportFile && (
                func.name === funcName || 
                func.name === 'module_exports_' + funcName || 
                func.name === 'exports_' + funcName ||
                ((func.type === 'ClassMethod' || func.type === 'MethodDefinition') && func.name === funcName)
              );
            });
          }
        }
        
        // 如果找不到，尝试在所有文件中查找函数名匹配的函数，但优先考虑与导入路径相关的文件
        if (!calleeFunc) {
          // 尝试在所有文件中查找，但优先选择与导入路径相关的文件
          // 首先尝试在可能的模块路径中查找
          if (typeof importFilePath !== 'undefined') {
            const importDir = path.dirname(importFilePath);
            calleeFunc = allFunctions.find(func => {
              const funcDir = path.dirname(func.file);
              const normalizedFuncDir = funcDir.replace(/\\/g, '/');
              const normalizedImportDir = importDir.replace(/\\/g, '/');
              return func.name === funcName && normalizedFuncDir.includes(normalizedImportDir);
            });
          }
          
          // 如果仍然找不到，再在所有文件中查找
          if (!calleeFunc) {
            calleeFunc = allFunctions.find(func => func.name === funcName);
          }
        }
        
        // 特殊处理：查找所有文件中类型为ClassMethod或MethodDefinition且函数名匹配的函数
        if (!calleeFunc) {
          // 首先尝试在可能的模块路径中查找，优先选择完整路径匹配
          if (typeof importFilePath !== 'undefined') {
            const importDir = path.dirname(importFilePath);
            // 优先选择路径完全匹配的函数
            calleeFunc = allFunctions.find(func => {
              const funcDir = path.dirname(func.file);
              const normalizedFuncDir = funcDir.replace(/\\/g, '/');
              const normalizedImportDir = importDir.replace(/\\/g, '/');
              return func.name === funcName && 
                     (func.type === 'ClassMethod' || func.type === 'MethodDefinition') &&
                     normalizedFuncDir === normalizedImportDir;
            });
            
            // 如果找不到，再尝试路径包含的函数
            if (!calleeFunc) {
              calleeFunc = allFunctions.find(func => {
                const funcDir = path.dirname(func.file);
                const normalizedFuncDir = funcDir.replace(/\\/g, '/');
                const normalizedImportDir = importDir.replace(/\\/g, '/');
                return func.name === funcName && 
                       (func.type === 'ClassMethod' || func.type === 'MethodDefinition') &&
                       normalizedFuncDir.includes(normalizedImportDir);
              });
            }
          }
          
          // 如果仍然找不到，再在所有文件中查找，但优先选择与当前文件路径结构相似的
          if (!calleeFunc) {
            // 优先选择与当前文件路径结构相似的函数
            const currentDir = path.dirname(currentFunc.file);
            const currentDirParts = currentDir.split('/').filter(part => part);
            
            // 按路径相似度排序函数
            const sortedFunctions = allFunctions
              .filter(func => 
                func.name === funcName && 
                (func.type === 'ClassMethod' || func.type === 'MethodDefinition')
              )
              .sort((a, b) => {
                const aDir = path.dirname(a.file);
                const bDir = path.dirname(b.file);
                const aParts = aDir.split('/').filter(part => part);
                const bParts = bDir.split('/').filter(part => part);
                
                // 计算路径相似度（共同路径部分的数量）
                let aSimilarity = 0;
                let bSimilarity = 0;
                
                for (let i = 0; i < Math.min(aParts.length, currentDirParts.length); i++) {
                  if (aParts[i] === currentDirParts[i]) {
                    aSimilarity++;
                  }
                }
                
                for (let i = 0; i < Math.min(bParts.length, currentDirParts.length); i++) {
                  if (bParts[i] === currentDirParts[i]) {
                    bSimilarity++;
                  }
                }
                
                return bSimilarity - aSimilarity;
              });
            
            if (sortedFunctions.length > 0) {
              calleeFunc = sortedFunctions[0];
              console.log('按路径相似度选择函数:', calleeFunc.name, '在文件:', calleeFunc.file);
            }
          }
        }
      }
      
      // 处理找到的函数
      if (calleeFunc && calleeFunc.start && calleeFunc.start.line !== undefined && calleeFunc.start.column !== undefined) {
        const calleeId = calleeFunc.file + '_' + calleeFunc.name + '_' + calleeFunc.start.line + '_' + calleeFunc.start.column;
        console.log('处理函数调用:', call.name, '->', calleeFunc.name, 'ID:', calleeId);
        
        // 检查节点是否已经存在
        if (!nodeExists(calleeId)) {
          console.log('添加新节点:', calleeId, '名称:', calleeFunc.name);
          // 添加被调用的函数节点
          // 构建节点名称：只显示函数名，并在后面添加文件路径
          let nodeName = calleeFunc.name;
          // 如果函数不在当前文件中，添加文件路径
          if (calleeFunc.file !== currentFunc.file) {
            nodeName = nodeName + ' （' + calleeFunc.file + '）';
          }
          callGraph.nodes.push({
            id: calleeId,
            name: nodeName,
            file: calleeFunc.file,
            type: calleeFunc.type,
            start: calleeFunc.start,
            end: calleeFunc.end
          });
        } else {
          console.log('节点已存在:', calleeId);
        }
        
        // 添加调用关系
        console.log('添加调用关系:', currentId, '->', calleeId);
        callGraph.links.push({
          source: currentId,
          target: calleeId
        });

        // 将被调用的函数加入队列，继续分析其内部调用
        if (!visited.has(calleeId)) {
          console.log('将函数加入队列:', calleeFunc.name, '深度:', currentDepth + 1);
          // 检查是否会形成循环调用
          // 简单的循环检测：如果被调用的函数已经在队列中，就不再添加
          if (!queue.some(func => {
            if (!func || !func.start || !func.start.line || !func.start.column) {
              return false;
            }
            const funcId = func.file + '_' + func.name + '_' + func.start.line + '_' + func.start.column;
            return funcId === calleeId;
          })) {
            queue.push(calleeFunc);
            depthMap.set(calleeId, currentDepth + 1);
          }
        } else {
          console.log('函数已访问:', calleeId);
        }
      } else {
        console.log('函数未找到或无效:', call.name);
      }
    });
  }

  return callGraph;
}

// 构建调用关系图
function buildCallGraph(functions, calls) {
  const callGraph = {
    nodes: [],
    links: []
  };

  // 限制节点和边的数量，防止构建过大的图
  const maxNodes = analysisConfig.maxNodes;
  const maxLinks = analysisConfig.maxLinks;
  let nodeCount = 0;
  let linkCount = 0;

  // 添加节点
  functions.forEach(func => {
    if (nodeCount >= maxNodes) return;
    
    callGraph.nodes.push({
      id: func.file + '_' + func.name + '_' + func.start.line + '_' + func.start.column,
      name: func.name,
      file: func.file,
      type: func.type,
      start: func.start,
      end: func.end
    });
    nodeCount++;
  });

  // 添加边
  calls.forEach(call => {
    if (linkCount >= maxLinks) return;
    
    if (call.parent) {
      const callerId = call.parent.file + '_' + call.parent.name + '_' + call.parent.start.line + '_' + call.parent.start.column;
      // 查找被调用的函数（可能在不同文件中）
      let calleeNode = functions.find(func => func.name === call.name);
      let calleeId;
      
      if (calleeNode) {
        calleeId = calleeNode.file + '_' + calleeNode.name + '_' + calleeNode.start.line + '_' + calleeNode.start.column;
        callGraph.links.push({
          source: callerId,
          target: calleeId
        });
        linkCount++;
      } else {
        // 如果找不到对应的函数，为成员表达式调用添加一个新的节点
        if (call.name.includes('.')) {
          calleeId = call.name;
          // 检查节点是否已经存在
          const existingNode = callGraph.nodes.find(node => node.id === calleeId);
          if (!existingNode) {
            callGraph.nodes.push({
              id: calleeId,
              name: call.name,
              file: call.file,
              type: 'ExternalFunction',
              start: call.start,
              end: call.end
            });
            nodeCount++;
          }
          // 添加边
          callGraph.links.push({
            source: callerId,
            target: calleeId
          });
          linkCount++;
        }
      }
    }
  });

  return callGraph;
}

// 分析入口文件，提取函数列表
const analyzeEntry = (req, res) => {
  try {
    const { entryFile } = req.body;

    // 处理路径：尝试多种路径方式
    let fullPath;
    let found = false;
    
    // 尝试1：相对于临时目录
    fullPath = path.join(__dirname, pathConfig.tmpDir, entryFile);
    if (fs.existsSync(fullPath)) {
      found = true;
    }
    
    // 尝试2：直接使用提供的路径（可能是绝对路径）
    if (!found && path.isAbsolute(entryFile)) {
      fullPath = entryFile;
      if (fs.existsSync(fullPath)) {
        found = true;
      }
    }
    
    // 尝试3：相对于项目根目录
    if (!found) {
      fullPath = path.join(__dirname, '..', '..', '..', entryFile);
      if (fs.existsSync(fullPath)) {
        found = true;
      }
    }
    
    // 尝试4：相对于当前工作目录
    if (!found) {
      fullPath = path.join(process.cwd(), entryFile);
      if (fs.existsSync(fullPath)) {
        found = true;
      }
    }
    
    // 尝试5：直接使用文件名（如果文件在当前目录）
    if (!found) {
      const fileName = path.basename(entryFile);
      fullPath = path.join(process.cwd(), fileName);
      if (fs.existsSync(fullPath)) {
        found = true;
      }
    }
    
    if (!found) {
      return res.status(404).json({ error: '未找到指定的入口文件' });
    }

    let targetCode = fs.readFileSync(fullPath, 'utf8');
    // 移除 multipart/form-data 头部信息
    const headerEndIndex = targetCode.indexOf('\n\n');
    if (headerEndIndex !== -1) {
      targetCode = targetCode.substring(headerEndIndex + 2);
    }

    const parser = new CodeParser();
    const result = parser.parse(targetCode);

    console.log('分析入口文件，找到函数:', result.functions.length);
    console.log('函数列表:', result.functions);

    res.json({
      functions: result.functions
    });
  } catch (error) {
    console.error('分析入口文件出错:', error);
    res.status(500).json({ error: error.message });
  }
};

// 分析代码
const analyze = (req, res) => {
  try {
    const { entryFile, entryFunction } = req.body;
    
    console.log('分析请求:', entryFile, entryFunction);

    // 直接从文件系统读取文件内容并递归分析所有相关文件

    const parser = new CodeParser();
    
    // 存储已分析的文件，避免重复分析
    const analyzedFiles = new Set();
    let allFunctions = [];
    let allCalls = [];
    let allImports = [];

    // 递归分析文件
    function analyzeFile(filePath, depth = 0) {
      // 规范化路径，确保同一个文件只有一个唯一的路径表示
      const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+\//g, '/');
      
      // 避免重复分析
      if (analyzedFiles.has(normalizedPath)) {
        return;
      }
      
      // 限制递归深度，防止栈溢出
      if (depth > analysisConfig.recursionDepthLimit) {
        console.log('警告：已达到递归深度上限，停止分析');
        return;
      }
      
      // 限制文件数量，防止分析过多文件
      if (analyzedFiles.size > analysisConfig.fileCountLimit) {
        console.log('警告：已达到文件分析上限，停止分析');
        return;
      }
      
      // 限制总函数数量，防止内存占用过大
      if (allFunctions.length > analysisConfig.functionCountLimit) {
        console.log('警告：已达到函数分析上限，停止分析');
        return;
      }
      
      analyzedFiles.add(normalizedPath);

      // 处理路径：只在tmp目录下查找
    let fullPath;
    let found = false;
    
    console.log('分析文件:', normalizedPath);
    
    // 尝试：相对于临时目录
    fullPath = path.join(__dirname, pathConfig.tmpDir, normalizedPath);
    console.log('尝试路径:', fullPath, '存在:', fs.existsSync(fullPath));
    if (fs.existsSync(fullPath)) {
      found = true;
    }
    
    console.log('最终路径:', fullPath, '找到:', found);
    
    if (!found) {
      return;
    }
    
    // 检查是否是目录
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return;
      }
      
      // 限制文件大小，防止分析过大的文件
      if (stat.size > analysisConfig.fileSizeLimit) {
        console.log('警告：文件过大，跳过分析');
        return;
      }
    } catch (error) {
      return;
    }

    const targetCode = fs.readFileSync(fullPath, 'utf8');
    const result = parser.parse(targetCode);
    
    console.log('解析结果:', result.functions.length, '个函数');
    
    // 为函数添加文件名信息
    result.functions.forEach(func => {
      func.file = normalizedPath;
    });
    result.calls.forEach(call => {
      call.file = normalizedPath;
    });
    // 为imports添加文件名信息
    result.imports.forEach(imp => {
      imp.file = normalizedPath;
    });

    allFunctions = [...allFunctions, ...result.functions];
    allCalls = [...allCalls, ...result.calls];
    allImports = [...allImports, ...result.imports];

    // 分析导入的文件
    console.log('Processing imports for file:', filePath);
    console.log('Imports:', result.imports);
    result.imports.forEach(imp => {
      if (imp.modulePath) {
        // 构建导入文件的路径
        const currentDir = path.dirname(normalizedPath);
        console.log('Current directory:', currentDir);
        
        // 处理相对路径导入
        let importPath;
        if (imp.modulePath.startsWith('./') || imp.modulePath.startsWith('../')) {
          // 相对路径：相对于当前文件所在目录
          importPath = imp.modulePath;
        } else {
          // 模块名：直接使用
          importPath = imp.modulePath;
        }
        
        console.log('Import path:', importPath);
        
        // 尝试不同的文件扩展名
        const possiblePaths = [
          importPath + '.js',
          importPath
        ];
        
        console.log('Looking for import:', imp.modulePath, 'from', currentDir);
        let found = false;
        for (const possiblePath of possiblePaths) {
          console.log('Trying path:', possiblePath);
          
          // 构建相对路径
          let relativePath;
          if (possiblePath.startsWith('./')) {
            // 移除 './' 前缀
            relativePath = possiblePath.substring(2);
          } else if (possiblePath.startsWith('../')) {
            // 处理 '../' 前缀
            relativePath = possiblePath;
          } else {
            relativePath = possiblePath;
          }
          
          // 构建相对于当前目录的完整路径
          let fullImportPath;
          if (relativePath.startsWith('../')) {
            // 处理上级目录
            // 分割当前目录和相对路径，然后计算新路径
            const currentParts = currentDir.split('/');
            const relativeParts = relativePath.split('/');
            
            for (const part of relativeParts) {
              if (part === '..') {
                // 向上一级目录
                if (currentParts.length > 0) {
                  currentParts.pop();
                }
              } else if (part !== '.') {
                // 向下一级目录
                currentParts.push(part);
              }
            }
            
            fullImportPath = currentParts.join('/');
          } else {
            // 处理同级或下级目录
            fullImportPath = path.join(currentDir, relativePath).replace(/\\/g, '/');
          }
          
          // 构建完整的tmp路径
          const tmpPath = path.join(__dirname, pathConfig.tmpDir, fullImportPath);
          console.log('Checking path (tmp):', tmpPath);
          if (fs.existsSync(tmpPath)) {
            // 规范化路径
            const normalizedImportPath = fullImportPath.replace(/\\/g, '/').replace(/\/+\//g, '/');
            analyzeFile(normalizedImportPath, depth + 1);
            found = true;
            break;
          }
          
          // 尝试直接在tmp目录下查找（处理路径中包含tmp的情况）
          const directTmpPath = path.join(__dirname, pathConfig.tmpDir, possiblePath);
          console.log('Checking direct path (tmp):', directTmpPath);
          if (fs.existsSync(directTmpPath)) {
            // 规范化路径
            let directPath = possiblePath.replace(/\\/g, '/').replace(/\/+\//g, '/');
            analyzeFile(directPath, depth + 1);
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log('Failed to find imported file:', imp.modulePath);
        }
      }
    });
  }

    // 开始分析入口文件
    console.log('Starting analysis with entry file:', entryFile);
    analyzeFile(entryFile, 0);

    console.log('Analysis completed:');
    console.log('Functions found:', allFunctions.length);
    console.log('Calls found:', allCalls.length);
    console.log('Imports found:', allImports.length);
    console.log('Functions:', allFunctions);
    console.log('Calls:', allCalls);
    console.log('Imports:', allImports);

    // 构建调用关系图
    const callGraph = buildCallGraphFromEntry(allFunctions, allCalls, allImports, entryFile, entryFunction);

    res.json({
      functions: allFunctions,
      calls: allCalls,
      imports: allImports,
      callGraph
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 保存文件到临时目录
const saveFiles = async (req, res) => {
  try {
    // 清空临时目录
    const tmpDir = path.join(__dirname, pathConfig.tmpDir);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    // 检查文件是否应该被排除
    function shouldExclude(filePath) {
      return (iconConfig.excludePaths || []).some(excludePath => {
        // 检查是否是文件夹路径
        if (excludePath.endsWith('/')) {
          return filePath.startsWith(excludePath);
        }
        // 检查是否是文件路径模式
        if (excludePath.includes('*')) {
          const regex = new RegExp(excludePath.replace(/\*/g, '.*'));
          return regex.test(filePath);
        }
        // 检查是否是完整的文件夹路径
        return filePath.includes('/' + excludePath + '/') || filePath === excludePath;
      });
    }

    // 检查请求类型
    if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
      // 处理文件上传（使用formidable库）
      const formidable = require('formidable');
      const form = new formidable.IncomingForm({
        allowEmptyFiles: true,
        minFileSize: 0,
        multiples: true,
        keepExtensions: true
      });
      
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('解析文件上传出错:', err);
          return res.status(500).json({ error: err.message });
        }

        console.log('Formidable解析结果:', { fields, files });

        const savePromises = [];
        
        // 处理多个文件
        if (files.files) {
          const fileArray = Array.isArray(files.files) ? files.files : [files.files];
          console.log('文件数量:', fileArray.length);
          
          fileArray.forEach((file, index) => {
            console.log('处理文件', index + 1, ':', file);
            
            // 检查文件对象的结构
            if (file && file.originalFilename && file.size > 0 && file.filepath) {
              // 提取文件路径（FormData中第三个参数）
              const filePath = file.originalFilename;
              console.log('文件路径:', filePath);
              if (shouldExclude(filePath)) {
                console.log('排除文件:', filePath);
                return;
              }
              
              const fullPath = path.join(tmpDir, filePath);
              const dir = path.dirname(fullPath);
              console.log('完整路径:', fullPath);
              console.log('目录:', dir);
              
              if (!fs.existsSync(dir)) {
                console.log('创建目录:', dir);
                fs.mkdirSync(dir, { recursive: true });
              }
              
              // 直接复制文件，不处理头部信息
              savePromises.push(new Promise((resolve, reject) => {
                console.log('复制文件:', file.filepath, '到:', fullPath);
                fs.copyFile(file.filepath, fullPath, (err) => {
                  if (err) {
                    console.error('复制文件出错:', err);
                    reject(err);
                  } else {
                    console.log('复制文件成功:', fullPath);
                    resolve();
                  }
                });
              }));
            } else {
              console.log('跳过空文件或无效文件:', file);
            }
          });
        } else {
          console.log('没有文件上传');
        }

        await Promise.all(savePromises);
        res.json({ success: true, message: '文件保存成功' });
      });
    } else {
      // 保持向后兼容，处理JSON格式
      const { files } = req.body;
      if (!files || typeof files !== 'object') {
        return res.status(400).json({ error: '缺少文件数据' });
      }

      // 保存所有文件（使用Promise.all并行处理）
      const savePromises = Object.entries(files).map(async ([filePath, content]) => {
        // 检查文件是否应该被排除
        if (!shouldExclude(filePath)) {
          const fullPath = path.join(tmpDir, filePath);
          // 创建目录结构
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // 写入文件
          fs.writeFileSync(fullPath, content);
        }
      });

      // 等待所有文件保存完成
      await Promise.all(savePromises);

      res.json({ success: true, message: '文件保存成功' });
    }
  } catch (error) {
    console.error('保存文件出错:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  analyzeEntry,
  analyze,
  saveFiles
};
