const mongoose = require('mongoose');

// 同一比赛、账号、单位的合并串行执行；保留完整关联快照供审计和故障续跑。
const schema = new mongoose.Schema({
  scope: { type: String, required: true },
  sourceNumber: { type: String, required: true },
  targetNumber: { type: String, required: true },
  operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  completedAt: Date
}, { timestamps: true });
schema.index({ scope: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
module.exports = mongoose.model('AthleteIdentityMerge', schema);
