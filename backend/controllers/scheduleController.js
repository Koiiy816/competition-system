const Schedule = require('../models/Schedule');
const Competition = require('../models/Competition');
const Participant = require('../models/Participant');

function mergeUndersizedAgeGroups(groups, competition) {
  const minimum = competition?.awardRules?.mergeGroupsBelow || 0;
  if (minimum < 2) return groups;
  const order = (competition?.ageGroups || []).map(group => group.name);
  const buckets = {};
  Object.values(groups).forEach(group => {
    const eventConfig = (competition?.events || []).find(event => event.name === group.event);
    if (group.isGroup || !String(eventConfig?.category || '').includes('\u4e2a\u4eba')) return;
    const key = [group.event, group.gender || 'mixed'].join('|');
    (buckets[key] ||= []).push(group);
  });
  Object.values(buckets).forEach(list => {
    list.sort((a, b) => {
      const ai = order.indexOf(a.ageGroup); const bi = order.indexOf(b.ageGroup);
      return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    });
    const merged = []; let pending = null;
    list.forEach(group => {
      if (!pending) { pending = { ...group, participants: [...group.participants], mergedAgeGroups: [group.ageGroup] }; return; }
      if (pending.participants.length < minimum) { pending.participants.push(...group.participants); pending.mergedAgeGroups.push(group.ageGroup); }
      else { merged.push(pending); pending = { ...group, participants: [...group.participants], mergedAgeGroups: [group.ageGroup] }; }
    });
    if (pending) {
      if (pending.participants.length < minimum && merged.length > 0) { const previous = merged[merged.length - 1]; previous.participants.push(...pending.participants); previous.mergedAgeGroups.push(...pending.mergedAgeGroups); }
      else merged.push(pending);
    }
    list.forEach(group => Object.keys(groups).forEach(key => { if (groups[key] === group) delete groups[key]; }));
    merged.forEach((group, index) => { if (group.mergedAgeGroups.length > 1) group.ageGroup = group.mergedAgeGroups.join('/'); groups['merged|' + group.event + '|' + group.gender + '|' + index + '|' + group.ageGroup] = group; });
  });
  return groups;
}

/**
 * 仅供管理员核对的分组预览：不创建赛程、不写入数据库、不随机排序。
 */
exports.previewGroups = async (req, res, next) => {
  try {
    const { competitionId } = req.params;
    const competition = await Competition.findById(competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });

    const participants = await Participant.find({ competition: competitionId, isVirtualTeam: { $ne: true } })
      .select('name schoolName event ageGroup grade gender manualEventGroup remark status')
      .sort({ event: 1, ageGroup: 1, gender: 1, name: 1 });
    const groups = new Map();

    participants.forEach((participant) => {
      const sourceEvent = String(participant.event || '未填写项目').trim();
      const groupEvent = String(participant.manualEventGroup || '').trim() || sourceEvent;
      const ageGroup = String(participant.ageGroup || participant.grade || '未填写年龄组').trim();
      const eventConfig = competition.events?.find((event) => event.name === sourceEvent);
      const isMixed = sourceEvent.includes('混合') || sourceEvent.includes('集体') || ageGroup.includes('集体') || eventConfig?.isGroupEvent;
      const gender = isMixed ? 'mixed' : (participant.gender === 'female' ? 'female' : participant.gender === 'male' ? 'male' : 'unknown');
      const genderLabel = gender === 'male' ? '男子' : gender === 'female' ? '女子' : gender === 'mixed' ? '混合' : '未填写性别';
      const key = [groupEvent, ageGroup, gender].join('|');
      if (!groups.has(key)) {
        groups.set(key, { key, event: groupEvent, sourceEvent, ageGroup, gender, genderLabel, participants: [] });
      }
      groups.get(key).participants.push({
        _id: participant._id,
        name: participant.name,
        schoolName: participant.schoolName || '-',
        manualEventGroup: participant.manualEventGroup || '',
        remark: participant.remark || ''
      });
    });

    const data = [...groups.values()]
      .sort((a, b) => a.event.localeCompare(b.event, 'zh-CN') || a.ageGroup.localeCompare(b.ageGroup, 'zh-CN') || a.gender.localeCompare(b.gender))
      .map((group) => ({ ...group, count: group.participants.length, name: `${group.ageGroup} ${group.gender === 'mixed' ? '' : group.genderLabel} ${group.event}`.replace(/\s+/g, ' ').trim() }));

    res.status(200).json({ success: true, data, totalParticipants: participants.length });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    自动生成赛程（出场顺序）
 * @route   POST /api/competitions/:competitionId/schedules/generate-start-list
 * @access  Private/Admin/Organizer
 */
exports.generateStartList = async (req, res, next) => {
  try {
    const { competitionId } = req.params;

    // 检查比赛是否存在
    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${competitionId}的比赛`
      });
    }

    // 检查权限
    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限为此比赛生成赛程'
      });
    }

    // 已有日程（尤其是 Excel 导入的日程）时，只在每个原有项目内随机出场顺序，绝不重建项目。
    const existingSchedules = await Schedule.find({ competition: competitionId });
    if (existingSchedules.length > 0) {
      const participantIds = existingSchedules.flatMap((schedule) => schedule.participants.map((participant) => participant.toString()));
      const participantRecords = await Participant.find({ _id: { $in: participantIds } }).select('_id isTest');
      const isTestById = new Map(participantRecords.map((participant) => [participant._id.toString(), participant.isTest]));
      const shuffle = (items) => {
        const result = [...items];
        for (let index = result.length - 1; index > 0; index -= 1) {
          const randomIndex = Math.floor(Math.random() * (index + 1));
          [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
        }
        return result;
      };
      await Promise.all(existingSchedules.map(async (schedule) => {
        const normal = schedule.participants.filter((participant) => !isTestById.get(participant.toString()));
        const test = schedule.participants.filter((participant) => isTestById.get(participant.toString()));
        schedule.participants = [...shuffle(normal), ...shuffle(test)];
        await schedule.save();
      }));
      return res.status(200).json({
        success: true,
        message: `已在 ${existingSchedules.length} 个现有日程项目内随机生成出场顺序，项目、场地和合并组别均保持不变。`
      });
    }

    // 如果是强制覆盖，顺便清理掉所有历史遗留的废弃虚拟队伍，保持数据库干净
    if (req.query.overwrite === 'true') {
      await Participant.deleteMany({ competition: competitionId, isVirtualTeam: true });
    }

    // 获取所有真实参赛者（排除虚拟队伍）
    const participants = await Participant.find({ 
      competition: competitionId,
      isVirtualTeam: { $ne: true }
    });
    if (participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: '暂无参赛者，无法生成赛程'
      });
    }

    // 按项目、年龄组、性别分组，如果项目是 isGroupEvent，还需要按 schoolName (单位) 归类为单个实体
    const groups = {};
    const teamGroups = {}; // 用于临时存储集体项目的队伍聚合

    participants.forEach(p => {
      // 如果缺少必要信息，跳过或归入未知组
      let event = p.event || '未知项目';
      const ageGroup = p.ageGroup || p.grade || '未知组别';
      const gender = p.gender || 'unknown';
      const schoolName = p.schoolName || '未知单位';
      
      // --- 核心纠错：统一“集体混合”到“集体项目” ---
      if (event.includes('集体混合')) {
        event = event.replace('集体混合', '集体项目');
      }
      
      // 管理员明确填写的人工项目分组才参与编排；报名备注不参与自动分组。
      const manualEventGroup = String(p.manualEventGroup || '').trim();
      const scheduleEvent = manualEventGroup || event;
      const eventConfig = competition.events?.find(e => e.name === event);
      
      // 容错处理：即使用户在创建比赛时忘记勾选“集体项目”，只要名称或组别里带有“集体”字眼，我们也认为是集体项目
      const isGroup = (eventConfig && eventConfig.isGroupEvent) || event.includes('集体') || ageGroup.includes('集体');
      
      // 自动为年龄组别补充性别前缀 (如果尚未包含且不是混合项目)
      let genderStr = '';
      if (gender === 'male' || gender === '男') genderStr = '男子';
      else if (gender === 'female' || gender === '女') genderStr = '女子';
      
      let finalAgeGroup = ageGroup;
      
      // --- 终极规则：集体项目合并策略 ---
      // 幼儿集体拳、武术操等集体项目需要合并男女，统称为混合集体
      const isForceMixedGroup = event === '集体项目' || event.includes('集体') || event.includes('武术操');
      if (isForceMixedGroup) {
         // 我们将带有男/女字眼的前缀去掉，但保留小学组/幼儿组等信息
         let strippedAgeGroup = ageGroup.replace(/男(子|童)?|女(子|童)?/g, '').trim();
         
         // 如果是武术操或幼儿集体拳，不仅不分男女，还不分具体的年龄组别（如U10、U13），直接按组别大类（小学组、幼儿组）或项目本身合并
          if (event.includes('武术操') || event.includes('集体拳')) {
             strippedAgeGroup = strippedAgeGroup.replace(/U\d+组?\s*/g, '').trim();
          }
         
         if (!strippedAgeGroup.includes('混合')) {
            finalAgeGroup = strippedAgeGroup ? `混合集体 ${strippedAgeGroup}` : '混合集体';
         } else {
            finalAgeGroup = strippedAgeGroup;
         }
      } else {
        // 对于所有普通项目，如果组别没有写明“男/女/混合”，我们都自动给它加上“男子/女子”前缀
        if (genderStr && finalAgeGroup && !finalAgeGroup.includes('男') && !finalAgeGroup.includes('女') && !finalAgeGroup.includes('混合')) {
          finalAgeGroup = `${genderStr}${finalAgeGroup}`;
        }
      }

      // --- 这里原有的 isTeamEvent 逻辑已经被顶部的 isForceMixedGroup 拦截并处理了 ---
      // 所以我们直接处理普通个人项目

      // 生成分组 Key
      let key;
      let normalizedGender = gender;
      if (gender === '女' || gender === 'female') normalizedGender = 'female';
      else if (gender === '男' || gender === 'male') normalizedGender = 'male';

      if (finalAgeGroup.includes('混合') || event.includes('混合') || isForceMixedGroup) {
        // 只要明确标明是“混合”的，或者属于强制混合项目，统统无视自身性别，划入 mixed
        key = `${scheduleEvent}|${finalAgeGroup}|mixed`;
      } else {
        // 其他项目（包括标明了男/女的集体项目），严格按照性别拆分
        key = `${scheduleEvent}|${finalAgeGroup}|${normalizedGender}`;
      }
      
      if (isGroup) {
         // 集体项目：同一单位（schoolName）的人算作一支队伍
         if (!teamGroups[key]) {
            teamGroups[key] = {};
         }
         if (!teamGroups[key][schoolName]) {
            teamGroups[key][schoolName] = []; 
         }
         teamGroups[key][schoolName].push(p._id);
      } else {
        // 个人项目：正常加入
        if (!groups[key]) {
          groups[key] = {
            event: scheduleEvent,
            sourceEvent: event,
            ageGroup,
            gender,
            participants: []
          };
        }
        groups[key].participants.push(p._id);
      }
    });

    // 把聚合好的集体项目队伍加入到 groups 中
    mergeUndersizedAgeGroups(groups, competition);

    for (const key in teamGroups) {
      const [event, ageGroup, gender] = key.split('|');
      if (!groups[key]) {
        groups[key] = {
          event,
          ageGroup,
          gender,
          participants: [],
          isGroup: true
        };
      } else {
        groups[key].isGroup = true;
      }
      
      // 检查当前比赛是否启用了集体项目虚拟队伍（由于这里我们直接将包含多个成员的数组结构化，可能需要特殊的虚拟参赛者或者前端渲染支持）
      // 由于现有系统强依赖 Participant _id 数组，对于集体项目，我们将所有同单位的队员组合在一起，作为一个子数组存储，或者合并他们的名字创建一个临时的虚拟参赛者
      
      for (const schoolName in teamGroups[key]) {
        const teamMembersIds = teamGroups[key][schoolName];
        // 我们需要获取这些队员的详细信息来拼接名字
        const teamMembers = participants.filter(p => teamMembersIds.includes(p._id));
        const combinedNames = teamMembers.map(m => m.name).join('、');
        
        // 创建或更新代表该队伍的虚拟参赛者记录
        const virtualTeamParticipant = await Participant.findOneAndUpdate(
          {
            competition: competitionId,
            isVirtualTeam: true,
            event: event,
            ageGroup: ageGroup,
            gender: gender,
            schoolName: schoolName
          },
          {
            $set: {
              type: 'team',
              name: combinedNames,
              teamName: schoolName,
              status: 'approved',
              teamMembers: teamMembersIds,
              isTest: teamMembers.some(m => m.isTest)
            },
            $setOnInsert: {
              registrationNumber: `VT-${Date.now()}-${Math.floor(Math.random() * 10000)}`
            }
          },
          { new: true, upsert: true }
        );
        
        // 因为我们在开头排除了 isVirtualTeam，所以这里不需要再推入 participants 数组
        // 但为了后面查找 pObj（比如判断 isTest），我们可以把它临时加进去
        participants.push(virtualTeamParticipant);
        groups[key].participants.push(virtualTeamParticipant._id);
      }
    }

    const createdSchedules = [];
    const newScheduleNames = [];

    // 为每个组创建或更新赛程
    for (const key in groups) {
      const group = groups[key];
      let genderText = '';
      if (group.gender === 'male') {
        genderText = '男子';
      } else if (group.gender === 'female') {
        genderText = '女子';
      } else if (group.gender === 'mixed') {
        // 如果原本的 ageGroup 已经包含了“混合”，就不再重复添加前缀，或者根据需求留空
        genderText = ''; 
      }
      
      const name = `${group.ageGroup} ${genderText} ${group.event}`.replace(/\s+/g, ' ').trim();
      
      // 区分正式和测试人员，并分别打乱顺序，测试人员永远排在最后
      let normalIds = [];
      let testIds = [];
      
      for (const pId of group.participants) {
         const pObj = participants.find(p => p._id.toString() === pId.toString());
         if (pObj && pObj.isTest) {
            testIds.push(pId);
         } else {
            normalIds.push(pId);
         }
      }
      
      // 使用基于当前项目名称和时间戳的唯一随机种子进行打乱，确保每个项目（即使是同一批人）顺序不同
      const shuffleArray = (arr) => {
        let currentIndex = arr.length, randomIndex;
        while (currentIndex !== 0) {
          // 这里使用真正的随机，因为每次都是完全独立的数组副本
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex--;
          [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
        }
        return arr;
      };
      
      normalIds = shuffleArray(normalIds);
      testIds = shuffleArray(testIds);
      
      // 合并，测试人员垫底
      const shuffled = [...normalIds, ...testIds];

      // 如果是合并项目，需要拆分成独立的子赛程
      const eventConfig = competition.events?.find(e => e.name === (group.sourceEvent || group.event));
      if (eventConfig && eventConfig.isCombinedEvent && eventConfig.subEvents?.length > 0) {
        for (const subEventName of eventConfig.subEvents) {
          if (!subEventName) continue;
          
          const subScheduleName = `${group.ageGroup} ${genderText} ${subEventName}`.replace(/\s+/g, ' ').trim();
          newScheduleNames.push(subScheduleName);
          
          // --- 核心修复：如果是合并项目拆分出的子赛程，也必须再次独立打乱，否则太极拳和太极剑顺序一模一样 ---
          let subNormalIds = [...normalIds];
          let subTestIds = [...testIds];
          subNormalIds = shuffleArray(subNormalIds);
          subTestIds = shuffleArray(subTestIds);
          const subShuffled = [...subNormalIds, ...subTestIds];
          
          let subSchedule = await Schedule.findOne({ 
            competition: competitionId, 
            name: subScheduleName 
          });

          if (subSchedule) {
            if (req.query.overwrite === 'true') {
              subSchedule.participants = subShuffled;
            } else {
              // 保留已有的出场顺序，仅追加新参赛者并移除已退赛者
              const existingIds = subSchedule.participants.map(p => p.toString());
              const finalNormal = [];
              const finalTest = [];
              
              // 分离已有列表中的正式和测试人员
              for (const id of existingIds) {
                 if (shuffled.some(s => s.toString() === id)) {
                    const pObj = participants.find(p => p._id.toString() === id);
                    if (pObj && pObj.isTest) {
                       finalTest.push(id);
                    } else {
                       finalNormal.push(id);
                    }
                 }
              }
              
              // 追加新来的正式和测试人员
              for (const id of normalIds) {
                 if (!finalNormal.includes(id.toString())) {
                    finalNormal.push(id.toString());
                 }
              }
              for (const id of testIds) {
                 if (!finalTest.includes(id.toString())) {
                    finalTest.push(id.toString());
                 }
              }
              
              subSchedule.participants = [...finalNormal, ...finalTest];
            }
            await subSchedule.save();
          } else {
            subSchedule = await Schedule.create({
              competition: competitionId,
              name: subScheduleName,
              type: 'preliminary',
              startTime: competition.startDate || new Date(),
              endTime: competition.startDate || new Date(),
              location: competition.location || '待定',
              participants: shuffled,
              status: 'scheduled'
            });
          }
          createdSchedules.push(subSchedule);
        }
      } else {
        // 普通赛程
        newScheduleNames.push(name);
        let schedule = await Schedule.findOne({ 
          competition: competitionId, 
          name: name 
        });

        if (schedule) {
          if (req.query.overwrite === 'true') {
            schedule.participants = shuffled;
          } else {
            // 保留已有的出场顺序，仅追加新参赛者并移除已退赛者
            const existingIds = schedule.participants.map(p => p.toString());
            const finalNormal = [];
            const finalTest = [];
            
            for (const id of existingIds) {
               if (shuffled.some(s => s.toString() === id)) {
                  const pObj = participants.find(p => p._id.toString() === id);
                  if (pObj && pObj.isTest) {
                     finalTest.push(id);
                  } else {
                     finalNormal.push(id);
                  }
               }
            }
            
            for (const id of normalIds) {
               if (!finalNormal.includes(id.toString())) {
                  finalNormal.push(id.toString());
               }
            }
            for (const id of testIds) {
               if (!finalTest.includes(id.toString())) {
                  finalTest.push(id.toString());
               }
            }
            
            schedule.participants = [...finalNormal, ...finalTest];
          }
          // 也可以选择不更新时间地点，保留之前的设置
          await schedule.save();
        } else {
          // 如果不存在，创建新赛程
          schedule = await Schedule.create({
            competition: competitionId,
            name: name,
            type: 'preliminary', // 默认为预赛
            startTime: competition.startDate || new Date(),
            endTime: competition.startDate || new Date(),
            location: competition.location || '待定',
            participants: shuffled,
            status: 'scheduled'
          });
        }
        createdSchedules.push(schedule);
      }
    }

    // 清理废弃的旧赛程 (例如因为重命名、取消勾选“集体项目”导致旧赛程变成了幽灵赛程)
    if (req.query.overwrite === 'true') {
      await Schedule.deleteMany({
        competition: competitionId,
        name: { $nin: newScheduleNames }
      });
    }

    res.status(200).json({
      success: true,
      count: createdSchedules.length,
      message: `成功生成 ${createdSchedules.length} 个赛程`,
      data: createdSchedules
    });

  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取所有赛程
 * @route   GET /api/competitions/:competitionId/schedules
 * @access  Public
 */
exports.getSchedules = async (req, res, next) => {
  try {
    let query = {};
    
    // 如果URL中包含competitionId，则按比赛ID过滤
    if (req.params.competitionId) {
      query.competition = req.params.competitionId;
    }

    // 过滤
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.type) {
      query.type = req.query.type;
    }

    // 日期过滤：支持原来的 startTime/endTime 范围，以及新的 scheduleDate 字段
    if (req.query.scheduleDate) {
      // 如果明确传了 scheduleDate，就优先以此为准
      query.$or = [
        { scheduleDate: req.query.scheduleDate },
        { startTime: { $gte: new Date(req.query.startDate || req.query.scheduleDate), $lte: new Date(req.query.endDate || req.query.scheduleDate + 'T23:59:59.999Z') } }
      ];
    } else {
      if (req.query.startDate) {
        query.startTime = { ...query.startTime, $gte: new Date(req.query.startDate) };
      }
      if (req.query.endDate) {
        query.endTime = { ...query.endTime, $lte: new Date(req.query.endDate) };
      }
    }

    // 分页
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Schedule.countDocuments(query);

    // 执行查询
    const schedules = await Schedule.find(query)
      .populate('competition', 'name')
      .populate({
        path: 'participants',
        select: 'user type teamName name schoolName grade ageGroup event gender isVirtualTeam teamMembers isTest isCheckedIn checkedInAt checkedInBy', // Select specific fields from Participant
        populate: [
          {
            path: 'user',
            select: 'name email'
          },
          {
            path: 'teamMembers',
            select: 'name schoolName'
          },
          {
            path: 'checkedInBy',
            select: 'name email'
          }
        ]
      })
      .populate('referees', 'name')
      .skip(startIndex)
      .limit(limit)
      .sort({ scheduleDate: 1, timeSlot: 1, court: 1, order: 1, startTime: 1 });

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
      count: schedules.length,
      pagination,
      total,
      data: schedules
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取单个赛程
 * @route   GET /api/competitions/:competitionId/schedules/:id
 * @access  Public
 */
exports.getSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('competition', 'name startDate endDate location')
      .populate({
        path: 'participants',
        select: 'user type teamName status name schoolName grade ageGroup event gender coach isVirtualTeam teamMembers isTest isCheckedIn checkInStatus checkedInAt checkedInBy',
        populate: [
          {
            path: 'user',
            select: 'name email'
          },
          {
            path: 'teamMembers',
            select: 'name schoolName isCheckedIn checkedInAt checkedInBy'
          },
          {
            path: 'checkedInBy',
            select: 'name email'
          }
        ]
      })
      .populate('referees', 'name email');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的赛程`
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    创建赛程
 * @route   POST /api/competitions/:competitionId/schedules
 * @access  Private/Admin/Organizer
 */
exports.createSchedule = async (req, res, next) => {
  try {
    // 设置比赛ID
    req.body.competition = req.params.competitionId;

    // 检查比赛是否存在
    const competition = await Competition.findById(req.params.competitionId);

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.competitionId}的比赛`
      });
    }

    // 检查用户是否是比赛的组织者或管理员/主裁判
    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限为此比赛创建赛程'
      });
    }
    // 集体项目以虚拟队伍保存到赛程中；只引用现有报名选手，不改动其报名资料或照片。
    if (Array.isArray(req.body.collectiveTeams)) {
      const requestedIds = [...new Set(req.body.collectiveTeams.flatMap((team) => Array.isArray(team?.memberIds) ? team.memberIds : []).filter(Boolean).map(String))];
      if (!requestedIds.length) {
        return res.status(400).json({ success: false, message: '请至少为一支集体队伍选择一名已报名选手' });
      }
      const members = await Participant.find({
        _id: { $in: requestedIds },
        competition: req.params.competitionId,
        isVirtualTeam: { $ne: true },
        status: { $ne: 'rejected' }
      }).select('_id name schoolName isTest');
      const memberById = new Map(members.map((member) => [member._id.toString(), member]));
      const virtualTeamIds = [];

      for (const rawTeam of req.body.collectiveTeams) {
        const memberIds = [...new Set((rawTeam?.memberIds || []).map(String))].filter((memberId) => memberById.has(memberId));
        if (!memberIds.length) continue;
        const teamMembers = memberIds.map((memberId) => memberById.get(memberId));
        const teamName = String(rawTeam?.teamName || teamMembers[0]?.schoolName || '未填写代表单位').trim();
        const virtualTeam = await Participant.create({
          competition: req.params.competitionId,
          name: teamName,
          teamName,
          schoolName: teamName,
          event: req.body.name,
          ageGroup: '集体项目',
          gender: 'mixed',
          type: 'team',
          isVirtualTeam: true,
          teamMembers: memberIds,
          status: 'approved',
          isTest: teamMembers.some((member) => member.isTest),
          additionalInfo: { source: 'manual-collective-schedule', createdBy: req.user.id }
        });
        virtualTeamIds.push(virtualTeam._id);
      }

      if (!virtualTeamIds.length) {
        return res.status(400).json({ success: false, message: '所选选手无法建立集体队伍，请重新选择已报名选手' });
      }
      req.body.participants = virtualTeamIds;
    }
    delete req.body.collectiveTeams;
    delete req.body.eventMode;

    // 创建赛程
    const schedule = await Schedule.create(req.body);

    res.status(201).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    更新赛程
 * @route   PUT /api/competitions/:competitionId/schedules/:id
 * @access  Private/Admin/Organizer
 */
exports.updateSchedule = async (req, res, next) => {
  try {
    let schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的赛程`
      });
    }

    // 获取比赛信息
    const competition = await Competition.findById(schedule.competition);

    // 检查权限
    const isOrganizer = competition.organizer?.toString() === req.user.id;
    const isAdmin = req.user.roles?.includes('admin') || req.user.roles?.includes('chief_referee');
    // 检查是否是被分配的裁判 (假设schedule.referees存储的是ID或对象)
    const isAssignedReferee = schedule.referees.some(ref => 
      (ref._id || ref).toString() === req.user.id
    );

    if (!isOrganizer && !isAdmin && !isAssignedReferee) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新此赛程'
      });
    }

    // 不允许更改比赛ID
    delete req.body.competition;

    // 如果是裁判但不是管理员/组织者，限制只能更新状态和备注
    if (!isOrganizer && !isAdmin && isAssignedReferee) {
       const allowedFields = ['status', 'notes'];
       const updates = Object.keys(req.body);
       const hasRestrictedUpdates = updates.some(field => !allowedFields.includes(field));
       
       if (hasRestrictedUpdates) {
         return res.status(403).json({ 
           success: false, 
           message: '裁判只能更新赛程状态和备注' 
         });
       }
    }

    // 检查是否需要随机排序参赛者
    if (req.query.shuffleParticipants === 'true') {
      // 检查用户是否有权限执行此操作
      if (
        competition.organizer?.toString() !== req.user.id &&
        !req.user.roles?.includes('admin') &&
        !req.user.roles?.includes('chief_referee')
      ) {
        return res.status(403).json({
          success: false,
          message: '没有权限随机排序参赛者'
        });
      }

      // 填充参赛者信息，包括event字段
      await schedule.populate({
        path: 'participants',
        populate: {
          path: 'user',
          select: 'name'
        }
      });

      // 按event对参赛者进行分组
      const groupedParticipants = schedule.participants.reduce((acc, p) => {
        const event = p.event || 'default';
        if (!acc[event]) {
          acc[event] = [];
        }
        acc[event].push(p);
        return acc;
      }, {});

      // 对每个分组进行随机排序
      const shuffledParticipants = [];
      for (const event in groupedParticipants) {
        const group = groupedParticipants[event];
        // Fisher-Yates shuffle algorithm
        for (let i = group.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [group[i], group[j]] = [group[j], group[i]];
        }
        shuffledParticipants.push(...group);
      }

      // 更新赛程的参赛者列表
      schedule.participants = shuffledParticipants.map(p => p._id);
      await schedule.save();
    }

    schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    批量更新赛程排序
 * @route   PUT /api/competitions/:competitionId/schedules/bulk/order
 * @access  Private/Admin/Organizer
 */
exports.updateSchedulesOrder = async (req, res, next) => {
  try {
    const { schedules } = req.body;
    
    if (!schedules || !Array.isArray(schedules)) {
      return res.status(400).json({
        success: false,
        message: '请提供包含赛程ID和排序的数组'
      });
    }

    const competition = await Competition.findById(req.params.competitionId);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.competitionId}的比赛`
      });
    }

    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }

    const bulkOps = schedules.map(item => {
      const updateFields = { order: item.order };
      if (item.scheduleDate !== undefined) updateFields.scheduleDate = item.scheduleDate;
      if (item.timeSlot !== undefined) updateFields.timeSlot = item.timeSlot;
      if (item.court !== undefined) updateFields.court = item.court;

      return {
        updateOne: {
          filter: { _id: item.id, competition: req.params.competitionId },
          update: updateFields
        }
      };
    });

    if (bulkOps.length > 0) {
      await Schedule.bulkWrite(bulkOps);
    }

    res.status(200).json({
      success: true,
      message: '排序更新成功'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    删除赛程
 * @route   DELETE /api/competitions/:competitionId/schedules/:id
 * @access  Private/Admin/Organizer
 */
exports.deleteSchedule = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的赛程`
      });
    }

    // 获取比赛信息
    const competition = await Competition.findById(schedule.competition);

    // 检查用户是否是比赛的组织者或管理员/主裁判
    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除此赛程'
      });
    }

    // 修复 schedule.remove is not a function 错误
    // Mongoose 较新版本推荐使用 deleteOne()
    await schedule.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    更新赛程状态
 * @route   PUT /api/competitions/:competitionId/schedules/:id/status
 * @access  Private/Admin/Organizer/Referee
 */
exports.updateScheduleStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: '请提供状态'
      });
    }

    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的赛程`
      });
    }

    // 更新状态
    schedule.status = status;
    await schedule.save();

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    随机分配参赛者到赛程
 * @route   POST /api/competitions/:competitionId/schedules/:id/randomize
 * @access  Private/Organizer
 */
exports.randomizeParticipants = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的赛程`
      });
    }

    // 获取比赛的所有参赛者
    const Participant = require('../models/Participant');
    const participants = await Participant.find({ 
      competition: req.params.competitionId,
      status: 'approved'
    });

    if (participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有已审核通过的参赛者可以分配'
      });
    }

    // 随机打乱参赛者顺序
    const shuffledParticipants = participants.sort(() => Math.random() - 0.5);
    
    // 更新赛程的参赛者列表
    schedule.participants = shuffledParticipants.map(p => p._id);
    await schedule.save();

    res.status(200).json({
      success: true,
      data: schedule,
      message: `已成功随机分配${shuffledParticipants.length}名参赛者到赛程`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    一键同步/追加新参赛者到现有赛程（不会打乱已有顺序）
 * @route   POST /api/competitions/:competitionId/schedules/sync-new
 * @access  Private/Admin/Organizer
 */
exports.syncNewParticipants = async (req, res, next) => {
  try {
    const { competitionId } = req.params;
    const competition = await Competition.findById(competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛未找到' });

    // 同步只允许追加到已存在的日程，绝不自动创建新项目。
    const schedules = await Schedule.find({ competition: competitionId }).populate({
      path: 'participants',
      populate: { path: 'teamMembers', select: 'name schoolName' }
    });
    if (schedules.length === 0) {
      return res.status(400).json({ success: false, message: '当前没有日程。请先使用「导入日程表（Excel）」建立日程，再同步新选手。' });
    }

    const participants = await Participant.find({
      competition: competitionId,
      status: 'approved',
      isVirtualTeam: { $ne: true }
    });
    const alreadyScheduled = new Set();
    schedules.forEach((schedule) => schedule.participants.forEach((participant) => {
      if (participant?.isVirtualTeam) {
        (participant.teamMembers || []).forEach((member) => alreadyScheduled.add(member._id.toString()));
      } else if (participant?._id) {
        alreadyScheduled.add(participant._id.toString());
      }
    }));

    let appendedCount = 0;
    let unmatchedCount = 0;
    for (const participant of participants) {
      if (alreadyScheduled.has(participant._id.toString())) continue;
      const targetSchedule = schedules.find((schedule) => participantMatchesExcelSchedule(participant, { name: schedule.name }));
      if (!targetSchedule) {
        unmatchedCount += 1;
        continue;
      }

      const parsed = parseExcelScheduleName(targetSchedule.name);
      if (parsed.event.includes('集体')) {
        const schoolName = participant.schoolName || '未填写代表单位';
        let team = targetSchedule.participants.find((item) => item?.isVirtualTeam && item.schoolName === schoolName);
        if (team) {
          const memberIds = new Set((team.teamMembers || []).map((member) => member._id.toString()));
          if (!memberIds.has(participant._id.toString())) {
            await Participant.findByIdAndUpdate(team._id, { $addToSet: { teamMembers: participant._id } });
            appendedCount += 1;
          }
        } else {
          team = await Participant.create({
            competition: competitionId,
            name: schoolName,
            schoolName,
            event: '集体项目',
            ageGroup: '混合集体',
            gender: 'mixed',
            type: 'team',
            isVirtualTeam: true,
            teamMembers: [participant._id],
            status: 'approved'
          });
          targetSchedule.participants.push(team._id);
          await targetSchedule.save();
          appendedCount += 1;
        }
      } else {
        targetSchedule.participants.push(participant._id);
        await targetSchedule.save();
        alreadyScheduled.add(participant._id.toString());
        appendedCount += 1;
      }
    }

    res.status(200).json({
      success: true,
      message: appendedCount > 0
        ? `已按已导入的日程规则追加 ${appendedCount} 名新选手；未创建任何新项目。${unmatchedCount ? `另有 ${unmatchedCount} 名选手没有对应日程。` : ''}`
        : `没有可追加的新选手；未创建任何新项目。${unmatchedCount ? `有 ${unmatchedCount} 名选手没有对应日程。` : ''}`
    });
  } catch (error) {
    next(error);
  }
};
/**
 * @desc    清空比赛的所有赛程
 * @route   DELETE /api/competitions/:competitionId/schedules
 * @access  Private/Admin/Organizer
 */
exports.clearAllSchedules = async (req, res, next) => {
  try {
    const { competitionId } = req.params;

    const competition = await Competition.findById(competitionId);
    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${competitionId}的比赛`
      });
    }

    if (
      competition.organizer?.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }

    // 删除该比赛下的所有赛程
    await Schedule.deleteMany({ competition: competitionId });

    // 同时清理废弃的虚拟队伍记录，以保持数据库整洁
    const Participant = require('../models/Participant');
    await Participant.deleteMany({ competition: competitionId, isVirtualTeam: true });

    res.status(200).json({
      success: true,
      message: '所有赛程及相关的虚拟队伍已成功清空'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    查询尚未编入任何赛程的报名选手
// @route   GET /api/competitions/:competitionId/schedules/unassigned-participants
// @access  Private/Admin
exports.getUnassignedParticipants = async (req, res, next) => {
  try {
    const schedules = await Schedule.find({ competition: req.params.competitionId }).select('participants').lean();
    const scheduledEntryIds = schedules.flatMap((schedule) => schedule.participants || []);
    const scheduledEntries = await Participant.find({ _id: { $in: scheduledEntryIds } })
      .select('_id isVirtualTeam teamMembers')
      .lean();

    // 集体项目在赛程中保存的是虚拟队伍，因此必须把其真实队员也视为“已编排”。
    const scheduledIds = new Set();
    scheduledEntries.forEach((entry) => {
      if (entry.isVirtualTeam) {
        (entry.teamMembers || []).forEach((memberId) => scheduledIds.add(memberId.toString()));
      } else {
        scheduledIds.add(entry._id.toString());
      }
    });

    const eligibleParticipants = await Participant.find({
      competition: req.params.competitionId,
      isVirtualTeam: { $ne: true },
      status: { $ne: 'rejected' }
    })
      .select('name schoolName ageGroup event gender status isTest')
      .sort({ schoolName: 1, name: 1 })
      .lean();
    const unassignedParticipants = eligibleParticipants.filter((participant) => !scheduledIds.has(participant._id.toString()));

    res.status(200).json({
      success: true,
      data: unassignedParticipants,
      summary: {
        totalEligible: eligibleParticipants.length,
        scheduledCount: eligibleParticipants.length - unassignedParticipants.length,
        unassignedCount: unassignedParticipants.length,
        scheduleCount: schedules.length
      }
    });
  } catch (error) {
    next(error);
  }
};
// @desc    获取可手动加入当前赛程的已报名选手
// @route   GET /api/competitions/:competitionId/schedules/:id/available-participants
// @access  Private/Admin
exports.getAvailableParticipants = async (req, res, next) => {
  try {
    const schedule = await Schedule.findOne({
      _id: req.params.id,
      competition: req.params.competitionId
    }).select('participants');

    if (!schedule) {
      return res.status(404).json({ success: false, message: '未找到当前比赛的赛程' });
    }

    const existingIds = schedule.participants.map((participant) => participant.toString());
    const participants = await Participant.find({
      competition: req.params.competitionId,
      isVirtualTeam: { $ne: true },
      status: { $ne: 'rejected' },
      _id: { $nin: existingIds }
    })
      .select('name schoolName ageGroup event gender status isTest')
      .sort({ schoolName: 1, name: 1 })
      .lean();

    res.status(200).json({ success: true, data: participants });
  } catch (error) {
    next(error);
  }
};

// @desc    手动把已报名选手加入当前赛程
// @route   POST /api/competitions/:competitionId/schedules/:id/participants
// @access  Private/Admin
exports.addParticipantsToSchedule = async (req, res, next) => {
  try {
    const participantIds = Array.isArray(req.body.participantIds)
      ? [...new Set(req.body.participantIds.map((id) => String(id)).filter(Boolean))]
      : [];

    if (participantIds.length === 0) {
      return res.status(400).json({ success: false, message: '请至少选择一名选手' });
    }

    const schedule = await Schedule.findOne({
      _id: req.params.id,
      competition: req.params.competitionId
    });
    if (!schedule) {
      return res.status(404).json({ success: false, message: '未找到当前比赛的赛程' });
    }

    const candidates = await Participant.find({
      _id: { $in: participantIds },
      competition: req.params.competitionId,
      isVirtualTeam: { $ne: true },
      status: { $ne: 'rejected' }
    }).select('_id isTest');

    const existingIds = new Set(schedule.participants.map((participant) => participant.toString()));
    const selectedById = new Map(candidates.map((participant) => [participant._id.toString(), participant]));
    const additions = participantIds
      .map((participantId) => selectedById.get(participantId))
      .filter((participant) => participant && !existingIds.has(participant._id.toString()));

    if (additions.length === 0) {
      return res.status(200).json({
        success: true,
        addedCount: 0,
        message: '所选选手已在当前赛程中，未重复加入'
      });
    }

    // 保持测试人员始终在名单末尾；手动加入的正常选手追加在正式名单之后。
    const currentParticipants = await Participant.find({ _id: { $in: schedule.participants } }).select('_id isTest');
    const currentById = new Map(currentParticipants.map((participant) => [participant._id.toString(), participant]));
    const currentNormal = schedule.participants.filter((participantId) => !currentById.get(participantId.toString())?.isTest);
    const currentTests = schedule.participants.filter((participantId) => currentById.get(participantId.toString())?.isTest);
    const newNormal = additions.filter((participant) => !participant.isTest).map((participant) => participant._id);
    const newTests = additions.filter((participant) => participant.isTest).map((participant) => participant._id);

    schedule.participants = [...currentNormal, ...newNormal, ...currentTests, ...newTests];
    await schedule.save();

    const updatedSchedule = await Schedule.findById(schedule._id).populate({
      path: 'participants',
      select: 'user type teamName status name schoolName grade ageGroup event gender isVirtualTeam teamMembers isTest',
      populate: { path: 'user', select: 'name email' }
    });

    res.status(200).json({
      success: true,
      addedCount: additions.length,
      message: `已加入 ${additions.length} 名选手到当前赛程`,
      data: updatedSchedule
    });
  } catch (error) {
    next(error);
  }
};
// @desc    将新录入的参赛者追加到指定赛程中
// @route   POST /api/schedules/:id/append-new
// @access  Private/Admin
exports.appendNewParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 我们允许前端传 scheduleName 过来做模糊追加（针对某些无法直接传 ID 的情况）
    // 或者直接使用 req.params.id 查询
    
    // 如果是前端批量追加（全局按钮），我们提供一个新的 API `syncNewParticipants`
    // 这里保留针对单赛程的逻辑

    // 必须 populate participants，这样才能知道已有人员是不是 isTest
    const schedule = await Schedule.findById(req.params.id).populate('participants');
    if (!schedule) {
      return res.status(404).json({ success: false, error: '找不到赛程' });
    }

    // 从现有的 participants 中获取至少一个有效的样本，用来推断该赛程的项目、组别等信息
    let sampleParticipant = schedule.participants.find(p => p && p.event);
    if (!sampleParticipant) {
      return res.status(400).json({ success: false, error: '当前赛程为空或数据异常，无法自动推断项目信息，请重新生成赛程' });
    }

    let scheduleEvent = sampleParticipant.event;
    let isCollective = schedule.name.includes('集体') || (sampleParticipant.ageGroup && sampleParticipant.ageGroup.includes('混合集体'));

    let query = { 
      competition: schedule.competition,
      event: scheduleEvent // 精确匹配该项目
    };

    if (!isCollective) {
      // 非集体项目，必须严格匹配组别和性别
      let scheduleAgeGroup = sampleParticipant.ageGroup || sampleParticipant.grade || '';
      let cleanAgeGroup = scheduleAgeGroup.replace('男子', '').replace('女子', '').replace('男', '').replace('女', '');
      query.ageGroup = { $regex: new RegExp(cleanAgeGroup, 'i') };
      
      let scheduleGender = sampleParticipant.gender;
      if (scheduleGender === 'male' || scheduleGender === '男' || schedule.name.includes('男')) {
         query.gender = { $in: ['male', '男'] };
      } else if (scheduleGender === 'female' || scheduleGender === '女' || schedule.name.includes('女')) {
         query.gender = { $in: ['female', '女'] };
      }
    }

    const finalMatchingParticipants = await Participant.find(query);
    
    // 获取当前赛程里已有的 participant IDs (因为已经 populate，所以 p 就是 Participant 对象或其 ObjectId)
    const existingParticipantIds = schedule.participants.map(p => {
      if (!p) return null;
      return p._id ? p._id.toString() : p.toString();
    }).filter(Boolean);
    
    let newParticipants = finalMatchingParticipants.filter(p => !existingParticipantIds.includes(p._id.toString()));
    
    if (newParticipants.length === 0) {
      // 容错：如果是因为年龄组别正则匹配不到，放宽查询再试一次
      if (!isCollective) {
         let fallbackQuery = {
           competition: schedule.competition,
           event: scheduleEvent
         };
         let scheduleGender = sampleParticipant.gender;
         if (scheduleGender === 'male' || scheduleGender === '男' || schedule.name.includes('男')) {
            fallbackQuery.gender = { $in: ['male', '男'] };
         } else if (scheduleGender === 'female' || scheduleGender === '女' || schedule.name.includes('女')) {
            fallbackQuery.gender = { $in: ['female', '女'] };
         }
         const fallbackParticipants = await Participant.find(fallbackQuery);
         let scheduleAgeGroup = sampleParticipant.ageGroup || sampleParticipant.grade || '';
         let cleanAgeGroup = scheduleAgeGroup.replace('男子', '').replace('女子', '').replace('男', '').replace('女', '');
         
         const fuzzyMatching = fallbackParticipants.filter(p => {
           const pAge = p.ageGroup || p.grade || '';
           return pAge.includes(cleanAgeGroup) || cleanAgeGroup.includes(pAge);
         });
         newParticipants = fuzzyMatching.filter(p => !existingParticipantIds.includes(p._id.toString()));
      }
      
      if (newParticipants.length === 0) {
        return res.status(200).json({ success: true, message: '没有发现新录入的参赛者', addedCount: 0, data: schedule });
      }
    }

    const normalNew = newParticipants.filter(p => !p.isTest);
    const testNew = newParticipants.filter(p => p.isTest);

    // 从已有的 schedule.participants 里分离出普通人员和测试人员
    const existingNormal = schedule.participants.filter(p => p && p._id && !p.isTest);
    const existingTest = schedule.participants.filter(p => p && p._id && p.isTest);

    // 重新拼装：由于我们要给 schedule 重新赋值，我们要把 populate 的对象还原成 ID 字符串
    let finalParticipants = existingNormal.map(p => p._id);
    
    normalNew.forEach(p => {
      finalParticipants.push(p._id);
    });
    
    existingTest.forEach(p => {
      finalParticipants.push(p._id);
    });

    testNew.forEach(p => {
      finalParticipants.push(p._id);
    });

    schedule.participants = finalParticipants;
    await schedule.save();

    const populatedSchedule = await Schedule.findById(req.params.id)
      .populate('competition', 'name startDate endDate location')
      .populate({
        path: 'participants',
        select: 'user type teamName status name schoolName grade ageGroup event gender coach isVirtualTeam teamMembers isTest',
        populate: [
          {
            path: 'user',
            select: 'name email'
          },
          {
            path: 'teamMembers',
            select: 'name'
          }
        ]
      });

    res.status(200).json({
      success: true,
      message: `成功追加了 ${newParticipants.length} 名新参赛者`,
      addedCount: newParticipants.length,
      data: populatedSchedule
    });

  } catch (error) {
    console.error('追加新参赛者失败:', error);
    res.status(500).json({ success: false, error: '追加新参赛者失败' });
  }
};

function normalizeExcelScheduleEvent(value) {
  const event = String(value || '').replace(/（.*?）/g, '').trim();
  return ({ '棍': '棍术', '刀': '刀术', '剑': '剑术' })[event] || event;
}

function normalizeExcelScheduleGender(value) {
  if (value === 'male' || value === '男') return '男';
  if (value === 'female' || value === '女') return '女';
  return '';
}

function parseExcelScheduleName(name) {
  const displayName = String(name || '').trim();
  const cleanName = displayName.replace(/（.*?）/g, '');
  const gender = cleanName.startsWith('女子') ? '女' : cleanName.startsWith('男子') ? '男' : '';
  const ages = [...cleanName.matchAll(/U(\d+)/g)].map((match) => match[1]);
  const event = cleanName
    .replace(/^(男子|女子)/, '')
    .replace(/U\d+(?:[-/]U\d+)*组?/g, '')
    .trim();
  return { displayName, gender, ages, event: normalizeExcelScheduleEvent(event) };
}

function participantMatchesExcelSchedule(participant, scheduleItem) {
  const parsed = parseExcelScheduleName(scheduleItem.name);
  const participantAge = String(participant.ageGroup || participant.grade || '').match(/U(\d+)/)?.[1];
  const participantGender = normalizeExcelScheduleGender(participant.gender);
  const events = [participant.event, participant.manualEventGroup]
    .filter(Boolean)
    .map(normalizeExcelScheduleEvent);
  const isCollective = parsed.event.includes('集体') || events.some((event) => event.includes('集体'));

  if (isCollective) return events.some((event) => event.includes('集体'));
  return Boolean(
    parsed.gender === participantGender
    && parsed.ages.includes(participantAge)
    && events.includes(parsed.event)
  );
}

function normalizeRosterText(value) {
  return String(value || '')
    .replace(/[（(]\d+(?:人|队)[）)]/g, '')
    .replace(/[\s　·・.．、，,()（）【】\[\]]/g, '')
    .trim()
    .toLowerCase();
}

function rosterRowMatchesSchedule(row, scheduleItem) {
  const rowScheduleName = normalizeRosterText(row.scheduleName);
  const scheduleName = normalizeRosterText(scheduleItem.name);
  if (rowScheduleName && rowScheduleName === scheduleName) return true;
  const parsed = parseExcelScheduleName(scheduleItem.name);
  const rowAge = String(row.ageGroup || '').match(/U(\d+)/)?.[1];
  const rowGender = normalizeExcelScheduleGender(row.gender);
  const rowEvent = normalizeExcelScheduleEvent(row.event);
  return Boolean(rowEvent && rowEvent === parsed.event && (!rowGender || rowGender === parsed.gender) && (!rowAge || parsed.ages.includes(rowAge)));
}

function buildRosterAssignments(participants, items, rawRoster) {
  const roster = Array.isArray(rawRoster) ? rawRoster.slice(0, 2000) : [];
  const participantIdsBySchedule = new Map();
  const rosterScheduleIndexes = new Set();
  const assignedIds = new Set();
  const rosterTeamsBySchedule = new Map();
  const summary = { providedRows: roster.length, autoAssignedEntries: 0, virtualImportEntries: 0, ambiguousRows: 0, unmatchedRows: 0, alreadyMatchedRows: 0 };

  roster.forEach((row) => {
    const name = normalizeRosterText(row?.name);
    if (!name) return;
    const targets = items.filter((item) => rosterRowMatchesSchedule(row || {}, item));
    if (targets.length !== 1) { summary.unmatchedRows += 1; return; }
    const target = targets[0];
    rosterScheduleIndexes.add(target.index);
    const rowGender = normalizeExcelScheduleGender(row.gender);
    const rowAge = String(row.ageGroup || '').match(/U(\d+)/)?.[1];
    const rowSchool = normalizeRosterText(row.schoolName);
    const rowEvent = normalizeExcelScheduleEvent(row.event);
    const parsedTarget = parseExcelScheduleName(target.name);
    const teamKey = String(row.teamKey || `${target.index}|${row.teamName || row.schoolName || '未填写代表单位'}`).trim();
    if (!rosterTeamsBySchedule.has(target.index)) rosterTeamsBySchedule.set(target.index, new Map());
    const teams = rosterTeamsBySchedule.get(target.index);
    if (!teams.has(teamKey)) teams.set(teamKey, {
      teamName: String(row.teamName || row.schoolName || '未填写代表单位').trim(),
      memberIds: [],
      externalMembers: []
    });
    const team = teams.get(teamKey);
    const externalMember = {
      name: String(row.name || '').trim(),
      schoolName: String(row.schoolName || team.teamName || '').trim(),
      ageGroup: rowAge ? `U${rowAge}` : String(row.ageGroup || '').trim(),
      gender: rowGender || 'mixed',
      event: String(row.event || target.name || '').trim()
    };
    const candidates = participants.filter((participant) => normalizeRosterText(participant.name) === name && !assignedIds.has(participant._id.toString()));
    if (candidates.length === 0) {
      team.externalMembers.push(externalMember);
      summary.virtualImportEntries += 1;
      return;
    }
    const scored = candidates.map((participant) => {
      const participantAge = String(participant.ageGroup || participant.grade || '').match(/U(\d+)/)?.[1];
      const participantEvents = [participant.event, participant.manualEventGroup].filter(Boolean).map(normalizeExcelScheduleEvent);
      let score = 0;
      if (rowSchool && normalizeRosterText(participant.schoolName) === rowSchool) score += 8;
      if (rowGender && normalizeExcelScheduleGender(participant.gender) === rowGender) score += 4;
      if (rowAge && participantAge === rowAge) score += 4;
      if (rowEvent && participantEvents.includes(rowEvent)) score += 6;
      if (participantEvents.includes(parsedTarget.event)) score += 5;
      return { participant, score };
    });
    const highestScore = Math.max(...scored.map((candidate) => candidate.score));
    const best = scored.filter((candidate) => candidate.score === highestScore);
    if (best.length > 1) {
      team.externalMembers.push(externalMember);
      summary.ambiguousRows += 1;
      summary.virtualImportEntries += 1;
      return;
    }
    const participant = best[0].participant;
    const participantId = participant._id.toString();
    assignedIds.add(participantId);
    if (!participantIdsBySchedule.has(target.index)) participantIdsBySchedule.set(target.index, []);
    participantIdsBySchedule.get(target.index).push(participantId);
    team.memberIds.push(participantId);
    summary.autoAssignedEntries += 1;
  });

  return { participantIdsBySchedule, rosterScheduleIndexes, rosterTeamsBySchedule, summary };
}
async function buildExcelSchedulePreview(competitionId, rawItems, rawRoster = []) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 300) {
    const error = new Error('请提供 1 至 300 个有效日程项目');
    error.statusCode = 400;
    throw error;
  }

  const participants = await Participant.find({
    competition: competitionId,
    isVirtualTeam: { $ne: true },
    status: { $ne: 'rejected' }
  }).select('name schoolName event manualEventGroup ageGroup grade gender status isTest');

  const items = rawItems.map((raw, index) => {
    const name = String(raw?.name || '').trim();
    const scheduleDate = String(raw?.scheduleDate || '').trim();
    const court = String(raw?.court || '').trim();
    const timeSlot = String(raw?.timeSlot || '').trim();
    const exactTime = String(raw?.exactTime || '').trim();
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate) || !court || !timeSlot) {
      const error = new Error(`第 ${index + 1} 个日程缺少名称、日期、场地或时段`);
      error.statusCode = 400;
      throw error;
    }
    const matches = participants.filter((participant) => participantMatchesExcelSchedule(participant, { name }));
    const approvedCount = matches.filter((participant) => participant.status === 'approved').length;
    const pendingCount = matches.filter((participant) => participant.status === 'pending').length;
    return {
      index,
      name,
      scheduleDate,
      court,
      timeSlot,
      exactTime,
      matchedCount: matches.length,
      approvedCount,
      pendingCount,
      participants: matches.map((participant) => ({
        id: participant._id,
        name: participant.name,
        schoolName: participant.schoolName || '-',
        status: participant.status
      }))
    };
  });

  const rosterResult = buildRosterAssignments(participants, items, rawRoster);
  if (rosterResult.summary.providedRows > 0) {
    items.forEach((item) => {
      if (!rosterResult.rosterScheduleIndexes.has(item.index)) return;
      const ids = new Set(rosterResult.participantIdsBySchedule.get(item.index) || []);
      const matches = participants.filter((participant) => ids.has(participant._id.toString()));
      item.participants = matches.map((participant) => ({ id: participant._id, name: participant.name, schoolName: participant.schoolName || '-', status: participant.status }));
      item.matchedCount = matches.length;
      item.approvedCount = matches.filter((participant) => participant.status === 'approved').length;
      item.pendingCount = matches.filter((participant) => participant.status === 'pending').length;
      item.rosterAutoAssignedCount = matches.length;
      item.rosterTeams = [...(rosterResult.rosterTeamsBySchedule.get(item.index)?.values() || [])];
    });
  }
  const matchedIds = new Set(items.flatMap((item) => item.participants.map((participant) => participant.id.toString())));
  const unmatchedParticipants = participants
    .filter((participant) => !matchedIds.has(participant._id.toString()))
    .map((participant) => ({
      id: participant._id,
      name: participant.name,
      schoolName: participant.schoolName || '-',
      ageGroup: participant.ageGroup || participant.grade || '-',
      gender: normalizeExcelScheduleGender(participant.gender) || '-',
      event: participant.event || '-',
      status: participant.status
    }));

  return {
    items,
    summary: {
      scheduleCount: items.length,
      participantEntries: participants.length,
      matchedEntries: matchedIds.size,
      unmatchedEntries: unmatchedParticipants.length,
      approvedUnmatchedEntries: unmatchedParticipants.filter((participant) => participant.status === 'approved').length,
      roster: rosterResult.summary
    },
    unmatchedParticipants
  };
}

async function buildCollectiveRosterPreview(competitionId, rawRoster) {
  const roster = Array.isArray(rawRoster) ? rawRoster.slice(0, 2000) : [];
  if (!roster.length) {
    const error = new Error('未在集体项目 Excel 中识别到队员名单');
    error.statusCode = 400;
    throw error;
  }

  const [participants, schedules] = await Promise.all([
    Participant.find({ competition: competitionId, isVirtualTeam: { $ne: true }, status: { $ne: 'rejected' } }).select('name schoolName event manualEventGroup ageGroup grade gender status isTest'),
    Schedule.find({ competition: competitionId }).select('_id name participants')
  ]);
  const sourceProjectNames = [...new Set(roster.map((row) => String(row?.scheduleName || '').trim()).filter(Boolean))];
  if (!sourceProjectNames.length) {
    const error = new Error('Excel 中缺少集体项目名称，无法判断每支队伍应归入哪个项目');
    error.statusCode = 400;
    throw error;
  }

  const items = sourceProjectNames.map((name, index) => {
    const sameNameSchedules = schedules.filter((schedule) => normalizeRosterText(schedule.name) === normalizeRosterText(name));
    return {
      index,
      name,
      scheduleId: sameNameSchedules.length === 1 ? sameNameSchedules[0]._id.toString() : null,
      willCreate: sameNameSchedules.length === 0,
      ambiguous: sameNameSchedules.length > 1
    };
  });
  const rosterResult = buildRosterAssignments(participants, items, roster);
  const ambiguousProjectNames = items.filter((item) => item.ambiguous).map((item) => item.name);

  return {
    items: items.map((item) => {
      const memberIds = rosterResult.participantIdsBySchedule.get(item.index) || [];
      const rosterTeams = [...(rosterResult.rosterTeamsBySchedule.get(item.index)?.values() || [])];
      return {
        scheduleId: item.scheduleId,
        name: item.name,
        willCreate: item.willCreate,
        ambiguous: item.ambiguous,
        matchedCount: memberIds.length,
        directImportMemberCount: rosterTeams.reduce((sum, team) => sum + (team.externalMembers || []).length, 0),
        importableMemberCount: rosterTeams.reduce((sum, team) => sum + team.memberIds.length + (team.externalMembers || []).length, 0),
        teamCount: rosterTeams.length,
        rosterTeams: rosterTeams.map((team) => ({ teamName: team.teamName, memberIds: team.memberIds, externalMembers: team.externalMembers || [], memberCount: team.memberIds.length + (team.externalMembers || []).length, matchedMemberCount: team.memberIds.length, directImportMemberCount: (team.externalMembers || []).length }))
      };
    }),
    summary: {
      sourceProjectCount: sourceProjectNames.length,
      existingProjectCount: items.filter((item) => item.scheduleId).length,
      newProjectCount: items.filter((item) => item.willCreate).length,
      providedRows: rosterResult.summary.providedRows,
      matchedMembers: rosterResult.summary.autoAssignedEntries,
      directImportMembers: rosterResult.summary.virtualImportEntries,
      unmatchedMembers: rosterResult.summary.unmatchedRows,
      ambiguousMembers: rosterResult.summary.ambiguousRows,
      ambiguousProjectNames
    }
  };
}

function collectivePendingScheduleTimes(competition) {
  const start = new Date(competition.startDate || Date.now());
  if (Number.isNaN(start.getTime())) return { startTime: new Date(), endTime: new Date(Date.now() + 60 * 60 * 1000) };
  start.setHours(9, 0, 0, 0);
  return { startTime: start, endTime: new Date(start.getTime() + 60 * 60 * 1000) };
}

exports.previewCollectiveRosterImport = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });
    const preview = await buildCollectiveRosterPreview(req.params.competitionId, req.body?.roster);
    res.status(200).json({ success: true, data: preview });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

exports.importCollectiveRoster = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });
    const preview = await buildCollectiveRosterPreview(req.params.competitionId, req.body?.roster);
    if (preview.summary.ambiguousProjectNames.length) {
      return res.status(400).json({ success: false, message: `存在同名集体赛程，无法安全更新：${preview.summary.ambiguousProjectNames.join('、')}` });
    }
    const targets = preview.items.filter((item) => item.teamCount > 0 && item.importableMemberCount > 0);
    if (!targets.length) return res.status(400).json({ success: false, message: '没有可导入的集体队伍；请确认 Excel 中每行均有集体项目名称、单位和队员姓名' });

    let createdScheduleCount = 0;
    let createdExcelMemberCount = 0;
    for (const item of targets) {
      const virtualTeamIds = [];
      for (const team of item.rosterTeams) {
        const memberIds = [...(team.memberIds || [])];
        for (const member of (team.externalMembers || [])) {
          const virtualMember = await Participant.create({
            competition: req.params.competitionId,
            name: member.name,
            schoolName: member.schoolName || team.teamName,
            event: item.name,
            manualEventGroup: item.name,
            ageGroup: member.ageGroup || '集体项目',
            gender: member.gender || 'mixed',
            type: 'individual',
            isVirtualTeam: true,
            status: 'approved',
            additionalInfo: { source: 'collective-roster-excel', importedAsCollectiveMember: true, sourceTeamName: team.teamName }
          });
          memberIds.push(virtualMember._id);
          createdExcelMemberCount += 1;
        }
        if (!memberIds.length) continue;
        const virtualTeam = await Participant.create({
          competition: req.params.competitionId,
          name: team.teamName,
          teamName: team.teamName,
          schoolName: team.teamName,
          event: item.name,
          ageGroup: '集体项目',
          gender: 'mixed',
          type: 'team',
          isVirtualTeam: true,
          teamMembers: memberIds,
          status: 'approved'
        });
        virtualTeamIds.push(virtualTeam._id);
      }
      if (item.scheduleId) {
        await Schedule.findByIdAndUpdate(item.scheduleId, { $set: { participants: virtualTeamIds } });
      } else {
        const times = collectivePendingScheduleTimes(competition);
        await Schedule.create({
          competition: req.params.competitionId,
          name: item.name,
          description: '由集体项目名单 Excel 导入；请管理员再编排日期、场地和时段。',
          type: 'other',
          startTime: times.startTime,
          endTime: times.endTime,
          location: '待编排',
          scheduleDate: '',
          timeSlot: '',
          exactTime: '',
          court: '',
          participants: virtualTeamIds
        });
        createdScheduleCount += 1;
      }
    }
    res.status(201).json({
      success: true,
      message: `已导入 ${targets.reduce((sum, item) => sum + item.teamCount, 0)} 支集体队伍；更新 ${targets.filter((item) => item.scheduleId).length} 个同名项目，新建 ${createdScheduleCount} 个待编排项目。其中 ${createdExcelMemberCount} 名为依 Excel 新建的集体成员；原始个人报名资料和照片均未改动。`,
      data: preview.summary
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};
/** 预览 Excel 日程与当前报名数据；只读，不写入数据库。 */
exports.previewExcelScheduleImport = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });
    const preview = await buildExcelSchedulePreview(req.params.competitionId, req.body?.items, req.body?.roster);
    res.status(200).json({ success: true, data: preview });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};

/** 管理员确认后创建 Excel 日程；已有赛程时拒绝导入，避免重复或覆盖。 */
exports.importExcelSchedule = async (req, res, next) => {
  try {
    const competitionId = req.params.competitionId;
    const competition = await Competition.findById(competitionId);
    if (!competition) return res.status(404).json({ success: false, message: '比赛不存在' });
    const existingCount = await Schedule.countDocuments({ competition: competitionId });
    if (existingCount > 0) return res.status(409).json({ success: false, message: '当前比赛已有赛程。请先确认或清空旧赛程，避免重复导入。' });

    const preview = await buildExcelSchedulePreview(competitionId, req.body?.items, req.body?.roster);
    const sourceParticipants = await Participant.find({
      competition: competitionId,
      isVirtualTeam: { $ne: true },
      status: { $ne: 'rejected' }
    });
    const unmatchedIds = new Set(preview.unmatchedParticipants.map((participant) => participant.id.toString()));
    const participantsById = new Map(sourceParticipants.map((participant) => [participant._id.toString(), participant]));
    const manualParticipantsBySchedule = new Map();
    for (const [participantId, rawIndex] of Object.entries(req.body?.assignments || {})) {
      const scheduleIndex = Number(rawIndex);
      if (!unmatchedIds.has(participantId) || !participantsById.has(participantId) || !preview.items.some((item) => item.index === scheduleIndex)) {
        return res.status(400).json({ success: false, message: '手动安排数据已失效，请重新上传并预览日程表。' });
      }
      if (!manualParticipantsBySchedule.has(scheduleIndex)) manualParticipantsBySchedule.set(scheduleIndex, new Set());
      manualParticipantsBySchedule.get(scheduleIndex).add(participantId);
    }

    const schedulesToCreate = [];

    for (const item of preview.items) {
      const parsed = parseExcelScheduleName(item.name);
      const manualParticipantIds = manualParticipantsBySchedule.get(item.index) || new Set();
      const previewParticipantIds = new Set(item.participants.map((participant) => participant.id.toString()));
      const matches = sourceParticipants.filter((participant) => previewParticipantIds.has(participant._id.toString()) || manualParticipantIds.has(participant._id.toString()));
      const isCollective = parsed.event.includes('集体');
      let participantIds = matches.map((participant) => participant._id);

      if (isCollective) {
        const rosterTeams = Array.isArray(item.rosterTeams) ? item.rosterTeams : [];
        const teamsBySchool = new Map();
        if (rosterTeams.length > 0) {
          rosterTeams.forEach((team, index) => {
            const members = matches.filter((participant) => team.memberIds.includes(participant._id.toString()));
            if (members.length > 0) teamsBySchool.set(`roster-${index}`, { schoolName: team.teamName || members[0].schoolName || '未填写代表单位', members });
          });
        } else {
          matches.forEach((participant) => {
            const schoolName = participant.schoolName || '未填写代表单位';
            if (!teamsBySchool.has(schoolName)) teamsBySchool.set(schoolName, { schoolName, members: [] });
            teamsBySchool.get(schoolName).members.push(participant);
          });
        }
        participantIds = [];
        for (const { schoolName, members } of teamsBySchool.values()) {
          const virtualTeam = await Participant.create({
            competition: competitionId,
            name: schoolName,
            teamName: schoolName,
            schoolName,
            event: '集体项目',
            ageGroup: '混合集体',
            gender: 'mixed',
            type: 'team',
            isVirtualTeam: true,
            teamMembers: members.map((member) => member._id),
            status: 'approved'
          });
          participantIds.push(virtualTeam._id);
        }
      }

      const startHour = item.timeSlot === '下午' ? 14 : item.timeSlot === '晚上' ? 19 : 9;
      const endHour = item.timeSlot === '下午' ? 17 : item.timeSlot === '晚上' ? 22 : 12;
      schedulesToCreate.push({
        competition: competitionId,
        name: item.name,
        description: '由 Excel 日程表导入',
        type: 'other',
        startTime: new Date(`${item.scheduleDate}T${String(startHour).padStart(2, '0')}:00:00`),
        endTime: new Date(`${item.scheduleDate}T${String(endHour).padStart(2, '0')}:00:00`),
        location: item.court,
        scheduleDate: item.scheduleDate,
        timeSlot: item.timeSlot,
        exactTime: item.exactTime,
        court: item.court,
        order: item.index,
        participants: participantIds
      });
    }

    const schedules = await Schedule.insertMany(schedulesToCreate);
    res.status(201).json({ success: true, message: `已导入 ${schedules.length} 个日程项目`, data: { count: schedules.length, preview: preview.summary } });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    next(error);
  }
};
