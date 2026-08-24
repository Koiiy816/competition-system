const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
  competition: {
    type: mongoose.Schema.ObjectId,
    ref: 'Competition',
    required: true
  },
  name: {
    type: String,
    required: [true, '请提供赛程名称'],
    trim: true,
    maxlength: [100, '赛程名称不能超过100个字符']
  },
  description: {
    type: String
  },
  type: {
    type: String,
    enum: ['preliminary', 'quarterfinal', 'semifinal', 'final', 'other'],
    default: 'other'
  },
  startTime: {
    type: Date,
    required: [true, '请提供开始时间']
  },
  endTime: {
    type: Date,
    required: [true, '请提供结束时间']
  },
  location: {
    type: String,
    required: [true, '请提供地点']
  },
  scheduleDate: {
    type: String // 例如 "2026-06-05"
  },
  timeSlot: {
    type: String // "上午", "下午", "晚上"
  },
  exactTime: {
    type: String // "14:00-17:00" 等具体时间段
  },
  court: {
    type: String // "一号场地", "二号场地" 等
  },
  order: {
    type: Number,
    default: 0
  },
  participants: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Participant'
  }],
  referees: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  judgeCount: {
    type: Number,
    enum: [3, 4, 5],
    default: 5
  },
  scoringMode: {
    type: String,
    enum: ['standard', 'diving'],
    default: 'standard'
  },
  divingFormat: {
    type: String,
    enum: ['individual', 'synchronized'],
    default: 'individual'
  },
  divingProgram: [{
    actionCode: { type: String, trim: true },
    actionName: { type: String, required: true, trim: true },
    difficulty: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ['official', 'custom'], default: 'custom' },
    notes: { type: String, trim: true }
  }],
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed'],
    default: 'scheduled'
  },
  round: {
    type: Number,
    default: 1
  },
  group: {
    type: String
  },
  notes: {
    type: String
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

// 更新updatedAt字段
ScheduleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 虚拟字段：成绩
ScheduleSchema.virtual('results', {
  ref: 'Result',
  localField: '_id',
  foreignField: 'schedule',
  justOne: false
});

module.exports = mongoose.model('Schedule', ScheduleSchema);
