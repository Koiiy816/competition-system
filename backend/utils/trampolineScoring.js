const { getCompetitionSportType, SPORT_TYPES } = require('./competitionType');

const isSmallNetSchedule = (competition, schedule) => getCompetitionSportType(competition) === SPORT_TYPES.TRAMPOLINE
  && /小网|蹦床操/.test(String(schedule?.name || ''));

const applyTrampolineJudgeCount = (competition, schedule) => {
  const type = getTrampolineScoringType(competition, schedule);
  if (type) schedule.judgeCount = type === 'small' ? 2 : 7;
  return schedule;
};

const getTrampolineScoringType = (competition, schedule) => {
  if (getCompetitionSportType(competition) !== SPORT_TYPES.TRAMPOLINE) return null;
  if (isSmallNetSchedule(competition, schedule)) return 'small';
  return /大网/.test(String(schedule?.name || '')) ? 'large' : null;
};

const calculateTrampolineScore = (scores, deduction, type) => {
  const technical = scores.slice(0, type === 'large' ? 4 : 2);
  if (technical.length !== (type === 'large' ? 4 : 2)
    || technical.some(value => value === '' || value == null || !Number.isFinite(Number(value)))) return 0;
  const values = technical.map(Number).sort((a, b) => a - b);
  const counted = type === 'large' ? values.slice(1, -1) : values;
  return Math.round((counted.reduce((sum, value) => sum + value, 0) - Number(deduction || 0)) * 100) / 100;
};

const getTrampolineJudgeIndex = (user, type) => {
  const name = String(user.name || user.username || '').trim();
  const named = name.match(/(?:^|[^A-Za-z])([EDTH])\s*([1-4])(?:\D|$)/i);
  if (named) {
    const role = named[1].toUpperCase();
    const number = Number(named[2]);
    if (role === 'E' && number <= (type === 'large' ? 4 : 2)) return number - 1;
    if (type === 'large' && number === 1) return { D: 4, T: 5, H: 6 }[role] ?? -1;
    return -1;
  }
  const number = Number(name.match(/\d+/)?.[0]);
  return number >= 1 && number <= (type === 'large' ? 7 : 2) ? number - 1 : -1;
};

module.exports = { isSmallNetSchedule, applyTrampolineJudgeCount, getTrampolineScoringType, calculateTrampolineScore, getTrampolineJudgeIndex };
