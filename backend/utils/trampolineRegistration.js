const dateOnly = value => value ? new Date(value).toISOString().slice(0, 10) : '';

const validateTrampolineRegistration = (competition, body) => {
  const event = competition.events?.find(item => item.name === String(body.event || '').trim());
  if (!event) return '所选比赛项目不属于本次比赛，请重新选择';
  const birth = new Date(body.birthDate);
  if (!body.birthDate || Number.isNaN(birth.getTime()) || birth > new Date()) return '请填写有效的出生日期';
  if (!['male', 'female'].includes(body.gender)) return '请选择运动员性别';
  if (event.genderRestriction !== 'both' && event.genderRestriction && event.genderRestriction !== body.gender) return '所选项目不接受当前性别报名';
  const groupName = String(body.ageGroup || body.grade || '').trim();
  const group = competition.ageGroups?.find(item => item.name === groupName && event.ageGroups.includes(item.name));
  const birthDate = dateOnly(birth);
  if (!group || (group.birthDateStart && birthDate < dateOnly(group.birthDateStart)) || (group.birthDateEnd && birthDate > dateOnly(group.birthDateEnd))) return '出生日期不符合所选项目的年龄组别';
  if (body.type !== 'individual') return '请逐名登记运动员，蹦床操按同单位、同项目及队伍编号组成团体';
  if (!String(body.schoolName || '').trim()) return '请填写参赛单位，个人参赛可填写个人';
  return null;
};

module.exports = { validateTrampolineRegistration };
