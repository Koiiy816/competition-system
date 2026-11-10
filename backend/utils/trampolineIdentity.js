const { createHash } = require('crypto');

const normalize = value => String(value || '').replace(/\s+/g, '').toUpperCase();

const getTrampolineDocumentKey = idCard => createHash('sha256').update(normalize(idCard)).digest('hex');

const getTrampolineIdentityDetails = row => {
  const birth = row.birthDate ? new Date(row.birthDate) : null;
  return { name: normalize(row.name), gender: String(row.gender || '').trim().toLowerCase(),
    birthDate: birth && !Number.isNaN(birth.getTime()) ? birth.toISOString().slice(0, 10) : '' };
};

const findTrampolineIdentityConflict = (rows, existing = []) => {
  const requested = new Map(rows.map(row => [normalize(row.idCard), row]));
  const identities = new Map();
  for (const row of [...existing, ...rows]) {
    const key = normalize(row.idCard);
    if (!key || row.isVirtualTeam || !requested.has(key)) continue;
    const details = getTrampolineIdentityDetails(row);
    const previous = identities.get(key) || {};
    const fields = [['name', '姓名'], ['gender', '性别'], ['birthDate', '出生日期']];
    const conflicts = fields.filter(([field]) => previous[field] && details[field] && previous[field] !== details[field]);
    if (conflicts.length) return `${requested.get(key).name || '当前选手'}的证件号码已绑定其他${conflicts.map(([, label]) => label).join('、')}，请核对资料；如需更正，请联系管理员`;
    identities.set(key, Object.fromEntries(fields.map(([field]) => [field, previous[field] || details[field]])));
  }
  return '';
};

// 与报名页面一致，仅从校验码及日期有效的18位证件中识别生日。
const parseChineseResidentIdentityNumber = input => {
  const value = normalize(input);
  if (!/^\d{17}[0-9X]$/.test(value)) return null;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  if (codes[weights.reduce((sum, weight, index) => sum + Number(value[index]) * weight, 0) % 11] !== value[17]) return null;
  const year = Number(value.slice(6, 10)), month = Number(value.slice(10, 12)), day = Number(value.slice(12, 14));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1800 || year > 2099 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { birthDate: `${value.slice(6, 10)}-${value.slice(10, 12)}-${value.slice(12, 14)}` };
};

const getTrampolineRegistrationKey = (competitionId, row) => {
  const fields = [row.name, row.gender, row.idCard, row.event].map(normalize);
  if (row.isVirtualTeam || fields.some(value => !value)) return undefined;
  return createHash('sha256').update(JSON.stringify([String(competitionId), ...fields])).digest('hex');
};

const findTrampolineDuplicate = (rows, existing = []) => {
  const keys = new Set(existing.filter(row => !row.isVirtualTeam).map(row => getTrampolineRegistrationKey('', row)).filter(Boolean));
  for (const row of rows) {
    const key = getTrampolineRegistrationKey('', row);
    if (!key) continue;
    if (keys.has(key)) return `${row.name}已报名“${row.event}”，同一姓名、性别和证件号码不能重复报名同一项目`;
    keys.add(key);
  }
  return '';
};

const isTrampolineDuplicateError = error => error?.code === 11000
  && (error.keyPattern?.trampolineRegistrationKey || String(error.message).includes('trampolineRegistrationKey'));

const getTrampolineBirthDateError = row => {
  const identity = parseChineseResidentIdentityNumber(row.idCard);
  const date = new Date(row.birthDate);
  if (identity && (!row.birthDate || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== identity.birthDate)) {
    return `出生日期必须与证件号码识别的出生日期（${identity.birthDate}）一致，请更正证件号码`;
  }
  return '';
};

module.exports = { parseChineseResidentIdentityNumber, getTrampolineRegistrationKey, findTrampolineDuplicate, isTrampolineDuplicateError, getTrampolineBirthDateError,
  getTrampolineDocumentKey, getTrampolineIdentityDetails, findTrampolineIdentityConflict };
