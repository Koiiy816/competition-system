const Competition = require('../models/Competition');
const Schedule = require('../models/Schedule');
const Result = require('../models/Result');
const AwardConfirmation = require('../models/AwardConfirmation');

const keyOf = value => String(value?._id || value || '');
const text = value => String(value || '').replace(/\s+/g, '');
const finalScore = result => {
  if (typeof result?.details?.finalScore === 'number') return result.details.finalScore;
  if (typeof result?.score === 'number') return result.score;
  return Number(result?.score) || 0;
};
const isIndividual = name => !/(\u96c6\u4f53|\u53cc\u4eba|\u5bf9\u7ec3)/.test(String(name || ''));

function remainingAwardCounts(count, rules = {}) {
  const weights = [
    ['\u4e00\u7b49\u5956', Number(rules?.remainingPrizePercents?.first ?? 50)],
    ['\u4e8c\u7b49\u5956', Number(rules?.remainingPrizePercents?.second ?? 30)],
    ['\u4e09\u7b49\u5956', Number(rules?.remainingPrizePercents?.third ?? 20)]
  ];
  const total = weights.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0) || 100;
  const result = Object.fromEntries(weights.map(([label]) => [label, 0]));
  const fractions = weights.map(([label, weight], index) => {
    const raw = count * Math.max(0, weight) / total;
    result[label] = Math.floor(raw);
    return { label, index, fraction: raw - Math.floor(raw) };
  });
  const assigned = Object.values(result).reduce((sum, value) => sum + value, 0);
  fractions.sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < count - assigned; index += 1) {
    result[fractions[index % fractions.length].label] += 1;
  }
  return result;
}

function awardLevel(rank, total, rules) {
  // 「比例錄取」模式：所有正式參賽者依實際參賽人數（集體項目則為實際隊伍數）
  // 分為前 30% 一等、31% 至 60% 二等、其餘三等。
  if (rules?.mode === 'legacy_percentage') {
    if (!rank || total <= 0) return null;
    const firstLimit = Math.max(1, Math.ceil(total * (Number(rules?.firstPrizePercent ?? 30) / 100)));
    const secondLimit = Math.max(firstLimit, Math.ceil(total * (Number(rules?.secondPrizePercent ?? 60) / 100)));
    if (rank <= firstLimit) return '一等奖';
    if (rank <= secondLimit) return '二等奖';
    return '三等奖';
  }

  const named = Number(rules?.rankAwardCount ?? 3);
  const canRank = total >= Number(rules?.minParticipantsForRanking ?? 3);
  if (canRank && rank <= named) return `\u7b2c${rank}\u540d`;
  const offset = canRank ? named : 0;
  const counts = remainingAwardCounts(Math.max(0, total - offset), rules);
  const position = rank - offset;
  if (position <= counts['\u4e00\u7b49\u5956']) return '\u4e00\u7b49\u5956';
  if (position <= counts['\u4e00\u7b49\u5956'] + counts['\u4e8c\u7b49\u5956']) return '\u4e8c\u7b49\u5956';
  return '\u4e09\u7b49\u5956';
}

function ranked(records) {
  const ordered = [...records].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  let previous = null; let rank = 0;
  return ordered.map((record, index) => {
    if (previous === null || previous !== record.score) rank = index + 1;
    previous = record.score;
    return { ...record, rank };
  });
}

function applyCeremonyCheckin(entries, awardKey, decisions, limit = 6) {
  const selected = [];
  for (const entry of entries) {
    const decision = decisions.get(`${awardKey}|${entry.recipientKey}`);
    const status = decision?.status || 'pending';
    if (status === 'forfeited') continue;
    if (selected.length < limit) selected.push({ ...entry, ceremonyStatus: status, awardedRank: selected.length + 1, promoted: entry.rank > limit });
  }
  return selected;
}

exports.getAwards = async (req, res, next) => {
  try {
    const competition = await Competition.findById(req.params.competitionId).lean();
    if (!competition) return res.status(404).json({ success: false, message: '\u6bd4\u8d5b\u4e0d\u5b58\u5728' });

    const [schedules, results, confirmations] = await Promise.all([
      Schedule.find({ competition: competition._id }).lean(),
      Result.find({ competition: competition._id }).populate('participant', 'name schoolName teamName gender coach isTest isVirtualTeam checkInStatus isCheckedIn').lean(),
      AwardConfirmation.find({ competition: competition._id }).lean()
    ]);
    const scheduleById = new Map(schedules.map(schedule => [keyOf(schedule), schedule]));
    const decisions = new Map(confirmations.map(item => [`${item.awardKey}|${item.recipientKey}`, item]));
    const valid = results.filter(item => item.participant && !item.participant.isTest && !item.details?.isAbsent && finalScore(item) > 0);

    // Every event award list is visible for checking results; it is not used for ceremony substitution.
    const eventsBySchedule = new Map();
    valid.forEach(result => {
      const schedule = scheduleById.get(keyOf(result.schedule));
      if (!schedule) return;
      const id = keyOf(schedule);
      if (!eventsBySchedule.has(id)) eventsBySchedule.set(id, { schedule, rows: [] });
      eventsBySchedule.get(id).rows.push({
        recipientKey: keyOf(result.participant), name: result.participant.name || result.participant.teamName,
        schoolName: result.participant.schoolName || result.participant.teamName || '', score: finalScore(result)
      });
    });
    const eventAwards = [...eventsBySchedule.values()].map(({ schedule, rows }) => {
      const list = ranked(rows).map(item => ({ ...item, awardLevel: awardLevel(item.rank, rows.length, competition.awardRules) }));
      return { scheduleId: keyOf(schedule), scheduleName: schedule.name, count: rows.length, awards: list };
    });

    // 團體總分只採計個人項目；29 號比賽依個人項目前八名 8 至 1 分計算。
    const eventKeysByPerson = new Map();
    valid.forEach(result => {
      const schedule = scheduleById.get(keyOf(result.schedule));
      if (schedule && isIndividual(schedule.name)) {
        const person = keyOf(result.participant);
        if (!eventKeysByPerson.has(person)) eventKeysByPerson.set(person, new Set());
        eventKeysByPerson.get(person).add(keyOf(schedule));
      }
    });
    const minimumEvents = Number(competition.awardRules?.teamMinEventsPerParticipant ?? 2);
    const eligible = new Set([...eventKeysByPerson]
      .filter(([, events]) => events.size >= minimumEvents)
      .map(([person]) => person));
    const teamPoints = new Map();
    eventAwards.forEach(event => {
      if (!isIndividual(event.scheduleName)) return;
      event.awards.forEach(item => {
        if (!eligible.has(item.recipientKey)) return;
        const percentageMode = competition.awardRules?.mode === 'legacy_percentage';
        const configuredTopEight = competition.awardRules?.teamPoints || [8, 7, 6, 5, 4, 3, 2, 1];
        const p = competition.awardRules?.teamAwardPoints || {};
        const points = percentageMode
          ? Number(configuredTopEight[item.rank - 1] || 0)
          : (item.awardLevel === '\u7b2c1\u540d' ? Number(p.rank1 ?? 6)
            : item.awardLevel === '\u7b2c2\u540d' ? Number(p.rank2 ?? 5)
              : item.awardLevel === '\u7b2c3\u540d' ? Number(p.rank3 ?? 4)
                : item.awardLevel === '\u4e00\u7b49\u5956' ? Number(p.firstPrize ?? 3)
                  : item.awardLevel === '\u4e8c\u7b49\u5956' ? Number(p.secondPrize ?? 2) : Number(p.thirdPrize ?? 1));
        if (points <= 0) return;
        if (!teamPoints.has(item.schoolName)) teamPoints.set(item.schoolName, { recipientKey: item.schoolName, name: item.schoolName, score: 0 });
        teamPoints.get(item.schoolName).score += points;
      });
    });
    const teamCandidates = ranked([...teamPoints.values()]);
    const teamAwards = applyCeremonyCheckin(teamCandidates, 'team-total', decisions, 6);

    // All-around kings: each category uses best 3/3/2 scores, separated by gender, regardless of age group.
    const categories = [
      { key: 'changquan', title: '\u957f\u62f3\u738b', pattern: /\u957f\u62f3/, take: 3 },
      { key: 'nanquan', title: '\u5357\u62f3\u738b', pattern: /\u5357\u62f3/, take: 3 },
      { key: 'taiji', title: '\u592a\u6781\u738b', pattern: /\u592a\u6781/, take: 2 }
    ];
    const kings = [];
    categories.forEach(category => {
      ['male', 'female'].forEach(gender => {
        const totals = new Map();
        valid.forEach(result => {
          const schedule = scheduleById.get(keyOf(result.schedule));
          if (!schedule || !category.pattern.test(schedule.name) || result.participant.gender !== gender) return;
          const person = keyOf(result.participant);
          if (!totals.has(person)) totals.set(person, { recipientKey: person, name: result.participant.name, schoolName: result.participant.schoolName || '', scores: [] });
          totals.get(person).scores.push(finalScore(result));
        });
        const candidates = ranked([...totals.values()].filter(item => item.scores.length >= category.take).map(item => ({ ...item, score: item.scores.sort((a, b) => b - a).slice(0, category.take).reduce((sum, value) => sum + value, 0) })));
        const awardKey = `king-${category.key}-${gender}`;
        kings.push({ key: awardKey, title: `${gender === 'male' ? '\u7537\u5b50' : '\u5973\u5b50'}${category.title}`, requiredEvents: category.take, awards: applyCeremonyCheckin(candidates, awardKey, decisions, 6) });
      });
    });

    const people = new Map();
    valid.forEach(result => people.set(keyOf(result.participant), result.participant));
    const coaches = new Map();
    people.forEach(person => {
      if (!person.coach) return;
      const name = person.coach.trim();
      if (!coaches.has(name)) coaches.set(name, { recipientKey: name, name, score: 0, schoolName: person.schoolName || '' });
      coaches.get(name).score += 1;
    });
    const specialAwards = {
      excellentCoaches: [...coaches.values()].sort((a, b) => b.score - a.score),
      wudeAthletes: [...people.values()].filter(person => person.isCheckedIn || person.checkInStatus === 'checked').map(person => ({ recipientKey: keyOf(person), name: person.name, schoolName: person.schoolName || '' })),
      wudeTeams: ranked([...teamPoints.values()]).map(item => ({ recipientKey: item.recipientKey, name: item.name, score: item.score }))
    };
    Object.entries(specialAwards).forEach(([key, entries]) => entries.forEach(entry => { entry.ceremonyStatus = decisions.get(`${key}|${entry.recipientKey}`)?.status || 'pending'; }));

    res.json({ success: true, data: { competition: { _id: competition._id, name: competition.name }, eventAwards, teamAwards, kings, specialAwards } });
  } catch (error) { next(error); }
};

exports.updateAwardConfirmation = async (req, res, next) => {
  try {
    const { awardKey, recipientKey, recipientName, status } = req.body;
    if (!awardKey || !recipientKey || !['pending', 'checked_in', 'forfeited', 'confirmed'].includes(status)) {
      return res.status(400).json({ success: false, message: '\u5956\u9879\u786e\u8ba4\u53c2\u6570\u4e0d\u6b63\u786e' });
    }
    const item = await AwardConfirmation.findOneAndUpdate(
      { competition: req.params.competitionId, awardKey, recipientKey },
      { recipientName, status, updatedBy: req.user._id, updatedAt: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: item });
  } catch (error) { next(error); }
};
