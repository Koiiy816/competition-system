const CompetitionTemplate = require('../models/CompetitionTemplate');
const Competition = require('../models/Competition');
const path = require('path');
const fs = require('fs');

/**
 * @desc    上传比赛报名表模板
 * @route   POST /api/competitions/:competitionId/templates
 * @access  Private (Admin/Organizer)
 */
exports.uploadTemplate = async (req, res, next) => {
  try {
    const { competitionId } = req.params;
    const { name, description } = req.body;

    // 检查比赛是否存在
    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: '比赛不存在'
      });
    }

    // 检查权限
    if (req.user.role !== 'admin' && 
        req.user.role !== 'organizer' && 
        competition.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限上传模板'
      });
    }

    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    // 创建模板记录
    const template = await CompetitionTemplate.create({
      competition: competitionId,
      name: name || req.file.originalname,
      description,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: template
    });

  } catch (error) {
    // 如果创建失败，删除已上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    获取比赛的所有模板
 * @route   GET /api/competitions/:competitionId/templates
 * @access  Public
 */
exports.getTemplates = async (req, res, next) => {
  try {
    const { competitionId } = req.params;

    const templates = await CompetitionTemplate.find({
      competition: competitionId,
      isActive: true
    })
    .populate('uploadedBy', 'name')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    下载模板文件
 * @route   GET /api/templates/:templateId/download
 * @access  Public
 */
exports.downloadTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;

    const template = await CompetitionTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }

    // 检查文件是否存在
    if (!fs.existsSync(template.filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 增加下载计数
    template.downloadCount += 1;
    await template.save();

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(template.fileName)}"`);
    res.setHeader('Content-Type', template.mimeType);

    // 发送文件
    res.sendFile(path.resolve(template.filePath));

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    删除模板
 * @route   DELETE /api/templates/:templateId
 * @access  Private (Admin/Organizer)
 */
exports.deleteTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;

    const template = await CompetitionTemplate.findById(templateId)
      .populate('competition');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }

    // 检查权限
    if (req.user.role !== 'admin' && 
        req.user.role !== 'organizer' && 
        template.competition.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除模板'
      });
    }

    // 删除文件
    if (fs.existsSync(template.filePath)) {
      fs.unlinkSync(template.filePath);
    }

    // 删除数据库记录
    await CompetitionTemplate.findByIdAndDelete(templateId);

    res.status(200).json({
      success: true,
      message: '模板删除成功'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};