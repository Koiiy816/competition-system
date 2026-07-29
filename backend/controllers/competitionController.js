const Competition = require('../models/Competition');
const path = require('path');
const fs = require('fs');

/**
 * @desc    获取所有比赛
 * @route   GET /api/competitions
 * @access  Public
 */
exports.getCompetitions = async (req, res, next) => {
  try {
    // 构建查询条件
    let query = {};

    // 过滤
    if (req.query.status) {
      if (Array.isArray(req.query.status)) {
        query.status = { $in: req.query.status };
      } else {
        query.status = req.query.status;
      }
    }
    
    if (req.query.exclude_status) {
      // 只有非管理员才应用 exclude_status 过滤（管理员可以看所有比赛，包括已结束的）
      if (!req.user || req.user.role !== 'admin') {
        if (query.status) {
          // 如果已经有 status 过滤，确保 exclude_status 不在其中
          if (query.status.$in) {
            query.status.$in = query.status.$in.filter(s => s !== req.query.exclude_status);
          } else if (query.status === req.query.exclude_status) {
            // 这是一种矛盾情况，将查询条件设为绝对不成立
            query.status = "invalid_status_to_force_empty"; 
          } else if (typeof query.status === 'string') {
            // 如果 query.status 已经是一个具体的字符串且不等于 exclude_status，
            // 我们不需要做任何事情，因为它本身就已经排除了 exclude_status
          }
        } else {
          query.status = { $ne: req.query.exclude_status };
        }
      }
    }

    if (req.query.type) {
      query.type = req.query.type;
    }

    if (req.query.organizer) {
      query.organizer = req.query.organizer;
    }

    // 搜索
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // 日期过滤
    if (req.query.startDate) {
      query.startDate = { $gte: new Date(req.query.startDate) };
    }

    if (req.query.endDate) {
      query.endDate = { $lte: new Date(req.query.endDate) };
    }

    // 分页
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Competition.countDocuments(query);

    // 执行查询
    const competitions = await Competition.find(query)
      .populate('organizer', 'name email')
      .skip(startIndex)
      .limit(limit)
      .sort({ createdAt: -1 });

    // 分页结果
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: competitions.length,
      pagination,
      total,
      data: competitions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取单个比赛
 * @route   GET /api/competitions/:id
 * @access  Public
 */
exports.getCompetition = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.id)
      .populate('organizer', 'name email')
      .populate({
        path: 'participants',
        select: 'user type teamName status registrationDate',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'schedules',
        select: 'name startTime endTime location status'
      });

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的比赛`
      });
    }

    res.status(200).json({
      success: true,
      data: competition
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    创建比赛
 * @route   POST /api/competitions
 * @access  Private/Admin/Organizer
 */
exports.createCompetition = async (req, res, next) => {
  try {
    const competitionData = { ...req.body };

    // 尝试解析可能为JSON字符串的字段 (处理FormData上传时的复杂数据)
    const jsonFields = ['hosts', 'organizers', 'coOrganizers', 'ageGroups', 'events', 'participantRequirements', 'registrationRules', 'scoringRules', 'awards', 'categories', 'tags'];
    
    jsonFields.forEach(field => {
      if (competitionData[field] && typeof competitionData[field] === 'string') {
        try {
          competitionData[field] = JSON.parse(competitionData[field]);
        } catch (e) {
          console.warn(`Failed to parse ${field} as JSON`, e);
          // 如果解析失败，保留原值，由Mongoose验证处理
        }
      }
    });

    // 清理前端可能错误添加了双引号的日期字段
    const dateFields = ['startDate', 'endDate', 'registrationDeadline'];
    dateFields.forEach(field => {
      if (competitionData[field] && typeof competitionData[field] === 'string') {
        // 如果字符串是被 JSON.stringify 处理过的带有首尾双引号的日期字符串，则去掉首尾的双引号
        if (competitionData[field].startsWith('"') && competitionData[field].endsWith('"')) {
          competitionData[field] = competitionData[field].slice(1, -1);
        }
      }
    });

    // 将 'true'/'false' 字符串转换为布尔值 (仅针对非JSON解析后的顶层字段)
    const toBoolean = (value) => value === 'true';

    // 解析 participantRequirements
    const hasFlattenedRequirements = Object.keys(competitionData).some(key => key.startsWith('participantRequirements['));
    if (hasFlattenedRequirements) {
      const requirements = {};
      for (const key in competitionData) {
        if (key.startsWith('participantRequirements[')) {
          const newKey = key.match(/\[(.*?)\]/)[1];
          requirements[newKey] = toBoolean(competitionData[key]);
          delete competitionData[key];
        }
      }
      competitionData.participantRequirements = requirements;
    }

    // 解析 registrationRules
    const hasFlattenedRules = Object.keys(competitionData).some(key => key.startsWith('registrationRules['));
    if (hasFlattenedRules) {
        const rules = {};
        for (const key in competitionData) {
            if (key.startsWith('registrationRules[')) {
                const newKey = key.match(/\[(.*?)\]/)[1];
                // 根据字段类型转换
                if ([ 'maxEventsPerParticipant', 'minTeamSize', 'maxTeamSize'].includes(newKey)) {
                    rules[newKey] = parseInt(competitionData[key], 10);
                } else {
                    rules[newKey] = toBoolean(competitionData[key]);
                }
                delete competitionData[key];
            }
        }
        competitionData.registrationRules = rules;
    }

    // 添加组织者ID
    competitionData.organizer = req.user.id;

    // 如果有上传的报名表文件，添加文件信息
    if (req.file) {
      competitionData.registrationForm = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path
      };
    }

    const competition = await Competition.create(competitionData);

    res.status(201).json({
      success: true,
      data: competition
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    更新比赛
 * @route   PUT /api/competitions/:id
 * @access  Private/Admin/Organizer
 */
exports.updateCompetition = async (req, res, next) => {
  try {
    let competition = await Competition.findById(req.params.id);

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的比赛`
      });
    }

    // 检查用户是否是比赛的组织者或管理员
    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新此比赛'
      });
    }

    const competitionData = { ...req.body };

    // 尝试解析可能为JSON字符串的字段 (处理FormData上传时的复杂数据)
    const jsonFields = ['hosts', 'organizers', 'coOrganizers', 'ageGroups', 'events', 'participantRequirements', 'registrationRules', 'scoringRules', 'awards', 'categories', 'tags', 'combinedEvents'];
    
    jsonFields.forEach(field => {
      if (competitionData[field] && typeof competitionData[field] === 'string') {
        try {
          competitionData[field] = JSON.parse(competitionData[field]);
        } catch (e) {
          console.warn(`Failed to parse ${field} as JSON`, e);
        }
      }
    });

    // 清理前端可能错误添加了双引号的日期字段
    const dateFields = ['startDate', 'endDate', 'registrationDeadline'];
    dateFields.forEach(field => {
      if (competitionData[field] && typeof competitionData[field] === 'string') {
        // 如果字符串是被 JSON.stringify 处理过的带有首尾双引号的日期字符串，则去掉首尾的双引号
        if (competitionData[field].startsWith('"') && competitionData[field].endsWith('"')) {
          competitionData[field] = competitionData[field].slice(1, -1);
        }
      }
    });

    // 如果前端传来的是嵌套对象的打平结构（如 registrationRules.teamSizeLimits.minSize），
    // mongoose.findByIdAndUpdate 会直接处理嵌套的点号路径（Dot Notation），
    // 只要它是合法的 JS 对象。由于前面已经对字符串做了 JSON.parse，对象结构应该得以保留。

    // 如果有上传的报名表文件，添加文件信息
    if (req.file) {
      competitionData.registrationForm = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path
      };
    }

    competition = await Competition.findByIdAndUpdate(req.params.id, competitionData, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: competition
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    删除比赛
 * @route   DELETE /api/competitions/:id
 * @access  Private/Admin/Organizer
 */
exports.deleteCompetition = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.id);

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的比赛`
      });
    }

    // 检查用户是否是比赛的组织者或管理员
    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除此比赛'
      });
    }

    // 检查是否有参赛者
    const Participant = require('../models/Participant');
    const participantCount = await Participant.countDocuments({ competition: req.params.id });
    if (participantCount > 0) {
      return res.status(400).json({
        success: false,
        message: '无法删除已有参赛者的比赛，请先删除所有参赛者或取消比赛状态'
      });
    }

    // 修复 Mongoose 移除方法的弃用问题
    await Competition.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    上传比赛封面图片
 * @route   PUT /api/competitions/:id/image
 * @access  Private/Admin/Organizer
 */
exports.uploadCompetitionImage = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.id);

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的比赛`
      });
    }

    // 检查用户是否是比赛的组织者或管理员
    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新此比赛'
      });
    }

    // 检查是否上传了文件
    if (!req.files || !req.files.image) {
      return res.status(400).json({
        success: false,
        message: '请上传图片'
      });
    }

    const file = req.files.image;

    // 检查文件是否为图片
    if (!file.mimetype.startsWith('image')) {
      return res.status(400).json({
        success: false,
        message: '请上传图片文件'
      });
    }

    // 检查文件大小
    if (file.size > process.env.MAX_FILE_UPLOAD) {
      return res.status(400).json({
        success: false,
        message: `请上传小于${process.env.MAX_FILE_UPLOAD}的图片`
      });
    }

    // 创建自定义文件名
    file.name = `competition_${competition._id}${path.parse(file.name).ext}`;

    // 移动文件
    file.mv(`${process.env.FILE_UPLOAD_PATH}/competitions/${file.name}`, async (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: '文件上传失败'
        });
      }

      // 更新数据库中的封面图片字段
      await Competition.findByIdAndUpdate(req.params.id, { coverImage: file.name });

      res.status(200).json({
        success: true,
        data: file.name
      });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取当前用户参加的比赛
 * @route   GET /api/competitions/my-competitions
 * @access  Private
 */
exports.getUserCompetitions = async (req, res, next) => {
  try {
    // 首先查找用户参与的所有参赛记录
    const Participant = require('../models/Participant');
    const participants = await Participant.find({ user: req.user.id }).populate('competition');

    // 提取比赛信息并添加用户在比赛中的角色信息
    let competitions = participants.map(participant => {
      if (!participant.competition) return null;
      return {
        ...participant.competition.toObject(),
        roleInCompetition: participant.type === 'team' ? '团队成员' : '个人参赛者',
        participantStatus: participant.status,
        registrationDate: participant.registrationDate
      };
    }).filter(c => c !== null);
    
    // 如果不是管理员，则隐藏已结束的比赛
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      competitions = competitions.filter(c => c.status !== 'completed');
    }

    res.status(200).json({
      success: true,
      count: competitions.length,
      data: competitions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取比赛状态列表
 * @route   GET /api/competitions/statuses
 * @access  Public
 */
exports.getCompetitionStatuses = async (req, res, next) => {
  try {
    const statuses = [
      { value: 'draft', label: '草稿' },
      { value: 'registration', label: '报名中' },
      { value: 'ongoing', label: '进行中' },
      { value: 'completed', label: '已结束' },
      { value: 'cancelled', label: '已取消' }
    ];

    res.status(200).json({
      success: true,
      data: statuses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取比赛状态列表失败'
    });
  }
};

/**
 * @desc    更新比赛状态
 * @route   PUT /api/competitions/:id/status
 * @access  Private (Organizer only)
 */
exports.updateCompetitionStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    
    // 验证状态值
    const validStatuses = ['draft', 'registration', 'registration_closed', 'ongoing', 'paused', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的比赛状态'
      });
    }

    const competition = await Competition.findById(req.params.id);
    
    if (!competition) {
      return res.status(404).json({
        success: false,
        error: '比赛不存在'
      });
    }

    // 检查权限 - 只有组织者可以更新状态
    if (competition.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '无权限更新比赛状态'
      });
    }

    // 验证状态转换的合法性
    const currentStatus = competition.status;
    const validTransitions = {
      'draft': ['registration', 'cancelled'],
      'registration': ['registration_closed', 'ongoing', 'cancelled'],
      'registration_closed': ['ongoing', 'cancelled'],
      'ongoing': ['paused', 'completed', 'cancelled'],
      'paused': ['ongoing', 'cancelled'],
      'completed': [], // 已完成的比赛不能再变更状态
      'cancelled': [] // 已取消的比赛不能再变更状态
    };

    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        error: `不能从 ${currentStatus} 状态变更为 ${status} 状态`
      });
    }

    // 更新状态和状态历史
    competition.status = status;
    competition.statusHistory.push({
      status: status,
      changedAt: new Date(),
      changedBy: req.user.id,
      reason: reason || ''
    });

    await competition.save();

    res.status(200).json({
      success: true,
      data: competition
    });

  } catch (error) {
    console.error('Update competition status error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
};

/**
 * @desc    更新比赛评分规则
 * @route   PUT /api/competitions/:id/scoring-rules
 * @access  Private (Organizer only)
 */
exports.updateScoringRules = async (req, res, next) => {
  try {
    const { scoringRules } = req.body;
    
    const competition = await Competition.findById(req.params.id);
    
    if (!competition) {
      return res.status(404).json({
        success: false,
        error: '比赛不存在'
      });
    }

    // 检查权限
    if (competition.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '无权限更新评分规则'
      });
    }

    // 更新评分规则
    competition.scoringRules = {
      ...competition.scoringRules,
      ...scoringRules
    };

    await competition.save();

    res.status(200).json({
      success: true,
      data: competition
    });

  } catch (error) {
    console.error('Update scoring rules error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
};

/**
 * @desc    更新比赛报名规则
 * @route   PUT /api/competitions/:id/registration-rules
 * @access  Private (Organizer only)
 */
exports.updateRegistrationRules = async (req, res, next) => {
  try {
    const { registrationRules } = req.body;
    
    const competition = await Competition.findById(req.params.id);
    
    if (!competition) {
      return res.status(404).json({
        success: false,
        error: '比赛不存在'
      });
    }

    // 检查权限
    if (competition.organizer.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '无权限更新报名规则'
      });
    }

    // 更新报名规则
    competition.registrationRules = {
      ...competition.registrationRules,
      ...registrationRules
    };

    await competition.save();

    res.status(200).json({
      success: true,
      data: competition
    });

  } catch (error) {
    console.error('Update registration rules error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
};

/**
 * @desc    报名参加比赛
 * @route   POST /api/competitions/:id/register
 * @access  Private
 */
exports.registerCompetition = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.id);
    
    if (!competition) {
      return res.status(404).json({
        success: false,
        error: '比赛不存在'
      });
    }

    // 检查比赛状态
    if (competition.status !== 'registration') {
      return res.status(400).json({
        success: false,
        error: '比赛当前不在报名阶段'
      });
    }

    // 检查报名截止日期
    if (new Date() > new Date(competition.registrationDeadline)) {
      return res.status(400).json({
        success: false,
        error: '报名已截止'
      });
    }

    // 检查参赛人数限制
    if (competition.maxParticipants && competition.participants.length >= competition.maxParticipants) {
      return res.status(400).json({
        success: false,
        error: '参赛人数已满'
      });
    }

    // 检查用户是否已经报名
    const existingParticipant = competition.participants.find(
      p => p.user.toString() === req.user.id
    );

    if (existingParticipant) {
      return res.status(400).json({
        success: false,
        error: '您已经报名了这个比赛'
      });
    }

    // 添加参赛者
    competition.participants.push({
      user: req.user.id,
      registrationDate: new Date(),
      status: 'pending'
    });

    await competition.save();

    res.status(200).json({
      success: true,
      data: competition
    });
  } catch (error) {
    console.error('Register competition error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
};

/**
 * @desc    下载比赛报名表文件
 * @route   GET /api/competitions/:id/registration-form
 * @access  Public
 */
exports.downloadRegistrationForm = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.id);
    
    if (!competition) {
      return res.status(404).json({
        success: false,
        error: '比赛不存在'
      });
    }

    if (!competition.registrationForm) {
      return res.status(404).json({
        success: false,
        error: '该比赛没有提供报名表文件'
      });
    }

    const filename = competition.registrationForm.filename || (typeof competition.registrationForm === 'string' ? competition.registrationForm : null);
    
    if (!filename) {
      return res.status(404).json({
        success: false,
        error: '报名表文件名无效'
      });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'registration-forms', filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '报名表文件不存在'
      });
    }

    // 获取文件信息
    const stat = fs.statSync(filePath);
    const fileExtension = path.extname(filename).toLowerCase();
    
    // 设置响应头
    res.setHeader('Content-Length', stat.size);
    const downloadName = encodeURIComponent(`${competition.name}_报名表${fileExtension}`);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"; filename*=UTF-8''${downloadName}`);
    
    // 根据文件类型设置Content-Type
    switch (fileExtension) {
      case '.pdf':
        res.setHeader('Content-Type', 'application/pdf');
        break;
      case '.doc':
        res.setHeader('Content-Type', 'application/msword');
        break;
      case '.docx':
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        break;
      case '.txt':
        res.setHeader('Content-Type', 'text/plain');
        break;
      default:
        res.setHeader('Content-Type', 'application/octet-stream');
    }

    // 创建文件流并发送
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: '文件下载失败'
        });
      }
    });

  } catch (error) {
    console.error('Download registration form error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误'
    });
  }
};