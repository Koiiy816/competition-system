const Schedule = require('../models/Schedule');
const Participant = require('../models/Participant');
const { formatScheduleName, getScheduleGender } = require('./scheduleNaming');
const { applyTrampolineJudgeCount } = require('./trampolineScoring');

// 使用项目类型、组别和性别匹配，兼容旧标题中重复出现大小网和组别的情况。
function scheduleKey(schedule) {
  const name = String(schedule.name || '');
  const group = name.match(/U\d+组|小学组|幼儿组/)?.[0];
  const kind = name.includes('蹦床操') ? 'routine' : name.includes('小网') ? 'small' : name.includes('大网') ? 'large' : '';
  const gender = kind === 'routine' ? 'mixed' : getScheduleGender({
    eventName: name,
    participantGender: schedule.participants?.find(p => p.gender)?.gender
  });
  return group && kind ? [kind, group, gender].join('|') : '';
}

const teamKey = participant => JSON.stringify([String(participant.schoolName || '').trim(), String(participant.groupTeam || '').trim()]);

async function syncTrampolineSchedules(competition, schedules, participants) {
  const scheduledIds = new Set();
  const teams = new Map();
  const byGroup = new Map();
  for (const schedule of schedules) {
    const key = scheduleKey(schedule);
    if (key && !byGroup.has(key)) byGroup.set(key, schedule);
    const scheduleTeams = new Map();
    for (const entry of schedule.participants) {
      if (entry.isVirtualTeam) {
        scheduleTeams.set(teamKey(entry), entry);
        for (const member of entry.teamMembers || []) scheduledIds.add(String(member._id || member));
      } else scheduledIds.add(String(entry._id || entry));
    }
    teams.set(String(schedule._id), scheduleTeams);
  }

  const changed = new Set();
  let appendedCount = 0;
  let createdScheduleCount = 0;
  let unmatchedCount = 0;
  let order = Math.max(0, ...schedules.map(s => s.order || 0));
  for (const participant of participants) {
    if (scheduledIds.has(String(participant._id))) continue;
    const event = competition.events.find(e => e.name === participant.event);
    const ageGroup = participant.ageGroup || participant.grade;
    if (!event?.ageGroups?.includes(ageGroup)) { unmatchedCount++; continue; }
    const gender = event.isGroupEvent ? 'mixed' : getScheduleGender({ eventName: event.name, eventConfig: event, participantGender: participant.gender });
    const name = formatScheduleName({ ageGroup, eventName: event.name, eventConfig: event, gender });
    const key = scheduleKey({ name });
    if (!key) { unmatchedCount++; continue; }
    let schedule = byGroup.get(key);
    // 不向已结束或取消的场次追加选手，也不修改已有成绩。
    if (schedule && ['completed', 'cancelled'].includes(schedule.status)) { unmatchedCount++; continue; }
    if (!schedule) {
      schedule = await Schedule.create(applyTrampolineJudgeCount(competition, {
        competition: competition._id, name, type: 'preliminary',
        startTime: competition.startDate, endTime: competition.endDate, location: competition.location,
        participants: [], status: 'scheduled', order: ++order
      }));
      byGroup.set(key, schedule);
      teams.set(String(schedule._id), new Map());
      createdScheduleCount++;
    }
    if (event.isGroupEvent) {
      const scheduleTeams = teams.get(String(schedule._id));
      const unitKey = teamKey(participant);
      let team = scheduleTeams.get(unitKey);
      if (team) {
        await Participant.updateOne({ _id: team._id }, {
          $addToSet: { teamMembers: participant._id },
          $set: { name: [team.name, participant.name].filter(Boolean).join('、'), isTest: Boolean(team.isTest || participant.isTest) }
        });
        team.name = [team.name, participant.name].filter(Boolean).join('、');
        team.isTest = Boolean(team.isTest || participant.isTest);
      } else {
        team = await Participant.create({
          competition: competition._id, event: event.name, ageGroup, grade: ageGroup,
          schoolName: participant.schoolName, groupTeam: participant.groupTeam || '',
          name: participant.name, teamName: participant.schoolName, gender: 'mixed', type: 'team',
          isVirtualTeam: true, teamMembers: [participant._id], status: 'approved', isTest: Boolean(participant.isTest)
        });
        scheduleTeams.set(unitKey, team);
        schedule.participants.push(team._id);
      }
    } else schedule.participants.push(participant._id);
    scheduledIds.add(String(participant._id));
    changed.add(schedule);
    appendedCount++;
  }
  for (const schedule of changed) {
    // populate 已滤掉失效引用；整体保存有效名单，避免 $push 把旧失效 ID 留在数据库中。
    schedule.participants = schedule.participants.map(entry => entry._id || entry);
    schedule.markModified('participants');
    applyTrampolineJudgeCount(competition, schedule);
    await schedule.save();
  }
  return { appendedCount, createdScheduleCount, unmatchedCount };
}

module.exports = { syncTrampolineSchedules };
