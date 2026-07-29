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

module.exports = mongoose.model('Result', ResultSchema);