const mongoose = require('mongoose');

const CompetitionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请提供比赛名称'],
    trim: true,
    maxlength: [100, '比赛名称不能超过100个字符']
  },
  description: {
    type: String,
    required: [true, '请提供比赛描述']
  },
  type: {
    type: String,
    required: [true, '请提供比赛类型'],
    default: '武术',
    trim: true
  },
  rules: {
    type: String,
    required: false
  },
  startDate: {
    type: Date,
    required: [true, '请提供开始日期']
  },
  endDate: {
    type: Date,
    required: [true, '请提供结束日期']
  },
  registrationDeadline: {
    type: Date,
    required: [true, '请提供报名截止日期']
  },
  location: {
    type: String,
    required: [true, '请提供比赛地点']
  },
  hosts: {
    type: [String],
    default: [],
    description: '主办单位'
  },
  organizers: {
    type: [String],
    default: [],
    description: '承办单位'
  },
  coOrganizers: {
    type: [String],
    default: [],
    description: '协办单位'
  },
  status: {
    type: String,
    enum: ['draft', 'registration', 'ongoing', 'completed', 'cancelled'],
    default: 'draft'
  },
  // 状态变更历史
  statusHistory: [{
    status: {
      type: String,
      enum: ['draft', 'registration', 'ongoing', 'completed', 'cancelled']
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    reason: String
  }],
  maxParticipants: {
    type: Number,
    default: 0 // 0表示不限制
  },
  participantType: {
    type: String,
    enum: ['individual', 'team', 'both'],
    default: 'individual'
  },
  // 新增字段：适用年级 - 改为年龄组别配置
  ageGroups: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    // 报名系统据此自动匹配年龄组别；留空时保留旧版按组别名称匹配的逻辑。
    birthDateStart: {
      type: Date
    },
    birthDateEnd: {
      type: Date
    }
  }],
  // 年龄组别详细配置 - 已废弃，保留用于兼容旧数据，建议使用 ageGroups
  ageGroupDetails: {
    type: Map,
    of: {
      name: String,
      ageRange: String,
      gradeRange: String
    },
    default: {} 
  },
  // 新增字段：性别限制
  genderRestriction: {
    type: String,
    enum: ['both', 'male', 'female'],
    default: 'both'
  },
  // 新增字段：比赛项目 - 武术专业项目配置
  events: [{
    name: {
      type: String,
      required: true
    },
    displayName: String,
    category: {
      type: String,
      required: false
    },
    subcategory: String, // 具体项目类型
    ageGroups: [{
      type: String,
      trim: true
    }],
    genderRestriction: {
      type: String,
      enum: ['both', 'male', 'female'],
      default: 'both'
    },
    isTraditional: {
      type: Boolean,
      default: false
    },
    // 部分项目需要报名人补充具体套路、器械或组合说明，不能只依赖通用备注。
    registrationDetail: {
      required: {
        type: Boolean,
        default: false
      },
      label: String,
      placeholder: String,
      maxLength: {
        type: Number,
        default: 100
      }
    },
    countInTeamScore: {
      type: Boolean,
      default: true // 传统项目设为false
    },
    maxParticipants: Number, // 单项最大参赛人数
    isGroupEvent: {
      type: Boolean,
      default: false
    },
    groupSize: Number, // 集体项目人数要求
    minGroupSize: Number,
    maxGroupSize: Number,
    maxEquipmentParticipants: Number,
    isCombinedEvent: {
      type: Boolean,
      default: false
    },
    subEvents: [{
      type: String, // 存储子项目的名称
      trim: true
    }],
    hasOnlinePreliminaries: {
      type: Boolean,
      default: false
    },
    preliminaryVideoRequired: {
      type: Boolean,
      default: false
    }
  }],
  // 新增字段：参赛要求 - 武术比赛专用
  participantRequirements: {
    requirePhoto: {
      type: Boolean,
      default: false
    },
    requireIdCard: {
      type: Boolean,
      default: true // 武术比赛通常需要身份验证
    },
    requirePhone: {
      type: Boolean,
      default: true
    },
    requireCoach: {
      type: Boolean,
      default: false
    },
    requireSchool: {
      type: Boolean,
      default: true // 学校单位报名
    },
    requireInsurance: {
      type: Boolean,
      default: true // 体育比赛需要保险
    },
    requireMedicalCertificate: {
      type: Boolean,
      default: false // 体检证明
    },
    requireParentConsent: {
      type: Boolean,
      default: true // 未成年人需要家长同意
    },
    requireRiskWaiver: {
      type: Boolean,
      default: true // 自愿参赛责任及风险告知书
    },
    requireStudentInfoDetails: {
      type: Boolean,
      default: true // 学籍基本信息
    }
  },
  // 报名限制规则
  registrationRules: {
    maxEventsPerParticipant: {
      type: Number,
      default: 3 // 每人最多报名项目数
    },
    allowTraditionalWeaponDuplicate: {
      type: Boolean,
      default: false // 传统器械项目是否允许重复报名
    },
    allowTraditionalFistDuplicate: {
      type: Boolean,
      default: false // 传统拳术项目是否允许重复报名
    },
    requireDistrictRegistration: {
      type: Boolean,
      default: false // 是否要求以区为单位报名
    },
    schoolBasedRegistration: {
      type: Boolean,
      default: true // 是否要求学校单位报名
    },
    schoolQuota: {
      type: Number,
      default: null // 学校报名配额限制
    },
    teamSizeLimits: {
      minSize: {
        type: Number,
        default: 3
      },
      maxSize: {
        type: Number,
        default: 8
      }
    }
  },
  // 评分规则配置
  awardRules: {
    enabled: { type: Boolean, default: false },
    // legacy_percentage: all completed competitors are divided into award levels by rank.
    // top3_then_percentage: ranks 1-3 are named places; the rest receive graded awards.
    mode: {
      type: String,
      enum: ['legacy_percentage', 'top3_then_percentage'],
      default: 'legacy_percentage'
    },
    rankAwardCount: { type: Number, default: 3 },
    minParticipantsForRanking: { type: Number, default: 3 },
    firstPrizePercent: { type: Number, default: 30 },
    secondPrizePercent: { type: Number, default: 60 },
    remainingPrizePercents: {
      first: { type: Number, default: 50 },
      second: { type: Number, default: 30 },
      third: { type: Number, default: 20 }
    },
    teamPoints: { type: [Number], default: [8, 7, 6, 5, 4, 3, 2, 1] },
    teamAwardPoints: {
      rank1: { type: Number, default: 6 },
      rank2: { type: Number, default: 5 },
      rank3: { type: Number, default: 4 },
      firstPrize: { type: Number, default: 3 },
      secondPrize: { type: Number, default: 2 },
      thirdPrize: { type: Number, default: 1 }
    },
    teamMinEventsPerParticipant: { type: Number, default: 2 },
    mergeGroupsBelow: { type: Number, default: 3 }
  },
  scoringRules: {
    traditionalExclusion: {
      type: Boolean,
      default: true // 传统项目不计入团体总分
    },
    teamScoring: {
      enabled: {
        type: Boolean,
        default: true
      },
      method: {
        type: String,
        enum: ['sum', 'average', 'best'],
        default: 'sum'
      },
      maxParticipants: Number // 最多几人成绩计入团体总分
    },
    individualScoring: {
      enabled: {
        type: Boolean,
        default: true
      },
      method: {
        type: String,
        enum: ['direct', 'weighted'],
        default: 'direct'
      },
      categoryWeights: mongoose.Schema.Types.Mixed
    },
    rankingPoints: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        1: 9,  // 第一名
        2: 7,  // 第二名
        3: 5,  // 第三名
        4: 3,  // 第四名
        5: 2,  // 第五名
        6: 1   // 第六名
      }
    },
    customRules: [{
      id: String,
      name: String,
      description: String,
      condition: String,
      action: String,
      enabled: {
        type: Boolean,
        default: true
      }
    }]
  },
  // 新增字段：报名费用
  registrationFee: {
    type: Number,
    default: 0,
    min: 0
  },
  // 新增字段：奖项设置
  awards: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    quantity: {
      type: Number,
      default: 1,
      min: 1
    }
  }],
  categories: [{
    name: String,
    description: String,
    ageMin: Number,
    ageMax: Number,
    gender: String
  }],
  organizer: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  coverImage: {
    type: String,
    default: 'default-competition.jpg'
  },
  registrationForm: {
    filename: String,
    originalName: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  tags: [String],
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
CompetitionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 虚拟字段：参赛者
CompetitionSchema.virtual('participants', {
  ref: 'Participant',
  localField: '_id',
  foreignField: 'competition',
  justOne: false
});

// 虚拟字段：赛程
CompetitionSchema.virtual('schedules', {
  ref: 'Schedule',
  localField: '_id',
  foreignField: 'competition',
  justOne: false
});

module.exports = mongoose.model('Competition', CompetitionSchema);
