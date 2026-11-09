const Participant = require('../models/Participant');
const { resolveAthleteNumber } = require('../utils/athleteIdentity');
const { validateTrampolineRegistration } = require('../utils/trampolineRegistration');
const { normalizeTrampolinePlan, isLargeTrampolineEvent } = require('../utils/trampolinePlan');
const Competition = require('../models/Competition');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { broadcastScoreEvent } = require('../utils/scoreUpdateStream');
const { getCompetitionSportType, SPORT_TYPES, canUserAccessCompetitionType } = require('../utils/competitionType');

// 本赛事的导入资料存在不同选手共用身份证号码的情况，不能用身份证或照片推断选手身份。
// 人数统计按报名册中的姓名、单位、性别归并；若三项均缺失则保留为独立记录。
const participantRosterKey = (participant) => {
  if (participant.athleteNumber) return `athlete:${participant.athleteNumber}`;
  const normalize = (value) => String(value || '').trim().replace(/\s+/g, '').toLowerCase();
  const fields = [normalize(participant.name || participant.teamName), normalize(participant.schoolName || participant.teamName), normalize(participant.gender)];
  if (fields.some(Boolean)) return `roster:${fields.join('|')}`;
  return `record:${participant._id}`;
};

const normalizeRuleValue = (value) => String(typeof value === 'object' ? value?.name : value || '').trim();
const isSynchronizedDivingEventName = (value) => /双人|雙人/.test(String(value || ''));
const dateOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

// 报名页面的筛选只是辅助；这里才是所有报名入口都必须遵守的最终规则。
const validateRegistrationAgainstCompetition = ({ competition, body }) => {
  if (competition.registrationDeadline && new Date() > new Date(competition.registrationDeadline)) return '报名已截止，只有管理员或主裁判可以代为修改报名资料';
  if (getCompetitionSportType(competition) === SPORT_TYPES.TRAMPOLINE) return validateTrampolineRegistration(competition, body);
  const birthDate = dateOnly(body.birthDate);
  const configuredAgeGroups = (competition.ageGroups || []).filter((group) => group.birthDateStart || group.birthDateEnd);
  if (configuredAgeGroups.length) {
    if (!birthDate) return '本赛事已按出生日期设置年龄组别，请填写出生日期';
    const matchedGroup = configuredAgeGroups.find((group) => {
      const start = dateOnly(group.birthDateStart);
      const end = dateOnly(group.birthDateEnd);
      return (!start || birthDate >= start) && (!end || birthDate <= end);
    });
    if (!matchedGroup) return '出生日期不属于本赛事已设置的任何年龄组别';
    const submittedGroup = normalizeRuleValue(body.ageGroup || body.grade);
    if (submittedGroup !== normalizeRuleValue(matchedGroup.name)) return `出生日期应报名“${matchedGroup.name}”，不能选择“${submittedGroup || '未填写'}”`;
  }
  if (!Array.isArray(competition.events) || !competition.events.length) return null;
  const event = competition.events.find((item) => normalizeRuleValue(item.name) === normalizeRuleValue(body.event));
  if (!event) return '所选比赛项目不属于本次比赛，请重新选择';
  const submittedGroup = normalizeRuleValue(body.ageGroup || body.grade);
  const allowedGroups = (event.ageGroups || []).map(normalizeRuleValue).filter(Boolean);
  if (allowedGroups.length && !allowedGroups.includes(submittedGroup)) return `项目“${event.displayName || event.name}”不接受“${submittedGroup || '未填写'}”报名`;
  if (event.genderRestriction && event.genderRestriction !== 'both' && event.genderRestriction !== body.gender) return `项目“${event.displayName || event.name}”不接受当前性别报名`;
  return null;
};

const validateWushuEventLimits = async (competition, body, excludeId) => {
  if (!competition.name?.includes('罗湖区') || !competition.name.includes('传统武术')) return null;
  const participantName = body.name;

  // 查找该选手已报名的项目 (仅按姓名识别，因为身份证非必填)
  const query = { competition: competition._id, status: { $ne: 'rejected' }, ...(body.athleteNumber ? { athleteNumber: body.athleteNumber } : { name: participantName }) };

  if (excludeId) query._id = { $ne: excludeId };
  const existingRegistrations = await Participant.find(query);
  const existingEvents = existingRegistrations.map(r => r.event);

  // 加上当前要报名的项目
  const allEvents = [...existingEvents, body.event];

  // 项目分类定义
  const fistEvents = ['三路长拳', '少年规定拳', '初级南拳', '传统拳术', '第三套国际规定长拳', '五步拳', '自选长拳', '第三套国际规定南拳', '自选南拳', '第一套国际规定南拳', '自选太极拳', '42式太极拳', '四十二式太极拳'];
  const shortEvents = ['初级刀术', '初级剑术', '42式太极剑', '四十二式太极剑', '自选太极剑', '第三套国际规定剑术', '自选剑术', '第三套国际规定刀术', '自选刀术', '第三套国际规定南刀', '自选南刀'];
  const longEvents = ['初级棍术', '初级枪术', '第三套国际规定枪术', '自选枪术', '第三套国际规定棍术', '自选棍术', '第三套国际规定南棍', '自选南棍'];
  const traditionalEvents = ['传统器械'];
  // 集体项目不计入 3 项个人项目限制
  const groupEvents = ['幼儿集体拳', '集体武术操'];

  let fistCount = 0;
  let shortCount = 0;
  let longCount = 0;
  let tradCount = 0;
  let individualEventCount = 0;

  allEvents.forEach(e => {
    if (!e) return;

    // 如果是集体项目，直接跳过统计
    if (groupEvents.includes(e) || e.includes('集体') || e.includes('操')) {
      return;
    }

    // 只有非集体项目才计入个人总数
    individualEventCount++;

    if (fistEvents.includes(e)) fistCount++;
    else if (shortEvents.includes(e)) shortCount++;
    else if (longEvents.includes(e)) longCount++;
    else if (traditionalEvents.includes(e)) tradCount++;
    // 对于未能完全匹配名称的，根据字眼做后备判断
    else if (e.includes('拳')) fistCount++;
    else if (e.includes('刀') || e.includes('剑')) shortCount++;
    else if (e.includes('棍') || e.includes('枪')) longCount++;
  });

  if (individualEventCount > 3) {
    return `报名失败：每个人最多只能报名3个个人比赛项目（集体项目不计入）。当前已选或已报个人项目总数超出限制。`;
  }

  if (fistCount > 1) {
    return `报名失败：拳术大项只能报名1个。当前已选或已报拳术：${fistCount}个`;
  }

  if (shortCount > 1) {
    return `报名失败：短器械大项只能报名1个。当前已选或已报短器械：${shortCount}个`;
  }

  if (longCount > 1) {
    return `报名失败：长器械大项只能报名1个。当前已选或已报长器械：${longCount}个`;
  }

  if (tradCount > 1) {
    return `报名失败：传统器械只能报名1个。当前已选或已报传统器械：${tradCount}个`;
  }

  // 核心逻辑：传统器械占短器械或长器械的一个名额
  // 也就是 短器械 + 长器械 + 传统器械 的总数不能超过2
  if ((shortCount + longCount + tradCount) > 2) {
    return `报名失败：如果报名了“传统器械”，则会占用一个器械名额（长器械或短器械不能再同时报名）。您当前的选择超出了器械类总名额。`;
  }
  return null;
};

const validateDivingPairPayload = (body) => {
  const pair = body.additionalInfo?.divingPair;
  const synchronized = isSynchronizedDivingEventName(body.event);
  if (!synchronized && pair) return '只有双人跳水项目可以提交双人配对资料';
  if (!synchronized) return null;
  if (!pair || !String(pair.pairId || '').trim() || !String(pair.pairKey || '').trim() || !String(pair.partnerName || '').trim()) return '双人跳水必须先完成配对后才能报名';
  const mixed = /混合|混雙/.test(String(body.event || ''));
  if ((mixed && pair.type !== 'mixed') || (!mixed && pair.type !== 'same-gender')) return '双人跳水配对类型与报名项目不一致';
  if (String(pair.event || '').trim() !== String(body.event || '').trim() || String(pair.ageGroup || '').trim() !== String(body.ageGroup || body.grade || '').trim()) return '双人跳水配对资料与当前项目或年龄组不一致';
  return null;
};
/**
 * @desc    获取所有参赛者
 * @route   GET /api/competitions/:competitionId/participants
 * @access  Public
 */
exports.getParticipants = async (req, res, next) => {
  try {
    const ownSchoolRegistrations = req.query.groupBy === 'school' && req.user?.roles?.includes('organization')
      && !req.user.roles.some(role => ['admin', 'chief_referee', 'referee', 'checkin_clerk'].includes(role));
    const exportSchoolRegistrations = req.query.groupBy === 'school' && req.query.exportPdf === 'true';
    // 独立的只读汇总分支。每次请求读取开关，关闭后完整沿用原列表逻辑。
    if (req.query.groupBy === 'school' && req.params.competitionId) {
      const setting = await require('../models/SystemSetting').findOne({ key: 'wushu_fee_summary_enabled' });
      if (setting?.value === true) {
        const competition = await Competition.findById(req.params.competitionId);
        if (getCompetitionSportType(competition) === SPORT_TYPES.WUSHU) {
          const query = { competition: req.params.competitionId, isVirtualTeam: { $ne: true } };
          const groupEventNames = new Set((competition.events || [])
            .filter((event) => event.isGroupEvent)
            .map((event) => event.name));
          const rows = (await Participant.find(query)
            .populate('user', 'name email')
            .populate('competition', 'name type sportType startDate endDate')
            .sort({ registrationDate: -1 }).lean())
            // type 是报名载体，项目“个人／集体”必须取自赛事项目配置。
            .map((row) => ({ ...row, isGroupEvent: groupEventNames.has(row.event) }));
          const displayRows = (req.query.myRegistrations === 'true' || ownSchoolRegistrations) && req.user
            ? rows.filter(row => String(row.user?._id || row.user) === req.user.id) : rows;
          const groups = require('../utils/wushuFees').buildWushuFeeGroups(displayRows, req.query, rows);
          const count = groups.reduce((sum, group) => sum + group.participants.length, 0);
          return res.status(200).json({ success: true, feeSummaryEnabled: true, grouped: true,
            count, total: count, groupCount: groups.length, pagination: {},
            uniqueParticipantTotal: new Set(groups.flatMap(group => group.roster.map(person => person.key))).size, data: groups });
        }
      }
    }
    let query = {};
    
    // 如果URL中包含competitionId，则按比赛ID过滤
    if (req.params.competitionId) {
      query.competition = req.params.competitionId;
    }

    // 默认在前端展示列表中过滤掉虚拟队伍记录 (后台专门生成的赛程辅助数据)
    if (req.query.includeVirtual !== 'true') {
      query.isVirtualTeam = { $ne: true };
    }

    // 过滤
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.type) {
      query.type = req.query.type;
    }

    // 按项目(event)过滤
    if (req.query.event) {
      query.event = req.query.event;
    }

    // 搜索 (姓名或团队名称)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: searchRegex },
        { teamName: searchRegex },
        { schoolName: searchRegex }
      ];
    }

    // 只查看自己的报名 (参赛单位功能)
    if ((req.query.myRegistrations === 'true' || ownSchoolRegistrations) && req.user) {
      query.user = req.user.id;
    }

    // 如果指定了 limit 并且是一个大数字（如1000），则允许获取全部数据
    const limitParam = parseInt(req.query.limit, 10);
    const limit = limitParam > 0 ? limitParam : 10;
    const page = parseInt(req.query.page, 10) || 1;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Participant.countDocuments(query);
    const identityRows = await Participant.find(query).select('name teamName schoolName gender athleteNumber').lean();
    const uniqueParticipantTotal = new Set(identityRows.map(participantRosterKey)).size;

    // 执行查询
    const participants = await Participant.find(query)
      .populate('user', 'name email')
      .populate('checkedInBy', 'name email')
      .populate('competition', 'name type sportType startDate endDate')
      .skip(exportSchoolRegistrations ? 0 : startIndex)
      .limit(exportSchoolRegistrations ? 0 : limit)
      .sort({ registrationDate: -1 });

    // 分页结果
    const pagination = {};

    if (!exportSchoolRegistrations && endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (!exportSchoolRegistrations && startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    // 支持按项目分组返回
    if (req.query.groupBy === 'event' || req.query.groupBy === 'school') {
      const competition = req.query.groupBy === 'event' && req.params.competitionId
        ? await Competition.findById(req.params.competitionId).select('events.name events.isGroupEvent')
        : null;
      const groupEvents = new Set((competition?.events || []).filter(event => event.isGroupEvent).map(event => event.name));
      const groupsMap = {};
      // 把项目配置带到分组结果中；前端“类型”列不再误用报名载体 type。
      participants.map((participant) => {
        const row = typeof participant.toObject === 'function' ? participant.toObject() : participant;
        return { ...row, isGroupEvent: groupEvents.has(row.event) };
      }).forEach(p => {
        let eventName = (p.event && p.event.trim()) ? p.event : '未分类项目';
        let ageGroup = (p.ageGroup && p.ageGroup.trim()) ? p.ageGroup : (p.grade && p.grade.trim() ? p.grade : '');
        let schoolName = (p.schoolName && p.schoolName.trim()) ? p.schoolName : '未知单位';
        
        // 如果原本报名的项目名里写了“集体混合”，把它统一规范化为“集体项目”
        if (eventName.includes('集体混合')) {
          eventName = eventName.replace('集体混合', '集体项目');
        }

        if (req.query.groupBy === 'school') {
          // ========================
          // 新增逻辑：完全按照参赛单位（学校）分组
          // ========================
          const key = schoolName;
          
          if (!groupsMap[key]) {
             groupsMap[key] = {
               event: undefined,
               schoolName: schoolName,
               displayName: key, // 用作手风琴的标题
               ageGroup: '',
               participants: []
             };
          }
          groupsMap[key].participants.push(p);

        } else {
          // ========================
          // 原有逻辑：按照比赛项目分组
          // ========================
          // 检查是否为集体项目 (根据名称或组别判断)
          const isCollective = groupEvents.has(eventName) || eventName.includes('集体') || ageGroup.includes('集体混合') || ageGroup.includes('混合集体') || eventName.includes('武术操');
          
          if (isCollective) {
             // 1. 如果是集体项目，必须以“单位（学校）”和“项目”作为最高级别的归类维度
             const key = `${schoolName} - ${eventName}`;
             
             if (!groupsMap[key]) {
               groupsMap[key] = {
                 event: eventName,
                 schoolName: schoolName,
                 displayName: key,
                 ageGroup: '',
                 participants: []
               };
             }
             groupsMap[key].participants.push(p);
          } else {
             // 2. 如果是普通个人项目，按“项目 + 年龄组别 + 性别”归类
             let genderStr = '';
             if (p.gender === 'male' || p.gender === '男') genderStr = '男子';
             if (p.gender === 'female' || p.gender === '女') genderStr = '女子';
             
             const isMixed = eventName.includes('男女混合') || ageGroup.includes('男女混合');
             
             if (!isMixed && genderStr && ageGroup && !ageGroup.includes('男') && !ageGroup.includes('女')) {
               ageGroup = `${genderStr}${ageGroup}`;
             }
             
             const key = ageGroup ? `${eventName} (${ageGroup})` : eventName;
          
             if (!groupsMap[key]) {
               groupsMap[key] = {
                 event: eventName,
                 ageGroup: ageGroup,
                 displayName: key,
                 participants: []
               };
             }
             groupsMap[key].participants.push(p);
          }
        }
      });
      
      const groups = Object.keys(groupsMap).map(key => ({
        event: groupsMap[key].event, 
        displayName: groupsMap[key].displayName || key,
        ageGroup: groupsMap[key].ageGroup,
        schoolName: groupsMap[key].schoolName,
        participants: groupsMap[key].participants
      }));

      // 如果是按单位分组，根据单位名称进行字母排序
      if (req.query.groupBy === 'school') {
        groups.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'));
      }

      return res.status(200).json({
        success: true,
        count: participants.length,
        groupCount: groups.length,
        grouped: true,
        pagination,
        total,
        uniqueParticipantTotal,
        data: groups
      });
    }

    res.status(200).json({
      success: true,
      count: participants.length,
      pagination,
      total,
      uniqueParticipantTotal,
      data: participants
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取单个参赛者
 * @route   GET /api/competitions/:competitionId/participants/:id
 * @access  Public
 */

exports.getParticipantPhoto = async (req, res, next) => {
  try {
    const participant = await Participant.findOne({ _id: req.params.id, competition: req.params.competitionId });
    if (!participant || !participant.photoFile) return res.status(404).json({ success: false, message: '\u7167\u7247\u4e0d\u5b58\u5728' });
    const photoPath = path.join(__dirname, '..', 'uploads', 'participant-photos', participant.photoFile);
    if (!fs.existsSync(photoPath)) return res.status(404).json({ success: false, message: '\u7167\u7247\u6587\u4ef6\u4e0d\u5b58\u5728' });
    return res.sendFile(photoPath);
  } catch (error) { return next(error); }
};

exports.exportParticipantsWithPhotos = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.competitionId).select('name');
    if (!competition) return res.status(404).json({ success: false, message: '\u672a\u627e\u5230\u8d5b\u4e8b' });
    const participants = await Participant.find({ competition: competition._id }).sort({ schoolName: 1, name: 1, registrationDate: 1 });
    const safeName = String(competition.name || 'competition').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    // 相片多為已壓縮的 JPG；使用快速壓縮可大幅縮短大型匯出的等待時間，
    // 不會改動照片內容或 CSV 資料。
    const archive = archiver('zip', { zlib: { level: 1 } });
    res.attachment(safeName + '_registration_photos.zip');
    archive.on('error', next);
    archive.pipe(res);
    const quote = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csvRows = [['\u5e8f\u53f7', '\u59d3\u540d', '\u6240\u5c5e\u5355\u4f4d', '\u6027\u522b', '\u5e74\u9f84\u7ec4\u522b', '\u53c2\u8d5b\u9879\u76ee', '\u9886\u961f', '\u6559\u7ec3', '\u62a5\u540d\u72b6\u6001', '\u7167\u7247\u6587\u4ef6']];
    let photoNumber = 0;
    const uniqueParticipants = new Set();
    // 同一选手可报名多个项目，系统可能为每条项目记录保存不同的照片文件名。
    // 导出照片按选手名册身分（姓名＋单位＋性别）去重，与页面显示的选手数一致。
    const photoEntryByParticipant = new Map();
    participants.forEach((participant, index) => {
      let photoEntry = '';
      const rosterKey = participantRosterKey(participant);
      uniqueParticipants.add(rosterKey);
      const existingPhotoEntry = photoEntryByParticipant.get(rosterKey) || '';
      const photoAlreadyExported = Boolean(existingPhotoEntry);
      if (participant.photoFile && !photoAlreadyExported) {
        const photoPath = path.join(__dirname, '..', 'uploads', 'participant-photos', participant.photoFile);
        if (fs.existsSync(photoPath)) {
          photoNumber += 1;
          const extension = path.extname(participant.photoFile) || '.jpg';
          const displayName = String(participant.name || participant.teamName || ('participant_' + (index + 1))).replace(/[\\/:*?"<>|]/g, '_');
          photoEntry = 'photos/' + String(photoNumber).padStart(3, '0') + '_' + displayName + extension;
          archive.file(photoPath, { name: photoEntry });
          photoEntryByParticipant.set(rosterKey, photoEntry);
        }
      }
      const photoStatus = photoEntry || existingPhotoEntry || (participant.photoFile ? '\u7167\u7247\u6587\u4ef6\u4e0d\u5b58\u5728' : '\u672a\u4e0a\u4f20');
      csvRows.push([index + 1, participant.name || participant.teamName || '', participant.schoolName || '', participant.gender || '', participant.ageGroup || participant.grade || '', participant.event || '', participant.teamLeader || '', participant.coach || '', participant.status || '', photoStatus]);
    });
    archive.append('\uFEFF' + csvRows.map((row) => row.map(quote).join(',')).join('\r\n'), { name: '\u62a5\u540d\u8d44\u6599\u6e05\u5355.csv' });
    archive.append('\u8d5b\u4e8b\uff1a' + competition.name + '\n\u62a5\u540d\u9879\u76ee\u8bb0\u5f55\uff1a' + participants.length + '\n\u53bb\u91cd\u540e\u53c2\u8d5b\u9009\u624b\uff1a' + uniqueParticipants.size + '\n\u5df2\u6253\u5305\u9009\u624b\u7167\u7247\uff1a' + photoNumber + '\n\u8bf4\u660e\uff1a\u62a5\u540d\u8d44\u6599\u6e05\u5355\u4fdd\u7559\u6bcf\u4e2a\u62a5\u540d\u9879\u76ee\uff0c\u7167\u7247\u6309\u9009\u624b\u8eab\u5206\uff08\u59d3\u540d\uff0b\u5355\u4f4d\uff0b\u6027\u522b\uff09\u4ec5\u5bfc\u51fa\u4e00\u4efd\u3002\n', { name: 'README.txt' });
    await archive.finalize();
  } catch (error) { return next(error); }
};

exports.getParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id)
      .populate('user', 'name email profile')
      .populate('competition', 'name startDate endDate location')
      .populate('checkedInBy', 'name email')
      .populate('members.user', 'name email');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的参赛者`
      });
    }

    res.status(200).json({
      success: true,
      data: participant
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    创建参赛者
 * @route   POST /api/competitions/:competitionId/participants
 * @access  Private
 */
exports.createParticipant = async (req, res, next) => {
  try {
    // 处理报名表文件上传（可选）
    if (req.file) {
      // 将文件路径保存到请求体中
      req.body.photoFile = req.file.filename;
    }

    // 处理 multipart/form-data 传来的 JSON 字符串字段
    if (req.body.additionalInfo && typeof req.body.additionalInfo === 'string') {
      try {
        req.body.additionalInfo = JSON.parse(req.body.additionalInfo);
      } catch (e) {
        console.error('解析 additionalInfo 失败:', e);
        req.body.additionalInfo = {};
      }
    }

    if (req.body.members) {
      if (typeof req.body.members === 'string') {
        try {
          // 如果是空字符串，设为空数组
          if (req.body.members.trim() === '') {
            req.body.members = [];
          } else {
            req.body.members = JSON.parse(req.body.members);
          }
        } catch (e) {
          console.error('解析 members 失败:', e);
          req.body.members = [];
        }
      }
    } else {
      // 如果未提供 members，默认为空数组
      req.body.members = [];
    }

    // 设置比赛ID
    req.body.competition = req.params.competitionId;
    // 设置用户ID
    req.body.user = req.user.id;

    // 检查比赛是否存在
    const competition = await Competition.findById(req.params.competitionId);

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.competitionId}的比赛`
      });
    }

    if (!canUserAccessCompetitionType(req.user, competition)) {
      return res.status(403).json({ success: false, message: '该单位未获授权参与此赛事类型' });
    }

    // 管理员或主裁手动添加可暂不上传照片；参赛单位自主报名仍遵循比赛的照片要求。
    const isAdmin = req.user.roles && (req.user.roles.includes('admin') || req.user.roles.includes('chief_referee'));
    if (isAdmin && getCompetitionSportType(competition) === SPORT_TYPES.TRAMPOLINE) {
      const error = validateTrampolineRegistration(competition, req.body);
      if (error) return res.status(400).json({ success: false, message: error });
    }
    if (!isAdmin && !String(req.body.idCard || '').trim()) {
      return res.status(400).json({ success: false, message: '请填写证件号码' });
    }
    if (competition.participantRequirements?.requirePhoto === true && !req.body.photoFile && !isAdmin) {
      return res.status(400).json({ success: false, message: '\u8bf7\u4e0a\u4f20\u8fd0\u52a8\u5458\u7167\u7247' });
    }
    // 管理员和主裁可在截止后代报名；单位提交必须同时满足截止时间、项目、年龄组及性别限制。
    if (!isAdmin) {
      const registrationError = validateRegistrationAgainstCompetition({ competition, body: req.body });
      if (registrationError) return res.status(400).json({ success: false, message: registrationError });
      const pairError = getCompetitionSportType(competition) === SPORT_TYPES.DIVING ? validateDivingPairPayload(req.body) : null;
      if (getCompetitionSportType(competition) !== SPORT_TYPES.DIVING && req.body.additionalInfo?.divingPair) {
        return res.status(400).json({ success: false, message: '只有跳水比赛可以提交双人跳水配对资料' });
      }
      if (pairError) return res.status(400).json({ success: false, message: pairError });
      const pair = req.body.additionalInfo?.divingPair;
      if (pair) {
        const existingPairMembers = await Participant.find({ competition: competition._id, 'additionalInfo.divingPair.pairId': pair.pairId, isVirtualTeam: { $ne: true } }).select('name schoolName grade ageGroup gender event additionalInfo.divingPair');
        if (existingPairMembers.length > 1) return res.status(400).json({ success: false, message: '该双人跳水配对已满，不能重复报名' });
        if (existingPairMembers.length === 1) {
          const partner = existingPairMembers[0];
          const existingPair = partner.additionalInfo?.divingPair || {};
          const sameUnit = normalizeRuleValue(partner.schoolName) === normalizeRuleValue(req.body.schoolName);
          const sameGroup = normalizeRuleValue(partner.ageGroup || partner.grade) === normalizeRuleValue(req.body.ageGroup || req.body.grade);
          const sameEvent = normalizeRuleValue(partner.event) === normalizeRuleValue(req.body.event);
          const gendersMatch = /混合|混雙/.test(String(req.body.event || '')) ? partner.gender !== req.body.gender : partner.gender === req.body.gender;
          if (!sameUnit || !sameGroup || !sameEvent || !gendersMatch || existingPair.partnerName !== req.body.name || pair.partnerName !== partner.name) return res.status(400).json({ success: false, message: '双人跳水搭档资料不匹配；须为同单位、同组别、同项目且符合性别规则的双方互相配对' });
        }
      }
    }

    // 检查比赛状态
    if (!isAdmin && competition.status !== 'registration') {
      return res.status(400).json({
        success: false,
        message: '该比赛当前不在报名阶段'
      });
    }

    if (getCompetitionSportType(competition) === SPORT_TYPES.WUSHU) {
      // 先验证报名字段，避免资料错误时留下无效的人员档案。
      await new Participant(req.body).validate();
      try { req.body.athleteNumber = await resolveAthleteNumber(req.body, req.user, { allowOwnerSelection: true }); }
      catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
    } else { delete req.body.athleteNumber; }

    if (!isAdmin) {
      const limitError = await validateWushuEventLimits(competition, req.body);
      if (limitError) return res.status(400).json({ success: false, message: limitError });
    }

    // 取消同一身份证只能报名一次同一项目的限制，允许参赛单位为多名学生报名同一项目
    // (已删除 existingParticipant 的校验逻辑)

    // 创建参赛者
    const participant = await Participant.create(req.body);

    res.status(201).json({
      success: true,
      data: participant
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    更新参赛者
 * @route   PUT /api/competitions/:competitionId/participants/:id
 * @access  Private
 */
// 独立入口只更新项目资料；开关每次从数据库读取，不缓存。
exports.updateRegistrationContent = async (req, res, next) => {
  try {
    const fail = (code, message) => res.status(code).json({ success: false, message });
    const participant = await Participant.findById(req.params.id);
    if (!participant || String(participant.competition) !== req.params.competitionId) return fail(404, '未找到该比赛的报名记录');
    if (!req.user.roles?.includes('organization') || String(participant.user) !== req.user.id) return fail(403, '只能编辑本单位账号提交的报名');
    const competition = await Competition.findById(participant.competition);
    if (!competition) return fail(404, '比赛不存在');
    if (getCompetitionSportType(competition) !== SPORT_TYPES.WUSHU || !canUserAccessCompetitionType(req.user, competition)) return fail(403, '此功能仅适用于获授权的武术赛事');
    const setting = await require('../models/SystemSetting').findOne({ key: 'wushu_registration_edit_enabled' });
    if (setting?.value !== true) return fail(403, '管理员尚未开启报名项目编辑功能');
    const deadline = new Date(competition.registrationDeadline).getTime();
    if (!competition.registrationDeadline || !Number.isFinite(deadline) || Date.now() >= deadline) return fail(400, '报名已截止或未设置有效截止时间');
    if (competition.status !== 'registration') return fail(400, '该比赛当前不在报名阶段');
    if (participant.isVirtualTeam || participant.isCheckedIn || ['checked', 'absent'].includes(participant.checkInStatus)) return fail(409, '该记录已进入比赛流程，请联系管理员');
    if (!participant.athleteNumber) return fail(409, '历史报名尚未关联参赛者编号，请联系管理员完成补号');
    if (req.body.athleteNumber !== participant.athleteNumber) return fail(409, '参赛者编号不匹配，请刷新后重试');
    if (participant.athleteNumber) {
      try { await resolveAthleteNumber({ ...participant.toObject(), user: participant.user }, req.user, { allowRegistrationSnapshot: true }); }
      catch (error) { return fail(error.statusCode || 500, error.message); }
    }
    const allowed = ['event', 'ageGroup', 'groupTeam', 'eventDetail', 'schoolName', 'updatedAt', 'athleteNumber'];
    if (!req.body || Object.keys(req.body).some(key => !allowed.includes(key))) return fail(400, '提交了不允许修改的字段');
    const required = allowed.filter(key => key !== 'schoolName');
    if (required.some(key => typeof req.body[key] !== 'string') || (req.body.schoolName !== undefined && typeof req.body.schoolName !== 'string')) return fail(400, '请提交完整的项目资料及记录版本');
    if (new Date(req.body.updatedAt).getTime() !== new Date(participant.updatedAt).getTime()) return fail(409, '报名已被修改，请刷新后重试');
    const eventName = req.body.event.trim();
    const event = competition.events.find(item => item.name === eventName);
    if (!event) return fail(400, '所选比赛项目不属于本次比赛');
    const ageGroup = req.body.ageGroup.trim();
    if (ageGroup !== normalizeRuleValue(participant.ageGroup || participant.grade)) return fail(400, '参赛单位不能修改组别，如需更正请联系管理员');
    if (competition.ageGroups?.length && !competition.ageGroups.some(group => normalizeRuleValue(group) === ageGroup)) return fail(400, '请选择本赛事的年龄组别');
    const schoolName = String(req.body.schoolName ?? participant.schoolName ?? '').trim();
    if (!schoolName) return fail(400, '请填写代表单位 / 学校');
    if (schoolName.length > 100) return fail(400, '代表单位 / 学校不能超过100个字符');
    const ruleError = validateRegistrationAgainstCompetition({ competition, body: { ...participant.toObject(), event: eventName, ageGroup, grade: ageGroup } });
    if (ruleError) return fail(400, ruleError);
    const detail = req.body.eventDetail.trim();
    if (event.registrationDetail?.required && !detail) return fail(400, '请填写项目补充说明');
    if (detail.length > (event.registrationDetail?.maxLength || 100)) return fail(400, '项目补充说明超过长度限制');
    const groupTeam = event.isGroupEvent ? req.body.groupTeam.trim() : '';
    if (event.isGroupEvent && !groupTeam) return fail(400, '请填写集体项目队伍编号');
    if (groupTeam.length > 30) return fail(400, '队伍编号不能超过30个字符');
    const limitError = await validateWushuEventLimits(competition, { ...participant.toObject(), event: eventName }, participant._id);
    if (limitError) return fail(400, limitError);
    // 项目去重只依据已确认的参赛者编号。
    if (eventName !== participant.event && await Participant.exists({
      _id: { $ne: participant._id }, competition: participant.competition,
      athleteNumber: participant.athleteNumber,
      event: eventName, status: { $ne: 'rejected' }, isVirtualTeam: { $ne: true }
    })) return fail(409, '该选手已报名目标项目');
    const Schedule = require('../models/Schedule');
    const Result = require('../models/Result');
    const [scheduled, result, virtualTeam] = await Promise.all([
      Schedule.exists({ competition: participant.competition, participants: participant._id }),
      Result.exists({ competition: participant.competition, participant: participant._id }),
      Participant.exists({ competition: participant.competition, isVirtualTeam: true, teamMembers: participant._id })
    ]);
    if (scheduled || result || virtualTeam) return fail(409, '报名已关联赛程、成绩或集体队伍，请联系管理员');
    const updated = await Participant.findOneAndUpdate(
      { _id: participant._id, user: req.user.id, competition: participant.competition,
        updatedAt: participant.updatedAt, status: participant.status, athleteNumber: participant.athleteNumber,
        isCheckedIn: { $ne: true }, checkInStatus: { $nin: ['checked', 'absent'] } },
      { $set: { event: eventName, groupTeam, schoolName,
        category: event.category || '', manualEventGroup: '', status: 'pending',
        additionalInfo: { ...participant.additionalInfo, eventDetail: detail,
          eventDetailLabel: event.registrationDetail?.label || '' },
        updatedAt: new Date(Math.max(Date.now(), new Date(participant.updatedAt).getTime() + 1)) } },
      { new: true, runValidators: true }
    );
    if (!updated) return fail(409, '报名状态已变化，请刷新后重试');
    return res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
};

exports.updateParticipant = async (req, res, next) => {
  try {
    let participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的参赛者`
      });
    }

    const isPrivileged = req.user.roles?.includes('admin') || req.user.roles?.includes('chief_referee');
    const isOrganization = req.user.roles?.includes('organization');
    // 武术单位报名统一走可开关的专用接口，避免旧接口绕过限制。
    if (isOrganization && !isPrivileged) {
      const competition = await Competition.findById(participant.competition);
      if (getCompetitionSportType(competition) === SPORT_TYPES.WUSHU) {
        return res.status(403).json({ success: false, message: '请使用我的报名中的项目编辑功能' });
      }
    }
    // 参赛单位只能编辑自己提交、且尚未审核的报名。
    if (
      participant.user?.toString() !== req.user.id &&
      !isPrivileged
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新此参赛信息'
      });
    }
    if (isOrganization && !isPrivileged && participant.status !== 'pending') {
      return res.status(400).json({ success: false, message: '报名审核后不能自行修改，请联系赛事管理员处理' });
    }

    // 身份关联只能由管理员明确选择；单位修改不能更换编号。
    if (Object.hasOwn(req.body, 'athleteNumber')) {
      if (!isPrivileged && req.body.athleteNumber !== participant.athleteNumber) return res.status(403).json({ success: false, message: '不能更换参赛者编号' });
      if (isPrivileged && req.body.athleteNumber !== participant.athleteNumber) {
        if (new Date(req.body.updatedAt).getTime() !== new Date(participant.updatedAt).getTime()) return res.status(409).json({ success: false, message: '报名已变化，请刷新后重新关联' });
        try { req.body.athleteNumber = await resolveAthleteNumber({ ...participant.toObject(), ...req.body, competition: participant.competition, user: participant.user }, req.user, { allowRegistrationSnapshot: true }); }
        catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
      }
    }
    if (participant.athleteNumber && !Object.hasOwn(req.body, 'athleteNumber') &&
        ['name', 'gender', 'birthDate', 'idCard'].some(key => Object.hasOwn(req.body, key))) {
      try { await resolveAthleteNumber({ ...participant.toObject(), ...req.body, competition: participant.competition, user: participant.user }, req.user, { allowRegistrationSnapshot: true }); }
      catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
    }
    if (participant.athleteNumber && req.body.athleteNumber === participant.athleteNumber) {
      try { await resolveAthleteNumber({ ...participant.toObject(), ...req.body, competition: participant.competition, user: participant.user }, req.user, { allowRegistrationSnapshot: true }); }
      catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.message }); }
    }
    delete req.body.athleteRequestKey;

    // 管理员编辑时可选择上传／替换照片；未选择则保留原照片。
    if (req.file) req.body.photoFile = req.file.filename;

    // 不允许更改比赛和用户ID
    delete req.body.competition;
    delete req.body.user;

    // 参赛单位不能借由通用更新接口修改审核、检录、测试或双人配对状态。
    if (!isPrivileged) {
      delete req.body.status;
      delete req.body.checkInStatus;
      delete req.body.isTest;
      delete req.body.additionalInfo;
      const allowedFields = new Set(['name', 'teamName', 'groupTeam', 'members', 'schoolName', 'event', 'manualEventGroup', 'grade', 'ageGroup', 'gender', 'idCard', 'birthDate', 'teamLeader', 'leaderPhone', 'coach', 'coachPhone', 'remark', 'photoFile']);
      Object.keys(req.body).forEach((key) => {
        if (!allowedFields.has(key)) delete req.body[key];
      });

      const competition = await Competition.findById(participant.competition);
      const registrationError = validateRegistrationAgainstCompetition({ competition, body: { ...participant.toObject(), ...req.body } });
      if (registrationError) return res.status(400).json({ success: false, message: registrationError });

      const pairingFields = ['schoolName', 'event', 'grade', 'ageGroup', 'gender'];
      const pairingChanged = pairingFields.some((field) => req.body[field] !== undefined && String(req.body[field]) !== String(participant[field] || ''));
      const pairId = participant.additionalInfo?.divingPair?.pairId;
      if (pairingChanged && pairId) {
        await Participant.updateMany(
          { competition: participant.competition, 'additionalInfo.divingPair.pairId': pairId, isVirtualTeam: { $ne: true } },
          { $unset: { 'additionalInfo.divingPair': '' }, $set: { updatedAt: new Date() } }
        );
      }
    }

    req.body.updatedAt = new Date(Math.max(Date.now(), new Date(participant.updatedAt).getTime() + 1));
    participant = await Participant.findOneAndUpdate({ _id: req.params.id, updatedAt: participant.updatedAt }, req.body, {
      new: true,
      runValidators: true
    });
    if (!participant) return res.status(409).json({ success: false, message: '报名已变化，请刷新后重试' });

    res.status(200).json({
      success: true,
      data: participant
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    删除参赛者
 * @route   DELETE /api/competitions/:competitionId/participants/:id
 * @access  Private
 */
exports.deleteParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的参赛者`
      });
    }

    // 确保用户是参赛者本人或管理员/主裁判
    if (
      participant.user?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: `没有权限删除此参赛信息 (当前角色: ${req.user.roles?.join(', ')})`
      });
    }

    await participant.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    审核通过参赛者
 * @route   PUT /api/competitions/:competitionId/participants/:id/approve
 * @access  Private/Admin/Organizer
 */
exports.approveParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的参赛者`
      });
    }

    participant.status = 'approved';
    await participant.save();

    res.status(200).json({
      success: true,
      data: participant
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    更新参赛者检录状态
 * @route   PUT /api/competitions/:competitionId/participants/:id/check-in
 * @access  Private/Admin/ChiefReferee/CheckinClerk
 */
exports.updateParticipantCheckInStatus = async (req, res, next) => {
  try {
    const { competitionId, id } = req.params;
    const { status, scheduleId } = req.body;

    if (!['not_checked', 'checked', 'absent'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '检录状态无效'
      });
    }

    const participant = await Participant.findOne({
      _id: id,
      competition: competitionId
    }).populate('teamMembers', '_id');

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${id}的参赛者`
      });
    }

    const targetIds = participant.isVirtualTeam
      ? (participant.teamMembers || []).map(member => member._id || member)
      : [participant._id];
    const resultParticipantIds = [participant._id];
    const cleanupResultParticipantIds = participant.isVirtualTeam
      ? [participant._id, ...targetIds]
      : targetIds;

    if (targetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '该集体项目队伍下没有可检录的真实参赛者'
      });
    }

    const now = new Date();
    const updateData = status === 'checked'
      ? {
          isCheckedIn: true,
          checkInStatus: 'checked',
          checkedInAt: now,
          checkedInBy: req.user.id,
          absentAt: null,
          absentBy: null,
          updatedAt: now
        }
      : status === 'absent'
        ? {
            isCheckedIn: false,
            checkInStatus: 'absent',
            absentAt: now,
            absentBy: req.user.id,
            updatedAt: now
          }
        : {
            isCheckedIn: false,
            checkInStatus: 'not_checked',
            checkedInAt: null,
            checkedInBy: null,
            absentAt: null,
            absentBy: null,
            updatedAt: now
          };

    await Participant.updateMany(
      {
        _id: { $in: targetIds },
        competition: competitionId,
        isVirtualTeam: { $ne: true }
      },
      { $set: updateData }
    );

    const updatedTargets = await Participant.find({
      _id: { $in: targetIds }
    }).populate('checkedInBy', 'name email');

    if (scheduleId) {
      const Result = require('../models/Result');
      if (status === 'absent') {
        await Promise.all(
          resultParticipantIds.map(async (targetId) => {
            const existingResult = await Result.findOne({
              competition: competitionId,
              schedule: scheduleId,
              participant: targetId
            });

            const resultData = {
              competition: competitionId,
              schedule: scheduleId,
              participant: targetId,
              score: 0,
              details: {
                ...(existingResult?.details || {}),
                isAbsent: true,
                absentSource: 'check_in'
              },
              submittedBy: req.user.id,
              status: 'pending'
            };

            if (existingResult) {
              await Result.findByIdAndUpdate(existingResult._id, resultData, {
                new: true,
                runValidators: true
              });
            } else {
              await Result.create(resultData);
            }
          })
        );
      } else {
        const absenceResults = await Result.find(
          {
            competition: competitionId,
            schedule: scheduleId,
            participant: { $in: cleanupResultParticipantIds },
            'details.absentSource': 'check_in'
          }
        );
        await Promise.all(absenceResults.map((result) => Result.findByIdAndUpdate(
          result._id,
          {
            $set: {
              status: 'pending',
              updatedAt: new Date(),
              details: {
                ...(result.details || {}),
                isAbsent: false,
                absentSource: null
              }
            }
          },
          { runValidators: true }
        )));
      }

      broadcastScoreEvent(competitionId, scheduleId, 'check-in-updated', {
        participantId: String(participant._id),
        status,
        updates: updatedTargets.map((target) => ({
          _id: String(target._id),
          isCheckedIn: target.isCheckedIn,
          checkInStatus: target.checkInStatus,
          checkedInAt: target.checkedInAt,
          absentAt: target.absentAt
        }))
      });
    }

    res.status(200).json({
      success: true,
      message:
        status === 'checked'
          ? '已标记为已检录'
          : status === 'absent'
            ? '已标记为缺席'
            : '已恢复为未检录',
      data: participant.isVirtualTeam ? updatedTargets : updatedTargets[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    批量通过指定比赛的所有待审核参赛者 (一键通过)
 * @route   PUT /api/competitions/:competitionId/participants/approve-all
 * @access  Private/Admin/Organizer
 */
exports.bulkApproveParticipants = async (req, res, next) => {
  try {
    const competitionId = req.params.competitionId;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        message: '未提供比赛ID'
      });
    }

    // 执行更新操作，只更新状态为 pending 的参赛者
    const result = await Participant.updateMany(
      { competition: competitionId, status: 'pending' },
      { $set: { status: 'approved' } }
    );

    res.status(200).json({
      success: true,
      message: `成功通过了 ${result.modifiedCount} 名参赛者`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    拒绝参赛者
 * @route   PUT /api/competitions/:competitionId/participants/:id/reject
 * @access  Private/Admin/Organizer
 */
exports.rejectParticipant = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的参赛者`
      });
    }

    participant.status = 'rejected';
    await participant.save();

    res.status(200).json({
      success: true,
      data: participant
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取当前用户的所有参赛记录
 * @route   GET /api/competitions/:competitionId/participants/me
 * @access  Private
 */
exports.getMyParticipations = async (req, res, next) => {
  try {
    let query = { user: req.user.id };
    
    // 如果URL中包含competitionId，则按比赛ID过滤
    if (req.params.competitionId && req.params.competitionId !== 'all') {
      query.competition = req.params.competitionId;
    }

    const participants = await Participant.find(query)
      .populate('competition', 'name type sportType startDate endDate location status registrationDeadline')
      .sort({ registrationDate: -1 });

    res.status(200).json({
      success: true,
      count: participants.length,
      data: participants
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    批量导入参赛者
 * @route   POST /api/competitions/:competitionId/participants/import
 * @access  Private/Organizer
 */
exports.importParticipants = async (req, res, next) => {
  try {
    const { participants } = req.body;
    const competitionId = req.params.competitionId;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的参赛者数据'
      });
    }

    const competition = await Competition.findById(competitionId).select('_id sportType type events ageGroups');
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });

    const createdParticipants = [];
    const errorDetails = [];
    const importedDetails = [];
    const importedKeys = new Set();
    const normalize = (value) => String(value || '').trim().replace(/\s+/g, '').toLowerCase();
    const duplicateKey = (participant) => {
      if (participant.athleteNumber) return `athlete:${participant.athleteNumber}:${normalize(participant.event)}`;
      const idCard = normalize(participant.idCard);
      if (idCard) return getCompetitionSportType(competition) === SPORT_TYPES.TRAMPOLINE ? `id:${idCard}:${normalize(participant.event)}` : `id:${idCard}`;
      return `person:${[participant.name, participant.schoolName || participant.teamName, participant.gender, participant.ageGroup || participant.grade, participant.event].map(normalize).join('|')}`;
    };
    const readableError = (error) => {
      if (error?.name === 'ValidationError') return Object.values(error.errors || {}).map((item) => item.message).filter(Boolean).join('；') || '资料格式不正确';
      if (error?.code === 11000) return '报名编号重复，请重新导入';
      return error?.message || '导入失败';
    };

    for (let i = 0; i < participants.length; i++) {
      const source = participants[i] || {};
      const row = Number(source.excelRow) || i + 2;
      const name = String(source.name || '').trim();
      const event = String(source.event || '').trim();
      try {
        const { excelRow, ...sourceData } = source;
        const participantData = {
          ...sourceData,
          competition: competitionId,
          user: req.user.id,
          members: Array.isArray(sourceData.members) ? sourceData.members : []
        };
        if (getCompetitionSportType(competition) === SPORT_TYPES.WUSHU && participantData.athleteNumber) {
          participantData.athleteNumber = await resolveAthleteNumber(participantData, req.user, { allowOwnerSelection: true });
        } else {
          // 未提供已确认编号的旧模板不猜测身份，保留为待管理员关联。
          delete participantData.athleteNumber;
        }
        const key = duplicateKey(participantData);
        if (getCompetitionSportType(competition) === SPORT_TYPES.TRAMPOLINE) {
          const error = validateTrampolineRegistration(competition, participantData);
          if (error) throw new Error(error);
        }
        if (importedKeys.has(key)) throw new Error('与本次 Excel 中已成功导入的报名重复');
        const existingQuery = participantData.athleteNumber
          ? { competition: competitionId, athleteNumber: participantData.athleteNumber, event: participantData.event }
          : participantData.idCard && getCompetitionSportType(competition) !== SPORT_TYPES.TRAMPOLINE
          ? { competition: competitionId, idCard: participantData.idCard }
          : { competition: competitionId, name: participantData.name, schoolName: participantData.schoolName, gender: participantData.gender, ageGroup: participantData.ageGroup || participantData.grade, event: participantData.event };
        if (await Participant.exists(existingQuery)) throw new Error('该报名已成功导入，不能重复导入');
        const participant = await Participant.create(participantData);
        createdParticipants.push(participant);
        importedKeys.add(key);
        importedDetails.push({ row, participant });
      } catch (error) {
        errorDetails.push({
          row,
          name: name || '未填写姓名',
          event: event || '未填写项目',
          reason: readableError(error)
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        imported: createdParticipants.length,
        failed: errorDetails.length,
        errors: errorDetails.length,
        participants: createdParticipants,
        importedDetails,
        errorDetails
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    下载参赛者报名表
 * @route   GET /api/competitions/:competitionId/participants/:id/download-form
 * @access  Private/Admin/Organizer
 */
exports.downloadRegistrationForm = async (req, res, next) => {
  try {
    const participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的参赛者`
      });
    }

    // 检查是否有报名表文件
    if (!participant.registrationFormFile) {
      return res.status(404).json({
        success: false,
        message: '该参赛者未上传报名表'
      });
    }

    // 检查权限 (管理员、主裁判或本人)
    if (
      participant.user?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限下载此文件'
      });
    }

    const path = require('path');
    const fs = require('fs');
    
    // 构建文件路径
    const filePath = path.join(__dirname, '..', 'uploads', 'registration-forms', participant.registrationFormFile);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件在服务器上不存在'
      });
    }
    
    // 获取文件扩展名
    const fileExtension = path.extname(participant.registrationFormFile);
    const fileName = `${participant.name}_报名表${fileExtension}`;
    
    // 下载文件
    res.download(filePath, fileName);
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    导出参赛者数据
 * @route   GET /api/competitions/:competitionId/participants/export
 * @access  Private/Organizer
 */
exports.exportParticipants = async (req, res, next) => {
  try {
    const competitionId = req.params.competitionId;
    
    const participants = await Participant.find({ competition: competitionId })
      .populate('user', 'name email')
      .populate('competition', 'name')
      .sort({ registrationDate: -1 });

    const exportData = participants.map(participant => ({
      姓名: participant.name,
      身份证号: participant.idCard,
      电话: participant.phone,
      邮箱: participant.email,
      性别: participant.gender,
      年龄: participant.age,
      团队名称: participant.teamName,
      参赛项目: participant.event,
      状态: participant.status,
      注册时间: participant.registrationDate
    }));

    res.status(200).json({
      success: true,
      data: exportData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    按单位格式导出参赛者数据 (给 Excel 使用)
 * @route   GET /api/competitions/:competitionId/participants/export-school
 * @access  Private/Organizer
 */
exports.exportParticipantsBySchool = async (req, res, next) => {
  try {
    const competitionId = req.params.competitionId;
    
    // 获取比赛信息，因为需要知道是否是集体项目
    const competition = await Competition.findById(competitionId);
    
    // 获取该比赛下所有的参赛者，排除被拒绝的
    const participants = await Participant.find({ 
      competition: competitionId,
      status: { $ne: 'rejected' }
    });

    const schoolGroups = {};

    participants.forEach(p => {
      const schoolName = p.schoolName || '未知单位';
      
      if (!schoolGroups[schoolName]) {
        schoolGroups[schoolName] = {
          schoolName: schoolName,
          leader: p.teamLeader || '',
          leaderPhone: p.leaderPhone || '',
          coach: p.coach || '',
          coachPhone: p.coachPhone || '',
          maleNames: new Set(),
          femaleNames: new Set(),
          collectiveEvents: new Set()
        };
      }
      
      // 更新领队教练信息（如果当前记录有的话）
      if (p.teamLeader && !schoolGroups[schoolName].leader) schoolGroups[schoolName].leader = p.teamLeader;
      if (p.leaderPhone && !schoolGroups[schoolName].leaderPhone) schoolGroups[schoolName].leaderPhone = p.leaderPhone;
      if (p.coach && !schoolGroups[schoolName].coach) schoolGroups[schoolName].coach = p.coach;
      if (p.coachPhone && !schoolGroups[schoolName].coachPhone) schoolGroups[schoolName].coachPhone = p.coachPhone;

      // 区分个人和集体项目
      const eventName = p.event || '';
      const ageGroup = p.ageGroup || p.grade || '';
      const isCollective = competition?.events?.some(event => event.name === eventName && event.isGroupEvent) || eventName.includes('集体') || ageGroup.includes('混合集体');
      
      if (isCollective) {
        // 如果是集体项目，记录队伍名称
        const teamName = p.groupTeam || p.teamName || p.name || '未知队伍';
        schoolGroups[schoolName].collectiveEvents.add(`${eventName}(${teamName})`);
      } else {
        // 个人项目，按性别分类姓名
        const name = p.name || '未知姓名';
        if (p.gender === 'male' || p.gender === '男') {
          schoolGroups[schoolName].maleNames.add(name);
        } else if (p.gender === 'female' || p.gender === '女') {
          schoolGroups[schoolName].femaleNames.add(name);
        } else {
          // 如果没填性别，暂时放进男子里
          schoolGroups[schoolName].maleNames.add(name);
        }
      }
    });

    // 格式化为数组，供前端转 Excel
    const exportData = Object.values(schoolGroups).map(group => ({
      '报名单位': group.schoolName,
      '领队信息': group.leader ? `${group.leader} (${group.leaderPhone})` : '无',
      '教练信息': group.coach ? `${group.coach} (${group.coachPhone})` : '无',
      '男子选手': Array.from(group.maleNames).join(' '),
      '女子选手': Array.from(group.femaleNames).join(' '),
      '集体项目': Array.from(group.collectiveEvents).join('; ')
    }));
    
    // 按单位名称排序
    exportData.sort((a, b) => a['报名单位'].localeCompare(b['报名单位'], 'zh-CN'));

    res.status(200).json({
      success: true,
      data: exportData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    批量删除指定比赛的参赛者 (一键清空)
 * @route   DELETE /api/competitions/:competitionId/participants
 * @access  Private/Admin/Organizer
 */
exports.bulkDeleteParticipants = async (req, res, next) => {
  try {
    const competitionId = req.params.competitionId;

    if (!competitionId) {
      return res.status(400).json({
        success: false,
        message: '未提供比赛ID'
      });
    }

    // 执行删除操作
    const result = await Participant.deleteMany({ competition: competitionId });

    res.status(200).json({
      success: true,
      message: `成功清空 ${result.deletedCount} 名参赛者`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};

const getDivingPlanRule = (participant) => {
  const group = ['U12', 'U10', 'U8', 'U7'].find((key) => String(participant.ageGroup || participant.grade || '').includes(key)) || '';
  return { maxDives: 20 };
};

const isLandDiving = (participant) => /陆上|陸上/.test(String(participant?.event || ''));
const isStrengthEvent = (participant) => /素质力量/.test(String(participant?.event || ''));

const normalizeDivingPlan = (plan, participant) => {
  const rule = getDivingPlanRule(participant);
  if (!plan || !Array.isArray(plan.dives) || !plan.dives.length || plan.dives.length > rule.maxDives) throw new Error(`请至少填写 1 个动作，最多 ${rule.maxDives} 个`);
  return {
    takeoffOrHeight: String(plan.takeoffOrHeight || '').trim().slice(0, 100),
    dives: plan.dives.map((dive, index) => {
      const actionCode = String(dive?.actionCode || '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '');
      if (!actionCode) throw new Error(`第 ${index + 1} 个动作不能为空`);
      const difficulty = isStrengthEvent(participant) ? undefined : (isLandDiving(participant) && (dive?.difficulty === '' || dive?.difficulty == null) ? 1 : (dive?.difficulty === '' || dive?.difficulty == null ? undefined : Number(dive.difficulty)));
      if (difficulty !== undefined && (!Number.isFinite(difficulty) || difficulty <= 0 || difficulty > 10)) throw new Error(`第 ${index + 1} 轮难度系数无效`);
      return { actionCode, ...(difficulty === undefined ? {} : { difficulty }) };
    })
  };
};

exports.saveDivingPlan = async (req, res, next) => {
  try {
    const participant = await Participant.findOne({ _id: req.params.id, competition: req.params.competitionId, isVirtualTeam: { $ne: true } });
    if (!participant) return res.status(404).json({ success: false, message: '未找到该报名记录' });
    if (!/跳水|跳板|跳台|陆上|陸上|冰棍|倒下|素质/.test(String(participant.event || ''))) return res.status(400).json({ success: false, message: '仅跳水项目可以补录动作表' });
    if (participant.user?.toString() !== req.user.id && !req.user.roles?.some((role) => ['admin', 'chief_referee'].includes(role))) return res.status(403).json({ success: false, message: '没有权限补录该报名的动作表' });

    let divingPlan;
    try { divingPlan = normalizeDivingPlan(req.body, participant); } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    const pairId = participant.additionalInfo?.divingPair?.pairId;
    let syncedCount = 0;
    if (pairId) {
      const pairMembers = await Participant.find({ competition: participant.competition, 'additionalInfo.divingPair.pairId': pairId, isVirtualTeam: { $ne: true } }).select('_id name additionalInfo.divingPair');
      const reciprocal = pairMembers.length === 2 && pairMembers.every((member) => pairMembers.some((other) => other._id.toString() !== member._id.toString() && member.additionalInfo?.divingPair?.partnerName === other.name));
      if (!reciprocal) return res.status(400).json({ success: false, message: '双人跳水配对资料不完整，暂不能保存共用动作表' });
      const result = await Participant.updateMany({ _id: { $in: pairMembers.map((member) => member._id) } }, { $set: { 'additionalInfo.divingPlan': divingPlan, updatedAt: new Date() } });
      syncedCount = result.modifiedCount || 0;
    } else {
      participant.additionalInfo = { ...(participant.additionalInfo || {}), divingPlan };
      await participant.save();
    }
    res.status(200).json({ success: true, message: pairId ? '双人共用动作表已保存并同步到两位搭档' : '动作表已保存', data: participant, syncedCount });  } catch (error) {
    next(error);
  }
};

exports.saveTrampolinePlan = async (req, res, next) => {
  try {
    const participant = await Participant.findOne({ _id: req.params.id, competition: req.params.competitionId, isVirtualTeam: { $ne: true } });
    if (!participant) return res.status(404).json({ success: false, message: '未找到该报名记录' });
    const competition = await Competition.findById(participant.competition).select('sportType type');
    if (!competition || getCompetitionSportType(competition) !== SPORT_TYPES.TRAMPOLINE) return res.status(400).json({ success: false, message: '仅蹦床项目可以补录动作表' });
    if (!isLargeTrampolineEvent(participant)) return res.status(400).json({ success: false, message: '仅大网项目需要补录蹦床动作表，小网及蹦床操无需填写' });

    const roles = req.user.roles || [];
    const canManageAll = roles.some((role) => ['admin', 'chief_referee', 'referee'].includes(role));
    const isTrampolineOrganization = roles.includes('organization') && Array.isArray(req.user.sportTypes) && req.user.sportTypes.includes(SPORT_TYPES.TRAMPOLINE);
    if (!canManageAll && (!isTrampolineOrganization || participant.user?.toString() !== req.user.id)) return res.status(403).json({ success: false, message: '没有权限补录该蹦床动作表' });

    let trampolinePlan;
    try { trampolinePlan = normalizeTrampolinePlan(req.body); } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    participant.additionalInfo = { ...(participant.additionalInfo || {}), trampolinePlan };
    await participant.save();
    return res.status(200).json({ success: true, message: `蹦床动作表已保存，预计难度总分 ${trampolinePlan.totalDifficulty.toFixed(2)}`, data: participant });
  } catch (error) {
    return next(error);
  }
};
