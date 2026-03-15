let files = [];
    let codeContents = {};
    let functions = [];
    let callGraph = {};
    let visualizer = null;
    let entryFile = '';
    let entryFunction = '';
    let tabs = [];
    let currentTabIndex = -1;

    // 初始化
    function init() {
      // 初始化可视化器
      visualizer = {
        containerId: 'graph-container',
        width: 600,
        height: 600,
        svg: null,
        force: null,
        nodes: [],
        links: []
      };

      // 事件监听
      document.getElementById('folder-input').addEventListener('change', handleFolderSelect);
      document.getElementById('entry-function-select').addEventListener('change', handleEntryFunctionSelect);
      document.getElementById('analyze-btn').addEventListener('click', analyzeCode);
    }
    
    // 调整大小相关函数
    let isResizing = false;
    
    function startResize(e) {
      isResizing = true;
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResize);
    }
    
    function resize(e) {
      if (!isResizing) return;
      
      const container = document.querySelector('body > div');
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      
      // 计算左侧面板的宽度百分比
      let leftWidthPercent = ((e.clientX - containerRect.left) / containerWidth) * 100;
      
      // 限制最小宽度
      leftWidthPercent = Math.max(20, Math.min(80, leftWidthPercent));
      
      // 更新左侧面板宽度
      const leftPanel = document.getElementById('left-panel');
      const resizer = document.getElementById('resizer');
      
      leftPanel.style.width = leftWidthPercent + '%';
      resizer.style.right = (100 - leftWidthPercent) + '%';
    }
    
    function stopResize() {
      isResizing = false;
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    }
    
    // Tab切换事件
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        // 检查是否是禁用的图形视图
        if (this.getAttribute('data-tab') === 'graph') {
          return; // 禁用图形视图
        }
        
        // 移除所有active类
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.borderBottom = 'none';
          b.style.backgroundColor = '#f8f9fa';
        });
        
        // 添加active类到当前按钮
        this.classList.add('active');
        this.style.borderBottom = '2px solid #3498db';
        this.style.backgroundColor = '#f8f9fa';
        
        // 隐藏所有tab内容
        document.querySelectorAll('.tab-content').forEach(content => {
          content.style.display = 'none';
        });
        
        // 显示对应tab内容
        const tabId = this.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).style.display = 'block';
      });
    });

    // 处理文件夹选择
    function handleFolderSelect(event) {
      const selectedFiles = event.target.files;
      if (selectedFiles.length === 0) return;

      console.log('选择的文件数量:', selectedFiles.length);
      files = Array.from(selectedFiles);
      codeContents = {};
      let loadedCount = 0;

      // 读取所有文件
      files.forEach(file => {
        console.log('文件:', file.name, 'webkitRelativePath:', file.webkitRelativePath);
        const reader = new FileReader();
        reader.onload = function(e) {
          // 存储文件内容，使用文件名作为键
          codeContents[file.name] = e.target.result;
          // 同时存储文件路径到文件名的映射
          if (file.webkitRelativePath) {
            codeContents[file.webkitRelativePath] = e.target.result;
            // 也存储文件路径的文件名部分作为键
            const fileName = file.webkitRelativePath.split('/').pop();
            codeContents[fileName] = e.target.result;
          }
          loadedCount++;
          console.log('加载进度:', loadedCount, '/', files.length);
          
          if (loadedCount === files.length) {
            console.log('所有文件加载完成，准备生成目录结构');
            document.getElementById('status').textContent = `已加载 ${files.length} 个文件`;
            
            // 显示目录结构
            const directoryStructure = document.getElementById('directory-structure');
            console.log('directory-structure 元素:', directoryStructure);
            directoryStructure.style.display = 'flex';
            console.log('directory-structure 显示状态:', directoryStructure.style.display);
            
            generateDirectoryStructure();
            
            // 不显示代码容器，只在选择函数后显示
            document.querySelector('.code-container').style.display = 'none';
            
            // 保存文件到后端临时目录
            saveFilesToServer();
          }
        };
        reader.readAsText(file);
      });
    }

    // 生成目录结构
    function generateDirectoryStructure() {
      const treeView = document.getElementById('tree-view');
      console.log('tree-view 元素:', treeView);
      treeView.innerHTML = '';
      
      // 按文件路径组织文件
      const directoryMap = {};
      
      console.log('files 数组长度:', files.length);
      files.forEach(file => {
        let parts = [];
        let filePath = file.name;
        
        // 检查是否支持webkitRelativePath
        if (file.webkitRelativePath) {
          parts = file.webkitRelativePath.split('/');
          filePath = file.webkitRelativePath;
        } else {
          // 如果不支持webkitRelativePath，只使用文件名
          parts = [file.name];
        }
        
        console.log('处理文件:', file.name, '路径部分:', parts);
        
        let current = directoryMap;
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (i === parts.length - 1) {
            // 是文件
            if (!current.files) {
              current.files = [];
            }
            current.files.push({
              name: part,
              path: filePath
            });
            console.log('添加文件:', part, '到路径:', filePath);
          } else {
            // 是目录
            if (!current[part]) {
              current[part] = {
                type: 'directory',
                children: {}
              };
              console.log('创建目录:', part);
            }
            current = current[part].children;
          }
        }
      });
      
      console.log('生成的目录结构:', directoryMap);
      
      // 递归生成目录树
      function buildTree(node, parentElement) {
        console.log('构建树节点:', node, '父元素:', parentElement);
        for (const key in node) {
          if (key === 'files') {
            // 处理文件
            console.log('处理文件列表:', node.files);
            node.files.forEach(file => {
              const fileElement = document.createElement('div');
              fileElement.className = 'file-item';
              fileElement.setAttribute('data-path', file.path);
              fileElement.innerHTML = `
                <span class="file-icon">📄</span>
                <span class="file-name">${file.name}</span>
              `;
              fileElement.style.paddingLeft = '20px';
              fileElement.style.cursor = 'pointer';
              fileElement.style.margin = '2px 0';
              
              // 添加点击事件
              fileElement.addEventListener('click', () => {
                selectEntryFile(file.path);
              });
              
              parentElement.appendChild(fileElement);
              console.log('添加文件元素:', file.name);
            });
          } else if (node[key].type === 'directory') {
            // 处理目录
            console.log('处理目录:', key);
            const dirElement = document.createElement('div');
            dirElement.className = 'dir-item';
            
            const dirHeader = document.createElement('div');
            dirHeader.style.cursor = 'pointer';
            dirHeader.style.display = 'flex';
            dirHeader.style.alignItems = 'center';
            dirHeader.style.padding = '4px 8px';
            dirHeader.style.borderRadius = '4px';
            dirHeader.style.transition = 'background-color 0.2s';
            
            // 添加悬停效果
            dirHeader.addEventListener('mouseenter', function() {
              this.style.backgroundColor = '#f0f0f0';
            });
            
            dirHeader.addEventListener('mouseleave', function() {
              this.style.backgroundColor = 'transparent';
            });
            
            // 创建目录图标
            const dirIcon = document.createElement('span');
            dirIcon.className = 'dir-icon';
            dirIcon.textContent = '📁';
            dirIcon.style.marginRight = '10px';
            dirIcon.style.fontSize = '16px';
            dirHeader.appendChild(dirIcon);
            
            // 创建目录名称
            const dirName = document.createElement('span');
            dirName.className = 'dir-name';
            dirName.textContent = key;
            dirName.style.fontSize = '14px';
            dirName.style.flex = '1';
            dirHeader.appendChild(dirName);
            
            // 创建目录内容
            const dirContent = document.createElement('div');
            dirContent.className = 'dir-content';
            dirContent.style.display = 'none';
            dirContent.style.paddingLeft = '20px';
            
            // 递归构建子目录
            buildTree(node[key].children, dirContent);
            
            // 添加展开/折叠功能
            dirHeader.addEventListener('click', function() {
              if (dirContent.style.display === 'none') {
                dirContent.style.display = 'block';
                dirIcon.textContent = '📂';
              } else {
                dirContent.style.display = 'none';
                dirIcon.textContent = '📁';
              }
            });
            
            dirElement.appendChild(dirHeader);
            dirElement.appendChild(dirContent);
            parentElement.appendChild(dirElement);
            console.log('添加目录元素:', key);
          }
        }
      }
      
      // 开始构建目录树
      console.log('开始构建目录树');
      buildTree(directoryMap, treeView);
      console.log('目录树构建完成');
    }

    // 选择入口文件
    function selectEntryFile(filePath) {
      entryFile = filePath;
      
      // 清除之前的选中状态
      document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
      });
      
      // 添加当前文件的选中状态
      const fileItems = document.querySelectorAll('.file-item');
      fileItems.forEach(item => {
        const fileName = item.querySelector('.file-name').textContent;
        const itemPath = item.getAttribute('data-path');
        if (itemPath === filePath || fileName === filePath.split('/').pop()) {
          item.classList.add('selected');
        }
      });
      
      // 显示起始函数选择和分析控制按钮
      document.getElementById('entry-function-section').style.display = 'flex';
      document.getElementById('analysis-controls').style.display = 'flex';
      
      // 分析入口文件，提取函数列表
      analyzeEntryFile(filePath);
    }




    // 分析入口文件，提取函数列表
    function analyzeEntryFile(filePath) {
      // 发送请求分析入口文件
      fetch('/api/analyze-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          entryFile: filePath
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          document.getElementById('status').textContent = `错误: ${data.error}`;
          document.getElementById('status').classList.add('error');
          console.error('分析入口文件出错:', data.error);
        } else {
          if (data.functions && data.functions.length > 0) {
            // 填充起始函数选择
            populateEntryFunctionSelect(data.functions);
            console.log('找到函数:', data.functions.length);
            console.log('函数列表:', data.functions);
          } else {
            document.getElementById('status').textContent = `警告: 未在文件中找到函数`;
            document.getElementById('status').classList.add('error');
            // 清空下拉框
            const select = document.getElementById('entry-function-select');
            select.innerHTML = '<option value="">未找到函数</option>';
            console.log('未在文件中找到函数');
          }
        }
      })
      .catch(error => {
        document.getElementById('status').textContent = `分析失败: ${error.message}`;
        document.getElementById('status').classList.add('error');
        console.error('分析请求失败:', error);
      });
    }

    // 填充起始函数选择
    function populateEntryFunctionSelect(fileFunctions) {
      const select = document.getElementById('entry-function-select');
      select.innerHTML = '<option value="">请选择起始函数</option>';
      
      console.log('填充起始函数选择，函数数量:', fileFunctions.length);
      console.log('函数列表:', fileFunctions);
      
      fileFunctions.forEach(func => {
        const option = document.createElement('option');
        option.value = func.name;
        
        // 根据函数类型添加图标
        let icon = '';
        if (func.type === 'FunctionDeclaration') {
          icon = '📝';
        } else if (func.type === 'FunctionExpression') {
          icon = '🔧';
        } else if (func.type === 'ArrowFunctionExpression') {
          icon = '➡️';
        } else if (func.type === 'MethodDefinition' || func.type === 'ClassMethod') {
          icon = '🏠';
        } else {
          icon = '📄';
        }
        
        option.textContent = `${icon} ${func.name} - 行 ${func.start.line}`;
        select.appendChild(option);
        console.log('添加函数选项:', func.name);
      });
      
      // 启用分析按钮
      document.getElementById('analyze-btn').disabled = false;
    }

    // 处理起始函数选择
    function handleEntryFunctionSelect(event) {
      entryFunction = event.target.value;
      if (entryFunction) {
        document.getElementById('analyze-btn').disabled = false;
      } else {
        document.getElementById('analyze-btn').disabled = true;
      }
    }

    // 创建新的代码tab
    function createTab(node) {
      const fileName = node.file.split('/').pop();
      const tabId = `${node.file}:${node.name}:${node.start.line}`;
      
      // 检查是否已经存在相同文件的tab（使用完整路径）
      const existingTabIndex = tabs.findIndex(tab => {
        return tab.file === node.file;
      });
      if (existingTabIndex !== -1) {
        // 更新已存在tab的node信息
        tabs[existingTabIndex].node = node;
        tabs[existingTabIndex].functionName = node.name;
        // 切换到已存在的tab
        switchTab(existingTabIndex);
        return;
      }
      
      // 创建新tab
      const newTab = {
        id: tabId,
        node: node,
        file: node.file,
        functionName: node.name,
        code: ''
      };
      
      // 查找文件内容
      if (node.file && codeContents[node.file]) {
        newTab.code = codeContents[node.file];
      } else if (node.file) {
        // 尝试使用反斜杠替换正斜杠
        const windowsPath = node.file.replace(/\//g, '\\');
        if (codeContents[windowsPath]) {
          newTab.code = codeContents[windowsPath];
        } else {
          // 尝试使用相对路径查找（从不同目录级别）
          const pathParts = node.file.split('/');
          let found = false;
          
          // 尝试从最长路径到最短路径
          for (let i = 0; i < pathParts.length; i++) {
            const partialPath = pathParts.slice(i).join('/');
            if (codeContents[partialPath]) {
              newTab.code = codeContents[partialPath];
              found = true;
              break;
            }
            // 尝试使用反斜杠
            const partialWindowsPath = pathParts.slice(i).join('\\');
            if (codeContents[partialWindowsPath]) {
              newTab.code = codeContents[partialWindowsPath];
              found = true;
              break;
            }
          }
          
          // 最后尝试使用文件名作为键查找
          if (!found) {
            const fileName = node.file.split('/').pop();
            if (codeContents[fileName]) {
              newTab.code = codeContents[fileName];
            }
          }
        }
      }
      
      tabs.push(newTab);
      currentTabIndex = tabs.length - 1;
      
      // 更新tab UI
      updateTabsUI();
      
      // 显示代码
      displayTabCode(newTab);
    }
    
    // 更新tab UI
    function updateTabsUI() {
      const tabsContainer = document.getElementById('code-tabs');
      tabsContainer.innerHTML = '';
      
      tabs.forEach((tab, index) => {
        const tabElement = document.createElement('div');
        tabElement.className = `code-tab ${index === currentTabIndex ? 'active' : ''}`;
        tabElement.style.display = 'flex';
        tabElement.style.alignItems = 'center';
        tabElement.style.padding = '8px 12px';
        tabElement.style.color = index === currentTabIndex ? '#d4d4d4' : '#999';
        tabElement.style.backgroundColor = index === currentTabIndex ? '#1e1e1e' : '#252526';
        tabElement.style.borderBottom = index === currentTabIndex ? '2px solid #3498db' : 'none';
        tabElement.style.cursor = 'pointer';
        tabElement.style.fontSize = '12px';
        tabElement.style.whiteSpace = 'nowrap';
        tabElement.style.overflow = 'hidden';
        tabElement.style.textOverflow = 'ellipsis';
        tabElement.style.minWidth = '100px';
        tabElement.style.maxWidth = '180px';
        
        // 只显示文件名
        const tabText = document.createElement('span');
        const fileName = tab.file.split('/').pop();
        tabText.textContent = fileName;
        tabText.style.whiteSpace = 'nowrap';
        tabText.style.overflow = 'hidden';
        tabText.style.textOverflow = 'ellipsis';
        tabText.style.flex = '1';
        tabText.style.marginRight = '8px';
        tabText.title = tab.file; // 鼠标悬停时显示完整文件路径
        tabElement.appendChild(tabText);
        
        // 关闭按钮
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.fontSize = '14px';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.padding = '0 4px';
        closeBtn.style.borderRadius = '2px';
        closeBtn.style.display = 'inline-block';
        closeBtn.style.lineHeight = '16px';
        closeBtn.style.height = '16px';
        closeBtn.style.width = '16px';
        closeBtn.style.textAlign = 'center';
        closeBtn.style.flexShrink = '0'; // 确保关闭按钮不被挤压
        
        closeBtn.addEventListener('mouseenter', function() {
          this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        
        closeBtn.addEventListener('mouseleave', function() {
          this.style.backgroundColor = 'transparent';
        });
        
        closeBtn.addEventListener('click', function(event) {
          event.stopPropagation();
          closeTab(index);
        });
        
        tabElement.appendChild(closeBtn);
        
        // 切换tab事件
        tabElement.addEventListener('click', function() {
          switchTab(index);
        });
        
        tabsContainer.appendChild(tabElement);
      });
    }
    
    // 切换tab
    function switchTab(index) {
      if (index < 0 || index >= tabs.length) return;
      
      currentTabIndex = index;
      updateTabsUI();
      displayTabCode(tabs[index]);
    }
    
    // 关闭tab
    function closeTab(index) {
      if (index < 0 || index >= tabs.length) return;
      
      tabs.splice(index, 1);
      
      if (tabs.length === 0) {
        currentTabIndex = -1;
        document.getElementById('code-content').innerHTML = '';
      } else {
        currentTabIndex = Math.min(currentTabIndex, tabs.length - 1);
        switchTab(currentTabIndex);
      }
      
      updateTabsUI();
    }
    
    // 显示代码
    function displayCode(code) {
      const codeContent = document.getElementById('code-content');
      
      // 使用highlight.js进行语法高亮
      const highlightedCode = hljs.highlight(code, { language: 'javascript' }).value;
      const lines = highlightedCode.split('\n');
      
      let html = '';
      lines.forEach((line, index) => {
        html += `<div class="line" data-line="${index + 1}">
          <span class="line-number">${index + 1}</span>
          <span class="code">${line}</span>
        </div>`;
      });
      
      codeContent.innerHTML = html;
    }
    
    // 显示tab代码
    function displayTabCode(tab) {
      if (!tab.code) {
        document.getElementById('code-content').innerHTML = `<div style="padding: 20px; color: red;">找不到文件: ${tab.file}</div>`;
        return;
      }
      
      // 显示代码
      displayCode(tab.code);
      
      // 高亮函数定义
      const startLine = tab.node.start.line;
      const endLine = tab.node.end.line;
      
      for (let i = startLine; i <= endLine; i++) {
        const lineElement = document.querySelector(`.line[data-line="${i}"]`);
        if (lineElement) {
          lineElement.classList.add('function-definition');
        }
      }
      
      // 滚动到函数定义位置
      const lineElement = document.querySelector(`.line[data-line="${startLine}"]`);
      if (lineElement) {
        lineElement.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }

    // 转义 HTML
    function escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // 分析代码
    function analyzeCode() {
      document.getElementById('status').textContent = '正在分析代码...';
      
      // 清空已打开的代码tab
      tabs = [];
      currentTabIndex = -1;
      updateTabsUI();
      document.getElementById('code-content').innerHTML = '';
      
      // 准备文件数据，只包含实际的 JS 文件
      const jsFiles = {};
      files.forEach(file => {
        if (file.name.endsWith('.js')) {
          // 使用完整的文件路径作为键
          const filePath = file.webkitRelativePath || file.name;
          jsFiles[filePath] = codeContents[filePath];
        }
      });
      
      fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          entryFile: entryFile,
          entryFunction: entryFunction
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          document.getElementById('status').textContent = `错误: ${data.error}`;
          document.getElementById('status').classList.add('error');
        } else {
          functions = data.functions;
          callGraph = data.callGraph;
          document.getElementById('status').textContent = `分析完成，找到 ${functions.length} 个函数`;
          document.getElementById('status').classList.remove('error');
          // 禁用图形视图，只生成函数目录结构
          generateFunctionTree(callGraph);
        }
      })
      .catch(error => {
        document.getElementById('status').textContent = `分析失败: ${error.message}`;
        document.getElementById('status').classList.add('error');
      });
    }

    // 可视化关系图
    function visualizeGraph(graphData) {
      try {
        // 清除之前的可视化
        d3.select(`#${visualizer.containerId}`).selectAll('*').remove();

        // 直接使用 graphData 中的数据，而不是存储到 visualizer 中
        const nodes = graphData.nodes;
        const links = graphData.links;

        // 限制节点数量，防止性能问题
        const MAX_NODES = 100;
        if (nodes.length > MAX_NODES) {
          console.warn(`节点数量过多(${nodes.length})，只显示前${MAX_NODES}个节点`);
          // 只保留入口节点和其直接子节点
          const entryNode = nodes[0];
          const entryNodeId = entryNode.id;
          const directChildIds = new Set();
          links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            if (sourceId === entryNodeId) {
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              directChildIds.add(targetId);
            }
          });
          const filteredNodes = nodes.filter(node => node.id === entryNodeId || directChildIds.has(node.id));
          const filteredLinks = links.filter(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return (sourceId === entryNodeId && directChildIds.has(targetId)) || 
                   (directChildIds.has(sourceId) && directChildIds.has(targetId));
          });
          nodes = filteredNodes;
          links = filteredLinks;
        }

        // 打印关键信息，简化日志输出
        console.log('可视化调用关系图:');
        console.log('节点数量:', nodes.length);
        console.log('边数量:', links.length);

        // 计算节点层级和子节点
        const nodeMap = {};
        const nodeChildren = {};
        const nodeLevels = {};
        
        // 构建节点映射
        nodes.forEach(node => {
          nodeMap[node.id] = node;
          nodeChildren[node.id] = [];
        });
        
        // 找到入口节点（假设第一个节点是入口）
        const entryNode = nodes[0];
        if (!entryNode) return;
        nodeLevels[entryNode.id] = 0;
        
        // 使用 BFS 计算每个节点的层级和子节点
        const queue = [entryNode.id];
        while (queue.length > 0) {
          const currentId = queue.shift();
          const currentLevel = nodeLevels[currentId];
          
          // 限制层级深度
          if (currentLevel > 5) continue;
          
          // 找到当前节点的所有子节点
          links.forEach(link => {
            if (link.source === currentId || (typeof link.source === 'object' && link.source.id === currentId)) {
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              if (!nodeLevels[targetId]) {
                nodeLevels[targetId] = currentLevel + 1;
                queue.push(targetId);
              }
              // 添加到子节点列表
              if (!nodeChildren[currentId].includes(targetId)) {
                nodeChildren[currentId].push(targetId);
              }
            }
          });
        }
        
        // 计算布局参数
        const margin = { top: 20, right: 20, bottom: 20, left: 20 };
        const width = visualizer.width - margin.left - margin.right;
        const height = visualizer.height - margin.top - margin.bottom;
        const maxLevel = Math.max(...Object.values(nodeLevels), 0);
        const levelWidth = width / (maxLevel + 1);
        const nodeHeight = 40;
        const nodeVerticalSpacing = 20; // 节点垂直间距
        const nodeHorizontalSpacing = 50; // 节点水平间距
        
        // 创建 SVG 元素
        visualizer.svg = d3.select(`#${visualizer.containerId}`)
          .append('svg')
          .attr('width', visualizer.width)
          .attr('height', visualizer.height)
          .append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // 计算每个节点的位置（类似目录结构）
        const nodePositions = {};
        const levelOffsets = {};
        
        // 初始化层级偏移
        Object.values(nodeLevels).forEach(level => {
          levelOffsets[level] = 0;
        });
        
        // 非递归计算节点位置
        function calculatePositions() {
          const stack = [{ nodeId: entryNode.id, level: 0 }];
          while (stack.length > 0) {
            const { nodeId, level } = stack.pop();
            const node = nodeMap[nodeId];
            if (!node) continue;
            
            const x = level * (levelWidth + nodeHorizontalSpacing) + 30; // 增加水平间距并为按钮留出空间
            const y = levelOffsets[level] * (nodeHeight + nodeVerticalSpacing); // 增加垂直间距
            
            nodePositions[nodeId] = { x, y };
            node.expanded = level === 0; // 只展开第一层
            
            // 增加层级偏移
            levelOffsets[level]++;
            
            // 处理子节点（逆序入栈，保证顺序）
            if (nodeChildren[nodeId].length > 0 && level < 5) {
              for (let i = nodeChildren[nodeId].length - 1; i >= 0; i--) {
                stack.push({ nodeId: nodeChildren[nodeId][i], level: level + 1 });
              }
            }
          }
        }
        
        // 开始计算位置
        calculatePositions();
        
        // 非递归绘制连接线（类似目录结构的连接线）
        function drawConnections() {
          const stack = [{ nodeId: entryNode.id, level: 0 }];
          while (stack.length > 0) {
            const { nodeId, level } = stack.pop();
            const parentPos = nodePositions[nodeId];
            if (!parentPos) continue;
            
            nodeChildren[nodeId].forEach(childId => {
              const childPos = nodePositions[childId];
              if (!childPos) return;
              
              const childNode = nodeMap[childId];
              const parentNode = nodeMap[nodeId];
              if (!childNode || !parentNode) return;
              
              const parentWidth = Math.max(100, parentNode.name.length * 7 + 10);
              
              // 绘制垂直连接线
              visualizer.svg.append('line')
                .attr('x1', parentPos.x + parentWidth)
                .attr('y1', parentPos.y + nodeHeight / 2)
                .attr('x2', childPos.x)
                .attr('y2', parentPos.y + nodeHeight / 2)
                .attr('stroke', '#999')
                .attr('stroke-width', 1)
                .attr('class', `connection-${nodeId}-${childId}`)
                .attr('data-source', nodeId)
                .attr('data-target', childId)
                .style('display', nodeMap[nodeId].expanded ? 'block' : 'none');
              
              // 绘制水平连接线
              visualizer.svg.append('line')
                .attr('x1', childPos.x)
                .attr('y1', parentPos.y + nodeHeight / 2)
                .attr('x2', childPos.x)
                .attr('y2', childPos.y + nodeHeight / 2)
                .attr('stroke', '#999')
                .attr('stroke-width', 1)
                .attr('class', `connection-${nodeId}-${childId}`)
                .attr('data-source', nodeId)
                .attr('data-target', childId)
                .style('display', nodeMap[nodeId].expanded ? 'block' : 'none');
              
              // 处理子节点
              if (level < 5) {
                stack.push({ nodeId: childId, level: level + 1 });
              }
            });
          }
        }
        
        // 绘制连接线
        drawConnections();
        
        // 绘制节点
        const node = visualizer.svg.selectAll('.node')
          .data(nodes)
          .enter()
          .append('g')
          .attr('class', 'node')
          .attr('data-id', d => d.id)
          .attr('transform', d => {
            const pos = nodePositions[d.id];
            return pos ? `translate(${pos.x},${pos.y})` : 'translate(0,0)';
          })
          .style('display', d => {
            if (nodeLevels[d.id] === 0) return 'block';
            const parentId = links.find(link => {
              const targetId = typeof link.target === 'object' ? link.target.id : link.target;
              return targetId === d.id;
            })?.source;
            const parentNode = nodeMap[typeof parentId === 'object' ? parentId.id : parentId];
            return parentNode?.expanded ? 'block' : 'none';
          });

        // 添加拖拽功能
        node.call(d3.drag()
          .on('start', function(event, d) {
            event.stopPropagation();
          })
          .on('drag', function(event, d) {
            // 计算移动距离
            const transform = d3.select(this).attr('transform');
            const oldTransform = transform ? transform.match(/translate\(([^,]+),([^)]+)\)/) : null;
            const oldX = oldTransform ? parseFloat(oldTransform[1]) : 0;
            const oldY = oldTransform ? parseFloat(oldTransform[2]) : 0;
            const deltaX = event.x - oldX;
            const deltaY = event.y - oldY;
            
            // 更新节点位置
            d3.select(this).attr('transform', `translate(${event.x},${event.y})`);
            
            const nodeWidth = Math.max(100, d.name.length * 7 + 10);
            const nodeCenterX = event.x;
            const nodeCenterY = event.y + nodeHeight / 2;
            const nodeRightX = event.x + nodeWidth;
            
            // 非递归移动所有子节点
            function moveChildNodes(parentId, dx, dy) {
              const stack = [parentId];
              while (stack.length > 0) {
                const currentId = stack.pop();
                nodeChildren[currentId].forEach(childId => {
                  const childNode = d3.select(`.node[data-id="${childId}"]`);
                  if (childNode.size() > 0) {
                    const childTransform = childNode.attr('transform');
                    const childOldTransform = childTransform ? childTransform.match(/translate\(([^,]+),([^)]+)\)/) : null;
                    const childOldX = childOldTransform ? parseFloat(childOldTransform[1]) : 0;
                    const childOldY = childOldTransform ? parseFloat(childOldTransform[2]) : 0;
                    const newChildX = childOldX + dx;
                    const newChildY = childOldY + dy;
                    
                    // 更新子节点位置
                    childNode.attr('transform', `translate(${newChildX},${newChildY})`);
                    
                    // 处理孙子节点
                    stack.push(childId);
                  }
                });
              }
            }
            
            // 移动所有子节点
            moveChildNodes(d.id, deltaX, deltaY);
            
            // 更新与该节点相关的连接线
            visualizer.svg.selectAll('line').each(function() {
              const line = d3.select(this);
              const source = line.attr('data-source');
              const target = line.attr('data-target');
              
              // 更新从当前节点出发的连接线
              if (source === d.id) {
                line.attr('x1', nodeRightX).attr('y1', nodeCenterY);
              }
              
              // 更新指向当前节点的连接线
              if (target === d.id) {
                line.attr('x2', nodeCenterX).attr('y2', nodeCenterY);
              }
              
              // 检查是否是子节点的连接线
              nodeChildren[d.id].forEach(childId => {
                if (source === childId || target === childId) {
                  const childNode = d3.select(`.node[data-id="${childId}"]`);
                  if (childNode.size() > 0) {
                    const childTransform = childNode.attr('transform');
                    const childOldTransform = childTransform ? childTransform.match(/translate\(([^,]+),([^)]+)\)/) : null;
                    const childX = childOldTransform ? parseFloat(childOldTransform[1]) : 0;
                    const childY = childOldTransform ? parseFloat(childOldTransform[2]) : 0;
                    const childCenterX = childX;
                    const childCenterY = childY + nodeHeight / 2;
                    
                    if (source === childId) {
                      line.attr('x1', childCenterX).attr('y1', childCenterY);
                    }
                    if (target === childId) {
                      line.attr('x2', childCenterX).attr('y2', childCenterY);
                    }
                  }
                }
              });
            });
          })
          .on('end', function(event, d) {
          }));
      
      // 为节点添加矩形框
      node.append('rect')
        .attr('width', d => {
          // 优化节点宽度计算，减少空间浪费
          return Math.max(100, d.name.length * 7 + 10);
        })
        .attr('height', nodeHeight)
        .attr('rx', 4)
        .attr('ry', 4)
        .attr('fill', d => {
          switch (d.type) {
            case 'FunctionDeclaration': return '#3498db';
            case 'FunctionExpression': return '#2ecc71';
            case 'ArrowFunctionExpression': return '#e74c3c';
            default: return '#95a5a6';
          }
        });
      
      // 为节点添加文本
      node.append('text')
        .attr('x', d => {
          // 计算节点宽度
          const nodeWidth = Math.max(100, d.name.length * 7 + 10);
          return nodeWidth / 2;
        })
        .attr('y', nodeHeight / 2 + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', '12px')
        .text(d => d.name);
      
      // 为有子节点的节点添加展开/折叠按钮
      node.filter(d => nodeChildren[d.id].length > 0)
        .append('rect')
        .attr('width', 20)
        .attr('height', 20)
        .attr('rx', 3)
        .attr('ry', 3)
        .attr('x', -25)
        .attr('y', (nodeHeight - 20) / 2)
        .attr('fill', '#f0f0f0')
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('click', function(event, d) {
          event.stopPropagation();
          // 切换展开/折叠状态
          d.expanded = !d.expanded;
          // 更新显示状态
          updateDisplay();
        });
      
      // 为展开/折叠按钮添加文本
      node.filter(d => nodeChildren[d.id].length > 0)
        .append('text')
        .attr('x', -15)
        .attr('y', nodeHeight / 2 + 4)
        .attr('text-anchor', 'middle')
        .attr('fill', '#333')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .text(d => d.expanded ? '−' : '+');

      // 添加缩放功能
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', function(event) {
          visualizer.svg.attr('transform', event.transform);
        });

      d3.select(`#${visualizer.containerId}`).call(zoom);

      // 为节点添加鼠标悬停效果，显示完整函数名
      node.append('title')
        .text(d => d.name);
      
      // 节点点击事件
      node.on('click', (event, d) => {
        highlightFunction(d);
      });
      
      // 更新显示状态
      function updateDisplay() {
        // 更新节点显示
        node.style('display', d => {
          if (nodeLevels[d.id] === 0) return 'block';
          const parentId = links.find(link => {
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            return targetId === d.id;
          })?.source;
          const parentNode = nodeMap[typeof parentId === 'object' ? parentId.id : parentId];
          return parentNode?.expanded ? 'block' : 'none';
        });
        
        // 更新连接线显示
        visualizer.svg.selectAll('line').style('display', function() {
          const classes = d3.select(this).attr('class').split(' ');
          for (const cls of classes) {
            if (cls.startsWith('connection-')) {
              const parts = cls.split('-');
              const parentId = parts[1];
              const parentNode = nodeMap[parentId];
              return parentNode?.expanded ? 'block' : 'none';
            }
          }
          return 'block';
        });
        
        // 更新展开/折叠按钮文本
        node.selectAll('text:nth-child(3)')
          .text(d => d.expanded ? '−' : '+');
      }
      } catch (error) {
        console.error('可视化失败:', error);
        document.getElementById('status').textContent = `可视化失败: ${error.message}`;
        document.getElementById('status').classList.add('error');
      }
    }

    // 高亮函数
    function highlightFunction(node) {
      // 显示代码容器
      document.querySelector('.code-container').style.display = 'flex';
      
      // 调试：查看节点数据结构
      console.log('点击的节点数据:', node);
      
      // 使用tab功能显示代码
      createTab(node);
    }



    // 生成函数目录结构
    function generateFunctionTree(graphData) {
      try {
        const treeContainer = document.getElementById('function-tree');
        treeContainer.innerHTML = '';
        
        const nodes = graphData.nodes;
        const links = graphData.links;
        
        // 限制节点数量，防止性能问题
        const MAX_NODES = 1000;
        if (nodes.length > MAX_NODES) {
          console.warn(`节点数量过多(${nodes.length})，只显示前${MAX_NODES}个节点`);
          // 保留前MAX_NODES个节点
          nodes = nodes.slice(0, MAX_NODES);
        }
      
      // 构建节点映射和子节点关系
      const nodeMap = {};
      const nodeChildren = {};
      
      nodes.forEach(node => {
        nodeMap[node.id] = node;
        nodeChildren[node.id] = [];
      });
      
      // 构建子节点关系
      links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        // 避免添加自身调用和循环调用
        if (sourceId !== targetId && !nodeChildren[sourceId].includes(targetId)) {
          nodeChildren[sourceId].push(targetId);
        }
      });
      
      // 找到入口节点（假设第一个节点是入口）
      const entryNode = nodes[0];
      if (!entryNode) return;
      
      // 非递归生成目录树
      function buildTree() {
        const stack = [{ nodeId: entryNode.id, parentElement: treeContainer, level: 0 }];
        
        while (stack.length > 0) {
          const { nodeId, parentElement, level } = stack.pop();
          const node = nodeMap[nodeId];
          if (!node) continue;
          
          // 限制层级深度
          if (level > 20) continue;
          
          // 创建节点元素
          const nodeElement = document.createElement('div');
          nodeElement.style.marginLeft = `${level * 20}px`;
          nodeElement.style.padding = '2px 0';
          
          // 创建节点内容
          const nodeContent = document.createElement('div');
          nodeContent.className = 'node-content';
          nodeContent.style.display = 'flex';
          nodeContent.style.alignItems = 'center';
          nodeContent.style.cursor = 'pointer';
          nodeContent.style.padding = '2px 8px';
          nodeContent.style.borderRadius = '4px';
          nodeContent.style.transition = 'background-color 0.2s';
          nodeContent.style.whiteSpace = 'nowrap';
          
          // 添加悬停效果
          nodeContent.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f0f0f0';
          });
          
          nodeContent.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
          });
          
          // 添加展开/折叠按钮
          let toggleBtn = null;
          if (nodeChildren[nodeId].length > 0) {
            toggleBtn = document.createElement('span');
            // 使用更现代的展开/折叠图标
            toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
            toggleBtn.style.marginRight = '10px';
            toggleBtn.style.cursor = 'pointer';
            toggleBtn.style.width = '16px';
            toggleBtn.style.display = 'flex';
            toggleBtn.style.alignItems = 'center';
            toggleBtn.style.justifyContent = 'center';
            
            // 初始状态为展开
            node.expanded = true;
            
            toggleBtn.addEventListener('click', function(event) {
              event.stopPropagation();
              node.expanded = !node.expanded;
              // 更新图标
              if (node.expanded) {
                toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
              } else {
                toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
              }
              
              // 切换子节点显示
              const childContainer = nodeElement.querySelector('.child-container');
              if (childContainer) {
                childContainer.style.display = node.expanded ? 'block' : 'none';
              }
            });
            
            nodeContent.appendChild(toggleBtn);
          } else {
            // 没有子节点，不显示图标
            // 添加一个空白占位符，保持对齐
            const placeholder = document.createElement('span');
            placeholder.style.width = '16px';
            placeholder.style.marginRight = '10px';
            placeholder.style.display = 'inline-block';
            nodeContent.appendChild(placeholder);
          }
          
          // 转换类型为缩写
          function getTypeAbbreviation(type) {
            switch(type) {
              case 'FunctionDeclaration': return 'FD';
              case 'FunctionExpression': return 'FE';
              case 'ClassMethod': return 'CM';
              case 'MethodDefinition': return 'MD';
              case 'ArrowFunctionExpression': return 'AF';
              case 'ObjectMethod': return 'OM';
              case 'ExternalFunction': return 'EF';
              default: return type.split('').filter(char => char === char.toUpperCase()).join('');
            }
          }
          
          // 添加函数名称和信息
          const functionInfo = document.createElement('span');
          functionInfo.style.fontSize = '12px';
          functionInfo.style.flex = '1';
          functionInfo.style.display = 'inline-flex';
          
          // 添加类型缩写（颜色淡一些）
          const typeAbbr = getTypeAbbreviation(node.type);
          const typeSpan = document.createElement('span');
          typeSpan.textContent = typeAbbr + ' ';
          typeSpan.style.color = '#666';
          typeSpan.style.marginRight = '4px';
          typeSpan.title = node.type; // 显示完整的类型名称
          functionInfo.appendChild(typeSpan);
          
          // 添加函数名称（正常颜色）
          const nameSpan = document.createElement('span');
          nameSpan.textContent = node.name;
          functionInfo.appendChild(nameSpan);
          
          // 添加文件路径（颜色淡一些）
          const filePath = node.file ? node.file : '';
          if (filePath) {
            const pathSpan = document.createElement('span');
            pathSpan.textContent = ` (${filePath})`;
            pathSpan.style.color = '#666';
            functionInfo.appendChild(pathSpan);
          }
          
          nodeContent.appendChild(functionInfo);
          
          // 添加悬停提示，显示行号
          nodeContent.title = `行 ${node.start.line}`;
          
          // 添加点击事件（触发展开/折叠并高亮函数）
          nodeContent.addEventListener('click', function() {
            // 无论是否有子节点，都高亮函数
            highlightFunction(node);
            
            // 高亮目录视图中的当前函数
            document.querySelectorAll('.node-content').forEach(el => {
              el.style.backgroundColor = 'transparent';
              el.style.fontWeight = 'normal';
            });
            nodeContent.style.backgroundColor = '#e3f2fd';
            nodeContent.style.fontWeight = 'bold';
            
            if (nodeChildren[nodeId].length > 0) {
              // 有子节点，触发展开/折叠
              node.expanded = !node.expanded;
              if (toggleBtn) {
                // 更新图标
                if (node.expanded) {
                  toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
                } else {
                  toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
                }
              }
              
              // 切换子节点显示
              const childContainer = nodeElement.querySelector('.child-container');
              if (childContainer) {
                childContainer.style.display = node.expanded ? 'block' : 'none';
              }
            }
          });
          
          nodeElement.appendChild(nodeContent);
          
          // 添加子节点容器
          if (nodeChildren[nodeId].length > 0) {
            const childContainer = document.createElement('div');
            childContainer.className = 'child-container';
            childContainer.style.display = 'block';
            
            // 逆序入栈，保证顺序
            for (let i = nodeChildren[nodeId].length - 1; i >= 0; i--) {
              stack.push({ 
                nodeId: nodeChildren[nodeId][i], 
                parentElement: childContainer, 
                level: level + 1 
              });
            }
            
            nodeElement.appendChild(childContainer);
          }
          
          parentElement.appendChild(nodeElement);
        }
      }
      
      // 开始构建目录树
      buildTree();
      } catch (error) {
        console.error('生成函数目录失败:', error);
        document.getElementById('status').textContent = `生成函数目录失败: ${error.message}`;
        document.getElementById('status').classList.add('error');
      }
    }

    // 保存文件到服务器临时目录
    function saveFilesToServer() {
      // 准备文件数据，只包含实际的 JS 文件
      const jsFiles = {};
      files.forEach(file => {
        if (file.name.endsWith('.js') || file.name.endsWith('.json')) {
          // 使用完整的文件路径作为键
          const filePath = file.webkitRelativePath || file.name;
          jsFiles[filePath] = codeContents[filePath];
        }
      });
      
      console.log('准备保存文件到服务器:', Object.keys(jsFiles));
      
      fetch('/api/save-files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: jsFiles })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log('文件保存成功');
          document.getElementById('status').textContent = `已加载 ${files.length} 个文件，保存成功`;
        } else {
          console.error('文件保存失败:', data.error);
          document.getElementById('status').textContent = `文件保存失败: ${data.error}`;
          document.getElementById('status').classList.add('error');
        }
      })
      .catch(error => {
        console.error('保存文件请求失败:', error);
        document.getElementById('status').textContent = `保存文件失败: ${error.message}`;
        document.getElementById('status').classList.add('error');
      });
    }

    // 初始化
    init();