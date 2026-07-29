const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../uploads');
const registrationFormsDir = path.join(uploadDir, 'registration-forms');
const templatesDir = path.join(uploadDir, 'templates');

// 创建目录
[uploadDir, registrationFormsDir, templatesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 配置存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 根据文件类型决定存储位置
    if (req.route.path.includes('template')) {
      cb(null, templatesDir);
    } else {
      cb(null, registrationFormsDir);
    }
  },
  filename: function (req, file, cb) {
    // 修复中文文件名乱码
    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      console.warn('Failed to decode originalname', e);
    }
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'text/plain' // 添加对文本文件的支持
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型。请上传 PDF、Word、Excel 文档、图片文件或文本文件。'), false);
  }
};

// 创建 multer 实例
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 限制
  },
  fileFilter: fileFilter
});

// 导出不同用途的上传中间件
module.exports = {
  // 上传报名表文件
  uploadRegistrationForm: upload.single('registrationForm'),
  
  // 上传模板文件
  uploadTemplate: upload.single('template'),
  
  // 多文件上传
  uploadMultiple: upload.array('files', 5),
  
  // 获取上传目录路径
  getUploadPaths: () => ({
    uploadDir,
    registrationFormsDir,
    templatesDir
  })
};