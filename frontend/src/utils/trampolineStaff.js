export const getTrampolineAthleteCount = participants => new Set(participants
  .map(row => String(row.idCard || '').replace(/\s+/g, '').toUpperCase()).filter(Boolean)).size;

export const findTrampolineIdentityConflict = rows => {
  const normalize = value => String(value || '').replace(/\s+/g, '').toUpperCase();
  const identities = new Map();
  for (const row of rows) {
    const key = normalize(row.idCard);
    const details = [normalize(row.name), normalize(row.gender), String(row.birthDate || '').slice(0, 10)];
    const previous = identities.get(key);
    if (previous) {
      const conflicts = ['姓名', '性别', '出生日期'].filter((_, index) => previous[index] !== details[index]);
      if (conflicts.length) return `${row.name}的证件号码已绑定其他${conflicts.join('、')}，请核对资料；如需更正，请联系管理员`;
    }
    if (key) identities.set(key, details);
  }
  return '';
};

export const findTrampolineDuplicate = rows => {
  const keys = new Set();
  for (const row of rows) {
    const key = JSON.stringify([row.name, row.gender, row.idCard, row.event]
      .map(value => String(value || '').replace(/\s+/g, '').toUpperCase()));
    if (keys.has(key)) return `${row.name}已报名“${row.event}”，同一姓名、性别和证件号码不能重复报名同一项目`;
    keys.add(key);
  }
  return '';
};

export const getTrampolineCoachLimit = athleteCount => Math.ceil(athleteCount / 5);

export const getFilledTrampolineCoaches = coaches => coaches.filter(person =>
  String(person?.name || '').trim() || String(person?.phone || '').trim());

export const validateTrampolineStaff = (staff, athleteCount) => {
  const valid = person => typeof (person?.name ?? '') === 'string' && (person?.name ?? '').trim().length <= 50
    && typeof (person?.phone ?? '') === 'string' && (person?.phone ?? '').trim().length <= 30;
  if (!athleteCount) return '请先添加运动员';
  if (!valid(staff?.leader)) return '领队姓名最多50字，电话最多30字，请使用文本填写';
  if (staff?.coaches != null && !Array.isArray(staff.coaches)) return '教练资料格式不正确';
  const rows = staff?.coaches || [];
  const invalid = rows.findIndex(coach => !valid(coach));
  if (invalid !== -1) return `教练${invalid + 1}姓名最多50字，电话最多30字，请使用文本填写`;
  const coaches = getFilledTrampolineCoaches(rows);
  const limit = getTrampolineCoachLimit(athleteCount);
  if (coaches.length > limit) return `${athleteCount}名运动员最多可报${limit}名教练，当前已填${coaches.length}名，请删除超额教练`;
  const keys = coaches.map(coach => `${(coach.name || '').trim().toLowerCase()}|${(coach.phone || '').trim()}`);
  if (new Set(keys).size !== keys.length) return '请勿重复添加同一名教练';
  return '';
};
