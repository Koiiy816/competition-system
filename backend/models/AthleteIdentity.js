const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const schema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, default: () => `AT-${randomUUID()}` },
  competition: { type: mongoose.Schema.Types.ObjectId, ref: 'Competition', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schoolName: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  gender: { type: String, trim: true },
  birthDate: Date,
  idCard: { type: String, trim: true, select: false },
  identityKey: String,
  mergedInto: { type: String, index: true },
  mergedAt: Date,
  mergedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // 一次添加人员时生成；重试及该人的多个项目沿用同一键，不按姓名推断身份。
  requestKey: { type: String, required: true }
}, { timestamps: true });
schema.index({ competition: 1, user: 1, requestKey: 1 }, { unique: true });
// 同一赛事内，完整的姓名、生日、证件号唯一；单位和创建账号只是档案来源。
schema.index({ competition: 1, identityKey: 1 }, { unique: true, partialFilterExpression: { identityKey: { $type: 'string' } } });
module.exports = mongoose.model('AthleteIdentity', schema);
