const mongoose = require('mongoose');

const CompetitionTemplateSchema = new mongoose.Schema({
  competition: {
    type: mongoose.Schema.ObjectId,
    ref: 'Competition',
    required: true
  },
  name: {
    type: String,
    required: [true, '模板名称不能为空'],
    trim: true,
    maxlength: [100, '模板名称不能超过100个字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, '模板描述不能超过500个字符']
  },
  fileName: {
    type: String,
    required: [true, '文件名不能为空']
  },
  filePath: {
    type: String,
    required: [true, '文件路径不能为空']
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 更新时间中间件
CompetitionTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 虚拟字段：文件URL
CompetitionTemplateSchema.virtual('fileUrl').get(function() {
  return `/api/templates/${this._id}/download`;
});

module.exports = mongoose.model('CompetitionTemplate', CompetitionTemplateSchema);