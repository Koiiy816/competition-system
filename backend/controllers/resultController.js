const Result = require('../models/Result');
const Schedule = require('../models/Schedule');
const Competition = require('../models/Competition');
const Participant = require('../models/Participant');
const { calculateDivingDiveScore } = require('../utils/divingScoring');
const { isStrengthSchedule, normalizeStrengthEvents, mergeStrengthEvents, pointsForRank } = require('../utils/strengthScoring');

// --- 新增：内存并发锁，防止多名裁判同时打分互相覆盖（0分BUG） ---
const scoreLocks = {};
const scoreStreamClients = new Map();

const scoreStreamKey = (competitionId, scheduleId) => `${competitionId}:${scheduleId}`;

const broadcastScoreUpdate = (competitionId, scheduleId, result) => {
  const clients = scoreStreamClients.get(scoreStreamKey(competitionId, scheduleId));
  if (!clients?.size) return;

  const participantId = result?.participant?._id || result?.participant;
  const payload = `event: score-updated\ndata: ${JSON.stringify({ participantId: String(participantId), result })}\n\n`;
  for (const client of clients) {
    if (!client.writableEnded && !client.destroyed) client.write(payload);
  }
};

const acquireLock = async (key) => {
  while (scoreLocks[key]) {
    await new Promise(resolve => setTimeout(resolve, 20)); // 每20ms检查一次锁
  }
  scoreLocks[key] = true;
};

const releaseLock = (key) => {
  delete scoreLocks[key];
};
// -----------------------------------------------------------------

// 裁判长和管理员使用一个长连接接收“已保存成绩”的小消息。
// 没有裁判保存时不读取数据库、不发送轮询请求。
exports.openScoreStream = (req, res) => {
  const scheduleId = String(req.query.scheduleId || '');
  if (!scheduleId) {
    return res.status(400).json({ success: false, message: '缺少赛程ID' });
  }

  const key = scoreStreamKey(req.params.competitionId, scheduleId);
  const clients = scoreStreamClients.get(key) || new Set();
  scoreStreamClients.set(key, clients);

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write(': connected\n\n');
  clients.add(res);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    if (clients.size === 0) scoreStreamClients.delete(key);
  });
};

/**
 * @desc    获取成绩状态列表
 * @route   GET /api/result-statuses
 * @access  Public
 */
exports.getResultStatuses = async (req, res, next) => {
  try {
    // 从Result模型的schema中获取status字段的枚举值
    const statusEnum = Result.schema.paths.status.enumValues;
    
    // 返回状态列表，包含值和显示名称
    const statuses = statusEnum.map(status => ({
      value: status,
      label: getStatusLabel(status)
    }));

    res.status(200).json({
      success: true,
      data: statuses
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取状态的中文显示名称
 * @param {string} status - 状态值
 * @returns {string} - 中文显示名称
 */
function getStatusLabel(status) {
  const statusLabels = {
    'pending': '待审核',
    'verified': '已审核',
    'disputed': '有争议'
  };
  return statusLabels[status] || status;
}

function normalizeCheckInStatus(participant) {
  if (!participant) return 'not_checked';
  if (['not_checked', 'checked', 'absent'].includes(participant.checkInStatus)) {
    return participant.checkInStatus;
  }
  return participant.isCheckedIn ? 'checked' : 'not_checked';
}

function getEffectiveCheckInStatus(participant) {
  if (!participant) return 'not_checked';

  if (!participant.isVirtualTeam) {
    return normalizeCheckInStatus(participant);
  }

  const teamMembers = participant.teamMembers || [];
  if (teamMembers.length === 0) {
    return normalizeCheckInStatus(participant);
  }

  const statuses = teamMembers.map(normalizeCheckInStatus);

  if (statuses.every(status => status === 'checked')) return 'checked';
  if (statuses.every(status => status === 'absent')) return 'absent';
  if (statuses.every(status => status === 'not_checked')) return 'not_checked';

  return 'mixed';
}


function getAllowedJudgeIndex(user) {
  if (!user?.name) return -1;
  const match = user.name.match(/\d+/);
  return match ? (parseInt(match[0], 10) - 1) % 5 : -1;
}
function normalizeDivingScores(scores) {
  const normalized = Array.isArray(scores) ? scores.slice(0, 5) : [];
  while (normalized.length < 5) normalized.push(null);
  return normalized.map((score) => {
    if (score === '' || score === null || score === undefined) return null;
    const parsed = Number(score);
    return Number.isFinite(parsed) ? parsed : null;
  });
}
function isCompleteDivingScore(scores) {
  return scores.length === 5 && scores.every((score) => Number.isFinite(score));
}
const isLandDiving = (participant) => /陆上|陸上/.test(String(participant?.event || ''));
const isLandNetOrBoard = (schedule, participant) => /陆上[网板]|陸上[網板]/.test(`${schedule?.name || ''} ${participant?.event || ''}`);
const isStrengthEvent = (participant) => /素质力量/.test(String(participant?.event || ''));
const normalizeParticipantDivingProgram = (participant) => {
  const plan = participant?.additionalInfo?.divingPlan;
  if (!Array.isArray(plan?.dives) || !plan.dives.length) return null;
  const program = plan.dives.map((dive, index) => {
    const actionCode = String(dive?.actionCode || '').trim().toUpperCase();
    const difficulty = (isLandDiving(participant) || isStrengthEvent(participant)) && (dive?.difficulty === '' || dive?.difficulty == null) ? 1 : Number(dive?.difficulty);
    if (!actionCode || !Number.isFinite(difficulty) || difficulty <= 0) return null;
    return { actionCode, actionName: actionCode, difficulty, source: 'registration-plan', round: index + 1 };
  });
  return program.every(Boolean) ? program : null;
};

const sameDivingProgram = (left, right) => JSON.stringify(left?.map(({ actionCode, difficulty }) => ({ actionCode, difficulty }))) === JSON.stringify(right?.map(({ actionCode, difficulty }) => ({ actionCode, difficulty })));

const getScoringDivingProgram = (participant, format) => {
  if (format !== 'synchronized') return normalizeParticipantDivingProgram(participant);
  const members = participant?.teamMembers || [];
  if (members.length !== 2) return null;
  const first = normalizeParticipantDivingProgram(members[0]);
  const second = normalizeParticipantDivingProgram(members[1]);
  return first && second && sameDivingProgram(first, second) ? first : null;
};
exports.submitDivingScore = async (req, res, next) => {
  const { scheduleId, participantId, dives, confirmNextRound } = req.body;
  if (!scheduleId || !participantId || !Array.isArray(dives)) return res.status(400).json({ success: false, message: 'Missing diving score data' });
  const lockKey = 'diving_' + scheduleId + '_' + participantId;
  await acquireLock(lockKey);
  try {
    const schedule = await Schedule.findById(scheduleId).select('name judgeCount scoringMode divingFormat divingProgram status participants');
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });
    if (schedule.scoringMode !== 'diving') return res.status(400).json({ success: false, message: 'This schedule is not configured for diving scoring' });
    if ((schedule.judgeCount || 5) !== 5) return res.status(400).json({ success: false, message: 'Diving scoring requires five judges' });
    const participant = await Participant.findById(participantId).populate('teamMembers', 'isCheckedIn checkInStatus additionalInfo event');
    if (!participant) return res.status(404).json({ success: false, message: 'Participant not found' });
    if (!(schedule.participants || []).some((entryId) => entryId.toString() === participant._id.toString())) {
      return res.status(400).json({ success: false, message: '该参赛对象不在当前赛程中' });
    }
    const program = getScoringDivingProgram(participant, schedule.divingFormat || 'individual');
    if (!program) return res.status(400).json({ success: false, message: schedule.divingFormat === 'synchronized' ? '双人跳水须由两位搭档补录完全一致的动作与难度后才能打分' : '请先补录完整的跳水动作表（动作代码和难度系数）' });
    if (dives.length !== program.length) return res.status(400).json({ success: false, message: '提交的打分轮次与补录动作表不一致' });
    if (schedule.divingFormat === 'synchronized' && (!participant.isVirtualTeam || (participant.teamMembers || []).length !== 2)) {
      return res.status(400).json({ success: false, message: 'Synchronized diving requires a two-member team' });
    }
    const checkInStatus = getEffectiveCheckInStatus(participant);
    if (checkInStatus !== 'checked' && checkInStatus !== 'absent') return res.status(400).json({ success: false, message: 'Participant must be checked in before scoring' });
    const isChiefOrAdmin = req.user.roles?.includes('admin') || req.user.roles?.includes('chief_referee');
    const allowedIndex = isChiefOrAdmin ? -1 : getAllowedJudgeIndex(req.user);
    if (!isChiefOrAdmin && (allowedIndex < 0 || allowedIndex >= (schedule.judgeCount || 5))) return res.status(403).json({ success: false, message: 'No assigned judge score column' });
    let result = await Result.findOne({ schedule: scheduleId, participant: participantId });
    const previousDives = result?.details?.dives || [];
    const supportsRoundDeduction = isLandNetOrBoard(schedule, participant);
    const savedDives = program.map((action, index) => {
      const submitted = dives[index] || {};
      let scores = normalizeDivingScores(submitted.scores);
      let deduction = 0;
      if (supportsRoundDeduction) {
        deduction = isChiefOrAdmin ? Number(submitted.deduction || 0) : Number(previousDives[index]?.deduction || 0);
        if (!Number.isFinite(deduction) || deduction < 0) {
          const error = new Error(`第${index + 1}轮扣分必须是非负数`);
          error.statusCode = 400;
          throw error;
        }
      }
      if (!isChiefOrAdmin && checkInStatus !== 'absent') {
        const previous = normalizeDivingScores(previousDives[index]?.scores);
        previous[allowedIndex] = scores[allowedIndex];
        scores = previous;
      }
      if (checkInStatus === 'absent') scores = [null, null, null, null, null];
      return { actionCode: action.actionCode || '', actionName: action.actionName, difficulty: action.difficulty, source: action.source || 'custom', scores, deduction, score: calculateDivingDiveScore(scores, action.difficulty, deduction), completed: isCompleteDivingScore(scores) };
    });
    const totalScore = Math.round(savedDives.reduce((sum, dive) => sum + dive.score, 0) * 100) / 100;
    const allCompleted = savedDives.every((dive) => dive.completed);
    const previousPublishedRound = Number(result?.details?.publishedRound || 0);
    let publishedRound = previousPublishedRound;
    let publishedAt = result?.details?.publishedAt || null;
    // 已公开动作是不可被后续录分改写的快照；大屏只读取它，保证“确认后才上屏”。
    const snapshot = (dive) => ({ ...dive, scores: [...(dive.scores || [])] });
    const previousPublicDives = Array.isArray(result?.details?.publishedDives)
      ? result.details.publishedDives
      : (result?.details?.dives || []);
    let publishedDives = previousPublicDives.slice(0, previousPublishedRound).map(snapshot);

    if (confirmNextRound) {
      if (!isChiefOrAdmin) return res.status(403).json({ success: false, message: '只有裁判长或管理员可以确认并公开成绩' });
      const nextRound = previousPublishedRound + 1;
      if (!savedDives[nextRound - 1]?.completed) return res.status(400).json({ success: false, message: `第${nextRound}轮尚未完成五位裁判打分，不能公开` });
      publishedRound = nextRound;
      publishedDives.push(snapshot(savedDives[nextRound - 1]));
      // 大屏用这一个时间识别“刚刚确认”的男子或女子子项目；普通裁判的补录不能改变大屏焦点。
      publishedAt = new Date();
    }

    const resultData = {
      competition: req.params.competitionId,
      schedule: scheduleId,
      participant: participantId,
      score: checkInStatus === 'absent' ? 0 : totalScore,
      details: {
        scoringType: 'diving', format: schedule.divingFormat || 'individual', dives: savedDives,
        isAbsent: checkInStatus === 'absent', completed: checkInStatus === 'absent' || allCompleted,
        publishedRound, publishedDives, publishedAt
      },
      submittedBy: req.user.id,
      // 已确认任一轮后，成绩就是可供大屏读取的正式公开快照；未确认的录分仍保持待确认。
      status: checkInStatus === 'absent' || publishedRound > 0 || (isChiefOrAdmin && allCompleted) ? 'verified' : 'pending',
      updatedAt: new Date()
    };
    result = result ? await Result.findByIdAndUpdate(result._id, resultData, { new: true, runValidators: true }) : await Result.create(resultData);
    if (schedule.status === 'scheduled') {
      schedule.status = 'ongoing';
      await schedule.save();
    }
    broadcastScoreUpdate(req.params.competitionId, scheduleId, result);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  } finally {
    releaseLock(lockKey);
  }
};

// 素质力量按小项录入原始成绩。仅裁判长/管理员可录入，保存后重新计算全场小项名次及积分。
exports.submitStrengthScore = async (req, res, next) => {
  const { scheduleId, participantId, events } = req.body;
  if (!scheduleId || !participantId || !Array.isArray(events)) return res.status(400).json({ success: false, message: '缺少素质力量成绩数据' });
  if (!(req.user.roles || []).some((role) => ['admin', 'chief_referee'].includes(role))) return res.status(403).json({ success: false, message: '素质力量原始成绩仅可由裁判长录入' });
  const lockKey = `strength_${scheduleId}`;
  await acquireLock(lockKey);
  try {
    const schedule = await Schedule.findById(scheduleId).select('competition name status participants');
    if (!schedule) return res.status(404).json({ success: false, message: '未找到对应赛程' });
    const participant = await Participant.findById(participantId).populate('teamMembers', 'isCheckedIn checkInStatus');
    if (!participant || !(schedule.participants || []).some((id) => id.toString() === participantId)) return res.status(400).json({ success: false, message: '参赛对象不在当前赛程中' });
    if (!isStrengthSchedule(schedule, participant)) return res.status(400).json({ success: false, message: '当前赛程不是素质力量项目' });
    const checkInStatus = getEffectiveCheckInStatus(participant);
    if (checkInStatus !== 'checked' && checkInStatus !== 'absent') return res.status(400).json({ success: false, message: '参赛对象尚未检录，暂不能录入成绩' });
    const normalizedEvents = checkInStatus === 'absent' ? [] : normalizeStrengthEvents(events);
    if (checkInStatus !== 'absent' && !normalizedEvents.length) return res.status(400).json({ success: false, message: '请录入至少一个有效的小项原始成绩' });
    const current = await Result.findOne({ schedule: scheduleId, participant: participantId });
    const mergedEvents = checkInStatus === 'absent'
      ? []
      : mergeStrengthEvents(current?.details?.events, normalizedEvents);
    const data = {
      competition: req.params.competitionId, schedule: scheduleId, participant: participantId,
      score: 0,
      details: { scoringType: 'strength', isAbsent: checkInStatus === 'absent', events: mergedEvents, completed: true },
      submittedBy: req.user.id, verifiedBy: req.user.id, verifiedAt: new Date(), status: 'verified', updatedAt: new Date()
    };
    if (current) await Result.findByIdAndUpdate(current._id, data, { runValidators: true }); else await Result.create(data);

    const allResults = await Result.find({ schedule: scheduleId });
    const eventNames = [...new Set(allResults.flatMap((result) => (result.details?.events || []).map((event) => event.actionName)))];
    const ranksByParticipant = new Map(allResults.map((result) => [result.participant.toString(), {}]));
    for (const actionName of eventNames) {
      const rows = allResults.map((result) => ({ result, event: (result.details?.events || []).find((item) => item.actionName === actionName) }))
        .filter((row) => row.event && !row.result.details?.isAbsent)
        .sort((a, b) => a.event.direction === 'asc' ? a.event.rawScore - b.event.rawScore : b.event.rawScore - a.event.rawScore);
      let rank = 0; let previous;
      rows.forEach((row, index) => {
        if (index === 0 || row.event.rawScore !== previous) rank = index + 1;
        previous = row.event.rawScore;
        ranksByParticipant.get(row.result.participant.toString())[actionName] = { rank, points: pointsForRank(rank) };
      });
    }
    for (const result of allResults) {
      const details = { ...(result.details || {}) };
      details.events = (details.events || []).map((event) => ({ ...event, ...(ranksByParticipant.get(result.participant.toString())[event.actionName] || { rank: null, points: 0 }) }));
      const totalPoints = details.isAbsent ? 0 : details.events.reduce((sum, event) => sum + Number(event.points || 0), 0);
      details.totalPoints = totalPoints;
      result.details = details; result.score = totalPoints; result.status = 'verified'; result.verifiedBy = req.user.id; result.verifiedAt = new Date();
      await result.save();
    }
    const strengthRank = (left, right) => {
      if (left.details?.isAbsent !== right.details?.isAbsent) return left.details?.isAbsent ? 1 : -1;
      if (right.score !== left.score) return Number(right.score || 0) - Number(left.score || 0);
      for (let place = 1; place <= eventNames.length; place += 1) {
        const leftCount = (left.details?.events || []).filter((event) => event.rank === place).length;
        const rightCount = (right.details?.events || []).filter((event) => event.rank === place).length;
        if (leftCount !== rightCount) return rightCount - leftCount;
      }
      return 0;
    };
    const rankedResults = [...allResults].sort(strengthRank);
    for (let index = 0; index < rankedResults.length; index += 1) {
      rankedResults[index].rank = rankedResults[index].details?.isAbsent ? null : index + 1;
      await rankedResults[index].save();
    }
    if (schedule.status === 'scheduled') { schedule.status = 'ongoing'; await schedule.save(); }
    const saved = await Result.findOne({ schedule: scheduleId, participant: participantId });
    res.status(200).json({ success: true, data: saved });
  } catch (error) { next(error); } finally { releaseLock(lockKey); }
};

// 裁判长按轮确认跳水成绩后，才允许大屏展示该轮的累计实得分。
exports.publishDivingRound = async (req, res, next) => {
  const { scheduleId, round } = req.body;
  const roundNumber = Number(round);
  if (!scheduleId || !Number.isInteger(roundNumber) || roundNumber < 1) return res.status(400).json({ success: false, message: '请提供有效的跳水轮次' });
  try {
    const schedule = await Schedule.findById(scheduleId).select('competition scoringMode divingFormat status participants');
    if (!schedule || schedule.competition.toString() !== req.params.competitionId) return res.status(404).json({ success: false, message: '未找到跳水赛程' });
    if (schedule.scoringMode !== 'diving') return res.status(400).json({ success: false, message: '当前赛程不是跳水项目' });
    const participants = await Participant.find({ _id: { $in: schedule.participants } }).populate('teamMembers', 'isCheckedIn checkInStatus');
    const activeParticipantIds = participants.filter((participant) => getEffectiveCheckInStatus(participant) === 'checked').map((participant) => participant._id.toString());
    if (!activeParticipantIds.length) return res.status(400).json({ success: false, message: '当前赛程没有已检录的参赛对象' });
    const results = await Result.find({ schedule: scheduleId, participant: { $in: activeParticipantIds } });
    const resultByParticipant = new Map(results.map((result) => [result.participant.toString(), result]));
    const incomplete = activeParticipantIds.filter((participantId) => !resultByParticipant.get(participantId)?.details?.dives?.[roundNumber - 1]?.completed);
    if (incomplete.length) return res.status(400).json({ success: false, message: `第${roundNumber}轮尚有${incomplete.length}名运动员未完成五位裁判打分，不能公开` });
    for (const result of results) {
      const details = { ...(result.details || {}) };
      details.publishedRound = Math.max(Number(details.publishedRound || 0), roundNumber);
      result.details = details;
      result.verifiedBy = req.user.id;
      result.verifiedAt = new Date();
      await result.save();
    }
    if (schedule.status === 'scheduled') { schedule.status = 'ongoing'; await schedule.save(); }
    res.status(200).json({ success: true, data: { scheduleId, publishedRound: roundNumber }, message: `第${roundNumber}轮已确认并公开到大屏` });
  } catch (error) {
    next(error);
  }
};

// 管理员在正式开赛前清除某场跳水的公开进度；保留原始裁判分和动作表，便于重新从第 1 轮确认。
exports.resetDivingPublication = async (req, res, next) => {
  const { scheduleId } = req.body;
  if (!scheduleId) return res.status(400).json({ success: false, message: '请提供赛程ID' });
  try {
    const schedule = await Schedule.findById(scheduleId).select('competition scoringMode name');
    if (!schedule || schedule.competition.toString() !== req.params.competitionId) return res.status(404).json({ success: false, message: '未找到跳水赛程' });
    if (schedule.scoringMode !== 'diving' || isStrengthSchedule(schedule)) return res.status(400).json({ success: false, message: '只有按轮次计分的跳水、陆上板或陆上网赛程可以重置公开轮次' });

    const update = await Result.updateMany(
      { schedule: scheduleId },
      {
        $unset: { 'details.publishedRound': 1, 'details.publishedDives': 1 },
        $set: { status: 'pending', verifiedBy: null, verifiedAt: null, updatedAt: new Date() }
      }
    );
    res.status(200).json({ success: true, data: { scheduleId, resetCount: update.modifiedCount }, message: '本场已公开轮次已重置，原始裁判分未删除' });
  } catch (error) {
    next(error);
  }
};

// 管理员在正式开赛前清除某一个项目的测试成绩。
// 只删除 Result，保留报名、赛程编排、检录状态及跳水动作表，避免影响同一选手的其他项目。
exports.resetScheduleResults = async (req, res, next) => {
  const { scheduleId } = req.body;
  if (!scheduleId) return res.status(400).json({ success: false, message: '请提供赛程ID' });
  try {
    const schedule = await Schedule.findById(scheduleId).select('competition name status');
    if (!schedule || schedule.competition.toString() !== req.params.competitionId) {
      return res.status(404).json({ success: false, message: '未找到对应赛程' });
    }

    const deleted = await Result.deleteMany({
      competition: req.params.competitionId,
      schedule: scheduleId
    });

    // 测试完成后可重新开始正式比赛；不改变已配置的赛程时间、场地和参赛名单。
    if (schedule.status !== 'scheduled') {
      schedule.status = 'scheduled';
      await schedule.save();
    }

    res.status(200).json({
      success: true,
      data: { scheduleId, resetCount: deleted.deletedCount },
      message: `已清空本项目 ${deleted.deletedCount} 条测试成绩，项目已恢复为未开始状态`
    });
  } catch (error) {
    next(error);
  }
};

function calculateFinalScore(scores, deduction, judgeCount) {
  const activeScores = scores.slice(0, judgeCount).filter(score => score > 0);
  if (activeScores.length === 0) return 0;

  // 所有有效裁判分數直接取平均；5 位裁判時亦不去除最高、最低分。
  return activeScores.reduce((sum, score) => sum + score, 0) / activeScores.length + deduction;
}

/**
 * @desc    获取所有成绩
 * @route   GET /api/competitions/:competitionId/results
 * @access  Public
 */
exports.getResults = async (req, res, next) => {
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

    if (req.query.scheduleId) {
      query.schedule = req.query.scheduleId;
    }

    if (req.query.participantId) {
      query.participant = req.query.participantId;
    }

    // 如果设置了 limit=1000（或类似大数字），则认为是请求所有数据，不强制限制为10
    const limitParam = parseInt(req.query.limit, 10);
    const limit = limitParam > 0 ? limitParam : 10;
    const page = parseInt(req.query.page, 10) || 1;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const scoreRefreshOnly = req.query.fields === 'score-refresh';

    // 评分页的实时同步只需要当前场次的分数。避免每两秒重复统计总数、
    // 展开参赛者/赛程/用户等关联资料；首次进入评分页仍使用完整响应。
    if (scoreRefreshOnly) {
      const results = await Result.find(query)
        .select('_id participant score details status updatedAt')
        .limit(limit)
        .lean();

      return res.status(200).json({
        success: true,
        count: results.length,
        total: results.length,
        data: results
      });
    }

    const total = await Result.countDocuments(query);

    // 执行完整查询
    const results = await Result.find(query)
      .populate('competition', 'name')
      .populate('schedule', 'name startTime location')
      .populate({
        path: 'participant',
        select: 'user name schoolName type teamName isTest isVirtualTeam teamMembers', // 增加了 isVirtualTeam teamMembers
        populate: [
          {
            path: 'user',
            select: 'name'
          },
          {
            path: 'teamMembers',
            select: 'name'
          }
        ]
      })
      .populate('submittedBy', 'name')
      .populate('verifiedBy', 'name')
      .skip(startIndex)
      .limit(limit)
      .sort({ submittedAt: -1 });

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
      count: results.length,
      pagination,
      total,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    获取单个成绩
 * @route   GET /api/competitions/:competitionId/results/:id
 * @access  Public
 */
exports.getResult = async (req, res, next) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('competition', 'name')
      .populate('schedule', 'name startTime location type')
      .populate({
        path: 'participant',
        select: 'user type teamName isTest isVirtualTeam teamMembers',
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
      })
      .populate('submittedBy', 'name')
      .populate('verifiedBy', 'name');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的成绩`
      });
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    创建成绩
 * @route   POST /api/competitions/:competitionId/results
 * @access  Private/Admin/Organizer/Referee
 */
exports.createResult = async (req, res, next) => {
  try {
    // 设置比赛ID
    req.body.competition = req.params.competitionId;
    // 设置提交人ID
    req.body.submittedBy = req.user.id;

    // 检查比赛是否存在
    const competition = await Competition.findById(req.params.competitionId);

    if (!competition) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.competitionId}的比赛`
      });
    }

    // 检查赛程是否存在
    const schedule = await Schedule.findById(req.body.schedule);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.body.schedule}的赛程`
      });
    }

    // 检查参赛者是否存在
    const participant = await Participant.findById(req.body.participant);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.body.participant}的参赛者`
      });
    }

    // 检查结果是否已存在
    const existingResult = await Result.findOne({
      schedule: req.body.schedule,
      participant: req.body.participant
    });

    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: '该参赛者在此赛程中已有成绩'
      });
    }

    const result = await Result.create(req.body);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    提交或更新成绩（打分专用）
 * @route   POST /api/competitions/:competitionId/results/submit
 * @access  Private/Referee/Admin
 */
exports.submitScore = async (req, res, next) => {
  const { scheduleId, participantId, scores, deduction } = req.body;

  if (!scheduleId || !participantId || !scores) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }

  const lockKey = `${scheduleId}_${participantId}`;
  await acquireLock(lockKey);

  try {
    const schedule = await Schedule.findById(scheduleId).select('judgeCount status');
    if (!schedule) {
      return res.status(404).json({ success: false, message: '未找到对应赛程' });
    }
    const judgeCount = schedule.judgeCount || 5;

    const participant = await Participant.findById(participantId).populate(
      'teamMembers',
      'isCheckedIn checkInStatus'
    );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${participantId}的参赛者`
      });
    }

    const effectiveCheckInStatus = getEffectiveCheckInStatus(participant);

    if (effectiveCheckInStatus === 'mixed') {
      return res.status(400).json({
        success: false,
        message: '该参赛对象的检录状态不一致，请先在检录页面统一状态'
      });
    }

    if (effectiveCheckInStatus === 'not_checked') {
      return res.status(400).json({
        success: false,
        message: '该参赛对象尚未检录，暂不能打分'
      });
    }

    let finalScore = 0;
    let newScores = scores.map(s => parseFloat(s) || 0).slice(0, 5);
    while (newScores.length < 5) newScores.push(0);
    for (let index = judgeCount; index < 5; index += 1) newScores[index] = 0;
    let newDeduction = parseFloat(deduction) || 0;
    let finalIsAbsent = effectiveCheckInStatus === 'absent';

    // 缺席状态由检录决定，自动写入弃权成绩
    if (finalIsAbsent) {
      finalScore = 0;
      newScores = [0, 0, 0, 0, 0];
      newDeduction = 0;
    } else {
      // 由服务器按赛程规则计算，避免客户端传入的最终分数影响结果。
      finalScore = calculateFinalScore(newScores, newDeduction, judgeCount);
    }
    
    finalScore = Math.round(finalScore * 100) / 100;

    let result = await Result.findOne({
      schedule: scheduleId,
      participant: participantId
    });

    if (result) {
      if (!req.user.roles?.includes('chief_referee') && !req.user.roles?.includes('admin')) {
        let allowedIndex = -1;
        if (req.user.name) {
          const match = req.user.name.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            allowedIndex = (num - 1) % 5;
          }
        }

        if (allowedIndex === -1) {
          return res.status(403).json({
            success: false,
            message: '只有比赛主裁判和管理员可以修改全部分数，您没有权限'
          });
        }

        if (allowedIndex >= judgeCount) {
          return res.status(403).json({ success: false, message: '当前赛程未分配此裁判评分栏位' });
        }

        if (!finalIsAbsent) {
          newScores = [...(result.details?.scores || [0, 0, 0, 0, 0])];
          newScores[allowedIndex] = req.body.scores[allowedIndex] ? parseFloat(req.body.scores[allowedIndex]) || 0 : 0;
          while (newScores.length < 5) newScores.push(0);
          for (let index = judgeCount; index < 5; index += 1) newScores[index] = 0;
          newDeduction = result.details?.deduction || 0;
          finalIsAbsent = effectiveCheckInStatus === 'absent';

          if (!finalIsAbsent) {
            finalScore = calculateFinalScore(newScores, newDeduction, judgeCount);
            finalScore = Math.round(finalScore * 100) / 100;
          } else {
            finalScore = 0;
          }
        }
      }
    }

    const isChiefOrAdmin = req.user.roles?.includes('admin') || req.user.roles?.includes('chief_referee');

    // 核心修改：如果裁判长把分数全改成了 0（或把某几个裁判的分数改成0退回重打），
    // 则把状态重置为 'pending'，这样普通裁判前端才会解除锁定。
    let newStatus = 'pending';
    if (isChiefOrAdmin) {
      // 只有全部有效裁判栏位都已录入，并且裁判长点击保存，才发布到大屏。
      const allJudgeScoresEntered = newScores
        .slice(0, judgeCount)
        .every(score => Number(score) > 0);
      if (allJudgeScoresEntered || finalIsAbsent) {
        newStatus = 'verified';
      } else {
        // 分数尚未齐全，或被裁判长退回重打。
        newStatus = 'pending';
      }
    } else {
      // 普通裁判打分永远是 pending
      newStatus = 'pending';
    }

    const resultData = {
      competition: req.params.competitionId,
      schedule: scheduleId,
      participant: participantId,
      score: finalScore,
      details: {
        scores: newScores,
        deduction: newDeduction,
        isAbsent: finalIsAbsent,
        absentSource: finalIsAbsent ? 'check_in' : null
      },
      submittedBy: req.user.id,
      status: newStatus,
      updatedAt: new Date()
    };

    if (result) {
      result = await Result.findByIdAndUpdate(result._id, resultData, {
        new: true,
        runValidators: true
      });
    } else {
      result = await Result.create(resultData);
    }

    if (schedule.status === 'scheduled') {
      schedule.status = 'ongoing';
      await schedule.save();
    }

    broadcastScoreUpdate(req.params.competitionId, scheduleId, result);
    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  } finally {
    releaseLock(lockKey);
  }
};

/**
 * @desc    更新结果
 * @route   PUT /api/competitions/:competitionId/results/:id
 * @access  Private/Admin/Organizer/Referee
 */
exports.updateResult = async (req, res, next) => {
  try {
    let result = await Result.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的成绩`
      });
    }

    // 检查用户是否是成绩的提交者、管理员或主裁判
    if (
      result.submittedBy.toString() !== req.user.id &&
      !req.user.roles?.includes('admin') &&
      !req.user.roles?.includes('chief_referee')
    ) {
      return res.status(403).json({
        success: false,
        message: '没有权限更新此成绩'
      });
    }

    // 不允许更改比赛ID、赛程ID、参赛者ID和提交人ID
    delete req.body.competition;
    delete req.body.schedule;
    delete req.body.participant;
    delete req.body.submittedBy;

    // 如果成绩已经被验证，非管理员不允许更新
    if (result.status === 'verified' && !req.user.roles?.includes('admin')) {
      return res.status(400).json({
        success: false,
        message: '已验证的成绩不能更新'
      });
    }

    result = await Result.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    删除成绩
 * @route   DELETE /api/competitions/:competitionId/results/:id
 * @access  Private/Admin/Organizer
 */
exports.deleteResult = async (req, res, next) => {
  try {
    const result = await Result.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的成绩`
      });
    }

    // 检查用户是否是管理员或主裁判
    if (!req.user.roles?.includes('admin') && !req.user.roles?.includes('chief_referee')) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除此成绩'
      });
    }

    await result.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    验证成绩
 * @route   PUT /api/competitions/:competitionId/results/:id/verify
 * @access  Private/Admin/Organizer
 */
exports.verifyResult = async (req, res, next) => {
  try {
    const result = await Result.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的成绩`
      });
    }

    // 更新状态和验证人
    result.status = 'verified';
    result.verifiedBy = req.user.id;
    result.verifiedAt = Date.now();
    await result.save();

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    对成绩提出异议
 * @route   PUT /api/competitions/:competitionId/results/:id/dispute
 * @access  Private
 */
exports.disputeResult = async (req, res, next) => {
  try {
    const result = await Result.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `未找到ID为${req.params.id}的成绩`
      });
    }

    // 获取参赛者信息
    const participant = await Participant.findById(result.participant);

    // 检查用户是否是参赛者本人
    if (participant.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '只有参赛者本人可以对成绩提出异议'
      });
    }

    // 更新状态
    result.status = 'disputed';
    result.notes = req.body.notes || '参赛者对成绩提出异议';
    await result.save();

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    导入结果
 * @route   POST /api/competitions/:competitionId/results/import
 * @access  Private/Organizer
 */
exports.importResults = async (req, res, next) => {
  try {
    const { results } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的结果数据'
      });
    }

    const importedResults = [];
    const errors = [];

    for (let i = 0; i < results.length; i++) {
      try {
        const resultData = {
          ...results[i],
          competition: req.params.competitionId
        };

        const result = await Result.create(resultData);
        importedResults.push(result);
      } catch (error) {
        errors.push({
          index: i,
          data: results[i],
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        imported: importedResults,
        errors: errors,
        total: results.length,
        successful: importedResults.length,
        failed: errors.length
      },
      message: `成功导入 ${importedResults.length} 条结果，失败 ${errors.length} 条`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    导出结果
 * @route   GET /api/competitions/:competitionId/results/export
 * @access  Private/Organizer
 */
exports.exportResults = async (req, res, next) => {
  try {
    const results = await Result.find({ competition: req.params.competitionId })
      .populate('schedule', 'name startTime location')
      .populate({
        path: 'participant',
        select: 'user type teamName',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .sort({ createdAt: -1 });

    // 转换为导出格式
    const exportData = results.map(result => ({
      id: result._id,
      schedule: result.schedule?.name || '',
      participant: result.participant?.user?.name || result.participant?.teamName || '',
      score: result.score,
      position: result.position,
      status: result.status,
      notes: result.notes || '',
      createdAt: result.createdAt
    }));

    res.status(200).json({
      success: true,
      data: exportData,
      count: exportData.length
    });
  } catch (error) {
    next(error);
  }
};
