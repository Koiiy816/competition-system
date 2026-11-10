const { getTrampolineBirthDateError } = require('./trampolineIdentity');
const dateOnly = value => value ? new Date(value).toISOString().slice(0, 10) : '';

const validateTrampolineRegistration = (competition, body) => {
  const event = competition.events?.find(item => item.name === String(body.event || '').trim());
  if (!event) return '所选比赛项目不属于本次比赛，请重新选择';
  const birth = new Date(body.birthDate);
  if (!body.birthDate || Number.isNaN(birth.getTime()) || birth > new Date()) return '请填写有效的出生日期';
  const identityError = getTrampolineBirthDateError(body);
  if (identityError) return identityError;
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

const normalizeTrampolineStaff = (staff, participants) => {
  if (!Array.isArray(participants) || !participants.length) throw new Error('请先添加运动员');
  const missing = participants.findIndex(row => !String(row?.idCard || '').trim());
  if (missing !== -1) throw new Error(`第${missing + 1}条报名（${participants[missing]?.name || '未填写姓名'}）：请填写运动员证件号码`);
  const count = new Set(participants.map(row => String(row.idCard).replace(/\s+/g, '').toUpperCase())).size;
  const person = (value, label) => {
    const name = value?.name ?? '', phone = value?.phone ?? '';
    if (typeof name !== 'string' || name.trim().length > 50 || typeof phone !== 'string' || phone.trim().length > 30) {
      throw new Error(`${label}姓名最多50字，电话最多30字，请使用文本填写`);
    }
    return { name: name.trim(), phone: phone.trim() };
  };
  const leader = person(staff?.leader, '领队');
  if (staff?.coaches != null && !Array.isArray(staff.coaches)) throw new Error('教练资料格式不正确');
  const coaches = (staff?.coaches || []).map((value, index) => person(value, `教练${index + 1}`))
    .filter(value => value.name || value.phone);
  const limit = Math.ceil(count / 5);
  if (coaches.length > limit) throw new Error(`${count}名运动员最多可报${limit}名教练，当前已填${coaches.length}名`);
  if (new Set(coaches.map(value => `${value.name.toLowerCase()}|${value.phone}`)).size !== coaches.length) throw new Error('请勿重复添加同一名教练');
  return { leader, coaches };
};

module.exports = { validateTrampolineRegistration, normalizeTrampolineStaff };
