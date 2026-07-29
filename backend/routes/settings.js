const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const SystemSetting = require('../models/SystemSetting');

// @route   GET api/settings
// @desc    获取所有系统设置
// @access  公开
router.get('/', async (req, res, next) => {
  try {
    const settings = await SystemSetting.find();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

// @route   PUT api/settings/:key
// @desc    更新或创建系统设置
// @access  私有/管理员
router.put('/:key', protect, authorize(['admin']), async (req, res, next) => {
  try {
    const { value } = req.body;
    const setting = await SystemSetting.findOneAndUpdate(
      { key: req.params.key },
      { value },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
});

module.exports = router;