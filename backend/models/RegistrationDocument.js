const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true }
}, { _id: false });

// 单位提交给某一场比赛的材料，不附属到单个运动员报名，避免同一文件重复保存。
const RegistrationDocumentSchema = new mongoose.Schema({
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  riskNotice: { type: fileSchema, required: false },
  insurance: { type: fileSchema, required: false },
  paperRegistrationForm: { type: fileSchema, required: false }
}, { timestamps: true });

RegistrationDocumentSchema.index({ competition: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('RegistrationDocument', RegistrationDocumentSchema);
