const MIXED_PATTERN = /男女混合|混双|混合/;
const MALE_PATTERN = /男子|男童/;
const FEMALE_PATTERN = /女子|女童/;

function normalizeParticipantGender(value) {
  const gender = String(value || '').trim().toLowerCase();
  if (['male', 'm', '男', '男性'].includes(gender)) return 'male';
  if (['female', 'f', '女', '女性'].includes(gender)) return 'female';
  if (['mixed', 'both', '混合', '男女混合'].includes(gender)) return 'mixed';
  return 'unknown';
}

// 项目名称优先于报名人的性别：混合项目中的任一成员都不能把项目变成男/女子项目。
function getScheduleGender({ eventName, eventConfig, participantGender } = {}) {
  const event = String(eventName || '').trim();
  if (MIXED_PATTERN.test(event)) return 'mixed';
  if (eventConfig?.genderRestriction === 'male' || MALE_PATTERN.test(event)) return 'male';
  if (eventConfig?.genderRestriction === 'female' || FEMALE_PATTERN.test(event)) return 'female';
  return normalizeParticipantGender(participantGender);
}

function hasGenderInEventName(value) {
  const event = String(value || '').trim();
  return MIXED_PATTERN.test(event) || MALE_PATTERN.test(event) || FEMALE_PATTERN.test(event);
}

function genderLabel(gender) {
  return gender === 'male' ? '男子' : gender === 'female' ? '女子' : '';
}

function formatScheduleName({ ageGroup, eventName, eventConfig, participantGender, gender } = {}) {
  const age = String(ageGroup || '未知组别').trim();
  const event = String(eventName || '未知项目').trim();
  const resolvedGender = gender || getScheduleGender({ eventName: event, eventConfig, participantGender });
  // 项目自身已带性别词时不再重复追加；混合项目也始终保留原项目全名。
  const prefix = hasGenderInEventName(event) ? '' : genderLabel(resolvedGender);
  return [age, prefix, event].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

// 用于 Excel/同步匹配。可同时识别新格式和旧的“U10组 男子 男子跳台”格式。
function parseScheduleIdentity(name, participantGender) {
  const displayName = String(name || '').replace(/[（(].*?[）)]/g, '').trim();
  const ages = [...displayName.matchAll(/U(\d+)/gi)].map((match) => match[1]);
  const gender = getScheduleGender({ eventName: displayName, participantGender });
  const event = displayName
    .replace(/U\d+(?:[-/]U\d+)*组?/gi, '')
    .replace(/男女混合|混双|混合|男子|女子|男童|女童/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { displayName, ages, gender, event };
}

module.exports = {
  normalizeParticipantGender,
  getScheduleGender,
  formatScheduleName,
  parseScheduleIdentity
};
