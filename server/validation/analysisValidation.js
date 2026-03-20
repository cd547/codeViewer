const z = require('zod');

// 分析入口文件请求验证
const analyzeEntrySchema = z.object({
  entryFile: z.string().min(1, '缺少入口文件路径')
});

// 分析代码请求验证
const analyzeSchema = z.object({
  entryFile: z.string().min(1, '缺少入口文件路径'),
  entryFunction: z.string().min(1, '缺少入口函数名')
});

// 验证函数
const validateRequest = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    // 使用 zod 的错误处理方法
    res.status(400).json({ error: error.message || '请求参数验证失败' });
  }
};

module.exports = {
  analyzeEntrySchema,
  analyzeSchema,
  validateRequest
};
