const Schedule = require('../models/Schedule');
const Result = require('../models/Result');

const locks = new Map();
async function acquireCollectiveLock(key) {
  while (locks.has(key)) await locks.get(key);
  let release;
  locks.set(key, new Promise(resolve => { release = resolve; }));
  return () => { locks.delete(key); release(); };
}

function validateBatches(batches, teamIds) {
  if (!Array.isArray(batches) || batches.length < 2 || batches.length > 30) {
    return '请设置 2 至 30 个比赛批次';
  }
  const expected = new Set(teamIds.map(String));
  const assigned = new Set();
  for (const batch of batches) {
    if (!batch || typeof batch.court !== 'string' || !batch.court.trim()
      || typeof batch.scheduleDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(batch.scheduleDate)
      || Number.isNaN(Date.parse(batch.scheduleDate))
      || new Date(batch.scheduleDate).toISOString().slice(0, 10) !== batch.scheduleDate
      || !['上午', '下午', '晚上'].includes(batch.timeSlot)) return '请为每个批次填写有效日期、时间段和场地';
    if (!Array.isArray(batch.participantIds) || !batch.participantIds.length) return '每个批次至少安排一支队伍';
    for (const id of batch.participantIds) {
      if (!expected.has(String(id))) return '只能分配当前项目已有的整支队伍';
      if (assigned.has(String(id))) return '同一支队伍不能重复安排到多个批次';
      assigned.add(String(id));
    }
  }
  return assigned.size === expected.size ? null : '必须为当前项目的所有队伍安排批次';
}

// 在读取时按完整项目计算，避免分页、场地过滤及多场地并发录分产生各自名次。
async function attachCollectiveRanks(results) {
  const groups = [...new Set(results.filter(row => row.schedule?.rankingGroupId)
    .map(row => String(row.schedule.rankingGroupId)))];
  if (!groups.length) return;
  const competitions = [...new Set(results.filter(row => row.schedule?.rankingGroupId)
    .map(row => String(row.competition?._id || row.competition)))];
  const schedules = await Schedule.find({ competition: { $in: competitions }, rankingGroupId: { $in: groups } })
    .select('_id rankingGroupId').lean();
  const groupBySchedule = new Map(schedules.map(row => [String(row._id), String(row.rankingGroupId)]));
  const allResults = await Result.find({ schedule: { $in: schedules.map(row => row._id) }, status: 'verified' })
    .select('_id schedule participant score details').populate('participant', 'isTest').lean();
  const ranks = new Map();
  for (const group of groups) {
    const eligible = allResults.filter(row => groupBySchedule.get(String(row.schedule)) === group
      && row.participant && !row.participant.isTest && !row.details?.isAbsent
      && row.score !== null && row.score !== '' && Number.isFinite(Number(row.score)))
      .sort((a, b) => Number(b.score) - Number(a.score));
    let rank = 0;
    eligible.forEach((row, index) => {
      if (!index || Number(row.score) !== Number(eligible[index - 1].score)) rank = index + 1;
      ranks.set(String(row._id), rank);
    });
  }
  results.forEach(row => {
    if (row.schedule?.rankingGroupId) row.rank = ranks.get(String(row._id)) ?? null;
  });
}

module.exports = { validateBatches, attachCollectiveRanks, acquireCollectiveLock };
