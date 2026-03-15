// 配置文件

// 分析配置
const analysisConfig = {
  // 调用图深度限制
  maxDepth: 20,
  // 节点数量限制
  maxNodes: 1000,
  // 边数量限制
  maxLinks: 2000,
  // 递归深度限制
  recursionDepthLimit: 1000,
  // 文件数量限制
  fileCountLimit: 3000,
  // 函数数量限制
  functionCountLimit: 100000,
  // 文件大小限制 (1MB)
  fileSizeLimit: 1000000
};

// 函数类型枚举
const functionTypes = {
  FUNCTION_DECLARATION: 'FunctionDeclaration',
  FUNCTION_EXPRESSION: 'FunctionExpression',
  CLASS_METHOD: 'ClassMethod',
  METHOD_DEFINITION: 'MethodDefinition',
  ARROW_FUNCTION_EXPRESSION: 'ArrowFunctionExpression',
  OBJECT_METHOD: 'ObjectMethod',
  EXTERNAL_FUNCTION: 'ExternalFunction'
};

// 导入类型枚举
const importTypes = {
  REQUIRE: 'require',
  IMPORT: 'import'
};

// 文件路径配置
const pathConfig = {
  // 临时目录相对路径
  tmpDir: '../../tmp'
};

// 服务器配置
const serverConfig = {
  // 端口号
  port: 3001,
  // 主机地址
  host: 'localhost'
};

module.exports = {
  analysisConfig,
  functionTypes,
  importTypes,
  pathConfig,
  serverConfig
};