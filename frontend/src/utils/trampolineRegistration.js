import { isTrampolineCompetition } from './competitionType.js';

export const getParticipantGroupTitle = (competition, group, bySchool = false) =>
  bySchool ? group.schoolName || group.displayName || '未知单位'
    : isTrampolineCompetition(competition) ? getEventDisplayName(competition, { name: group.event })
    : group.displayName || group.event || '未分类项目';

export const getAgeGroupDisplayName = (competition, group) => {
  const name = typeof group === 'string' ? group : group?.name || '';
  return isTrampolineCompetition(competition) ? name.replace(/^(?:混合集体\s*)?(?:男子|女子)?(?:大网|小网)/, '') : name;
};

export const getScheduleDisplayName = (competition, schedule) => {
  const name = schedule?.name || '';
  if (!isTrampolineCompetition(competition)) return name;
  const group = name.match(/(?:大网|小网)?(U\d+组|小学组|幼儿组)/)?.[1];
  if (!group) return name;
  if (name.includes('蹦床操')) return `${group} 蹦床操`;
  const category = name.includes('小网') ? '小网' : name.includes('大网') ? '大网' : '';
  if (!category) return name;
  const gender = name.match(/男子|女子/)?.[0] || '';
  return category === '小网' ? `${group} 小网${gender}个人` : [group, gender, '大网个人'].filter(Boolean).join(' ');
};

// 保留旧项目名作为报名关联键，显示时将组别放在独立控件中。
export const getEventDisplayName = (competition, event) => {
  let name = event.displayName || event.name || '';
  if (!isTrampolineCompetition(competition)) return name;
  const category = event.category || name.match(/^(大网|小网)/)?.[0] || '';
  const groups = (event.ageGroups?.length ? event.ageGroups : name.match(/(?:大网|小网)?(?:U\d+组|小学组|幼儿组)/g) || [])
    .map(group => typeof group === 'string' ? group : group.name);
  for (const group of groups.sort((a, b) => b.length - a.length)) {
    name = name.replace(group, category && group.startsWith(category) ? category : '');
  }
  return name.replace(/^小网(?=蹦床操)/, '').replace(/蹦床个人/g, '个人').trim();
};

export const getTrampolineScoringOptions = (competition, schedule) => {
  const trampoline = isTrampolineCompetition(competition);
  const name = String(schedule?.name || '');
  const scoringType = trampoline && /小网|蹦床操/.test(name) ? 'small'
    : trampoline && /大网/.test(name) ? 'large' : null;
  const judgeLabels = scoringType === 'large'
    ? ['E1\n技术', 'E2\n技术', 'E3\n技术', 'E4\n技术', 'D分\n难度', 'T分\n高度', 'H分\n位移']
    : scoringType === 'small' ? ['E1\n技术', 'E2\n技术'] : null;
  return { scoringType, judgeLabels, hideParticipantName: trampoline && name.includes('蹦床操') };
};

export const calculateTrampolineScore = (scores, deduction, type) => {
  const technical = scores.slice(0, type === 'large' ? 4 : 2);
  if (technical.length !== (type === 'large' ? 4 : 2)
    || technical.some(value => value === '' || value == null || !Number.isFinite(Number(value)))) return 0;
  const values = technical.map(Number).sort((a, b) => a - b);
  const counted = type === 'large' ? values.slice(1, -1) : values;
  return Math.round((counted.reduce((sum, value) => sum + value, 0) - Number(deduction || 0)) * 100) / 100;
};

export const getTrampolineJudgeIndex = (user, type) => {
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


// 蹦床大网、小网和蹦床操的出生日期区间相互重叠，须按每个项目匹配组别。
export const getTrampolineEventGroup = (competition, event, birthDateValue) => {
  const birthDate = String(birthDateValue || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > new Date().toISOString().slice(0, 10)) return '';
  return (competition.ageGroups || []).find(group =>
    event.ageGroups?.includes(group.name)
    && (!group.birthDateStart || birthDate >= String(group.birthDateStart).slice(0, 10))
    && (!group.birthDateEnd || birthDate <= String(group.birthDateEnd).slice(0, 10))
  )?.name || '';
};

export const getTrampolineEvents = (competition, birthDate, gender) => (competition.events || []).filter(event =>
  getTrampolineEventGroup(competition, event, birthDate)
  && ['male', 'female'].includes(gender)
  && (!event.genderRestriction || event.genderRestriction === 'both' || event.genderRestriction === gender)
).map(event => ({
  ...event,
  displayName: getEventDisplayName(competition, event),
  matchedGroup: getTrampolineEventGroup(competition, event, birthDate)
}));
