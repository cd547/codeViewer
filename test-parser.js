const CodeParser = require('./src/server/lib/parser/codeParser');
const fs = require('fs');

// 读取测试文件
const code = fs.readFileSync('./test-async-method.js', 'utf8');

// 创建解析器实例
const parser = new CodeParser();

// 解析代码
const result = parser.parse(code);

// 输出结果
console.log('解析结果:');
console.log('函数数量:', result.functions.length);
console.log('函数列表:', JSON.stringify(result.functions, null, 2));
