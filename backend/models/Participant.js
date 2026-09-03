const mongoose = require('mongoose');

const ParticipantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    // 虚拟队伍不需要关联用户
    required: function() { return !this.isVirtualTeam; }
  },
  competition: {
    type: mongoose.Schema.ObjectId,
    ref: 'Competition',
    required: true
  },
  // 参赛者姓名
  name: {
    type: String,
    required: [true, '请填写姓名'],
    trim: true,
    maxlength: [10000, '姓名不能超过10000个字符'] // 放宽限制以容纳集体项目拼接的长名字
  },
  // 学校名称（小学为主）
  schoolName: {
    type: String,
    trim: true,
    maxlength: [100, '学校名称不能超过100个字符']
  },
  // 年级（如 一年级、二年级 或 1-6）
  grade: {
    type: String,
    trim: true,
    maxlength: [20, '年级字段不能超过20个字符']
  },
  // 年龄组别（如 U16组, U13组等）
  ageGroup: {
    type: String,
    trim: true,
    maxlength: [20, '年龄组别字段不能超过20个字符']
  },
  // 比赛项目（如 武术套路、长拳 等）
  event: {
    type: String,
    trim: true,
    maxlength: [100, '比赛项目不能超过100个字符']
  },
  // 管理员依据报名资料人工指定的赛程分组名称；不读取备注自动生成。
  manualEventGroup: {
    type: String,
    trim: true,
    maxlength: [150, '人工项目分组不能超过150个字符']
  },
  // 是否为测试人员（不计入排名和团体分）
  isTest: {
    type: Boolean,
    default: false
  },
  // 性别
  gender: {
    type: String,
    // 移除了 enum: ['male', 'female'] 的严格限制，以兼容 'mixed' 或其他虚拟值
    required: true
  },
  // 身份证号码
  idCard: {
    type: String,
    trim: true
  },
  // 联系电话 (旧字段，保留为了向后兼容，但不再必填)
  phone: {
    type: String,
    trim: true,
  },
  // 出生日期
  birthDate: {
    type: Date,
  },
  // 领队
  teamLeader: {
    type: String,
    trim: true,
    maxlength: [50, '领队姓名不能超过50个字符']
  },
  // 领队联系电话
  leaderPhone: {
    type: String,
    trim: true,
  },
  // 指导教练
  coach: {
    type: String,
    trim: true,
    maxlength: [50, '指导教练姓名不能超过50个字符']
  },
  // 教练联系电话
  coachPhone: {
    type: String,
    trim: true,
  },
  // 管理员备注
  remark: {
    type: String,
    trim: true,
    maxlength: [1000, '备注不能超过1000个字符']
  },
  // 保险确认
  insuranceConfirmed: {
    type: Boolean,
    // 虚拟队伍不需要保险确认
    required: function() { return !this.isVirtualTeam; },
    validate: {
      validator: function(v) {
        if (this.isVirtualTeam) return true;
        return v === true;
      },
      message: '参赛必须办理保险'
    }
  },
  type: {
    type: String,
    enum: ['individual', 'team'],
    required: true
  },
  teamName: {
    type: String,
    trim: true,
    maxlength: [50, '团队名称不能超过50个字符']
  },
  members: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    role: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  category: {
    type: String,
    required: false
  },
  
  // 新增：用于集体赛程排版生成的虚拟队伍标记
  isVirtualTeam: {
    type: Boolean,
    default: false
  },
  
  // 新增：存储该虚拟队伍所包含的真实队员ID
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Participant'
  }],

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  registrationNumber: {
    type: String,
    unique: true
  },
  isCheckedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date
  },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // 报名表文件（PDF或图片）的存储文件名
  registrationFormFile: {
    type: String
  },
  photoFile: {
    type: String
  },
  additionalInfo: {
    type: mongoose.Schema.Types.Mixed
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
ParticipantSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 生成唯一的参赛编号
ParticipantSchema.pre('save', async function(next) {
  try {
    if (!this.registrationNumber) {
      // 批量导入可能在短时间内创建大量记录；先查询并重试，避免随机编号撞库导致单条报名失败。
      const year = new Date().getFullYear();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        const candidate = `CP-${year}-${randomNum}`;
        const exists = await this.constructor.exists({ registrationNumber: candidate });
        if (!exists) {
          this.registrationNumber = candidate;
          return next();
        }
      }
      return next(new Error('无法生成未占用的参赛编号，请重试'));
    }
    return next();
  } catch (error) {
    return next(error);
  }
});
// 虚拟字段：成绩
ParticipantSchema.virtual('results', {
  ref: 'Result',
  localField: '_id',
  foreignField: 'participant',
  justOne: false
});

module.exports = mongoose.model('Participant', ParticipantSchema);
