const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadTemplate } = require('../middlewares/uploadMiddleware');
const {
  uploadTemplate: uploadTemplateController,
  getTemplates,
  downloadTemplate,
  deleteTemplate
} = require('../controllers/templateController');

// 上传模板 - 需要管理员权限
router.post('/', 
  protect, 
  authorize('admin'), 
  uploadTemplate,
  uploadTemplateController
);

// 获取比赛模板列表 - 公开访问
router.get('/', getTemplates);

// 下载模板 - 公开访问
router.get('/:templateId/download', downloadTemplate);

// 删除模板 - 需要管理员权限
router.delete('/:templateId', 
  protect, 
  authorize('admin'), 
  deleteTemplate
);

module.exports = router;