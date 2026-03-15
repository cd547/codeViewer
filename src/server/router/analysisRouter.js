const express = require('express');
const { analyzeEntry, analyze, saveFiles } = require('../controllers/analysisController');
const { analyzeEntrySchema, analyzeSchema, validateRequest } = require('../validation/analysisValidation');

const router = express.Router();

// API 接口：保存文件到临时目录
router.post('/save-files', saveFiles);

// API 接口：分析入口文件，提取函数列表
router.post('/analyze-entry', validateRequest(analyzeEntrySchema), analyzeEntry);

// API 接口：分析代码
router.post('/analyze', validateRequest(analyzeSchema), analyze);

module.exports = router;
