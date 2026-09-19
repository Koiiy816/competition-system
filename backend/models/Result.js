const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  schedule: {
    type: mongoose.Schema.ObjectId,
    ref: 'Schedule',
    required: true
  },
  participant: {
    type: mongoose.Schema.ObjectId,
    ref: 'Participant',
    required: true
  },
  competition: {
    type: mongoose.Schema.ObjectId,
    ref: 'Competition',
    required: true
  },
  score: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  rank: {
    type: Number
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  submittedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'disputed'],
    default: 'pending'
  },
  notes: {
    type: String
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  verifiedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新updatedAt字段
ResultSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 支持成绩页的轻量版本检查：按比赛和状态快速定位最后一次成绩变动。
ResultSchema.index({ competition: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('Result', ResultSchema);
