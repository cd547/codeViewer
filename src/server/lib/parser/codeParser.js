const parser = require('@babel/parser');

class CodeParser {
  constructor() {
    this.functions = [];
    this.calls = [];
    this.imports = [];
  }

  parse(code) {
    try {
      // 检查代码是否为空
      if (!code || code.trim() === '') {
        console.warn('解析空代码');
        return {
          functions: [],
          calls: [],
          imports: []
        };
      }
      
      // 尝试使用模块模式解析（支持ES6模块）
      try {
        const ast = parser.parse(code, { 
          sourceType: 'module',
          locations: true,
          ranges: true,
          tokens: true,
          plugins: [
            'jsx',
            'typescript',
            'decorators-legacy',
            'classProperties',
            'objectRestSpread',
            'asyncGenerators',
            'dynamicImport',
            'optionalChaining',
            'nullishCoalescingOperator'
          ]
        });
        this.functions = [];
        this.calls = [];
        this.imports = [];
        this.traverse(ast);
        
        // 只移除module_exports_前缀，不再过滤箭头函数和IIFE
        const userDefinedFunctions = this.functions.map(func => {
          // 移除module_exports_前缀
          if (func.name.startsWith('module_exports_')) {
            return {
              ...func,
              name: func.name.replace('module_exports_', '')
            };
          }
          return func;
        });
        
        return {
          functions: userDefinedFunctions,
          calls: this.calls,
          imports: this.imports
        };
      } catch (moduleError) {
        // 模块模式解析失败，尝试脚本模式
        console.warn('模块模式解析失败，尝试脚本模式:', moduleError.message);
        
        const ast = parser.parse(code, { 
          sourceType: 'script',
          locations: true,
          ranges: true,
          tokens: true,
          plugins: [
            'jsx',
            'typescript',
            'decorators-legacy',
            'classProperties',
            'objectRestSpread',
            'asyncGenerators',
            'dynamicImport',
            'optionalChaining',
            'nullishCoalescingOperator'
          ]
        });
        this.functions = [];
        this.calls = [];
        this.imports = [];
        this.traverse(ast);
        
        // 只移除module_exports_前缀，不再过滤箭头函数和IIFE
        const userDefinedFunctions = this.functions.map(func => {
          // 移除module_exports_前缀
          if (func.name.startsWith('module_exports_')) {
            return {
              ...func,
              name: func.name.replace('module_exports_', '')
            };
          }
          return func;
        });
        
        return {
          functions: userDefinedFunctions,
          calls: this.calls,
          imports: this.imports
        };
      }
    } catch (error) {
      console.error('解析代码时出错:', error);
      // 尝试使用更宽松的解析模式
      try {
        console.log('尝试使用宽松模式解析');
        const ast = parser.parse(code, { 
          sourceType: 'script',
          locations: true,
          ranges: true,
          tokens: true,
          plugins: [],
          strictMode: false
        });
        this.functions = [];
        this.calls = [];
        this.imports = [];
        this.traverse(ast);
        
        // 只移除module_exports_前缀，不再过滤箭头函数和IIFE
        const userDefinedFunctions = this.functions.map(func => {
          // 移除module_exports_前缀
          if (func.name.startsWith('module_exports_')) {
            return {
              ...func,
              name: func.name.replace('module_exports_', '')
            };
          }
          return func;
        });
        
        return {
          functions: userDefinedFunctions,
          calls: this.calls,
          imports: this.imports
        };
      } catch (error2) {
        console.error('使用宽松模式解析代码时出错:', error2);
        // 尝试提取函数声明的简单方法
        try {
          console.log('尝试使用简单方法提取函数');
          const functions = this.extractFunctionsSimple(code);
          return {
            functions: functions,
            calls: [],
            imports: []
          };
        } catch (error3) {
          console.error('简单方法提取函数失败:', error3);
          // 返回空结果，避免影响用户体验
          return {
            functions: [],
            calls: [],
            imports: []
          };
        }
      }
    }
  }
  
  // 简单的函数提取方法，用于处理解析失败的情况
  extractFunctionsSimple(code) {
    const functions = [];
    const lines = code.split('\n');
    
    // 正则表达式匹配函数声明
    const functionRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
      const funcName = match[1];
      const lineNumber = code.substring(0, match.index).split('\n').length;
      
      functions.push({
        name: funcName,
        type: 'FunctionDeclaration',
        start: { line: lineNumber, column: 0 },
        end: { line: lineNumber + 1, column: 0 }
      });
    }
    
    return functions;
  }

  traverse(rootNode) {
    // 使用栈来模拟递归，避免栈溢出
    const stack = [{ node: rootNode, parentFunction: null, parentNode: null }];
    const visited = new Set();

    // 定义需要跳过的属性
    const skipKeys = new Set(['loc', 'range', 'id', 'params']);

    while (stack.length > 0) {
      // 限制栈的大小，防止无限循环
      if (stack.length > 50000) {
        console.warn('栈深度过大，可能存在循环引用，强制停止遍历');
        break;
      }

      const { node, parentFunction, parentNode } = stack.pop();

      if (!node || visited.has(node)) continue;
      visited.add(node);

      // 处理require语句 (CommonJS)
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
        // 检查是否有参数
        if (node.arguments && node.arguments.length > 0 && node.arguments[0].type === 'StringLiteral') {
          const modulePath = node.arguments[0].value;
          
          // 检查是否是赋值给变量
          if (parentNode && parentNode.type === 'VariableDeclarator') {
            const localName = parentNode.id.name;
            this.imports.push({
              type: 'require',
              modulePath,
              localName
            });
          } else if (parentNode && parentNode.type === 'AssignmentExpression' && parentNode.left.type === 'Identifier') {
            const localName = parentNode.left.name;
            this.imports.push({
              type: 'require',
              modulePath,
              localName
            });
          }
        }
      }
      
      // 处理import语句 (ES6)
      if (node.type === 'ImportDeclaration') {
        const modulePath = node.source.value;
        const specifiers = node.specifiers.map(spec => {
          if (spec.type === 'ImportDefaultSpecifier') {
            return {
              type: 'default',
              local: spec.local.name
            };
          } else if (spec.type === 'ImportSpecifier') {
            return {
              type: 'named',
              imported: spec.imported.name,
              local: spec.local.name
            };
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            return {
              type: 'namespace',
              local: spec.local.name
            };
          }
          return null;
        }).filter(Boolean);
        
        this.imports.push({
          type: 'import',
          modulePath,
          specifiers
        });
      }

      // 处理函数声明
      if (node.type === 'FunctionDeclaration') {
        const funcName = node.id ? node.id.name : 'anonymous';
        const funcInfo = {
          name: funcName,
          type: 'FunctionDeclaration',
          start: node.loc.start,
          end: node.loc.end,
          parent: parentFunction
        };
        this.functions.push(funcInfo);
        // 将函数体加入栈
        if (node.body) {
          stack.push({ node: node.body, parentFunction: funcInfo, parentNode: node });
        }
        // 跳过后续的子节点遍历，因为函数体已经单独处理
        continue;
      }

      // 处理函数表达式
      if (node.type === 'FunctionExpression') {
        // 检查是否是module.exports对象字面量的一部分
        let isModuleExportsFunction = false;
        if (parentNode) {
          // 检查是否是对象属性
          if (parentNode.type === 'Property') {
            // 检查父对象是否是module.exports的对象字面量
            if (parentNode.parent && parentNode.parent.type === 'ObjectExpression') {
              const objExpr = parentNode.parent;
              if (objExpr.parent && objExpr.parent.type === 'AssignmentExpression') {
                const assignment = objExpr.parent;
                if (assignment.left.type === 'MemberExpression' && 
                    assignment.left.object.type === 'Identifier' && 
                    assignment.left.object.name === 'module' && 
                    assignment.left.property.type === 'Identifier' && 
                    assignment.left.property.name === 'exports') {
                  isModuleExportsFunction = true;
                }
              }
            }
          }
        }
        
        // 如果是module.exports对象字面量中的函数，跳过，因为已经在处理module.exports时添加过了
        if (isModuleExportsFunction) {
          // 将函数体加入栈，继续分析函数内部
          if (node.body) {
            stack.push({ node: node.body, parentFunction, parentNode: node });
          }
          continue;
        }
        
        let funcName = 'anonymous';
        // 尝试从不同上下文中获取函数名
        if (parentNode) {
          if (parentNode.type === 'VariableDeclarator') {
            // 变量声明: const foo = function() {}
            funcName = parentNode.id.name;
          } else if (parentNode.type === 'AssignmentExpression' && parentNode.left.type === 'Identifier') {
            // 赋值表达式: foo = function() {}
            funcName = parentNode.left.name;
          } else if (parentNode.type === 'MethodDefinition') {
            // 类方法: class Foo { bar() {}}
            funcName = parentNode.key.name;
          } else if (parentNode.type === 'CallExpression') {
            // 立即执行函数表达式: (function() {})()
            // 尝试从函数表达式本身获取名称
            if (node.id) {
              // 命名函数表达式: (function foo() {})()
              funcName = node.id.name;
            } else {
              // 匿名函数表达式: (function() {})()
              funcName = 'IIFE';
            }
          }
        }
        const funcInfo = {
          name: funcName,
          type: 'FunctionExpression',
          start: node.loc.start,
          end: node.loc.end,
          parent: parentFunction
        };
        this.functions.push(funcInfo);
        // 将函数体加入栈
        if (node.body) {
          stack.push({ node: node.body, parentFunction: funcInfo, parentNode: node });
        }
        // 跳过后续的子节点遍历，因为函数体已经单独处理
        continue;
      }
      // 处理变量声明，确保能遍历到require语句
      if (node.type === 'VariableDeclaration') {
        // 遍历变量声明的声明符
        if (node.declarations) {
          node.declarations.forEach(declaration => {
            stack.push({ node: declaration, parentFunction, parentNode: node });
          });
        }
      }
      // 处理变量声明符，确保能遍历到require语句
      if (node.type === 'VariableDeclarator') {
        // 遍历初始化器
        if (node.init) {
          stack.push({ node: node.init, parentFunction, parentNode: node });
        }
      }
      // 处理箭头函数
      if (node.type === 'ArrowFunctionExpression') {
        let funcName = 'arrow';
        // 尝试从不同上下文中获取函数名
        if (parentNode) {
          if (parentNode.type === 'VariableDeclarator') {
            // 变量声明: const foo = () => {}
            funcName = parentNode.id.name;
          } else if (parentNode.type === 'AssignmentExpression' && parentNode.left.type === 'Identifier') {
            // 赋值表达式: foo = () => {}
            funcName = parentNode.left.name;
          } else if (parentNode.type === 'Property' && parentNode.key.type === 'Identifier') {
            // 对象方法: const obj = { foo: () => {} }
            funcName = parentNode.key.name;
          } else if (parentNode.type === 'MethodDefinition') {
            // 类方法: class Foo { bar() {} }
            funcName = parentNode.key.name;
          } else if (parentNode.type === 'CallExpression') {
            // 检查是否是真正的IIFE（立即执行箭头函数）: (() => {})()
            // 只有当箭头函数是CallExpression的callee时，才是真正的IIFE
            if (parentNode.callee === node) {
              // 尝试从上下文中获取更有意义的名称
              // 检查是否是赋值给变量的 IIFE
              if (parentNode.parent && parentNode.parent.type === 'VariableDeclarator') {
                funcName = parentNode.parent.id.name;
              } else if (parentNode.parent && parentNode.parent.type === 'AssignmentExpression' && parentNode.parent.left.type === 'Identifier') {
                funcName = parentNode.parent.left.name;
              } else {
                funcName = 'IIFE';
              }
            } else {
              // 箭头函数作为函数参数，不是IIFE
              funcName = 'arrow';
            }
          } else if (parentNode.type === 'ConditionalExpression') {
            // 条件表达式: condition ? () => {} : () => {}
            funcName = 'conditional_arrow';
          } else if (parentNode.type === 'ArrayExpression') {
            // 数组中的箭头函数: const arr = [() => {}]
            funcName = 'array_arrow';
          }
        }
        const funcInfo = {
          name: funcName,
          type: 'ArrowFunctionExpression',
          start: node.loc.start,
          end: node.loc.end,
          parent: parentFunction
        };
        this.functions.push(funcInfo);
        // 将函数体加入栈
        if (node.body) {
          if (node.body.type === 'BlockStatement') {
            stack.push({ node: node.body, parentFunction: funcInfo, parentNode: node });
          } else {
            // 箭头函数的简洁体
            stack.push({ node: node.body, parentFunction: funcInfo, parentNode: node });
          }
        }
        // 跳过后续的子节点遍历，因为函数体已经单独处理
        continue;
      }
      // 处理 BlockStatement
      if (node.type === 'BlockStatement') {
        // 处理 BlockStatement 的 body 属性
        if (node.body) {
          node.body.forEach(item => {
            if (typeof item === 'object' && item !== null) {
              stack.push({ node: item, parentFunction, parentNode: node });
            }
          });
        }
        // 跳过后续的子节点遍历，因为body已经单独处理
        continue;
      }

      // 处理AwaitExpression
      if (node.type === 'AwaitExpression') {
        // 递归处理表达式中的所有CallExpression
        function processExpression(expr) {
          if (expr.type === 'CallExpression') {
            let callName = '';
            if (expr.callee.type === 'Identifier') {
              // 简单标识符调用: foo()
              callName = expr.callee.name;
            } else if (expr.callee.type === 'MemberExpression') {
              // 成员表达式调用: obj.foo()
              callName = this.getMemberExpressionName(expr.callee);
            }
            
            if (callName) {
              // 检查是否是通用的JS方法
              let isCommonMethod = false;
              
              // 检查是否是全局方法
              const globalMethods = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate'];
              if (globalMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是内置对象的方法
              const builtInObjects = ['JSON', 'console', 'Math', 'Date', 'RegExp', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Function', 'Error', 'Buffer', 'process', 'global', 'window', 'document', 'Promise'];
              for (const obj of builtInObjects) {
                if (callName.startsWith(obj + '.')) {
                  isCommonMethod = true;
                  break;
                }
              }
              
              // 检查是否是请求/响应对象的方法
              if (callName.startsWith('req.') || callName.startsWith('res.')) {
                isCommonMethod = true;
              }
              
              // 检查是否是内置函数构造器
              const builtInConstructors = ['String', 'Boolean', 'Object', 'Array', 'Function', 'Date', 'RegExp', 'Error', 'Buffer', 'Number'];
              if (builtInConstructors.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是数组方法
              const arrayMethods = ['map', 'forEach', 'filter', 'reduce', 'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat', 'indexOf', 'lastIndexOf', 'includes', 'sort', 'reverse', 'join', 'toString', 'toLocaleString', 'every', 'some', 'find', 'findIndex', 'flat', 'flatMap'];
              if (arrayMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是成员表达式中的数组方法（如list.map）
              if (callName.includes('.')) {
                const parts = callName.split('.');
                const methodName = parts[parts.length - 1];
                if (arrayMethods.includes(methodName)) {
                  isCommonMethod = true;
                }
              }
              
              // 检查是否是对象方法
              const objectMethods = ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable'];
              if (objectMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是字符串方法
              const stringMethods = ['toString', 'toLowerCase', 'toUpperCase', 'trim', 'trimStart', 'trimEnd', 'split', 'join', 'substring', 'substr', 'slice', 'indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith', 'replace', 'replaceAll', 'match', 'matchAll', 'search', 'localeCompare', 'charAt', 'charCodeAt', 'codePointAt', 'repeat', 'padStart', 'padEnd'];
              if (stringMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是数字方法
              const numberMethods = ['toString', 'toFixed', 'toExponential', 'toPrecision', 'valueOf'];
              if (numberMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是函数方法
              const functionMethods = ['apply', 'call', 'bind', 'toString'];
              if (functionMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是第三方依赖（npm安装的外部依赖）
              const thirdPartyLibs = ['_', 'lodash', 'moment', 'axios', 'express', 'react', 'vue', 'angular', 'jquery', 'underscore', 'async', 'bluebird', 'lodash-es'];
              if (callName.includes('.')) {
                const parts = callName.split('.');
                const libName = parts[0];
                if (thirdPartyLibs.includes(libName)) {
                  isCommonMethod = true;
                }
              } else {
                if (thirdPartyLibs.includes(callName)) {
                  isCommonMethod = true;
                }
              }
              
              // 只添加非通用方法
              if (!isCommonMethod) {
                // 检查是否已经添加过相同的调用
                const isDuplicate = this.calls.some(call => 
                  call.name === callName && 
                  call.start.line === expr.loc.start.line && 
                  call.start.column === expr.loc.start.column
                );
                
                if (!isDuplicate) {
                  const callInfo = {
                    name: callName,
                    start: expr.loc.start,
                    end: expr.loc.end,
                    parent: parentFunction
                  };
                  this.calls.push(callInfo);
                }
              }
            }
            
            // 处理CallExpression的参数，特别是数组参数（如Promise.all([...])）
            if (expr.arguments) {
              expr.arguments.forEach(arg => {
                processExpression.call(this, arg);
              });
            }
          } else if (expr.type === 'ArrayExpression') {
            // 处理数组表达式中的元素
            expr.elements.forEach(element => {
              if (element) {
                processExpression.call(this, element);
              }
            });
          } else if (expr.type === 'ObjectExpression') {
            // 处理对象表达式中的属性
            expr.properties.forEach(prop => {
              if (prop.value) {
                processExpression.call(this, prop.value);
              }
            });
          } else if (expr.type === 'LogicalExpression' || expr.type === 'BinaryExpression' || expr.type === 'ConditionalExpression') {
            // 处理逻辑表达式、二元表达式和条件表达式
            if (expr.left) {
              processExpression.call(this, expr.left);
            }
            if (expr.right) {
              processExpression.call(this, expr.right);
            }
            if (expr.test) {
              processExpression.call(this, expr.test);
            }
            if (expr.consequent) {
              processExpression.call(this, expr.consequent);
            }
            if (expr.alternate) {
              processExpression.call(this, expr.alternate);
            }
          }
        }
        
        // 处理AwaitExpression中的表达式
        processExpression.call(this, node.argument);
      }
      // 处理函数调用
      if (node.type === 'CallExpression') {
        // 跳过AwaitExpression中的CallExpression，避免重复处理
        if (parentNode && parentNode.type === 'AwaitExpression') {
          continue;
        }
        
        let callName = '';
        if (node.callee.type === 'Identifier') {
          // 简单标识符调用: foo()
          callName = node.callee.name;
        } else if (node.callee.type === 'MemberExpression') {
          // 成员表达式调用: obj.foo() 或 obj[foo]()
          callName = this.getMemberExpressionName(node.callee);
        }
        
        if (callName) {
          // 检查是否是通用的JS方法
          let isCommonMethod = false;
          
          // 检查是否是全局方法
          const globalMethods = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate'];
          if (globalMethods.includes(callName)) {
            isCommonMethod = true;
          }
          
          // 检查是否是内置对象的方法
          const builtInObjects = ['JSON', 'console', 'Math', 'Date', 'RegExp', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Function', 'Error', 'Buffer', 'process', 'global', 'window', 'document', 'Promise'];
          for (const obj of builtInObjects) {
            if (callName.startsWith(obj + '.')) {
              isCommonMethod = true;
              break;
            }
          }
          
          // 检查是否是请求/响应对象的方法
          if (callName.startsWith('req.') || callName.startsWith('res.')) {
            isCommonMethod = true;
          }
          
          // 检查是否是内置函数构造器
          const builtInConstructors = ['String', 'Boolean', 'Object', 'Array', 'Function', 'Date', 'RegExp', 'Error', 'Buffer', 'Number'];
          if (builtInConstructors.includes(callName)) {
            isCommonMethod = true;
          }
          
          // 检查是否是数组方法
          const arrayMethods = ['map', 'forEach', 'filter', 'reduce', 'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat', 'indexOf', 'lastIndexOf', 'includes', 'sort', 'reverse', 'join', 'toString', 'toLocaleString', 'every', 'some', 'find', 'findIndex', 'flat', 'flatMap'];
          if (arrayMethods.includes(callName)) {
            isCommonMethod = true;
          }
          
          // 检查是否是成员表达式中的数组方法（如list.map）
          if (callName.includes('.')) {
            const parts = callName.split('.');
            const methodName = parts[parts.length - 1];
            if (arrayMethods.includes(methodName)) {
              isCommonMethod = true;
            }
          }
          
          // 检查是否是对象方法
          const objectMethods = ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable'];
          if (objectMethods.includes(callName)) {
            isCommonMethod = true;
          }
          
          // 检查是否是字符串方法
          const stringMethods = ['toString', 'toLowerCase', 'toUpperCase', 'trim', 'trimStart', 'trimEnd', 'split', 'join', 'substring', 'substr', 'slice', 'indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith', 'replace', 'replaceAll', 'match', 'matchAll', 'search', 'localeCompare', 'charAt', 'charCodeAt', 'codePointAt', 'repeat', 'padStart', 'padEnd'];
          if (stringMethods.includes(callName)) {
            isCommonMethod = true;
          }
          
          // 检查是否是数字方法
          const numberMethods = ['toString', 'toFixed', 'toExponential', 'toPrecision', 'valueOf'];
          if (numberMethods.includes(callName)) {
            isCommonMethod = true;
          }
          
          // 检查是否是函数方法
          const functionMethods = ['apply', 'call', 'bind', 'toString'];
          if (functionMethods.includes(callName)) {
            isCommonMethod = true;
          }
          
          // 检查是否是第三方依赖（npm安装的外部依赖）
          const thirdPartyLibs = ['_', 'lodash', 'moment', 'axios', 'express', 'react', 'vue', 'angular', 'jquery', 'underscore', 'async', 'bluebird', 'lodash-es'];
          if (callName.includes('.')) {
            const parts = callName.split('.');
            const libName = parts[0];
            if (thirdPartyLibs.includes(libName)) {
              isCommonMethod = true;
            }
          } else {
            if (thirdPartyLibs.includes(callName)) {
              isCommonMethod = true;
            }
          }
          
          // 只添加非通用方法
          if (!isCommonMethod) {
            // 检查是否已经添加过相同的调用
            const isDuplicate = this.calls.some(call => 
              call.name === callName && 
              call.start.line === node.loc.start.line && 
              call.start.column === node.loc.start.column
            );
            
            if (!isDuplicate) {
              const callInfo = {
                name: callName,
                start: node.loc.start,
                end: node.loc.end,
                parent: parentFunction
              };
              this.calls.push(callInfo);
            }
          }
        }
      }
      // 处理 module.exports 和 exports
      if (node.type === 'AssignmentExpression') {
        // 检查右侧是否是AwaitExpression
        if (node.right.type === 'AwaitExpression') {
          // 如果await的是一个CallExpression，处理它
          if (node.right.argument.type === 'CallExpression') {
            let callName = '';
            if (node.right.argument.callee.type === 'Identifier') {
              // 简单标识符调用: await foo()
              callName = node.right.argument.callee.name;
            } else if (node.right.argument.callee.type === 'MemberExpression') {
              // 成员表达式调用: await obj.foo()
              callName = this.getMemberExpressionName(node.right.argument.callee);
            }
            
            if (callName) {
              // 检查是否是通用的JS方法
              let isCommonMethod = false;
              
              // 检查是否是全局方法
              const globalMethods = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'setImmediate', 'clearImmediate'];
              if (globalMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是内置对象的方法
              const builtInObjects = ['JSON', 'console', 'Math', 'Date', 'RegExp', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Function', 'Error', 'Buffer', 'process', 'global', 'window', 'document', 'Promise'];
              for (const obj of builtInObjects) {
                if (callName.startsWith(obj + '.')) {
                  isCommonMethod = true;
                  break;
                }
              }
              
              // 检查是否是请求/响应对象的方法
              if (callName.startsWith('req.') || callName.startsWith('res.')) {
                isCommonMethod = true;
              }
              
              // 检查是否是内置函数构造器
              const builtInConstructors = ['String', 'Boolean', 'Object', 'Array', 'Function', 'Date', 'RegExp', 'Error', 'Buffer', 'Number'];
              if (builtInConstructors.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是数组方法
              const arrayMethods = ['map', 'forEach', 'filter', 'reduce', 'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat', 'indexOf', 'lastIndexOf', 'includes', 'sort', 'reverse', 'join', 'toString', 'toLocaleString', 'every', 'some', 'find', 'findIndex', 'flat', 'flatMap'];
              if (arrayMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是成员表达式中的数组方法（如list.map）
              if (callName.includes('.')) {
                const parts = callName.split('.');
                const methodName = parts[parts.length - 1];
                if (arrayMethods.includes(methodName)) {
                  isCommonMethod = true;
                }
              }
              
              // 检查是否是对象方法
              const objectMethods = ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable'];
              if (objectMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是字符串方法
              const stringMethods = ['toString', 'toLowerCase', 'toUpperCase', 'trim', 'trimStart', 'trimEnd', 'split', 'join', 'substring', 'substr', 'slice', 'indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith', 'replace', 'replaceAll', 'match', 'matchAll', 'search', 'localeCompare', 'charAt', 'charCodeAt', 'codePointAt', 'repeat', 'padStart', 'padEnd'];
              if (stringMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是数字方法
              const numberMethods = ['toString', 'toFixed', 'toExponential', 'toPrecision', 'valueOf'];
              if (numberMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是函数方法
              const functionMethods = ['apply', 'call', 'bind', 'toString'];
              if (functionMethods.includes(callName)) {
                isCommonMethod = true;
              }
              
              // 检查是否是第三方依赖（npm安装的外部依赖）
              const thirdPartyLibs = ['_', 'lodash', 'moment', 'axios', 'express', 'react', 'vue', 'angular', 'jquery', 'underscore', 'async', 'bluebird', 'lodash-es'];
              if (callName.includes('.')) {
                const parts = callName.split('.');
                const libName = parts[0];
                if (thirdPartyLibs.includes(libName)) {
                  isCommonMethod = true;
                }
              } else {
                if (thirdPartyLibs.includes(callName)) {
                  isCommonMethod = true;
                }
              }
              
              // 只添加非通用方法
              if (!isCommonMethod) {
                // 检查是否已经添加过相同的调用
                const isDuplicate = this.calls.some(call => 
                  call.name === callName && 
                  call.start.line === node.right.argument.loc.start.line && 
                  call.start.column === node.right.argument.loc.start.column
                );
                
                if (!isDuplicate) {
                  const callInfo = {
                    name: callName,
                    start: node.right.argument.loc.start,
                    end: node.right.argument.loc.end,
                    parent: parentFunction
                  };
                  this.calls.push(callInfo);
                }
              }
            }
          }
        }
        
        // 处理 module.exports = function() {}
        if (node.left.type === 'MemberExpression' && 
            node.left.object.type === 'Identifier' && 
            node.left.object.name === 'module' && 
            node.left.property.type === 'Identifier' && 
            node.left.property.name === 'exports') {
          if (node.right.type === 'FunctionExpression' || node.right.type === 'ArrowFunctionExpression') {
            let funcName = 'module_exports';
            const funcInfo = {
              name: funcName,
              type: node.right.type,
              start: node.right.loc.start,
              end: node.right.loc.end,
              parent: parentFunction
            };
            this.functions.push(funcInfo);
            // 将函数体加入栈
            if (node.right.body) {
              if (node.right.body.type === 'BlockStatement') {
                stack.push({ node: node.right.body, parentFunction: funcInfo, parentNode: node.right });
              } else {
                // 箭头函数的简洁体
                stack.push({ node: node.right.body, parentFunction: funcInfo, parentNode: node.right });
              }
            }
          } else if (node.right.type === 'ObjectExpression') {
            // 处理 module.exports = { foo: function() {} }
            // 标记这个对象表达式为module.exports，避免重复处理
            node.right.isModuleExports = true;
            console.log('处理module.exports对象字面量，属性数量:', node.right.properties.length);
            node.right.properties.forEach(prop => {
              console.log('处理属性:', prop.type, 'key:', prop.key ? (prop.key.name || prop.key.value) : '无', 'value:', prop.value ? prop.value.type : '无');
              // 处理对象属性（ObjectProperty）
              if (prop.type === 'ObjectProperty' && prop.value && (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')) {
                let funcName = prop.key ? (prop.key.name || prop.key.value) : 'anonymous';
                const funcInfo = {
                  name: funcName,
                  type: prop.value.type,
                  start: prop.value.loc.start,
                  end: prop.value.loc.end,
                  parent: parentFunction
                };
                this.functions.push(funcInfo);
                console.log('添加函数:', funcName, '类型:', prop.value.type);
                // 将函数体加入栈
                if (prop.value.body) {
                  if (prop.value.body.type === 'BlockStatement') {
                    stack.push({ node: prop.value.body, parentFunction: funcInfo, parentNode: prop.value });
                  } else {
                    // 箭头函数的简洁体
                    stack.push({ node: prop.value.body, parentFunction: funcInfo, parentNode: prop.value });
                  }
                }
              } 
              // 处理对象方法（ObjectMethod）
              else if (prop.type === 'ObjectMethod') {
                let funcName = prop.key ? (prop.key.name || prop.key.value) : 'anonymous';
                const funcInfo = {
                  name: funcName,
                  type: prop.type,
                  start: prop.loc.start,
                  end: prop.loc.end,
                  parent: parentFunction
                };
                this.functions.push(funcInfo);
                console.log('添加函数:', funcName, '类型:', prop.type);
                // 将函数体加入栈
                if (prop.body) {
                  if (prop.body.type === 'BlockStatement') {
                    stack.push({ node: prop.body, parentFunction: funcInfo, parentNode: prop });
                  } else {
                    // 箭头函数的简洁体
                    stack.push({ node: prop.body, parentFunction: funcInfo, parentNode: prop });
                  }
                }
              }
            });
          }
        }
        // 处理 exports.foo = function() {}
        if (node.left.type === 'MemberExpression' && 
                 node.left.object.type === 'Identifier' && 
                 node.left.object.name === 'exports' && 
                 node.left.property.type === 'Identifier') {
          if (node.right.type === 'FunctionExpression' || node.right.type === 'ArrowFunctionExpression') {
            let funcName = 'exports_' + node.left.property.name;
            const funcInfo = {
              name: funcName,
              type: node.right.type,
              start: node.right.loc.start,
              end: node.right.loc.end,
              parent: parentFunction
            };
            this.functions.push(funcInfo);
            // 将函数体加入栈
            if (node.right.body) {
              if (node.right.body.type === 'BlockStatement') {
                stack.push({ node: node.right.body, parentFunction: funcInfo, parentNode: node.right });
              } else {
                // 箭头函数的简洁体
                stack.push({ node: node.right.body, parentFunction: funcInfo, parentNode: node.right });
              }
            }
          }
        }
      }
      // 处理对象字面量中的函数
      if (node.type === 'ObjectExpression') {
        // 检查是否是 module.exports 的对象字面量
        const isModuleExports = node.isModuleExports || (parentNode && 
                              parentNode.type === 'AssignmentExpression' && 
                              parentNode.left.type === 'MemberExpression' && 
                              parentNode.left.object.type === 'Identifier' && 
                              parentNode.left.object.name === 'module' && 
                              parentNode.left.property.type === 'Identifier' && 
                              parentNode.left.property.name === 'exports');
        
        // 如果是 module.exports 的对象字面量，已经在上面处理过了，跳过
        if (!isModuleExports) {
          node.properties.forEach(prop => {
            // 处理对象属性（ObjectProperty）
            if (prop.type === 'ObjectProperty' && prop.value && (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')) {
              let funcName = prop.key ? (prop.key.name || prop.key.value) : 'anonymous';
              const funcInfo = {
                name: funcName,
                type: prop.value.type,
                start: prop.value.loc.start,
                end: prop.value.loc.end,
                parent: parentFunction
              };
              this.functions.push(funcInfo);
              // 将函数体加入栈
              if (prop.value.body) {
                if (prop.value.body.type === 'BlockStatement') {
                  stack.push({ node: prop.value.body, parentFunction: funcInfo, parentNode: prop.value });
                } else {
                  // 箭头函数的简洁体
                  stack.push({ node: prop.value.body, parentFunction: funcInfo, parentNode: prop.value });
                }
              }
            } 
            // 处理对象方法（ObjectMethod）
            else if (prop.type === 'ObjectMethod') {
              let funcName = prop.key ? (prop.key.name || prop.key.value) : 'anonymous';
              const funcInfo = {
                name: funcName,
                type: prop.type,
                start: prop.loc.start,
                end: prop.loc.end,
                parent: parentFunction
              };
              this.functions.push(funcInfo);
              // 将函数体加入栈
              if (prop.body) {
                if (prop.body.type === 'BlockStatement') {
                  stack.push({ node: prop.body, parentFunction: funcInfo, parentNode: prop });
                } else {
                  // 箭头函数的简洁体
                  stack.push({ node: prop.body, parentFunction: funcInfo, parentNode: prop });
                }
              }
            }
          });
        }
      }
      // 处理类声明和类表达式
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        // 获取类名
        let className = '';
        if (node.id) {
          className = node.id.name;
        } else if (parentNode && parentNode.type === 'VariableDeclarator') {
          // 处理类表达式：const MyClass = class { ... }
          className = parentNode.id.name;
        }
        
        // 遍历类的成员
        if (node.body && node.body.body) {
          node.body.body.forEach(member => {
            // 处理类方法（包括静态方法）
            if (member.type === 'MethodDefinition' || member.type === 'ClassMethod' || 
                (member.type === 'Property' && (member.value.type === 'FunctionExpression' || member.value.type === 'ArrowFunctionExpression'))) {
              let funcName = '';
              let funcType = '';
              let funcBody = null;
              let funcLoc = null;
              
              if (member.type === 'MethodDefinition' || member.type === 'ClassMethod') {
                // 传统类方法
                funcName = member.key.name;
                funcType = member.type === 'ClassMethod' ? 'ClassMethod' : 'MethodDefinition';
                funcBody = member.body;
                funcLoc = member.loc;
              } else if (member.type === 'Property') {
                // 类属性中的函数（可能是箭头函数）
                funcName = member.key.name;
                funcType = member.value.type;
                funcBody = member.value.body;
                funcLoc = member.value.loc;
              }
              
              if (funcName && funcLoc) {
                // 如果有类名，将类名添加到函数名中，避免函数名冲突
                const fullFuncName = className ? `${className}.${funcName}` : funcName;
                
                const funcInfo = {
                  name: fullFuncName,
                  type: funcType,
                  start: funcLoc.start,
                  end: funcLoc.end,
                  parent: parentFunction
                };
                this.functions.push(funcInfo);
                // 将函数体加入栈
                if (funcBody) {
                  if (funcBody.type === 'BlockStatement') {
                    stack.push({ node: funcBody, parentFunction: funcInfo, parentNode: member });
                  } else {
                    // 箭头函数的简洁体
                    stack.push({ node: funcBody, parentFunction: funcInfo, parentNode: member });
                  }
                }
              }
            }
          });
        }
        // 跳过后续的子节点遍历，因为类成员已经单独处理
        continue;
      }

      // 遍历子节点
      for (const key in node) {
        // 跳过不需要遍历的属性
        if (skipKeys.has(key)) {
          continue;
        }
        
        // 跳过原始类型属性
        if (typeof node[key] !== 'object' || node[key] === null) {
          continue;
        }
        
        // 确定子节点的 parentFunction
        let childParentFunction = parentFunction;
        
        // 跳过 module.exports 的对象字面量，避免重复处理
        if (node[key].type === 'ObjectExpression' && node[key].isModuleExports) {
          continue;
        }
        
        if (Array.isArray(node[key])) {
          // 处理数组类型的子节点
          node[key].forEach(item => {
            if (typeof item === 'object' && item !== null) {
              // 跳过 module.exports 的对象字面量，避免重复处理
              if (item.type === 'ObjectExpression' && item.isModuleExports) {
                return;
              }
              // 检查是否已经访问过，避免重复处理
              if (!visited.has(item)) {
                stack.push({ node: item, parentFunction: childParentFunction, parentNode: node });
              }
            }
          });
        } else {
          // 处理单个对象类型的子节点
          // 检查是否已经访问过，避免重复处理
          if (!visited.has(node[key])) {
            stack.push({ node: node[key], parentFunction: childParentFunction, parentNode: node });
          }
        }
      }
    }
  }

  // 获取成员表达式的名称（使用迭代方式避免栈溢出）
  getMemberExpressionName(node) {
    const parts = [];
    let current = node;
    
    while (current) {
      if (current.type === 'Identifier') {
        parts.unshift(current.name);
        break;
      } else if (current.type === 'MemberExpression') {
        if (current.property.type === 'Identifier') {
          parts.unshift(current.property.name);
        }
        current = current.object;
      } else {
        break;
      }
    }
    
    return parts.join('.');
  }

  // 构建调用关系
  buildCallGraph() {
    const callGraph = {
      nodes: [],
      links: []
    };

    // 添加节点
    this.functions.forEach(func => {
      callGraph.nodes.push({
        id: func.name + '_' + func.start.line + '_' + func.start.column,
        name: func.name,
        type: func.type,
        start: func.start,
        end: func.end
      });
    });

    // 添加边
    this.calls.forEach(call => {
      if (call.parent) {
        const callerId = call.parent.name + '_' + call.parent.start.line + '_' + call.parent.start.column;
        // 查找函数，先精确匹配，再尝试匹配 module_exports_ 前缀
        let calleeNode = this.functions.find(func => func.name === call.name);
        if (!calleeNode) {
          // 尝试匹配 module_exports_ 前缀
          calleeNode = this.functions.find(func => func.name === 'module_exports_' + call.name);
        }
        if (!calleeNode) {
          // 尝试匹配 exports_ 前缀
          calleeNode = this.functions.find(func => func.name === 'exports_' + call.name);
        }
        if (!calleeNode) {
          // 对于成员表达式调用，尝试匹配最后一部分作为函数名
          const parts = call.name.split('.');
          if (parts.length > 1) {
            const lastName = parts[parts.length - 1];
            calleeNode = this.functions.find(func => func.name === lastName);
            if (!calleeNode) {
              calleeNode = this.functions.find(func => func.name === 'module_exports_' + lastName);
            }
            if (!calleeNode) {
              calleeNode = this.functions.find(func => func.name === 'exports_' + lastName);
            }
          }
        }
        if (calleeNode) {
          const calleeId = calleeNode.name + '_' + calleeNode.start.line + '_' + calleeNode.start.column;
          callGraph.links.push({
            source: callerId,
            target: calleeId
          });
        } else {
          // 如果找不到对应的函数，为成员表达式调用添加一个新的节点
          if (call.name.includes('.')) {
            // 使用函数名作为节点ID，确保相同名称的函数只创建一个节点
            const calleeId = call.name;
            // 检查节点是否已经存在
            const existingNode = callGraph.nodes.find(node => node.id === calleeId);
            if (!existingNode) {
              callGraph.nodes.push({
                id: calleeId,
                name: call.name,
                type: 'ExternalFunction',
                start: call.start,
                end: call.end
              });
            }
            // 添加边
            callGraph.links.push({
              source: callerId,
              target: calleeId
            });
          } else {
            // 对于非成员表达式调用，也添加一个外部函数节点
            const calleeId = call.name;
            // 检查节点是否已经存在
            const existingNode = callGraph.nodes.find(node => node.id === calleeId);
            if (!existingNode) {
              callGraph.nodes.push({
                id: calleeId,
                name: call.name,
                type: 'ExternalFunction',
                start: call.start,
                end: call.end
              });
            }
            // 添加边
            callGraph.links.push({
              source: callerId,
              target: calleeId
            });
          }
        }
      }
    });

    return callGraph;
  }
}

module.exports = CodeParser;