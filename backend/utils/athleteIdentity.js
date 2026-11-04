const { randomUUID, createHash } = require('crypto');
const AthleteIdentity = require('../models/AthleteIdentity');

const fail = (message, statusCode = 400) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const dateOnly = value => value ? new Date(value).toISOString().slice(0, 10) : '';
const normalized = value => String(value || '').trim();
const verifyDetails = (identity, data) => {
  if (identity.name !== normalized(data.name) ||
      (identity.gender && identity.gender !== data.gender) ||
      (identity.birthDate && dateOnly(identity.birthDate) !== dateOnly(data.birthDate)) ||
      (identity.idCard && normalized(identity.idCard).toUpperCase() !== normalized(data.idCard).toUpperCase())) {
    fail('参赛者资料与已有编号不一致，请核对姓名、性别、出生日期和证件信息，或联系管理员');
  }
};
async function resolveAthleteNumber(data, user, { allowOwnerSelection = false } = {}) {
  const number = data.athleteNumber;
  if (number !== undefined && typeof number !== 'string') fail('参赛者编号必须为字符串');
  const schoolName = String(data.schoolName || '').trim();
  const name = String(data.name || '').trim();
  if (!schoolName || !name) fail('分配参赛者编号需要姓名和所属单位');
  if (number?.trim()) {
    const identity = await AthleteIdentity.findOne({ number: number.trim(), competition: data.competition, schoolName }).select('+idCard');
    if (!identity) fail('参赛者编号不存在或不属于该比赛、单位');
    if (allowOwnerSelection && user.roles?.some(role => ['admin', 'chief_referee'].includes(role))) data.user = identity.user;
    if (String(identity.user) !== String(data.user)) fail('参赛者编号不属于该报名账号', 403);
    verifyDetails(identity, data);
    return identity.number;
  }
  const idCard = normalized(data.idCard).toUpperCase();
  if (idCard) {
    const escaped = idCard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = await AthleteIdentity.find({ competition: data.competition, user: data.user,
      schoolName, name, gender: data.gender, idCard: new RegExp(`^${escaped}$`, 'i') })
      .select('+idCard').limit(2);
    if (matches.length > 1) fail('存在多个相同证件、姓名和性别的人员编号，请联系管理员核对，不能重复新增', 409);
    if (matches.length === 1) {
      verifyDetails(matches[0], data);
      return matches[0].number;
    }
  }
  // 证件、姓名、性别和单位构成稳定请求键，跨页面及并发提交也复用编号。
  const requestKey = idCard ? 'auto-' + createHash('sha256')
    .update(JSON.stringify([schoolName, name, data.gender, idCard])).digest('hex')
    : data.athleteRequestKey || randomUUID();
  if (typeof requestKey !== 'string' || requestKey.length > 100) fail('人员关联请求标识无效');
  const filter = { competition: data.competition, user: data.user, requestKey };
  let identity;
  try {
    identity = await AthleteIdentity.findOneAndUpdate(filter,
      { $setOnInsert: { name, schoolName, gender: data.gender, birthDate: data.birthDate || undefined,
        idCard: normalized(data.idCard), number: `AT-${randomUUID()}` } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }).select('+idCard');
  } catch (error) {
    if (error.code !== 11000) throw error;
    identity = await AthleteIdentity.findOne(filter).select('+idCard');
    if (!identity) throw error;
  }
  if (identity.name !== name || identity.schoolName !== schoolName) fail('同一人员请求标识不能用于不同人员或单位');
  verifyDetails(identity, data);
  return identity.number;
}

module.exports = { resolveAthleteNumber };
